import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLiff } from '@/contexts/LiffContext';
import { aiAgentService, AIAgentState } from '@/services/ai-agent-service';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Mic, MicOff, PhoneOff, Loader2, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as PlanetKitEval from '@line/planet-kit/dist/planet-kit-eval';

/**
 * AI Agent Bridge Meeting Page
 * 
 * Browser-as-Bridge implementation:
 * - Browser joins a PlanetKit Conference room (e.g., "ai-agent-room")
 * - Local microphone → Gemini AI (AI hears the user)
 * - Gemini AI output → Local speaker (user hears AI)
 * - Gemini AI output → PlanetKit Conference (others in room hear AI)
 * 
 * This creates a bridge where the AI can participate in a group call.
 */
export const AIAgentBridgeMeeting = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile, isLoggedIn, isInitialized } = useLiff();
  const { toast } = useToast();

  // URL parameters
  const language = (searchParams.get('lang') || 'ko') as 'ko' | 'en';
  const voice = searchParams.get('voice') || 'Kore';
  const roomId = searchParams.get('roomId') || 'ai-agent-bridge';

  // Component state
  const [agentState, setAgentState] = useState<AIAgentState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState<string>('');
  const [callDuration, setCallDuration] = useState(0);
  const [isConnecting, setIsConnecting] = useState(true);
  const [conferenceConnected, setConferenceConnected] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);

  // Refs
  const callStartTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const conferenceRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const audioElementRef = useRef<HTMLAudioElement>(null);
  const nextStartTimeRef = useRef<number>(0);
  const micStreamRef = useRef<MediaStream | null>(null);

  // Initialize call on mount
  useEffect(() => {
    // Wait for LIFF to initialize
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

    const initializeBridge = async () => {
      console.log('[AIAgentBridge] Initializing AI Agent Bridge');
      console.log('[AIAgentBridge] Language:', language, 'Voice:', voice, 'Room:', roomId);

      try {
        // Step 1: Setup AI Agent Service
        setupAIAgent();

        // Step 2: Join PlanetKit Conference
        await joinPlanetKitConference();

        // Step 3: Create Audio Bridge
        await createAudioBridge();

        setIsConnecting(false);
        callStartTimeRef.current = Date.now();
        startDurationTimer();

        console.log('[AIAgentBridge] Bridge initialized successfully');
      } catch (error: any) {
        console.error('[AIAgentBridge] Failed to initialize:', error);
        toast({
          title: 'Connection Failed',
          description: error.message || 'Failed to initialize AI Agent Bridge',
          variant: 'destructive',
        });
        setTimeout(() => navigate('/setup'), 2000);
      }
    };

    initializeBridge();

    // Cleanup on unmount
    return () => {
      console.log('[AIAgentBridge] Cleaning up...');
      stopDurationTimer();
      cleanupAIAgent();
      cleanupPlanetKit();
      cleanupAudioBridge();
    };
  }, [isInitialized, isLoggedIn, profile, language, voice, roomId]);

  const handleStateChange = (newState: AIAgentState) => {
    console.log('[AIAgentBridge] AI State changed:', newState);
    setAgentState(newState);

    if (newState === 'disconnected' || newState === 'error') {
      stopDurationTimer();
    }
  };

  const handleError = (errorMessage: string) => {
    console.error('[AIAgentBridge] AI Error:', errorMessage);
    toast({
      title: 'AI Error',
      description: errorMessage,
      variant: 'destructive',
    });
  };

  const handleTranscript = ({ text, isFinal }: { text: string; isFinal: boolean }) => {
    console.log('[AIAgentBridge] Transcript:', text, 'isFinal:', isFinal);
    if (isFinal) {
      setTranscript((prev) => prev + '\n' + text);
    } else {
      setTranscript((prev) => prev + text);
    }
  };

  const handleAudioOutput = (audioData: Float32Array) => {
    if (!audioContextRef.current || !mediaStreamDestRef.current) {
      return;
    }

    try {
      const audioCtx = audioContextRef.current;

      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      // Create buffer at exactly 24kHz to match Gemini's native output
      const buffer = audioCtx.createBuffer(1, audioData.length, 24000);
      buffer.getChannelData(0).set(audioData);

      const source = audioCtx.createBufferSource();
      source.buffer = buffer;

      // Schedule playback
      const now = audioCtx.currentTime;
      // If nextStartTime is in the past (gap happened), reset to now
      // Small buffer (0.05s) to prevent immediate start glitches
      if (nextStartTimeRef.current < now) {
        nextStartTimeRef.current = now + 0.05;
      }

      // Play at the scheduled time
      source.start(nextStartTimeRef.current);

      // Advance the schedule
      nextStartTimeRef.current += buffer.duration;

      // Route 1: To PlanetKit Conference (The primary path for the room)
      source.connect(mediaStreamDestRef.current);

      // Route 2: Local Monitor (Tiger hearing the AI)
      // Unmuted so the user hosting the bridge can hear the AI too.
      // Note: If this device is in the same room as others, use headphones to prevent feedback loop.
      source.connect(audioCtx.destination);

    } catch (err) {
      console.error('[AIAgentBridge] Failed to route AI audio:', err);
    }
  };

  const setupAIAgent = () => {
    console.log('[AIAgentBridge] Setting up AI Agent service');

    aiAgentService.on('stateChange', handleStateChange);
    aiAgentService.on('error', handleError);
    aiAgentService.on('transcript', handleTranscript);
    aiAgentService.on('audioOutput', handleAudioOutput);
  };

  // Join PlanetKit Conference
  const joinPlanetKitConference = async () => {
    console.log('[AIAgentBridge] Joining PlanetKit Conference');

    // Get PlanetKit credentials from environment
    const serviceId = import.meta.env.VITE_PLANETKIT_EVAL_SERVICE_ID;
    const apiKey = import.meta.env.VITE_PLANETKIT_EVAL_API_KEY;
    const apiSecret = import.meta.env.VITE_PLANETKIT_EVAL_API_SECRET;

    if (!serviceId || !apiKey || !apiSecret) {
      throw new Error('PlanetKit credentials not configured');
    }

    // Generate access token (simplified - in production use server-side)
    const userId = profile?.userId || 'ai-bridge-user';
    const displayName = profile?.displayName || 'AI Bridge';

    const { generatePlanetKitToken } = await import('@/utils/token-generator');
    const accessToken = await generatePlanetKitToken(
      serviceId,
      apiKey,
      userId,
      roomId,
      3600,
      apiSecret
    );

    // Initialize PlanetKit Conference
    const conference = new PlanetKitEval.Conference();
    conferenceRef.current = conference;

    const conferenceDelegate = {
      evtConnected: () => {
        console.log('[AIAgentBridge] PlanetKit Conference connected');
        setConferenceConnected(true);
        setParticipantCount(1); // Local user

        toast({
          title: 'Conference Joined',
          description: `Joined room: ${roomId}`,
        });
      },

      evtDisconnected: (disconnectDetails: any) => {
        console.log('[AIAgentBridge] PlanetKit Conference disconnected:', disconnectDetails);
        setConferenceConnected(false);
        setParticipantCount(0);
      },

      evtPeerListUpdated: (peerUpdateInfo: any) => {
        const addedPeers = peerUpdateInfo.addedPeers || [];
        const removedPeers = peerUpdateInfo.removedPeers || [];

        console.log('[AIAgentBridge] Peer list updated:', { added: addedPeers.length, removed: removedPeers.length });

        setParticipantCount(prev => prev + addedPeers.length - removedPeers.length);
      },

      evtError: (error: any) => {
        console.error('[AIAgentBridge] PlanetKit error:', error);
        toast({
          title: 'Conference Error',
          description: error?.message || 'An error occurred in the conference',
          variant: 'destructive',
        });
      },
    };

    const conferenceParams = {
      myId: userId,
      displayName: displayName,
      myServiceId: serviceId,
      roomId: roomId,
      roomServiceId: serviceId,
      accessToken: accessToken,
      mediaType: 'video', // Must match PlanetKitMeetingArea's "video" svckey (groupcall.video) for cross-participant audio routing
      mediaHtmlElement: { roomAudio: audioElementRef.current },
      delegate: conferenceDelegate,
    };

    await conference.joinConference(conferenceParams);
    console.log('[AIAgentBridge] PlanetKit Conference joined successfully');
  };

  // Create Audio Bridge
  const createAudioBridge = async () => {
    console.log('[AIAgentBridge] Creating audio bridge');

    // Use 48kHz — standard WebRTC sample rate for PlanetKit compatibility
    audioContextRef.current = new AudioContext({ sampleRate: 48000 });
    mediaStreamDestRef.current = audioContextRef.current.createMediaStreamDestination();

    // Step 1: Capture local microphone and mix into PlanetKit output stream.
    // This ensures other participants hear the bridge user's voice alongside AI audio.
    const micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    micStreamRef.current = micStream;
    const micSource = audioContextRef.current.createMediaStreamSource(micStream);
    micSource.connect(mediaStreamDestRef.current);
    console.log('[AIAgentBridge] Local mic mixed into PlanetKit output stream');

    // Step 2: Connect to Gemini AI first — so the WebSocket and worklet are ready
    // before we inject the custom stream into PlanetKit.
    await aiAgentService.connect({
      language,
      voice,
      systemPrompt: language === 'ko'
        ? `당신은 그룹 통화에 참여한 AI 비서입니다. 한국어로 자연스럽고 친근하게 대화하세요. 간결하고 명확하게 답변하세요.`
        : `You are an AI assistant participating in a group call. Respond naturally and helpfully in English. Keep responses concise and clear.`,
    });

    // Step 3: Inject the mixed stream (mic + AI audio) into PlanetKit.
    // setCustomMediaStream replaces PlanetKit's internal mic capture, so the mixed
    // stream is the sole outgoing audio — containing both the user's voice and AI voice.
    if (conferenceRef.current) {
      try {
        const mixedStream = mediaStreamDestRef.current.stream;
        if (typeof conferenceRef.current.setCustomMediaStream === 'function') {
          await conferenceRef.current.setCustomMediaStream(mixedStream);
          console.log('[AIAgentBridge] Mixed stream (mic + AI) injected into PlanetKit');
        } else {
          console.warn('[AIAgentBridge] setCustomMediaStream not available on conference');
        }
      } catch (err) {
        console.warn('[AIAgentBridge] Could not set custom media stream:', err);
      }
    }

    // Step 4: Capture PlanetKit room audio and feed it to Gemini so the AI can
    // hear what other conference participants are saying.
    if (audioElementRef.current) {
      try {
        const roomStream = (audioElementRef.current as any).captureStream() as MediaStream;
        aiAgentService.addAudioSource(roomStream);
        console.log('[AIAgentBridge] Room audio routed to Gemini');
      } catch (err) {
        console.warn('[AIAgentBridge] Could not capture room audio for Gemini:', err);
      }
    }

    console.log('[AIAgentBridge] Audio bridge created successfully');
  };

  const startDurationTimer = () => {
    durationIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
      setCallDuration(elapsed);
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

  const handleEndCall = () => {
    console.log('[AIAgentBridge] Ending call...');
    cleanupAIAgent();
    cleanupPlanetKit();
    cleanupAudioBridge();
    toast({
      title: 'Call Ended',
      description: 'Returning to setup page',
    });
    setTimeout(() => navigate('/setup'), 1000);
  };

  // Cleanup functions
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
      } catch (err) {
        console.warn('[AIAgentBridge] Error leaving conference:', err);
      }
      conferenceRef.current = null;
    }
  };

  const cleanupAudioBridge = () => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => { });
      audioContextRef.current = null;
    }
    mediaStreamDestRef.current = null;
  };

  // UI helpers
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStateDisplay = (): { text: string; color: string } => {
    if (!conferenceConnected) {
      return { text: 'Conference Disconnected', color: 'text-red-400' };
    }

    switch (agentState) {
      case 'connecting':
        return { text: 'Connecting AI...', color: 'text-yellow-400' };
      case 'connected':
        return { text: 'AI Connected', color: 'text-green-400' };
      case 'listening':
        return { text: 'AI Listening...', color: 'text-blue-400' };
      case 'speaking':
        return { text: 'AI Speaking...', color: 'text-purple-400' };
      case 'error':
        return { text: 'AI Error', color: 'text-red-400' };
      case 'disconnected':
        return { text: 'AI Disconnected', color: 'text-gray-400' };
      default:
        return { text: 'Initializing...', color: 'text-gray-400' };
    }
  };

  const stateDisplay = getStateDisplay();

  return (
    <>
      {/* Audio element for PlanetKit room audio — always mounted so the ref
          is available when joinConference is called during the loading phase */}
      <audio ref={audioElementRef} autoPlay playsInline className="hidden" />

      {isConnecting ? (
        <div className="h-screen w-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-16 h-16 animate-spin text-white" />
            <p className="text-white text-xl font-semibold">Initializing AI Agent Bridge...</p>
            <p className="text-gray-300 text-sm">Room: {roomId}</p>
            <p className="text-gray-300 text-sm">Language: {language === 'ko' ? '한국어' : 'English'}</p>
          </div>
        </div>
      ) : (
        <div className="h-screen w-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex flex-col">

      {/* Top Bar - Fixed */}
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

      {/* Main Content Area - Scrollable */}
      <div className="flex-1 overflow-y-auto mt-16 mb-24 px-4 py-6">
        {/* AI Avatar */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div
              className={`w-32 h-32 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-2xl ${agentState === 'speaking' ? 'animate-pulse' : ''
                }`}
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
            {/* Speaking indicator ring */}
            {agentState === 'speaking' && (
              <div className="absolute inset-0 rounded-full border-4 border-purple-400 animate-ping"></div>
            )}
          </div>
        </div>

        {/* User Info */}
        <div className="text-center mb-6">
          <p className="text-white text-lg font-medium">{profile?.displayName || 'User'}</p>
          <p className="text-gray-300 text-sm">Connected to: {roomId}</p>
          <p className="text-gray-400 text-xs mt-1">
            {participantCount > 1
              ? `${participantCount} participants in room`
              : 'Waiting for other participants...'}
          </p>
        </div>

        {/* Conference Status */}
        {conferenceConnected && (
          <Card className="bg-green-500/20 backdrop-blur-md border-green-500/30 p-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
              <span className="text-green-300 text-sm font-medium">
                Conference Active - AI can hear and speak in the room
              </span>
            </div>
          </Card>
        )}

        {/* Transcript Card */}
        {transcript && (
          <Card className="bg-white/10 backdrop-blur-md border-white/20 p-4 mb-4">
            <div className="text-white/90 text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">
              {transcript}
            </div>
          </Card>
        )}

        {/* Status Message */}
        {agentState === 'listening' && (
          <div className="text-center">
            <p className="text-blue-300 text-sm animate-pulse">
              {language === 'ko' ? '말씀해주세요...' : 'Speak now...'}
            </p>
          </div>
        )}

        {/* Bridge Info */}
        <Card className="bg-white/5 backdrop-blur-md border-white/10 p-4 mt-6">
          <h3 className="text-white font-semibold text-sm mb-2">Bridge Status:</h3>
          <div className="space-y-1 text-xs text-gray-300">
            <div className="flex justify-between">
              <span>Local Mic → AI + Room:</span>
              <span className={isMuted ? 'text-red-400' : 'text-green-400'}>
                {isMuted ? 'Muted' : 'Active'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Room → AI:</span>
              <span className={conferenceConnected ? 'text-green-400' : 'text-red-400'}>
                {conferenceConnected ? 'Active' : 'Disconnected'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>AI → Local Speaker:</span>
              <span className="text-green-400">Active</span>
            </div>
            <div className="flex justify-between">
              <span>AI → Conference Room:</span>
              <span className={conferenceConnected ? 'text-green-400' : 'text-red-400'}>
                {conferenceConnected ? 'Broadcasting' : 'Disconnected'}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Bottom Controls - Fixed */}
      <div className="fixed bottom-0 left-0 right-0 h-24 bg-black/30 backdrop-blur-sm border-t border-white/10 flex items-center justify-center gap-6 px-4">
        {/* Mute Button */}
        <Button
          size="lg"
          variant="ghost"
          onClick={handleToggleMute}
          className={`w-16 h-16 rounded-full ${isMuted
            ? 'bg-red-500/80 hover:bg-red-600/80'
            : 'bg-white/20 hover:bg-white/30'
            } backdrop-blur-sm`}
        >
          {isMuted ? (
            <MicOff className="w-8 h-8 text-white" />
          ) : (
            <Mic className="w-8 h-8 text-white" />
          )}
        </Button>

        {/* End Call Button */}
        <Button
          size="lg"
          onClick={handleEndCall}
          className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 shadow-2xl"
        >
          <PhoneOff className="w-10 h-10 text-white" />
        </Button>
      </div>
    </div>
      )}
    </>
  );
};

export default AIAgentBridgeMeeting;
