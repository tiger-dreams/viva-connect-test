import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLiff } from '@/contexts/LiffContext';
import { aiAgentService, AIAgentState } from '@/services/ai-agent-service';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, PhoneOff, Loader2, Users, Bot, BotOff, WifiOff } from 'lucide-react';
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

  // UI State — always visible, no loading gate
  const [agentState, setAgentState] = useState<AIAgentState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const [conferenceStatus, setConferenceStatus] = useState<'joining' | 'connected' | 'failed'>('joining');
  const [participantCount, setParticipantCount] = useState(1);
  const [aiActive, setAiActive] = useState(false);
  const [lockStatus, setLockStatus] = useState<LockStatus>({ locked: false, holder: null });
  const [isTogglingAI, setIsTogglingAI] = useState(false);

  const callStartTimeRef = useRef(Date.now());
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const conferenceRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const audioElementRef = useRef<HTMLAudioElement>(null);
  const nextStartTimeRef = useRef(0);
  const micStreamRef = useRef<MediaStream | null>(null);
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const aiActiveRef = useRef(false);

  const userId = profile?.userId || 'ai-bridge-user';
  const userName = profile?.displayName || 'User';

  // ────────────────────────────────────────────────────────
  // Lock API
  // ────────────────────────────────────────────────────────
  const lockApi = useCallback(async (action: string, extra: Record<string, string> = {}) => {
    try {
      const res = await fetch('/api/ai-agent-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, roomId, userId, userName, ...extra }),
      });
      return await res.json();
    } catch {
      return { success: false };
    }
  }, [roomId, userId, userName]);

  const fetchLockStatus = useCallback(async () => {
    const data = await lockApi('status');
    if (data) setLockStatus(data as LockStatus);
  }, [lockApi]);

  // ────────────────────────────────────────────────────────
  // Mount: kick off all initialization in parallel, UI shown immediately
  // ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isInitialized || !isLoggedIn || !profile) return;

    // Start duration timer immediately
    callStartTimeRef.current = Date.now();
    durationIntervalRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);

    // Setup AI listeners
    aiAgentService.on('stateChange', setAgentState);
    aiAgentService.on('transcript', ({ text, isFinal }) =>
      setTranscript(prev => isFinal ? prev + '\n' + text : prev + text)
    );
    aiAgentService.on('audioOutput', handleAudioOutput);

    // Start PlanetKit join in background — UI is already visible
    joinPlanetKitConference()
      .then(async () => {
        setConferenceStatus('connected');
        const status = await lockApi('status');
        setLockStatus(status as LockStatus);
        startPolling();
        if (!status.locked) {
          await activateAI();
        }
      })
      .catch((err) => {
        console.error('[AIAgentBridge] Join failed:', err);
        setConferenceStatus('failed');
        toast({ title: 'Connection Failed', description: err?.message, variant: 'destructive' });
      });

    return () => {
      clearInterval(durationIntervalRef.current!);
      clearInterval(pollTimerRef.current!);
      clearInterval(heartbeatTimerRef.current!);
      aiAgentService.disconnect();
      if (micStreamRef.current) micStreamRef.current.getTracks().forEach(t => t.stop());
      if (conferenceRef.current?.leaveConference) conferenceRef.current.leaveConference();
      if (audioContextRef.current?.state !== 'closed') audioContextRef.current?.close();
      if (aiActiveRef.current) lockApi('release').catch(() => {});
    };
  }, [isInitialized, isLoggedIn, profile]);

  // ────────────────────────────────────────────────────────
  // PlanetKit
  // ────────────────────────────────────────────────────────
  const joinPlanetKitConference = async () => {
    const serviceId = import.meta.env.VITE_PLANETKIT_EVAL_SERVICE_ID;
    const apiKey = import.meta.env.VITE_PLANETKIT_EVAL_API_KEY;
    const apiSecret = import.meta.env.VITE_PLANETKIT_EVAL_API_SECRET;
    const { generatePlanetKitToken } = await import('@/utils/token-generator');
    const accessToken = await generatePlanetKitToken(serviceId, apiKey, userId, roomId, 3600, apiSecret);

    const conference = new PlanetKitEval.Conference();
    conferenceRef.current = conference;

    await conference.joinConference({
      myId: userId, displayName: userName, myServiceId: serviceId,
      roomId, roomServiceId: serviceId,
      accessToken, mediaType: 'audio',
      mediaHtmlElement: { roomAudio: audioElementRef.current },
      delegate: {
        evtConnected: () => {
          setConferenceStatus('connected');
          setParticipantCount(1);
        },
        evtDisconnected: () => setConferenceStatus('failed'),
        evtPeerListUpdated: (info: any) => {
          const delta = (info.addedPeers?.length ?? 0) - (info.removedPeers?.length ?? 0);
          setParticipantCount(p => Math.max(1, p + delta));
        },
      },
    });
  };

  // ────────────────────────────────────────────────────────
  // Audio Bridge
  // ────────────────────────────────────────────────────────
  const createAudioBridge = async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: 48000 });
    }
    const audioCtx = audioContextRef.current;
    if (audioCtx.state === 'suspended') await audioCtx.resume();

    mediaStreamDestRef.current = audioCtx.createMediaStreamDestination();
    const dest = mediaStreamDestRef.current;

    // Mic: echoCancellation only — avoid noiseSuppression which destroys voice for AI
    const micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: false,  // ← off: Gemini's server VAD is better
        autoGainControl: true,
      },
    });
    micStreamRef.current = micStream;
    const micSource = audioCtx.createMediaStreamSource(micStream);
    micSource.connect(dest);

    // Connect AI with the raw mic stream
    const systemPrompt = language === 'ko'
      ? '당신은 AI 비서 해밀입니다. 짧고 친근하게 대답하세요. 배경 소음이 있더라도 사람의 목소리에 집중하세요.'
      : 'You are Haemil, an AI assistant. Be concise and friendly.';
    await aiAgentService.connect({ language, voice, systemPrompt }, micStream);

    // Inject mixed stream to PlanetKit so all participants hear AI
    if (conferenceRef.current?.setCustomMediaStream) {
      await conferenceRef.current.setCustomMediaStream(dest.stream);
    }

    // Feed room audio to AI
    if (audioElementRef.current) {
      const roomStream = (audioElementRef.current as any).captureStream?.() 
        || (audioElementRef.current as any).mozCaptureStream?.();
      if (roomStream) aiAgentService.addAudioSource(roomStream);
    }
  };

  const handleAudioOutput = (audioData: Float32Array) => {
    const audioCtx = audioContextRef.current;
    const dest = mediaStreamDestRef.current;
    if (!audioCtx || !dest) return;

    const buffer = audioCtx.createBuffer(1, audioData.length, 24000);
    buffer.getChannelData(0).set(audioData);
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;

    const now = audioCtx.currentTime;
    if (nextStartTimeRef.current < now) nextStartTimeRef.current = now + 0.05;
    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += buffer.duration;

    source.connect(dest);         // → PlanetKit → other participants
    source.connect(audioCtx.destination); // → local speaker
  };

  // ────────────────────────────────────────────────────────
  // AI Activation / Deactivation
  // ────────────────────────────────────────────────────────
  const activateAI = async () => {
    const result = await lockApi('acquire');
    if (!result.acquired) {
      await fetchLockStatus();
      return;
    }
    try {
      await createAudioBridge();
      aiActiveRef.current = true;
      setAiActive(true);
      startHeartbeat();
    } catch (err: any) {
      console.error('[AIAgentBridge] Audio bridge failed:', err);
      await lockApi('release');
      if (audioContextRef.current?.state !== 'closed') audioContextRef.current?.close();
      audioContextRef.current = null;
      mediaStreamDestRef.current = null;
    }
  };

  const deactivateAI = async () => {
    clearInterval(heartbeatTimerRef.current!);
    heartbeatTimerRef.current = null;

    aiAgentService.disconnect();
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    if (conferenceRef.current?.setCustomMediaStream) {
      await conferenceRef.current.setCustomMediaStream(null);
    }
    if (audioContextRef.current?.state !== 'closed') {
      await audioContextRef.current?.close();
      audioContextRef.current = null;
      mediaStreamDestRef.current = null;
    }

    await lockApi('release');
    aiActiveRef.current = false;
    setAiActive(false);
    fetchLockStatus();
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

  // ────────────────────────────────────────────────────────
  // Timers
  // ────────────────────────────────────────────────────────
  const startPolling = () => {
    pollTimerRef.current = setInterval(fetchLockStatus, POLL_INTERVAL_MS);
  };

  const startHeartbeat = () => {
    heartbeatTimerRef.current = setInterval(async () => {
      const data = await lockApi('heartbeat');
      if (!data.alive) deactivateAI();
    }, HEARTBEAT_INTERVAL_MS);
  };

  // ────────────────────────────────────────────────────────
  // Handlers
  // ────────────────────────────────────────────────────────
  const handleToggleMute = () => setIsMuted(aiAgentService.toggleMute());
  const handleEndCall = () => navigate('/setup');

  const formatDuration = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const isOccupiedByOther = lockStatus.locked && lockStatus.holder?.userId !== userId;

  // ────────────────────────────────────────────────────────
  // Render — ALWAYS shows full UI, no loading gate
  // ────────────────────────────────────────────────────────
  return (
    <div className="h-screen w-screen bg-indigo-950 text-white flex flex-col overflow-hidden">
      {/* Hidden Room Audio — always in DOM */}
      <audio ref={audioElementRef} autoPlay playsInline className="hidden" />

      {/* Header */}
      <div className="h-16 px-4 flex items-center justify-between bg-black/20 border-b border-white/5 shrink-0">
        <div>
          <h1 className="font-bold text-base leading-none">AI Agent Bridge</h1>
          <p className={`text-[10px] mt-0.5 ${
            conferenceStatus === 'connected' ? 'text-green-400' :
            conferenceStatus === 'failed' ? 'text-red-400' : 'text-yellow-400 animate-pulse'
          }`}>
            {conferenceStatus === 'connected' ? 'Connected' :
             conferenceStatus === 'failed' ? 'Disconnected' : 'Joining room...'}
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {conferenceStatus === 'failed' && <WifiOff className="w-4 h-4 text-red-400" />}
          <Users className="w-4 h-4" />
          <span>{participantCount}</span>
          <span className="font-mono bg-black/30 px-2 py-1 rounded text-xs">{formatDuration(callDuration)}</span>
        </div>
      </div>

      {/* Main scroll area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* AI Avatar */}
        <div className="flex justify-center pt-4">
          <div className={`w-36 h-36 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500
            ${aiActive ? 'bg-gradient-to-br from-indigo-500 to-purple-600' : 'bg-gray-800 opacity-50'}`}>
            <Bot className={`w-20 h-20 ${agentState === 'speaking' ? 'animate-bounce' : ''}`} />
          </div>
        </div>

        <div className="text-center">
          <p className="font-bold">{userName}</p>
          <p className="text-xs text-indigo-300/70 mt-0.5">Room: {roomId}</p>
          {aiActive && (
            <p className={`text-sm mt-1 ${
              agentState === 'listening' ? 'text-blue-400' :
              agentState === 'speaking' ? 'text-purple-400' : 'text-green-400'
            }`}>
              {agentState === 'listening' ? '🎤 AI 듣는 중...' :
               agentState === 'speaking' ? '💬 AI 말하는 중...' : '✅ AI 활성화됨'}
            </p>
          )}
        </div>

        {/* Occupied banner */}
        {isOccupiedByOther && (
          <div className="bg-orange-500/10 border border-orange-400/20 rounded-2xl p-4 text-orange-200 text-xs text-center">
            AI is active by <span className="font-bold">{lockStatus.holder?.userName}</span>
          </div>
        )}

        {/* Transcript */}
        {transcript && aiActive && (
          <div className="bg-white/5 rounded-2xl p-4 text-sm text-white/80 italic leading-relaxed whitespace-pre-wrap">
            "{transcript.slice(-300)}"
          </div>
        )}

        {/* Status card */}
        <div className="bg-white/5 rounded-2xl p-4 text-xs text-gray-400 space-y-2">
          <div className="flex justify-between">
            <span>Conference</span>
            <span className={conferenceStatus === 'connected' ? 'text-green-400' : 'text-yellow-400'}>
              {conferenceStatus}
            </span>
          </div>
          <div className="flex justify-between">
            <span>AI Bridge</span>
            <span className={aiActive ? 'text-green-400' : 'text-gray-500'}>{aiActive ? 'active' : 'idle'}</span>
          </div>
          <div className="flex justify-between">
            <span>Mic</span>
            <span className={isMuted ? 'text-red-400' : 'text-green-400'}>{isMuted ? 'muted' : 'live'}</span>
          </div>
        </div>
      </div>

      {/* Bottom Controls — always visible */}
      <div className="h-28 px-6 flex items-center justify-center gap-6 bg-black/40 backdrop-blur-xl border-t border-white/5 shrink-0">
        <Button
          variant="ghost"
          onClick={handleToggleMute}
          className={`w-14 h-14 rounded-full border ${isMuted ? 'bg-red-500/20 border-red-500/50 text-red-400' : 'bg-white/5 border-white/10'}`}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </Button>

        <Button
          onClick={handleToggleAI}
          disabled={isTogglingAI || isOccupiedByOther || conferenceStatus === 'failed'}
          className={`h-16 px-8 rounded-full font-bold text-base shadow-xl transition-all
            ${isOccupiedByOther || conferenceStatus === 'failed' ? 'bg-gray-700 text-gray-500' :
              aiActive ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}
        >
          {isTogglingAI
            ? <Loader2 className="animate-spin mr-2 w-5 h-5" />
            : aiActive
            ? <BotOff className="mr-2 w-5 h-5" />
            : <Bot className="mr-2 w-5 h-5" />
          }
          {aiActive ? 'AI OFF' : 'AI ON'}
        </Button>

        <Button
          onClick={handleEndCall}
          className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 shadow-xl"
        >
          <PhoneOff className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
};

export default AIAgentBridgeMeeting;
