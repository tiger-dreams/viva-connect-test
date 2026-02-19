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
        console.error('[HeadlessAgent] Failed to initialize');
        console.error('[HeadlessAgent] Error message:', error?.message || 'Unknown error');
        console.error('[HeadlessAgent] Error stack:', error?.stack || 'No stack trace');
        console.error('[HeadlessAgent] Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
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

      // Send audio chunk to AudioWorklet (ring buffer)
      const playbackNode = (audioCtx as any)._playbackNode;
      if (playbackNode) {
        // Transfer ownership for efficiency (avoid copying)
        playbackNode.port.postMessage(
          { audioChunk: audioData },
          [audioData.buffer]
        );
      }

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

  // Setup Audio Routing with AudioWorklet + Ring Buffer
  const setupAudioRouting = async () => {
    console.log('[HeadlessAgent] Setting up audio routing with AudioWorklet');

    // Initialize AudioContext at 24kHz (matches Gemini output)
    audioContextRef.current = new AudioContext({ sampleRate: 24000 });
    console.log('[HeadlessAgent] AudioContext created at 24kHz');

    // AudioWorklet processor code (Ring Buffer)
    const workletCode = `
class AudioPlaybackProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 48000;  // 2 seconds buffer (24kHz * 2s)
    this.ringBuffer = new Float32Array(this.bufferSize);
    this.writeIndex = 0;
    this.readIndex = 0;
    this.filled = 0;
    this.hasStarted = false;  // Track if playback has started

    // Receive audio chunks from main thread
    this.port.onmessage = (e) => {
      const chunk = e.data.audioChunk;
      if (chunk) {
        this.writeToBuffer(chunk);
      }
    };
  }

  writeToBuffer(chunk) {
    // Write chunk to ring buffer
    for (let i = 0; i < chunk.length; i++) {
      this.ringBuffer[this.writeIndex] = chunk[i];
      this.writeIndex = (this.writeIndex + 1) % this.bufferSize;
      this.filled = Math.min(this.filled + 1, this.bufferSize);
    }
  }

  process(inputs, outputs) {
    const output = outputs[0];
    if (!output || !output[0]) return true;

    const channel = output[0];

    // Initial buffering only: wait for 100ms (2400 samples) before first playback
    if (!this.hasStarted) {
      if (this.filled < 2400) {
        channel.fill(0);
        return true;
      }
      this.hasStarted = true;
    }

    // After playback started: only pause when buffer is completely empty
    // (natural silence between AI responses - no 500ms penalty)
    if (this.filled === 0) {
      this.hasStarted = false;  // Re-buffer briefly on next response
      channel.fill(0);
      return true;
    }

    // Read from ring buffer continuously (no threshold check mid-stream)
    for (let i = 0; i < channel.length; i++) {
      if (this.filled > 0) {
        channel[i] = this.ringBuffer[this.readIndex];
        this.readIndex = (this.readIndex + 1) % this.bufferSize;
        this.filled--;
      } else {
        channel[i] = 0;  // Buffer underrun - output silence
      }
    }

    return true;
  }
}

registerProcessor('audio-playback-processor', AudioPlaybackProcessor);
    `;

    // Load AudioWorklet
    const blob = new Blob([workletCode], { type: 'application/javascript' });
    const workletUrl = URL.createObjectURL(blob);

    try {
      await audioContextRef.current.audioWorklet.addModule(workletUrl);
      console.log('[HeadlessAgent] ✅ AudioWorklet loaded');
    } finally {
      URL.revokeObjectURL(workletUrl);
    }

    // Create AudioWorkletNode
    const playbackNode = new AudioWorkletNode(
      audioContextRef.current,
      'audio-playback-processor'
    );

    // Connect to MediaStreamDestination (for PlanetKit)
    mediaStreamDestRef.current = audioContextRef.current.createMediaStreamDestination();
    playbackNode.connect(mediaStreamDestRef.current);

    // Store worklet node for sending audio chunks
    (audioContextRef.current as any)._playbackNode = playbackNode;
    console.log('[HeadlessAgent] ✅ AudioWorklet connected to MediaStreamDestination');

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

    console.log('[HeadlessAgent] ✅ Audio routing setup complete (AudioWorklet + Ring Buffer)');
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
