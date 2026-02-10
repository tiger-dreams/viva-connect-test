import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLiff } from '@/contexts/LiffContext';
import { aiAgentService, AIAgentState } from '@/services/ai-agent-service';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Mic, MicOff, PhoneOff, Loader2, Users, Bot, BotOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as PlanetKitEval from '@line/planet-kit/dist/planet-kit-eval';

type LockStatus =
  | { locked: false; holder: null }
  | { locked: true; holder: { userId: string; userName: string } };

const HEARTBEAT_INTERVAL_MS = 10_000;
const POLL_INTERVAL_MS = 5_000;

export const AIAgentBridgeMeeting = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile, isLoggedIn, isInitialized } = useLiff();
  const { toast } = useToast();

  const language = (searchParams.get('lang') || 'ko') as 'ko' | 'en';
  const voice = searchParams.get('voice') || 'Kore';
  const roomId = searchParams.get('roomId') || 'ai-agent-room';

  const [agentState, setAgentState] = useState<AIAgentState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState<string>('');
  const [callDuration, setCallDuration] = useState(0);
  const [isConnecting, setIsConnecting] = useState(true);
  const [conferenceConnected, setConferenceConnected] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);

  const [aiActive, setAiActive] = useState(false);
  const [lockStatus, setLockStatus] = useState<LockStatus>({ locked: false, holder: null });
  const [isTogglingAI, setIsTogglingAI] = useState(false);

  const callStartTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const conferenceRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const audioElementRef = useRef<HTMLAudioElement>(null);
  const nextStartTimeRef = useRef<number>(0);
  const micStreamRef = useRef<MediaStream | null>(null);
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const aiActiveRef = useRef(false);
  const speakingSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const userId = profile?.userId || 'ai-bridge-user';
  const userName = profile?.displayName || 'User';

  const lockApi = useCallback(
    async (action: string, extra: Record<string, string> = {}) => {
      try {
        const res = await fetch('/api/ai-agent-lock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, roomId, userId, userName, ...extra }),
        });
        return await res.json();
      } catch (e) {
        console.error('[AIAgentBridge] Lock API error:', e);
        return { success: false };
      }
    },
    [roomId, userId, userName]
  );

  const fetchLockStatus = useCallback(async () => {
    const data: LockStatus = await lockApi('status');
    if (data) setLockStatus(data);
  }, [lockApi]);

  // Initial Logic
  useEffect(() => {
    if (!isInitialized) return;
    if (!isLoggedIn || !profile) {
      navigate('/setup');
      return;
    }

    const startSession = async () => {
      try {
        console.log('[AIAgentBridge] 1. Setting up listeners');
        setupAIAgentListeners();

        console.log('[AIAgentBridge] 2. Joining PlanetKit');
        await joinPlanetKitConference();
        
        console.log('[AIAgentBridge] 3. Initializing UI');
        setIsConnecting(false);
        callStartTimeRef.current = Date.now();
        startDurationTimer();
        
        // Polling and Auto-activation
        const status = await lockApi('status');
        setLockStatus(status);
        startPolling();

        if (!status.locked) {
          console.log('[AIAgentBridge] 4. Auto-activating AI');
          await activateAI();
        }
      } catch (error: any) {
        console.error('[AIAgentBridge] Initialization failed:', error);
        toast({ title: 'Join Failed', description: error.message, variant: 'destructive' });
        setTimeout(() => navigate('/setup'), 3000);
      }
    };

    startSession();

    return () => {
      stopDurationTimer();
      stopPolling();
      stopHeartbeat();
      cleanupAIAgent();
      cleanupPlanetKit();
      cleanupAudioBridge();
      if (aiActiveRef.current) lockApi('release').catch(() => {});
    };
  }, [isInitialized, isLoggedIn, profile]);

  const handleToggleAI = async () => {
    if (isTogglingAI) return;
    setIsTogglingAI(true);
    try {
      if (aiActive) await deactivateAI();
      else await activateAI();
    } finally {
      setIsTogglingAI(false);
    }
  };

  const activateAI = async () => {
    console.log('[AIAgentBridge] Attempting to acquire lock');
    const result = await lockApi('acquire');
    if (!result.acquired) {
      toast({ title: 'Notice', description: `AI is active by ${result.holder?.userName}` });
      return;
    }

    try {
      await createAudioBridge();
      aiActiveRef.current = true;
      setAiActive(true);
      startHeartbeat();
    } catch (err: any) {
      console.error('[AIAgentBridge] activation error:', err);
      await lockApi('release');
      cleanupAudioBridge();
    }
  };

  const deactivateAI = async () => {
    stopHeartbeat();
    cleanupAIBridge();
    cleanupAudioBridge();
    if (conferenceRef.current?.setCustomMediaStream) {
      await conferenceRef.current.setCustomMediaStream(null);
    }
    await lockApi('release');
    aiActiveRef.current = false;
    setAiActive(false);
    fetchLockStatus();
  };

  const createAudioBridge = async () => {
    // 1. Context Init
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: 48000 });
    }
    const audioCtx = audioContextRef.current;
    if (audioCtx.state === 'suspended') await audioCtx.resume();

    mediaStreamDestRef.current = audioCtx.createMediaStreamDestination();
    const dest = mediaStreamDestRef.current;

    // 2. High-Performance Mic Capture with GYM-NOISE FILTERS
    const micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    micStreamRef.current = micStream;
    
    const micSource = audioCtx.createMediaStreamSource(micStream);
    
    // Add Physical Filter for background music/humming (High Pass Filter)
    // Most music/ambient hum is in low frequencies. 
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 200; // Cut off sounds below 200Hz
    micSource.connect(filter);

    // 3. Connect to mixing and AI
    filter.connect(dest);
    
    // AI Connection (Pass the FILTERED stream to AI for better VAD)
    const systemPrompt = language === 'ko'
      ? '당신은 인공지능 비서 해밀입니다. 주변 소음이 있더라도 사용자의 말을 잘 파악하여 짧고 친근하게 대답하세요.'
      : 'I am Haemil, an AI. Please be concise.';
    
    await aiAgentService.connect({ language, voice, systemPrompt }, micStream);

    // 4. PlanetKit Outbound
    if (conferenceRef.current?.setCustomMediaStream) {
      await conferenceRef.current.setCustomMediaStream(dest.stream);
    }

    // 5. Room -> AI
    if (audioElementRef.current) {
      const roomStream = (audioElementRef.current as any).captureStream?.() || (audioElementRef.current as any).mozCaptureStream?.();
      if (roomStream) aiAgentService.addAudioSource(roomStream);
    }
  };

  // UI Handlers
  const handleToggleMute = () => {
    const newMuted = aiAgentService.toggleMute();
    setIsMuted(newMuted);
  };

  const handleEndCall = () => {
    navigate('/setup');
  };

  const setupAIAgentListeners = () => {
    aiAgentService.on('stateChange', setAgentState);
    aiAgentService.on('transcript', ({ text, isFinal }) => {
      setTranscript(prev => isFinal ? prev + '\n' + text : prev + text);
    });
    aiAgentService.on('audioOutput', (audioData) => {
      if (!audioContextRef.current || !mediaStreamDestRef.current) return;
      const audioCtx = audioContextRef.current;
      const buffer = audioCtx.createBuffer(1, audioData.length, 24000);
      buffer.getChannelData(0).set(audioData);
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      const now = audioCtx.currentTime;
      if (nextStartTimeRef.current < now) nextStartTimeRef.current = now + 0.05;
      source.start(nextStartTimeRef.current);
      nextStartTimeRef.current += buffer.duration;
      source.connect(mediaStreamDestRef.current);
      source.connect(audioCtx.destination);
    });
  };

  const joinPlanetKitConference = async () => {
    const serviceId = import.meta.env.VITE_PLANETKIT_EVAL_SERVICE_ID;
    const apiKey = import.meta.env.VITE_PLANETKIT_EVAL_API_KEY;
    const apiSecret = import.meta.env.VITE_PLANETKIT_EVAL_API_SECRET;
    const { generatePlanetKitToken } = await import('@/utils/token-generator');
    const accessToken = await generatePlanetKitToken(serviceId, apiKey, userId, roomId, 3600, apiSecret);

    const conference = new PlanetKitEval.Conference();
    conferenceRef.current = conference;

    await conference.joinConference({
      myId: userId, displayName: userName, myServiceId: serviceId, roomId, roomServiceId: serviceId,
      accessToken, mediaType: 'audio', mediaHtmlElement: { roomAudio: audioElementRef.current },
      delegate: {
        evtConnected: () => setConferenceConnected(true),
        evtDisconnected: () => setConferenceConnected(false),
        evtPeerListUpdated: (info: any) => {
          const count = (info.addedPeers || []).length - (info.removedPeers || []).length;
          setParticipantCount(prev => prev + count);
        },
      },
    });
  };

  // Timers and Cleanups
  const startPolling = () => { pollTimerRef.current = setInterval(fetchLockStatus, POLL_INTERVAL_MS); };
  const stopPolling = () => { clearInterval(pollTimerRef.current!); pollTimerRef.current = null; };
  const startHeartbeat = () => { heartbeatTimerRef.current = setInterval(async () => { const data = await lockApi('heartbeat'); if (!data.alive) deactivateAI(); }, HEARTBEAT_INTERVAL_MS); };
  const stopHeartbeat = () => { clearInterval(heartbeatTimerRef.current!); heartbeatTimerRef.current = null; };
  const startDurationTimer = () => { durationIntervalRef.current = setInterval(() => setCallDuration(d => d + 1), 1000); };
  const stopDurationTimer = () => { clearInterval(durationIntervalRef.current!); durationIntervalRef.current = null; };
  const cleanupAIAgent = () => aiAgentService.disconnect();
  const cleanupPlanetKit = async () => { if (conferenceRef.current?.leaveConference) await conferenceRef.current.leaveConference(); };
  const cleanupAIBridge = () => { if (micStreamRef.current) micStreamRef.current.getTracks().forEach(t => t.stop()); };
  const cleanupAudioBridge = () => { if (audioContextRef.current?.state !== 'closed') audioContextRef.current?.close(); };

  const formatDuration = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="h-screen w-screen bg-indigo-950 text-white flex flex-col overflow-hidden">
      {/* Hidden Room Audio - ALWAYS PRESENT TO PREVENT UI GLITCHES */}
      <audio ref={audioElementRef} autoPlay playsInline className="hidden" />

      {isConnecting ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-400" />
          <p className="text-xl font-medium animate-pulse">Entering Room...</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="h-16 px-4 flex items-center justify-between bg-black/20 border-b border-white/5">
            <div className="flex flex-col">
              <h1 className="font-bold">AI Agent Bridge</h1>
              <p className="text-[10px] text-indigo-300">{conferenceConnected ? 'Connected' : 'Reconnecting...'}</p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Users className="w-4 h-4" />
              <span>{participantCount}</span>
              <span className="font-mono bg-black/30 px-2 py-1 rounded">{formatDuration(callDuration)}</span>
            </div>
          </div>

          {/* Main Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="flex justify-center py-4">
              <div className={`w-36 h-36 rounded-full flex items-center justify-center shadow-[0_0_50px_-12px_rgba(168,85,247,0.5)] transition-all duration-500 ${aiActive ? 'bg-gradient-to-br from-indigo-500 to-purple-600 scale-100' : 'bg-gray-800 scale-90 opacity-50'}`}>
                <Bot className={`w-20 h-20 ${agentState === 'speaking' ? 'animate-bounce' : ''}`} />
              </div>
            </div>

            <div className="text-center">
              <h2 className="text-lg font-bold">{userName}</h2>
              <p className="text-sm text-indigo-300/70">Room ID: {roomId}</p>
            </div>

            {isOccupiedByOther && (
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 text-orange-200 text-xs text-center">
                AI is currently held by <span className="font-bold">{lockStatus.holder?.userName}</span>
              </div>
            )}

            {transcript && (
              <div className="bg-white/5 rounded-2xl p-4 text-sm text-white/80 leading-relaxed font-light whitespace-pre-wrap italic">
                "{transcript.slice(-200)}"
              </div>
            )}
          </div>

          {/* Bottom Bar */}
          <div className="h-32 px-6 flex items-center justify-center gap-6 bg-black/40 backdrop-blur-xl border-t border-white/5">
            <Button variant="ghost" onClick={handleToggleMute} className={`w-14 h-14 rounded-full ${isMuted ? 'bg-red-500/20 text-red-400' : 'bg-white/5'}`}>
              {isMuted ? <MicOff /> : <Mic />}
            </Button>

            <Button size="lg" onClick={handleToggleAI} disabled={isTogglingAI || isOccupiedByOther} className={`h-16 px-8 rounded-full font-bold shadow-lg transition-all ${isOccupiedByOther ? 'bg-gray-800 text-gray-500' : aiActive ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
              {isTogglingAI ? <Loader2 className="animate-spin mr-2" /> : aiActive ? <BotOff className="mr-2" /> : <Bot className="mr-2" />}
              {aiActive ? 'AI Sleep' : 'Wake AI'}
            </Button>

            <Button onClick={handleEndCall} className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 shadow-lg">
              <PhoneOff />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAgentBridgeMeeting;
