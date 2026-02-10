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
      const res = await fetch('/api/ai-agent-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, roomId, userId, userName, ...extra }),
      });
      return res.json();
    },
    [roomId, userId, userName]
  );

  const fetchLockStatus = useCallback(async () => {
    try {
      const data: LockStatus = await lockApi('status');
      setLockStatus(data);
    } catch {
      // ignore
    }
  }, [lockApi]);

  // Initial Setup
  useEffect(() => {
    if (!isInitialized) return;

    if (!isLoggedIn || !profile) {
      toast({
        title: 'Authentication Required',
        description: 'Please log in with LINE to use AI Agent Bridge',
        variant: 'destructive',
      });
      navigate('/setup');
      return;
    }

    const init = async () => {
      try {
        console.log('[AIAgentBridge] Starting initial connection');
        
        // 1. Listeners
        setupAIAgentListeners();
        
        // 2. Join PlanetKit
        await joinPlanetKitConference();
        
        // 3. Update UI state
        setIsConnecting(false);
        callStartTimeRef.current = Date.now();
        startDurationTimer();
        
        // 4. Initial status check
        const initialStatus: LockStatus = await lockApi('status');
        setLockStatus(initialStatus);
        
        // 5. Start maintenance timers
        startPolling();

        // 6. Auto-activate if room is empty (First user experience)
        if (!initialStatus.locked) {
          console.log('[AIAgentBridge] Room is empty, auto-activating AI');
          await activateAI();
        }

      } catch (error: any) {
        console.error('[AIAgentBridge] Initialization failed:', error);
        toast({
          title: 'Connection Failed',
          description: error.message || 'Failed to initialize AI Agent Bridge',
          variant: 'destructive',
        });
        setTimeout(() => navigate('/setup'), 3000);
      }
    };

    init();

    return () => {
      stopDurationTimer();
      stopPolling();
      stopHeartbeat();
      cleanupAIAgent();
      cleanupPlanetKit();
      cleanupAudioBridge();
      if (aiActiveRef.current) {
        lockApi('release').catch(() => {});
      }
    };
  }, [isInitialized, isLoggedIn, profile]);

  const startPolling = () => {
    if (!pollTimerRef.current) {
      pollTimerRef.current = setInterval(fetchLockStatus, POLL_INTERVAL_MS);
    }
  };

  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const startHeartbeat = () => {
    if (!heartbeatTimerRef.current) {
      heartbeatTimerRef.current = setInterval(async () => {
        try {
          const data = await lockApi('heartbeat');
          if (!data.alive) {
            console.warn('[AIAgentBridge] Heartbeat failed, deactivating AI');
            deactivateAI();
          }
        } catch { /* ignore */ }
      }, HEARTBEAT_INTERVAL_MS);
    }
  };

  const stopHeartbeat = () => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  };

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
    const result = await lockApi('acquire');
    if (!result.acquired) {
      toast({
        title: language === 'ko' ? 'AI 활성화 불가' : 'Cannot Activate AI',
        description: language === 'ko' 
          ? `이미 다른 참여자가 AI를 활성화 하였습니다 (활성화 유저: ${result.holder?.userName})`
          : `AI is already activated by ${result.holder?.userName}`,
        variant: 'destructive',
      });
      await fetchLockStatus();
      return;
    }

    try {
      await setupAudioGraph(); 
      await createAudioBridge();
      aiActiveRef.current = true;
      setAiActive(true);
      startHeartbeat();
      toast({
        title: language === 'ko' ? 'AI 활성화됨' : 'AI Activated',
        description: language === 'ko' ? 'Gemini AI와 대화할 수 있습니다' : 'Gemini AI is ready',
      });
    } catch (err: any) {
      console.error('[AIAgentBridge] activateAI failed:', err);
      await lockApi('release');
      cleanupAudioBridge();
      toast({ title: 'AI Connection Failed', description: err.message, variant: 'destructive' });
    }
  };

  const deactivateAI = async () => {
    stopHeartbeat();
    cleanupAIBridge();
    cleanupAudioBridge();
    
    if (conferenceRef.current?.setCustomMediaStream) {
      try { await conferenceRef.current.setCustomMediaStream(null); } catch (e) {}
    }

    await lockApi('release');
    aiActiveRef.current = false;
    setAiActive(false);
    await fetchLockStatus();
    toast({
      title: language === 'ko' ? 'AI 비활성화됨' : 'AI Deactivated',
      description: language === 'ko' ? 'Gemini AI 연결이 해제되었습니다' : 'Gemini AI disconnected',
    });
  };

  const setupAudioGraph = async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: 48000 });
    }
    const audioCtx = audioContextRef.current;
    if (audioCtx.state === 'suspended') await audioCtx.resume();

    if (!mediaStreamDestRef.current) {
      mediaStreamDestRef.current = audioCtx.createMediaStreamDestination();
    }
    
    if (!analyserRef.current) {
      analyserRef.current = audioCtx.createAnalyser();
      analyserRef.current.fftSize = 256;
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkInterruption = () => {
        if (!analyserRef.current || !aiActiveRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / bufferLength;

        if (average > 35 && speakingSourcesRef.current.length > 0) {
          console.log('[AIAgentBridge] Interruption detected');
          speakingSourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
          speakingSourcesRef.current = [];
          nextStartTimeRef.current = audioCtx.currentTime;
        }
        requestAnimationFrame(checkInterruption);
      };
      requestAnimationFrame(checkInterruption);
    }
  };

  const createAudioBridge = async () => {
    const audioCtx = audioContextRef.current!;
    const dest = mediaStreamDestRef.current!;

    // 1. Mic -> PlanetKit Dest & Analyser
    const micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    micStreamRef.current = micStream;
    const micSource = audioCtx.createMediaStreamSource(micStream);
    micSource.connect(dest);
    micSource.connect(analyserRef.current!);

    // 2. AI Connect
    const systemPrompt = language === 'ko'
      ? '당신은 그룹 통화에 참여한 AI 비서입니다. 한국어로 자연스럽고 친근하게 대화하세요.'
      : 'You are an AI assistant in a group call. Respond naturally in English.';
    await aiAgentService.connect({ language, voice, systemPrompt });

    // 3. Inject Mixed Stream to PlanetKit
    if (conferenceRef.current?.setCustomMediaStream) {
      await conferenceRef.current.setCustomMediaStream(dest.stream);
    }

    // 4. Room -> AI Hearing
    if (audioElementRef.current) {
      const roomStream = (audioElementRef.current as any).captureStream?.() || (audioElementRef.current as any).mozCaptureStream?.();
      if (roomStream) {
        aiAgentService.addAudioSource(roomStream);
        const roomSource = audioCtx.createMediaStreamSource(roomStream);
        roomSource.connect(analyserRef.current!);
      }
    }
  };

  // Listeners & Cleanup
  const handleStateChange = (s: AIAgentState) => setAgentState(s);
  const handleError = (e: string) => toast({ title: 'AI Error', description: e, variant: 'destructive' });
  const handleTranscript = ({ text, isFinal }: { text: string; isFinal: boolean }) => {
    setTranscript(prev => isFinal ? prev + '\n' + text : prev + text);
  };

  const handleAudioOutput = (audioData: Float32Array) => {
    if (!audioContextRef.current || !mediaStreamDestRef.current) return;
    try {
      const audioCtx = audioContextRef.current;
      const buffer = audioCtx.createBuffer(1, audioData.length, 24000);
      buffer.getChannelData(0).set(audioData);

      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      speakingSourcesRef.current.push(source);
      source.onended = () => {
        speakingSourcesRef.current = speakingSourcesRef.current.filter(s => s !== source);
      };

      const now = audioCtx.currentTime;
      if (nextStartTimeRef.current < now) nextStartTimeRef.current = now + 0.05;
      source.start(nextStartTimeRef.current);
      nextStartTimeRef.current += buffer.duration;

      source.connect(mediaStreamDestRef.current);
      source.connect(audioCtx.destination);
    } catch (err) { console.error('[AIAgentBridge] Playback error:', err); }
  };

  const setupAIAgentListeners = () => {
    aiAgentService.on('stateChange', handleStateChange);
    aiAgentService.on('error', handleError);
    aiAgentService.on('transcript', handleTranscript);
    aiAgentService.on('audioOutput', handleAudioOutput);
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
        evtConnected: () => { setConferenceConnected(true); setParticipantCount(1); },
        evtDisconnected: () => { setConferenceConnected(false); setParticipantCount(0); },
        evtPeerListUpdated: (info: any) => {
          const count = (info.addedPeers || []).length - (info.removedPeers || []).length;
          setParticipantCount(prev => prev + count);
        },
        evtError: (e: any) => toast({ title: 'Conference Error', description: e?.message, variant: 'destructive' }),
      },
    });
  };

  const cleanupAIBridge = () => {
    aiAgentService.disconnect();
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
  };

  const cleanupPlanetKit = async () => {
    if (conferenceRef.current?.leaveConference) {
      try { await conferenceRef.current.leaveConference(); } catch (e) {}
      conferenceRef.current = null;
    }
  };

  const cleanupAudioBridge = () => {
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    mediaStreamDestRef.current = null;
    analyserRef.current = null;
  };

  const startDurationTimer = () => {
    durationIntervalRef.current = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
    }, 1000);
  };

  const stopDurationTimer = () => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  };

  const formatDuration = (s: number): string => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStateDisplay = () => {
    if (!conferenceConnected) return { text: 'Conference Disconnected', color: 'text-red-400' };
    if (!aiActive) return { text: language === 'ko' ? 'AI 비활성화' : 'AI Inactive', color: 'text-gray-400' };
    switch (agentState) {
      case 'connecting': return { text: 'Connecting AI...', color: 'text-yellow-400' };
      case 'connected': return { text: 'AI Connected', color: 'text-green-400' };
      case 'listening': return { text: language === 'ko' ? 'AI 듣는 중...' : 'AI Listening...', color: 'text-blue-400' };
      case 'speaking': return { text: language === 'ko' ? 'AI 말하는 중...' : 'AI Speaking...', color: 'text-purple-400' };
      default: return { text: 'AI Disconnected', color: 'text-gray-400' };
    }
  };

  const isOccupiedByOther = lockStatus.locked && lockStatus.holder?.userId !== userId;
  const stateDisplay = getStateDisplay();

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex flex-col">
      <audio ref={audioElementRef} autoPlay playsInline className="hidden" />

      {isConnecting ? (
        <div className="flex-1 flex flex-center items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-16 h-16 animate-spin text-white" />
            <p className="text-white text-xl font-semibold">Connecting to room...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Top Bar */}
          <div className="fixed top-0 left-0 right-0 h-16 bg-black/30 backdrop-blur-sm border-b border-white/10 flex items-center justify-between px-4 z-10">
            <div className="flex flex-col">
              <span className="text-white font-semibold text-lg">AI Agent Bridge</span>
              <span className={`text-xs ${stateDisplay.color}`}>{stateDisplay.text}</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-white" />
                <span className="text-white text-sm">{participantCount}</span>
              </div>
              <span className="text-white font-mono text-sm">{formatDuration(callDuration)}</span>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto mt-16 mb-28 px-4 py-6">
            <div className="flex justify-center mb-8">
              <div className={`w-32 h-32 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 ${aiActive ? 'bg-gradient-to-br from-purple-500 to-pink-500' : 'bg-gray-600'} ${agentState === 'speaking' ? 'animate-pulse' : ''}`}>
                <Bot className="w-16 h-16 text-white" />
              </div>
            </div>

            <div className="text-center mb-6 text-white">
              <p className="text-lg font-medium">{userName}</p>
              <p className="text-gray-300 text-sm">Room: {roomId}</p>
            </div>

            {isOccupiedByOther && (
              <Card className="bg-orange-500/20 border-orange-500/30 p-4 mb-4 text-orange-200 text-sm">
                이미 다른 참여자가 AI를 활성화 하였습니다 (활성화 유저: {lockStatus.holder?.userName})
              </Card>
            )}

            {transcript && aiActive && (
              <Card className="bg-white/10 p-4 mb-4 text-white/90 text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">
                {transcript}
              </Card>
            )}

            <Card className="bg-white/5 p-4 mt-6 text-xs text-gray-300">
              <h3 className="text-white font-semibold mb-2">Bridge Status:</h3>
              <div className="flex justify-between"><span>AI Active:</span> <span className={aiActive ? 'text-green-400' : 'text-gray-400'}>{aiActive ? 'Active' : 'Inactive'}</span></div>
              <div className="flex justify-between"><span>Mic → AI + Room:</span> <span className={isMuted ? 'text-red-400' : 'text-green-400'}>{isMuted ? 'Muted' : 'Active'}</span></div>
              <div className="flex justify-between"><span>Room → AI:</span> <span className={aiActive && conferenceConnected ? 'text-green-400' : 'text-red-400'}>{aiActive && conferenceConnected ? 'Active' : 'Inactive'}</span></div>
            </Card>
          </div>

          {/* Controls */}
          <div className="fixed bottom-0 left-0 right-0 h-28 bg-black/30 backdrop-blur-sm border-t border-white/10 flex items-center justify-center gap-4 px-4">
            <Button size="lg" variant="ghost" onClick={handleToggleMute} className={`w-14 h-14 rounded-full ${isMuted ? 'bg-red-500/80' : 'bg-white/20'}`}>
              {isMuted ? <MicOff className="text-white" /> : <Mic className="text-white" />}
            </Button>

            <Button size="lg" onClick={handleToggleAI} disabled={isTogglingAI || isOccupiedByOther} className={`h-16 px-6 rounded-full font-semibold ${isOccupiedByOther ? 'bg-gray-600' : aiActive ? 'bg-purple-500' : 'bg-green-500'}`}>
              {isTogglingAI ? <Loader2 className="animate-spin mr-2" /> : aiActive ? <BotOff className="mr-2" /> : <Bot className="mr-2" />}
              {aiActive ? 'AI 비활성화' : 'AI 활성화'}
            </Button>

            <Button size="lg" onClick={handleEndCall} className="w-14 h-14 rounded-full bg-red-500"><PhoneOff className="text-white" /></Button>
          </div>
        </>
      )}
    </div>
  );
};

export default AIAgentBridgeMeeting;
