import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { aiAgentService, AIAgentState } from '@/services/ai-agent-service';
import * as PlanetKitEval from '@line/planet-kit/dist/planet-kit-eval';

/**
 * Headless AI Agent Page
 *
 * Runs in Puppeteer (headless Chrome) on Render.com
 * - No UI (headless mode)
 * - Single Conference (AI Agent participant)
 * - Gemini AI integration
 * - Audio routing for group calls
 */

// Declare window property for Puppeteer signal
declare global {
  interface Window {
    agentConnected?: boolean;
  }
}

export const HeadlessAgentPage = () => {
  const [searchParams] = useSearchParams();

  // URL parameters
  const roomId = searchParams.get('roomId') || 'headless-room';
  const userId = searchParams.get('userId') || `AI_AGENT_${Date.now()}`;
  const language = (searchParams.get('lang') || 'ko') as 'ko' | 'en';
  const voice = searchParams.get('voice') || 'Kore';

  // State
  const [agentState, setAgentState] = useState<AIAgentState>('idle');
  const [isConnected, setIsConnected] = useState(false);

  // Refs
  const conferenceRef = useRef<any>(null);
  const audioElementRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);

  // Initialize headless agent
  useEffect(() => {
    console.log('[HeadlessAgent] Initializing...');
    console.log('[HeadlessAgent] Room:', roomId, 'User:', userId, 'Language:', language);

    const initializeAgent = async () => {
      try {
        // Step 1: Setup AI Agent Service
        setupAIAgent();

        // Step 2: Join PlanetKit Conference
        await joinPlanetKitConference();

        // Step 3: Setup Audio Routing
        await setupAudioRouting();

        setIsConnected(true);

        // Signal to Puppeteer that agent is ready
        window.agentConnected = true;
        console.log('[HeadlessAgent] ✅ Successfully connected and ready');

      } catch (error: any) {
        console.error('[HeadlessAgent] Failed to initialize:', error);
        window.agentConnected = false;
      }
    };

    initializeAgent();

    // Cleanup on unmount
    return () => {
      console.log('[HeadlessAgent] Cleaning up...');
      aiAgentService.off('stateChange', handleStateChange);
      aiAgentService.off('error', handleError);
      aiAgentService.off('audioOutput', handleAudioOutput);
      aiAgentService.disconnect();

      if (conferenceRef.current) {
        conferenceRef.current.leaveConference?.();
      }

      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // AI Agent Event Handlers
  const handleStateChange = (newState: AIAgentState) => {
    console.log('[HeadlessAgent] AI state changed:', newState);
    setAgentState(newState);
  };

  const handleError = (errorMessage: string) => {
    console.error('[HeadlessAgent] AI error:', errorMessage);
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

      // One-time: Inject AI audio stream into Conference
      if (conferenceRef.current && !conferenceRef.current._aiStreamInjected) {
        try {
          const mixedStream = mediaStreamDestRef.current.stream;
          if (typeof conferenceRef.current.setCustomMediaStream === 'function') {
            conferenceRef.current.setCustomMediaStream(mixedStream);
            conferenceRef.current._aiStreamInjected = true;
            console.log('[HeadlessAgent] ✅ AI audio stream injected into Conference');
          }
        } catch (err) {
          console.warn('[HeadlessAgent] Could not inject AI stream:', err);
        }
      }

      // Create buffer at 24kHz (Gemini native output)
      const buffer = audioCtx.createBuffer(1, audioData.length, 24000);
      buffer.getChannelData(0).set(audioData);

      const source = audioCtx.createBufferSource();
      source.buffer = buffer;

      // Schedule playback
      const now = audioCtx.currentTime;
      if (nextStartTimeRef.current < now) {
        nextStartTimeRef.current = now + 0.05;
      }

      source.start(nextStartTimeRef.current);
      nextStartTimeRef.current += buffer.duration;

      // Route AI audio to Conference
      source.connect(mediaStreamDestRef.current);

    } catch (err) {
      console.error('[HeadlessAgent] Failed to route AI audio:', err);
    }
  };

  const setupAIAgent = () => {
    console.log('[HeadlessAgent] Setting up AI Agent service');
    aiAgentService.on('stateChange', handleStateChange);
    aiAgentService.on('error', handleError);
    aiAgentService.on('audioOutput', handleAudioOutput);
  };

  // Join PlanetKit Conference
  const joinPlanetKitConference = async () => {
    console.log('[HeadlessAgent] Joining PlanetKit Conference');

    // Get PlanetKit credentials
    const serviceId = import.meta.env.VITE_PLANETKIT_EVAL_SERVICE_ID;
    const apiKey = import.meta.env.VITE_PLANETKIT_EVAL_API_KEY;
    const apiSecret = import.meta.env.VITE_PLANETKIT_EVAL_API_SECRET;

    if (!serviceId || !apiKey || !apiSecret) {
      throw new Error('PlanetKit credentials not configured');
    }

    // Generate access token
    const { generatePlanetKitToken } = await import('@/utils/token-generator');
    const accessToken = await generatePlanetKitToken(
      serviceId,
      apiKey,
      userId,
      roomId,
      3600,
      apiSecret
    );

    // Initialize Conference
    const conference = new PlanetKitEval.Conference();
    conferenceRef.current = conference;

    const conferenceDelegate = {
      evtConnected: () => {
        console.log('[HeadlessAgent] Conference connected');
      },

      evtDisconnected: (details: any) => {
        console.log('[HeadlessAgent] Conference disconnected:', details);
      },

      evtPeerListUpdated: (peerUpdateInfo: any) => {
        console.log('[HeadlessAgent] Peer list updated:', peerUpdateInfo);
      },

      evtError: (error: any) => {
        console.error('[HeadlessAgent] Conference error:', error);
      },
    };

    const conferenceParams = {
      myId: userId,
      displayName: 'AI Assistant',
      myServiceId: serviceId,
      roomId: roomId,
      roomServiceId: serviceId,
      accessToken: accessToken,
      mediaType: 'video',
      cameraOn: false,
      micOn: true,
      mediaHtmlElement: { roomAudio: audioElementRef.current },
      delegate: conferenceDelegate,
    };

    await conference.joinConference(conferenceParams);
    console.log('[HeadlessAgent] ✅ Conference joined successfully');
  };

  // Setup Audio Routing
  const setupAudioRouting = async () => {
    console.log('[HeadlessAgent] Setting up audio routing');

    // Initialize AudioContext
    audioContextRef.current = new AudioContext({ sampleRate: 48000 });
    mediaStreamDestRef.current = audioContextRef.current.createMediaStreamDestination();

    // Connect to Gemini AI
    await aiAgentService.connect({
      language,
      voice,
      systemPrompt: language === 'ko'
        ? `당신은 그룹 통화에 참여한 AI 비서입니다. 한국어로 자연스럽고 친근하게 대화하세요. 간결하고 명확하게 답변하세요.`
        : `You are an AI assistant participating in a group call. Respond naturally and helpfully in English. Keep responses concise and clear.`,
    });
    console.log('[HeadlessAgent] ✅ Gemini AI connected');

    // Route Conference room audio to Gemini (so AI hears participants)
    if (audioElementRef.current) {
      try {
        const roomStream = (audioElementRef.current as any).captureStream() as MediaStream;
        aiAgentService.addAudioSource(roomStream);
        console.log('[HeadlessAgent] ✅ Room audio → Gemini routing complete');
      } catch (err) {
        console.warn('[HeadlessAgent] Could not capture room audio:', err);
      }
    }

    console.log('[HeadlessAgent] ✅ Audio routing setup complete');
  };

  // Headless mode - minimal UI for debugging
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: '#000',
      color: '#0f0',
      fontFamily: 'monospace',
      padding: '20px',
      overflow: 'auto'
    }}>
      <audio ref={audioElementRef} autoPlay playsInline />

      <h1>🤖 Headless AI Agent</h1>
      <div style={{ marginTop: '20px', fontSize: '14px' }}>
        <div>Status: {isConnected ? '✅ Connected' : '⏳ Connecting...'}</div>
        <div>AI State: {agentState}</div>
        <div>Room: {roomId}</div>
        <div>User ID: {userId}</div>
        <div>Language: {language}</div>
        <div>Voice: {voice}</div>
        <div style={{ marginTop: '10px', color: '#ff0' }}>
          {window.agentConnected ? '✅ Ready (Puppeteer can proceed)' : '⏳ Initializing...'}
        </div>
      </div>

      <div style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
        <div>⚠️ This page runs in headless Chrome via Puppeteer</div>
        <div>⚠️ Do not access directly in browser</div>
      </div>
    </div>
  );
};

export default HeadlessAgentPage;
