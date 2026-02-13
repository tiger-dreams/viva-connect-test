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
  const [renderServiceCalled, setRenderServiceCalled] = useState(false);
  const [renderServiceStatus, setRenderServiceStatus] = useState<string>('');

  // Refs
  const callStartTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Conference 1: Real User (User A)
  const conference1Ref = useRef<any>(null);
  const audioElement1Ref = useRef<HTMLAudioElement>(null);

  // Conference 2: AI Agent
  const conference2Ref = useRef<any>(null);
  const audioElement2Ref = useRef<HTMLAudioElement>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
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
      console.log('[AIAgentBridge] Initializing 2-Conference AI Agent Bridge');
      console.log('[AIAgentBridge] Language:', language, 'Voice:', voice, 'Room:', roomId);

      try {
        // Step 1: Setup AI Agent Service event listeners
        setupAIAgent();

        // Step 2: Join 2 PlanetKit Conferences (User A + AI Agent)
        await joinPlanetKitConferences();

        // Step 3: Setup Audio Routing (Gemini connection + audio paths)
        await setupAudioRouting();

        setIsConnecting(false);
        callStartTimeRef.current = Date.now();
        startDurationTimer();

        console.log('[AIAgentBridge] ✅ 2-Conference Bridge initialized successfully');
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

      // One-time: Inject AI audio stream into Conference 2
      if (conference2Ref.current && !conference2Ref.current._aiStreamInjected) {
        try {
          const mixedStream = mediaStreamDestRef.current.stream;
          if (typeof conference2Ref.current.setCustomMediaStream === 'function') {
            conference2Ref.current.setCustomMediaStream(mixedStream);
            conference2Ref.current._aiStreamInjected = true;
            console.log('[AIAgentBridge] ✅ AI audio stream → Conference 2 injection complete');
          } else {
            console.warn('[AIAgentBridge] setCustomMediaStream not available on Conference 2');
          }
        } catch (err) {
          console.warn('[AIAgentBridge] Could not inject AI stream into Conference 2:', err);
        }
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

      // Route 1: To Conference 2 (AI Agent participant transmits to room)
      source.connect(mediaStreamDestRef.current);

      // Route 2: Local Monitor (User A hears the AI)
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

  // Conference 1 Delegate (User A)
  const conferenceDelegate1 = {
    evtConnected: () => {
      console.log('[Conference 1] User A connected');
      setConferenceConnected(true);
      setParticipantCount(1); // Local user

      toast({
        title: 'Conference Joined',
        description: `Joined as User A in room: ${roomId}`,
      });
    },

    evtDisconnected: (disconnectDetails: any) => {
      console.log('[Conference 1] User A disconnected:', disconnectDetails);
      setConferenceConnected(false);
      handleDisconnect();
    },

    evtPeerListUpdated: (peerUpdateInfo: any) => {
      const addedPeers = peerUpdateInfo.addedPeers || [];
      const removedPeers = peerUpdateInfo.removedPeers || [];

      console.log('[Conference 1] Peer list updated:', { added: addedPeers.length, removed: removedPeers.length });

      // Update participant count (User B and others)
      setParticipantCount(prev => prev + addedPeers.length - removedPeers.length);
    },

    evtError: (error: any) => {
      console.error('[Conference 1] Error:', error);
      toast({
        title: 'Conference 1 Error',
        description: error?.message || 'Unknown error in User A conference',
        variant: 'destructive',
      });
    },
  };

  // Conference 2 Delegate (AI Agent)
  const conferenceDelegate2 = {
    evtConnected: () => {
      console.log('[Conference 2] AI Agent connected');

      toast({
        title: 'AI Agent Joined',
        description: 'AI is now in the conference',
      });
    },

    evtDisconnected: (disconnectDetails: any) => {
      console.log('[Conference 2] AI Agent disconnected:', disconnectDetails);
      // Conference 1만 남아있으면 정상 동작
    },

    evtPeerListUpdated: (peerUpdateInfo: any) => {
      console.log('[Conference 2] AI peer list updated:', peerUpdateInfo);
    },

    evtError: (error: any) => {
      console.error('[Conference 2] Error:', error);
      toast({
        title: 'AI Agent Error',
        description: error?.message || 'Unknown error in AI agent conference',
        variant: 'destructive',
      });
    },
  };

  // Join PlanetKit Conferences (2 instances)
  const joinPlanetKitConferences = async () => {
    console.log('[AIAgentBridge] Joining 2 PlanetKit Conferences');

    // Get PlanetKit credentials from environment
    const serviceId = import.meta.env.VITE_PLANETKIT_EVAL_SERVICE_ID;
    const apiKey = import.meta.env.VITE_PLANETKIT_EVAL_API_KEY;
    const apiSecret = import.meta.env.VITE_PLANETKIT_EVAL_API_SECRET;

    if (!serviceId || !apiKey || !apiSecret) {
      throw new Error('PlanetKit credentials not configured');
    }

    if (!profile?.userId) {
      throw new Error('LINE profile information missing');
    }

    // User ID generation
    const userId1 = profile.userId;  // User A
    const userId2 = `AI_AGENT_${profile.userId}`;  // AI Agent

    const displayName1 = profile.displayName || 'User A';
    const displayName2 = 'AI Assistant';

    console.log('[AIAgentBridge] User A ID:', userId1);
    console.log('[AIAgentBridge] AI Agent ID:', userId2);

    // Generate tokens
    const { generatePlanetKitToken } = await import('@/utils/token-generator');
    const token1 = await generatePlanetKitToken(serviceId, apiKey, userId1, roomId, 3600, apiSecret);
    const token2 = await generatePlanetKitToken(serviceId, apiKey, userId2, roomId, 3600, apiSecret);

    // Conference 1 creation (User A)
    console.log('[AIAgentBridge] Creating Conference 1 (User A)');
    const conference1 = new PlanetKitEval.Conference();
    conference1Ref.current = conference1;

    const conferenceParams1 = {
      myId: userId1,
      displayName: displayName1,
      myServiceId: serviceId,
      roomId: roomId,
      roomServiceId: serviceId,
      accessToken: token1,
      mediaType: 'video',
      cameraOn: false,  // User A camera off
      micOn: true,      // User A mic on
      mediaHtmlElement: { roomAudio: audioElement1Ref.current },
      delegate: conferenceDelegate1,
    };

    await conference1.joinConference(conferenceParams1);
    console.log('[AIAgentBridge] ✅ Conference 1 (User A) joined successfully');

    // Small delay before joining Conference 2
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Conference 2 creation (AI Agent)
    console.log('[AIAgentBridge] Creating Conference 2 (AI Agent)');
    const conference2 = new PlanetKitEval.Conference();
    conference2Ref.current = conference2;

    const conferenceParams2 = {
      myId: userId2,
      displayName: displayName2,
      myServiceId: serviceId,
      roomId: roomId,
      roomServiceId: serviceId,
      accessToken: token2,
      mediaType: 'video',
      cameraOn: false,  // AI has no camera
      micOn: true,      // AI audio transmission needed
      mediaHtmlElement: { roomAudio: audioElement2Ref.current },  // Not used (echo prevention)
      delegate: conferenceDelegate2,
    };

    await conference2.joinConference(conferenceParams2);
    console.log('[AIAgentBridge] ✅ Conference 2 (AI Agent) joined successfully');
  };

  // Setup Audio Routing (2-Conference architecture)
  const setupAudioRouting = async () => {
    console.log('[AIAgentBridge] Setting up audio routing for 2-Conference architecture');

    // Initialize AudioContext for AI audio processing
    audioContextRef.current = new AudioContext({ sampleRate: 48000 });
    mediaStreamDestRef.current = audioContextRef.current.createMediaStreamDestination();

    // Step 1: Connect to Gemini AI
    await aiAgentService.connect({
      language,
      voice,
      systemPrompt: language === 'ko'
        ? `당신은 그룹 통화에 참여한 AI 비서입니다. 한국어로 자연스럽고 친근하게 대화하세요. 간결하고 명확하게 답변하세요.`
        : `You are an AI assistant participating in a group call. Respond naturally and helpfully in English. Keep responses concise and clear.`,
    });
    console.log('[AIAgentBridge] ✅ Gemini AI connected');

    // Step 2: Route User A's microphone to Gemini (so AI hears User A)
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = micStream;

      // Route mic to Gemini
      aiAgentService.addAudioSource(micStream);
      console.log('[AIAgentBridge] ✅ User A mic → Gemini routing complete');
    } catch (err) {
      console.error('[AIAgentBridge] Failed to capture microphone:', err);
      throw new Error('Microphone access required for AI Bridge');
    }

    // Step 3: Route Conference 1 room audio to Gemini (so AI hears User B and others)
    if (audioElement1Ref.current) {
      try {
        const roomStream = (audioElement1Ref.current as any).captureStream() as MediaStream;
        aiAgentService.addAudioSource(roomStream);
        console.log('[AIAgentBridge] ✅ Conference 1 room audio → Gemini routing complete');
      } catch (err) {
        console.warn('[AIAgentBridge] Could not capture room audio for Gemini:', err);
      }
    }

    // Step 4: AI audio output will be handled by handleAudioOutput()
    // It will inject AI audio into Conference 2 via setCustomMediaStream

    console.log('[AIAgentBridge] ✅ Audio routing setup complete');
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

  const handleCallRenderService = async () => {
    console.log('[AIAgentBridge] Calling Render Service...');
    setRenderServiceStatus('Calling Render Service...');

    const renderServiceUrl = import.meta.env.VITE_RENDER_SERVICE_URL;

    if (!renderServiceUrl) {
      toast({
        title: 'Configuration Error',
        description: 'VITE_RENDER_SERVICE_URL not configured',
        variant: 'destructive',
      });
      setRenderServiceStatus('Error: VITE_RENDER_SERVICE_URL not set');
      return;
    }

    try {
      const response = await fetch(`${renderServiceUrl}/join-as-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomId: roomId,
          userId: `AI_HEADLESS_${profile?.userId || 'guest'}`,
          language: language,
          voice: voice,
        }),
      });

      const data = await response.json();

      if (data.success) {
        console.log('[AIAgentBridge] ✅ Render Service called successfully:', data);
        toast({
          title: 'Headless AI Agent Joined',
          description: `AI Agent joined room: ${roomId}`,
        });
        setRenderServiceCalled(true);
        setRenderServiceStatus(`✅ AI Agent joined (Browser ID: ${data.browserId})`);
      } else {
        throw new Error(data.error || 'Failed to call Render Service');
      }
    } catch (error: any) {
      console.error('[AIAgentBridge] Failed to call Render Service:', error);
      toast({
        title: 'Render Service Error',
        description: error.message || 'Failed to call Headless AI Agent',
        variant: 'destructive',
      });
      setRenderServiceStatus(`❌ Error: ${error.message}`);
    }
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
    console.log('[AIAgentBridge] Cleaning up 2 Conferences');

    // Clean up Conference 1 (User A)
    if (conference1Ref.current && typeof conference1Ref.current.leaveConference === 'function') {
      try {
        await conference1Ref.current.leaveConference();
        console.log('[AIAgentBridge] Conference 1 left');
      } catch (err) {
        console.warn('[AIAgentBridge] Error leaving Conference 1:', err);
      }
      conference1Ref.current = null;
    }

    // Clean up Conference 2 (AI Agent)
    if (conference2Ref.current && typeof conference2Ref.current.leaveConference === 'function') {
      try {
        await conference2Ref.current.leaveConference();
        console.log('[AIAgentBridge] Conference 2 left');
      } catch (err) {
        console.warn('[AIAgentBridge] Error leaving Conference 2:', err);
      }
      conference2Ref.current = null;
    }
  };

  const cleanupAudioBridge = () => {
    console.log('[AIAgentBridge] Cleaning up audio resources');

    // Stop microphone tracks
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }

    // Close AudioContext
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => { });
      audioContextRef.current = null;
    }

    // Clear MediaStream references
    mediaStreamDestRef.current = null;

    // Stop audio element streams
    if (audioElement1Ref.current?.srcObject) {
      const tracks = (audioElement1Ref.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      audioElement1Ref.current.srcObject = null;
    }

    if (audioElement2Ref.current?.srcObject) {
      const tracks = (audioElement2Ref.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      audioElement2Ref.current.srcObject = null;
    }

    console.log('[AIAgentBridge] ✅ Cleanup complete');
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
      {/* Conference 1 (User A) room audio - User A hears AI + User B */}
      <audio ref={audioElement1Ref} autoPlay playsInline className="hidden" />

      {/* Conference 2 (AI Agent) room audio - 사용 안함 (에코 방지) */}
      <audio ref={audioElement2Ref} autoPlay={false} playsInline className="hidden" />

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
          <span className="text-xs text-white/70">User A + AI Agent</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-white" />
            <span className="text-white text-sm">{participantCount + 1}</span> {/* +1 for AI Agent */}
          </div>
          <span className="text-white font-mono text-sm">{formatDuration(callDuration)}</span>
        </div>
      </div>

      {/* Main Content Area - Scrollable */}
      <div className="flex-1 overflow-y-auto mt-16 mb-24 px-4 py-6">
        {/* Participants Display */}
        <div className="flex justify-center mb-8 gap-6">
          {/* User A */}
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-blue-500 flex items-center justify-center shadow-lg">
              <span className="text-white text-3xl">👤</span>
            </div>
            <span className="text-white text-sm mt-2 font-medium">{profile?.displayName || 'User A'}</span>
            <span className="text-gray-400 text-xs">Conference 1</span>
          </div>

          {/* AI Agent */}
          <div className="flex flex-col items-center">
            <div className="relative">
              <div
                className={`w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg ${
                  agentState === 'speaking' ? 'animate-pulse' : ''
                }`}
              >
                <span className="text-white text-3xl">🤖</span>
              </div>
              {/* Speaking indicator ring */}
              {agentState === 'speaking' && (
                <div className="absolute inset-0 rounded-full border-4 border-purple-400 animate-ping"></div>
              )}
            </div>
            <span className="text-white text-sm mt-2 font-medium">AI Assistant</span>
            <span className="text-gray-400 text-xs">Conference 2</span>
          </div>
        </div>

        {/* Room Info */}
        <div className="text-center mb-6">
          <p className="text-gray-300 text-sm">Room: {roomId}</p>
          <p className={`text-xs ${stateDisplay.color} mt-1`}>{stateDisplay.text}</p>
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

        {/* Render Service Test */}
        <Card className="bg-purple-500/10 backdrop-blur-md border-purple-500/30 p-4 mt-4">
          <h3 className="text-white font-semibold text-sm mb-2">🚀 Headless AI Agent (Render Service)</h3>
          <p className="text-gray-300 text-xs mb-3">
            Call a headless Chrome instance on Render.com to join this room as an AI agent.
          </p>
          <Button
            onClick={handleCallRenderService}
            disabled={renderServiceCalled || !conferenceConnected}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
          >
            {renderServiceCalled ? '✅ Headless AI Called' : '🤖 Call Headless AI Agent'}
          </Button>
          {renderServiceStatus && (
            <p className="text-xs text-gray-300 mt-2">{renderServiceStatus}</p>
          )}
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
