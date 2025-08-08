LiveKit Voice Agent (Minimal)

1) 환경 변수(.env)

```
LIVEKIT_URL=wss://alllogo-lu7k4qum.livekit.cloud
LIVEKIT_API_KEY=YOUR_KEY
LIVEKIT_API_SECRET=YOUR_SECRET
ROOM_NAME=test-agent
OPENAI_API_KEY=YOUR_OPENAI_KEY
OPENAI_MODEL=gpt-4o-realtime-preview-2024-12-17
VOICE=alloy
```

2) 설치/실행

```
cd agent
npm i
npm run dev
```

빌드 실행:

```
npm run build
npm run start
```

3) 동작
- 에이전트가 LiveKit 룸 `test-agent`에 참가자로 조인합니다.
- 브라우저에서 같은 룸에 접속하면 음성으로 대화할 수 있습니다.

참고: 서버리스(Functions/Edge)는 장시간 WebRTC 연결에 적합하지 않습니다. Fly.io/Railway/EC2 등 상주형 환경에 배포하세요.


