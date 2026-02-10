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
      // silently ignore polling errors
    }
  }, [lockApi]);

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
        console.log('[AIAgentBridge] Starting initialization');
        setupAIAgentListeners();
        
        // 1. Join Conference first
        await joinPlanetKitConference();
        console.log('[AIAgentBridge] PlanetKit joined');
        
        // 2. Release loading screen immediately to show the room UI
        setIsConnecting(false);
        callStartTimeRef.current = Date.now();
        startDurationTimer();
        
        // 3. Start polling for room status
        startPolling();

        // 4. Try auto-activation in the next tick to prevent blocking the UI
        setTimeout(async () => {
          try {
            const data: LockStatus = await lockApi('status');
            setLockStatus(data);
            if (!data.locked && !aiActiveRef.current) {
              console.log('[AIAgentBridge] Attempting auto-activation');
              await activateAI(); 
            }
          } catch (err) {
            console.warn('[AIAgentBridge] Auto-activation check failed:', err);
          }
        }, 500);

      } catch (error: any) {
        console.error('[AIAgentBridge] Init failed:', error);
        toast({
          title: 'Connection Failed',
          description: error.message || 'Failed to initialize AI Agent Bridge',
          variant: 'destructive',
        });
        setIsConnecting(false); // Make sure to hide loader even on error
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
    pollTimerRef.current = setInterval(fetchLockStatus, POLL_INTERVAL_MS);
  };

  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const startHeartbeat = () => {
    heartbeatTimerRef.current = setInterval(async () => {
      try {
        const data = await lockApi('heartbeat');
        if (!data.alive) {
          stopHeartbeat();
          aiActiveRef.current = false;
          setAiActive(false);
          cleanupAIBridge();
        }
      } catch {
        // ignore network errors during heartbeat
      }
    }, HEARTBEAT_INTERVAL_MS);
  };

  const stopHeartbeat = () => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  };

  const handleToggleAI = useCallback(async () => {
    if (isTogglingAI) return;
    setIsTogglingAI(true);
    try {
      if (aiActive) {
        await deactivateAI();
      } else {
        await activateAI();
      }
    } finally {
      setIsTogglingAI(false);
    }
  }, [isTogglingAI, aiActive, activateAI, deactivateAI]);

  const activateAI = async () => {
    console.log('[AIAgentBridge] activateAI requested');
    const prevLock: LockStatus = await lockApi('status');
    const result = await lockApi('acquire');

    if (!result.acquired) {
      console.warn('[AIAgentBridge] Lock acquisition failed', result.holder);
      toast({
        title: language === 'ko' ? 'AI 활성화 불가' : 'Cannot Activate AI',
        description:
          language === 'ko'
            ? `이미 다른 참여자가 AI를 활성화 하였습니다 (활성화 유저: ${result.holder?.userName})`
            : `AI is already activated by another participant (${result.holder?.userName})`,
        variant: 'destructive',
      });
      await fetchLockStatus();
      return;
    }

    try {
      console.log('[AIAgentBridge] Initializing audio/bridge');
      await setupAudioContext(); 
      const isHandoff = prevLock.locked && prevLock.holder?.userId !== userId;
      await createAudioBridge(isHandoff);
      
      aiActiveRef.current = true;
      setAiActive(true);
      startHeartbeat();
      
      console.log('[AIAgentBridge] AI Activation complete');
      toast({
        title: language === 'ko' ? 'AI 활성화됨' : 'AI Activated',
        description: language === 'ko' ? 'Gemini AI가 연결되었습니다' : 'Gemini AI connected',
      });
    } catch (err: any) {
      console.error('[AIAgentBridge] AI Activation failed:', err);
      await lockApi('release');
      cleanupAudioBridge();
      toast({
        title: 'AI Connection Failed',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const deactivateAI = async () => {
    stopHeartbeat();
    cleanupAIBridge();
    cleanupAudioBridge();
    
    // Reset PlanetKit back to default microphone if possible
    if (conferenceRef.current && typeof conferenceRef.current.setCustomMediaStream === 'function') {
      try {
        await conferenceRef.current.setCustomMediaStream(null);
      } catch (err) {
        console.warn('[AIAgentBridge] Failed to reset custom media stream:', err);
      }
    }

    await lockApi('release');
    aiActiveRef.current = false;
    setAiActive(false);
    await fetchLockStatus();
    toast({
      title: language === 'ko' ? 'AI 비활성화됨' : 'AI Deactivated',
      description:
        language === 'ko' ? 'Gemini AI 연결이 해제되었습니다' : 'Gemini AI disconnected',
    });
  };

  const cleanupAIBridge = () => {
    cleanupAIAgent();
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
  };

  const handleStateChange = (newState: AIAgentState) => {
    setAgentState(newState);
    if (newState === 'disconnected' || newState === 'error') {
      stopDurationTimer();
    }
  };

  const handleError = (errorMessage: string) => {
    toast({ title: 'AI Error', description: errorMessage, variant: 'destructive' });
  };

  const handleTranscript = ({ text, isFinal }: { text: string; isFinal: boolean }) => {
    if (isFinal) {
      setTranscript((prev) => prev + '\n' + text);
    } else {
      setTranscript((prev) => prev + text);
    }
  };

  const handleAudioOutput = (audioData: Float32Array) => {
    if (!audioContextRef.current || !mediaStreamDestRef.current) return;
    try {
      const audioCtx = audioContextRef.current;
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const buffer = audioCtx.createBuffer(1, audioData.length, 24000);
      buffer.getChannelData(0).set(audioData);

      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      
      // Store reference to current speaking sources for interruption
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
    } catch (err) {
      console.error('[AIAgentBridge] Failed to route AI audio:', err);
    }
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

    if (!serviceId || !apiKey || !apiSecret) {
      throw new Error('PlanetKit credentials not configured');
    }

    const { generatePlanetKitToken } = await import('@/utils/token-generator');
    const accessToken = await generatePlanetKitToken(
      serviceId,
      apiKey,
      userId,
      roomId,
      3600,
      apiSecret
    );

    const conference = new PlanetKitEval.Conference();
    conferenceRef.current = conference;

    await conference.joinConference({
      myId: userId,
      displayName: userName,
      myServiceId: serviceId,
      roomId,
      roomServiceId: serviceId,
      accessToken,
      mediaType: 'audio',
      mediaHtmlElement: { roomAudio: audioElementRef.current },
      delegate: {
        evtConnected: () => {
          setConferenceConnected(true);
          setParticipantCount(1);
          toast({ title: 'Conference Joined', description: `Joined room: ${roomId}` });
        },
        evtDisconnected: () => {
          setConferenceConnected(false);
          setParticipantCount(0);
        },
        evtPeerListUpdated: (info: any) => {
          const added = (info.addedPeers || []).length;
          const removed = (info.removedPeers || []).length;
          setParticipantCount((prev) => prev + added - removed);
        },
        evtError: (error: any) => {
          toast({
            title: 'Conference Error',
            description: error?.message || 'An error occurred',
            variant: 'destructive',
          });
        },
      },
    });
  };

  const setupAudioContext = async () => {
    console.log('[AIAgentBridge] Setting up AudioContext');
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: 48000 });
    }
    
    const audioCtx = audioContextRef.current;
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }

    if (!mediaStreamDestRef.current) {
      mediaStreamDestRef.current = audioCtx.createMediaStreamDestination();
    }
    
    // Setup analyzer for barge-in detection
    if (!analyserRef.current) {
      analyserRef.current = audioCtx.createAnalyser();
      analyserRef.current.fftSize = 256;
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkAudioLevel = () => {
        if (!analyserRef.current || !aiActiveRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const sum = dataArray.reduce((a, b) => a + b, 0);
        const average = sum / bufferLength;

        if (average > 30 && speakingSourcesRef.current.length > 0) {
          console.log('[AIAgentBridge] Barge-in detected, interrupting AI');
          speakingSourcesRef.current.forEach(source => {
            try { source.stop(); } catch (e) {}
          });
          speakingSourcesRef.current = [];
          nextStartTimeRef.current = audioCtx.currentTime;
        }
        requestAnimationFrame(checkAudioLevel);
      };
      requestAnimationFrame(checkAudioLevel);
    }
  };

  const createAudioBridge = async (isHandoff: boolean) => {
    if (!audioContextRef.current || !mediaStreamDestRef.current || !analyserRef.current) {
      throw new Error('Audio context not initialized');
    }

    const micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    micStreamRef.current = micStream;

    const micSource = audioContextRef.current.createMediaStreamSource(micStream);
    micSource.connect(mediaStreamDestRef.current);
    micSource.connect(analyserRef.current); // Connect mic to analyzer for barge-in

    const systemPrompt =
      language === 'ko'
        ? '당신은 그룹 통화에 참여한 AI 비서입니다. 한국어로 자연스럽고 친근하게 대화하세요. 간결하고 명확하게 답변하세요.'
        : 'You are an AI assistant participating in a group call. Respond naturally and helpfully in English. Keep responses concise and clear.';

    await aiAgentService.connect({ language, voice, systemPrompt });

    if (conferenceRef.current) {
      try {
        const mixedStream = mediaStreamDestRef.current.stream;
        if (typeof conferenceRef.current.setCustomMediaStream === 'function') {
          await conferenceRef.current.setCustomMediaStream(mixedStream);
        }
      } catch (err) {
        console.warn('[AIAgentBridge] Could not set custom media stream:', err);
      }
    }

    if (audioElementRef.current) {
      try {
        // captureStream() might require a user interaction to work in some browsers
        // and needs to be called on the element playing the room audio
        const roomStream = (audioElementRef.current as any).captureStream?.() || (audioElementRef.current as any).mozCaptureStream?.();
        if (roomStream) {
          aiAgentService.addAudioSource(roomStream);
          
          // Also connect room audio to the analyzer to allow other participants to interrupt AI
          if (audioContextRef.current && analyserRef.current) {
            const roomSource = audioContextRef.current.createMediaStreamSource(roomStream);
            roomSource.connect(analyserRef.current);
          }
        }
      } catch (err) {
        console.warn('[AIAgentBridge] Could not capture room audio for Gemini:', err);
      }
    }

    if (isHandoff) {
      const greetingPrompt =
        language === 'ko'
          ? '다른 참여자로부터 AI 대화를 이어받았습니다. 자연스럽게 인사하며 이렇게 말해주세요: "제가 이어서 대화할게요!"'
          : 'You are continuing the AI conversation from another participant. Greet naturally and say: "I\'ll continue the conversation from here!"';
      setTimeout(() => {
        aiAgentService.sendTextMessage(greetingPrompt);
      }, 2000);
    }
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

  const handleToggleMute = () => {
    const newMuted = aiAgentService.toggleMute();
    setIsMuted(newMuted);
    toast({
      title: newMuted ? 'Microphone Muted' : 'Microphone Unmuted',
      description: newMuted ? 'AI cannot hear you' : 'AI can hear you now',
    });
  };

  const handleEndCall = async () => {
    if (aiActive) {
      stopHeartbeat();
      cleanupAIBridge();
      await lockApi('release').catch(() => {});
    }
    stopDurationTimer();
    stopPolling();
    cleanupPlanetKit();
    cleanupAudioBridge();
    toast({ title: 'Call Ended', description: 'Returning to setup page' });
    setTimeout(() => navigate('/setup'), 1000);
  };

  const cleanupAIAgent = () => {
    aiAgentService.off('stateChange', handleStateChange);
    aiAgentService.off('error', handleError);
    aiAgentService.off('transcript', handleTranscript);
    aiAgentService.off('audioOutput', handleAudioOutput);
    aiAgentService.disconnect();
  };

  const cleanupPlanetKit = async () => {
    if (conferenceRef.current && typeof conferenceRef.current.leaveConference === 'function') {
      try {
        await conferenceRef.current.leaveConference();
      } catch {
        // ignore
      }
      conferenceRef.current = null;
    }
  };

  const cleanupAudioBridge = () => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    mediaStreamDestRef.current = null;
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStateDisplay = (): { text: string; color: string } => {
    if (!conferenceConnected) return { text: 'Conference Disconnected', color: 'text-red-400' };
    if (!aiActive)
      return {
        text: language === 'ko' ? 'AI 비활성화' : 'AI Inactive',
        color: 'text-gray-400',
      };
    switch (agentState) {
      case 'connecting':
        return { text: 'Connecting AI...', color: 'text-yellow-400' };
      case 'connected':
        return { text: 'AI Connected', color: 'text-green-400' };
      case 'listening':
        return {
          text: language === 'ko' ? 'AI 듣는 중...' : 'AI Listening...',
          color: 'text-blue-400',
        };
      case 'speaking':
        return {
          text: language === 'ko' ? 'AI 말하는 중...' : 'AI Speaking...',
          color: 'text-purple-400',
        };
      case 'error':
        return { text: 'AI Error', color: 'text-red-400' };
      case 'disconnected':
        return { text: 'AI Disconnected', color: 'text-gray-400' };
      default:
        return { text: 'Initializing...', color: 'text-gray-400' };
    }
  };

  const isOccupiedByOther = lockStatus.locked && lockStatus.holder?.userId !== userId;
  const stateDisplay = getStateDisplay();

  return (
    <>
      <audio ref={audioElementRef} autoPlay playsInline className="hidden" />

      {isConnecting ? (
        <div className="h-screen w-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-16 h-16 animate-spin text-white" />
            <p className="text-white text-xl font-semibold">
              {language === 'ko' ? 'AI Agent Bridge 초기화 중...' : 'Initializing AI Agent Bridge...'}
            </p>
            <p className="text-gray-300 text-sm">Room: {roomId}</p>
          </div>
        </div>
      ) : (
        <div className="h-screen w-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex flex-col">
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

          <div className="flex-1 overflow-y-auto mt-16 mb-28 px-4 py-6">
            <div className="flex justify-center mb-8">
              <div className="relative">
                <div
                  className={`w-32 h-32 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 ${
                    aiActive
                      ? 'bg-gradient-to-br from-purple-500 to-pink-500'
                      : 'bg-gradient-to-br from-gray-600 to-gray-700'
                  } ${agentState === 'speaking' ? 'animate-pulse' : ''}`}
                >
                  <svg
                    className="w-16 h-16 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </svg>
                </div>
                {agentState === 'speaking' && aiActive && (
                  <div className="absolute inset-0 rounded-full border-4 border-purple-400 animate-ping" />
                )}
              </div>
            </div>

            <div className="text-center mb-6">
              <p className="text-white text-lg font-medium">{userName}</p>
              <p className="text-gray-300 text-sm">
                {language === 'ko' ? '연결된 방:' : 'Connected to:'} {roomId}
              </p>
              <p className="text-gray-400 text-xs mt-1">
                {participantCount > 1
                  ? `${participantCount} ${language === 'ko' ? '명 참여 중' : 'participants in room'}`
                  : language === 'ko'
                  ? '다른 참여자 대기 중...'
                  : 'Waiting for other participants...'}
              </p>
            </div>

            {isOccupiedByOther && (
              <Card className="bg-orange-500/20 backdrop-blur-md border-orange-500/30 p-4 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse flex-shrink-0" />
                  <span className="text-orange-200 text-sm">
                    {language === 'ko'
                      ? `이미 다른 참여자가 AI를 활성화 하였습니다 (활성화 유저: ${lockStatus.holder?.userName})`
                      : `AI is already activated by another participant (${lockStatus.holder?.userName})`}
                  </span>
                </div>
              </Card>
            )}

            {aiActive && conferenceConnected && (
              <Card className="bg-green-500/20 backdrop-blur-md border-green-500/30 p-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-green-300 text-sm font-medium">
                    {language === 'ko'
                      ? 'AI 활성 — AI가 방에서 듣고 말할 수 있습니다'
                      : 'AI Active — AI can hear and speak in the room'}
                  </span>
                </div>
              </Card>
            )}

            {transcript && aiActive && (
              <Card className="bg-white/10 backdrop-blur-md border-white/20 p-4 mb-4">
                <div className="text-white/90 text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">
                  {transcript}
                </div>
              </Card>
            )}

            {agentState === 'listening' && aiActive && (
              <div className="text-center">
                <p className="text-blue-300 text-sm animate-pulse">
                  {language === 'ko' ? '말씀해주세요...' : 'Speak now...'}
                </p>
              </div>
            )}

            <Card className="bg-white/5 backdrop-blur-md border-white/10 p-4 mt-6">
              <h3 className="text-white font-semibold text-sm mb-2">
                {language === 'ko' ? '브릿지 상태:' : 'Bridge Status:'}
              </h3>
              <div className="space-y-1 text-xs text-gray-300">
                <div className="flex justify-between">
                  <span>{language === 'ko' ? 'AI 활성화:' : 'AI Active:'}</span>
                  <span className={aiActive ? 'text-green-400' : 'text-gray-400'}>
                    {aiActive
                      ? language === 'ko'
                        ? '활성'
                        : 'Active'
                      : language === 'ko'
                      ? '비활성'
                      : 'Inactive'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{language === 'ko' ? '마이크 → AI + 방:' : 'Local Mic → AI + Room:'}</span>
                  <span
                    className={
                      !aiActive ? 'text-gray-400' : isMuted ? 'text-red-400' : 'text-green-400'
                    }
                  >
                    {!aiActive ? 'N/A' : isMuted ? 'Muted' : 'Active'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{language === 'ko' ? '방 → AI:' : 'Room → AI:'}</span>
                  <span
                    className={
                      aiActive && conferenceConnected ? 'text-green-400' : 'text-red-400'
                    }
                  >
                    {aiActive && conferenceConnected ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>
                    {language === 'ko' ? 'AI → 방 브로드캐스트:' : 'AI → Conference Room:'}
                  </span>
                  <span
                    className={
                      aiActive && conferenceConnected ? 'text-green-400' : 'text-gray-400'
                    }
                  >
                    {aiActive && conferenceConnected ? 'Broadcasting' : 'Off'}
                  </span>
                </div>
              </div>
            </Card>
          </div>

          <div className="fixed bottom-0 left-0 right-0 h-28 bg-black/30 backdrop-blur-sm border-t border-white/10 flex items-center justify-center gap-4 px-4">
            <Button
              size="lg"
              variant="ghost"
              onClick={handleToggleMute}
              className={`w-14 h-14 rounded-full ${
                isMuted
                  ? 'bg-red-500/80 hover:bg-red-600/80'
                  : 'bg-white/20 hover:bg-white/30'
              } backdrop-blur-sm`}
            >
              {isMuted ? (
                <MicOff className="w-6 h-6 text-white" />
              ) : (
                <Mic className="w-6 h-6 text-white" />
              )}
            </Button>

            <Button
              size="lg"
              onClick={handleToggleAI}
              disabled={isTogglingAI || isOccupiedByOther}
              className={`h-16 px-6 rounded-full font-semibold text-sm transition-all duration-200 shadow-lg ${
                isOccupiedByOther
                  ? 'bg-gray-600/60 cursor-not-allowed opacity-60 text-gray-300'
                  : aiActive
                  ? 'bg-purple-500 hover:bg-purple-600 text-white'
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              {isTogglingAI ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : aiActive ? (
                <BotOff className="w-5 h-5 mr-2" />
              ) : (
                <Bot className="w-5 h-5 mr-2" />
              )}
              {isTogglingAI
                ? language === 'ko'
                  ? '처리 중...'
                  : 'Processing...'
                : aiActive
                ? language === 'ko'
                  ? 'AI 비활성화'
                  : 'Deactivate AI'
                : language === 'ko'
                ? 'AI 활성화'
                : 'Activate AI'}
            </Button>

            <Button
              size="lg"
              onClick={handleEndCall}
              className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 shadow-2xl"
            >
              <PhoneOff className="w-6 h-6 text-white" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

export default AIAgentBridgeMeeting;
