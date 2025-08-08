import 'dotenv/config';
import { 
  Agent, 
  connect as connectAgent, 
  VoicePipeline, 
} from '@livekit/agents';
import { RealtimeLLM } from '@livekit/agents-plugin-openai';

const LIVEKIT_URL = process.env.LIVEKIT_URL!;
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY!;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET!;
const ROOM_NAME = process.env.ROOM_NAME || 'test-agent';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-realtime-preview-2024-12-17';
const VOICE = process.env.VOICE || 'alloy';

async function main() {
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    throw new Error('LIVEKIT_URL/KEY/SECRET env required');
  }
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY env required');
  }

  // Realtime LLM + TTS/STT in one
  const llm = new RealtimeLLM({
    apiKey: OPENAI_API_KEY,
    model: OPENAI_MODEL,
    voice: VOICE,
    systemPrompt: 'You are a helpful Korean voice assistant. Keep responses brief and natural.',
    // language: 'ko-KR', // optional
  });

  const agent = new Agent({
    name: 'VoiceAgent',
    llm,
    // VoicePipeline will bridge tracks between LiveKit and the LLM
    voice: new VoicePipeline(),
    onTurnStart: (ctx) => {
      console.log('🎙️ User speaking...');
    },
    onTurnEnd: (ctx) => {
      console.log('🗣️ Agent replied.');
    },
  });

  console.log('Connecting voice agent to LiveKit...', { ROOM_NAME, LIVEKIT_URL });
  await connectAgent({
    url: LIVEKIT_URL,
    apiKey: LIVEKIT_API_KEY,
    apiSecret: LIVEKIT_API_SECRET,
    room: ROOM_NAME,
    participant: {
      identity: 'ai-agent',
      name: 'AI Voice Agent'
    },
    agent,
  });
}

main().catch((err) => {
  console.error('Agent crashed:', err);
  process.exit(1);
});


