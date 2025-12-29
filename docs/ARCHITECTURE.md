# System Architecture

## Overview

This document describes the system architecture for the LIFF Demo application, including Conference Call (multi-party video) and Agent Call (outbound audio caller) features.

---

## Technology Stack

### 1. **Frontend Hosting**
- **Vercel** - React 앱 배포 및 호스팅
  - LIFF 앱 (Setup, Meeting, Agent Call 페이지)
  - Static assets

### 2. **Backend API**
- **Vercel Serverless Functions** - API 엔드포인트
  - `/api/agent-call-callback.ts` - Agent Call 상태 콜백
  - `/api/one-to-one-call-callback.ts` - 통화 종료/타임아웃 콜백
  - `/api/notify-callback.ts` - PlanetKit notify 콜백
  - `/api/schedule-retry.ts` - 재시도 예약 처리
  - `/api/execute-retry.ts` - QStash 재시도 실행
  - `/api/get-line-token.ts` - LINE 토큰 발급

### 3. **Database**
- **Vercel Postgres (powered by Neon)** - 메인 데이터베이스
  - `agent_call_sessions` - 통화 세션 정보
  - `agent_call_events` - 콜백 이벤트 로그
  - `agent_call_retry_queue` - 재시도 큐

### 4. **Callback 수신**
- **PlanetKit → Vercel Serverless Functions**
  - Agent Call 상태: `agent-call-callback`
  - 통화 이벤트: `one-to-one-call-callback`
  - Notify 이벤트: `notify-callback`

### 5. **Scheduled Jobs / Retry System**
- **Upstash QStash** - 지연 작업 스케줄러
  - 5분 지연 재시도 스케줄링
  - `/api/execute-retry` 엔드포인트 호출
  - 300초(5분) 딜레이 설정

### 6. **External Services**
- **LINE Platform**
  - LINE Messaging API - 푸시 알림 전송
  - LINE LIFF - 웹앱 인증 및 실행
- **LINE PlanetKit**
  - Agent Call API - 발신 전용 음성 통화
  - Conference API - 그룹 화상 통화

### 7. **Token Generation**
- **Client-side (Browser)** - Development/Testing only
  - `generatePlanetKitToken()` - JWT 생성 (jose 라이브러리)
  - ⚠️ Production에서는 서버 사이드 권장

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        USER (LINE App)                       │
└───────────────────────────┬─────────────────────────────────┘
                            │
                    ┌───────▼────────┐
                    │   LINE LIFF    │
                    │   (Vercel)     │
                    └───────┬────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
   ┌────▼────┐         ┌────▼────┐       ┌─────▼─────┐
   │ Setup   │         │ Meeting │       │Agent Call │
   │  Page   │         │  Page   │       │  Trigger  │
   └────┬────┘         └────┬────┘       └─────┬─────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                    ┌───────▼────────┐
                    │  Vercel Edge   │
                    │  (Serverless)  │
                    └───────┬────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
   ┌────▼──────┐      ┌─────▼─────┐     ┌──────▼──────┐
   │ Callback  │      │  Retry    │     │ LINE Token  │
   │ Endpoints │      │ Scheduler │     │   Manager   │
   └────┬──────┘      └─────┬─────┘     └──────┬──────┘
        │                   │                   │
        │              ┌────▼────┐              │
        │              │ QStash  │              │
        │              │(Upstash)│              │
        │              └────┬────┘              │
        │                   │ (5 min delay)    │
        │              ┌────▼────┐              │
        │              │ Execute │              │
        │              │  Retry  │              │
        │              └────┬────┘              │
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                    ┌───────▼────────┐
                    │Vercel Postgres │
                    │   (Neon DB)    │
                    └───────┬────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
   ┌────▼────┐         ┌────▼────┐       ┌─────▼─────┐
   │Sessions │         │ Events  │       │Retry Queue│
   │  Table  │         │  Table  │       │   Table   │
   └─────────┘         └─────────┘       └───────────┘

┌─────────────────────────────────────────────────────────────┐
│                   EXTERNAL SERVICES                          │
│                                                              │
│  ┌──────────────┐        ┌─────────────────┐               │
│  │ LINE Platform│◄───────┤ LINE PlanetKit  │               │
│  │              │        │                 │               │
│  │ • Messaging  │        │ • Agent Call    │               │
│  │ • LIFF Auth  │        │ • Conference    │               │
│  └──────────────┘        └─────────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Conference Call (Multi-party Video) 🎥

**Simple P2P WebRTC Connection**

```
┌─────────────────────────────────────────────────────────────┐
│                  1. Join Conference                          │
└─────────────────────────────────────────────────────────────┘

User A                                                    User B
  │                                                         │
  │ 1. Open LIFF Setup Page                                │
  │ 2. Select Room (JP/KR/TW/TH)                           │
  │ 3. Click "Join Meeting"                                │
  │                                                         │
  ├──────────► PlanetKit Conference API ◄──────────────────┤
  │            (WebRTC Signaling)                           │
  │                                                         │
  │ 4. Generate JWT Token (client-side)                    │
  │    - Service ID + API Key + User ID                    │
  │    - Room ID                                            │
  │                                                         │
  │ 5. Connect to Conference                               │
  │    - SDK: conference.connect(...)                      │
  │                                                         │
  │◄═════════════ WebRTC Media Stream ═══════════════════►│
  │              (Direct P2P Connection)                    │
  │                                                         │
  │ 6. Video/Audio Tracks Exchange                         │
  │    - Camera, Microphone                                │
  │    - Speaking Detection                                │
  │    - Adaptive Video Grid (TileView)                    │
  │                                                         │
  │ 7. Disconnect                                          │
  │    - SDK: conference.disconnect()                      │
  │    - Navigate to /setup                                │
  │                                                         │

┌─────────────────────────────────────────────────────────────┐
│             No Database, No Backend API                      │
│        All state managed client-side in browser              │
└─────────────────────────────────────────────────────────────┘
```

**Key Points:**
- ✅ **No server-side state** - 완전히 클라이언트 사이드
- ✅ **No callbacks** - 백엔드 콜백 없음
- ✅ **No database** - DB 저장 없음
- ✅ **Direct WebRTC** - PlanetKit이 시그널링만 처리, 미디어는 P2P
- ✅ **Room-based** - 같은 Room ID를 입력한 유저끼리만 연결
- ✅ **Client-side token** - 브라우저에서 JWT 생성 (개발/테스트용)

**Conference Call Components:**
- `src/pages/SetupPage.tsx` - Room 선택, 설정
- `src/pages/PlanetKitMeeting.tsx` - Meeting 페이지 래퍼
- `src/components/PlanetKitMeetingArea.tsx` - 실제 Conference 로직
- `src/components/TileView.tsx` - 비디오 그리드 레이아웃

---

### Agent Call (Outbound Audio Caller) 📞

**Complex Server-side Orchestration**

#### 1️⃣ **Agent Call 시작**

```
User
  │
  │ 1. Navigate to /agent-call in LIFF
  │
  ├──────────► Vercel API
  │            POST /api/trigger-agent-call
  │
  │ 2. Create session in DB
  │
  ├──────────► Neon DB
  │            INSERT INTO agent_call_sessions
  │            (sid, callee_user_id, status='initiated')
  │
  │ 3. Call PlanetKit Agent Call API
  │
  ├──────────► PlanetKit Agent Call API
  │            POST /agent-call/make-call
  │            { serviceId, calleeUserId, audioFileIds }
  │
  │ 4. Auto-close LIFF window (2 seconds)
  │
  └──────────► LIFF window closes
```

#### 2️⃣ **Callback 수신 및 알림**

```
PlanetKit
  │
  │ Callback 1: Agent Call Status
  │
  ├──────────► Vercel API
  │            POST /api/agent-call-callback
  │            { sid, result='SUCCESS', fail_reason }
  │
  ├──────────► Neon DB
  │            UPDATE agent_call_sessions
  │            SET status='ringing'
  │
  │
  │ Callback 2: Notify Event
  │
  ├──────────► Vercel API
  │            POST /api/notify-callback
  │            { sid, cc_param }
  │
  ├──────────► Neon DB
  │            UPDATE agent_call_sessions
  │            SET cc_param='xxx'
  │
  ├──────────► LINE Messaging API
  │            Push notification with Button
  │            "📞 Incoming call! Please accept within 60 seconds"
  │            [Accept Call] button
  │
  └──────────► User receives LINE message
```

#### 3️⃣ **통화 수락 또는 타임아웃**

**Case A: User Accepts**

```
User clicks [Accept Call]
  │
  ├──────────► LIFF opens
  │            /agent-call-meeting?sid=xxx&cc_param=yyy&autoAccept=true
  │
  ├──────────► Initialize PlanetKit Config
  │            - Load LIFF profile
  │            - Generate JWT token
  │            - Auto-accept call
  │
  ├──────────► PlanetKit Conference API
  │            conference.connect(...)
  │
  │◄═════════ WebRTC Media Stream ══════════►│
  │           (Audio only)                    │ Agent
  │                                           │ (Audio File)
  │
  │ Call ends
  │
  ├──────────► Vercel API (Callback)
  │            POST /api/one-to-one-call-callback
  │            { event_type='DISCONNECTED', terminate='16' }
  │
  ├──────────► Neon DB
  │            UPDATE agent_call_sessions
  │            SET status='ended'
  │
  └──────────► Navigate to /setup
```

**Case B: User Timeout (60 seconds)**

```
PlanetKit detects timeout
  │
  ├──────────► Vercel API
  │            POST /api/one-to-one-call-callback
  │            { terminate='18', rel_code_str='NO_ANSWER' }
  │
  │ Timeout Detection Logic:
  │ - terminate === '18' (Q.850: NO_ANSWER)
  │ - rel_code_str === 'NO_ANSWER'
  │ - disconnect_reason === '1203'
  │
  ├──────────► Neon DB
  │            UPDATE agent_call_sessions
  │            SET status='missed', timeout_at=NOW()
  │
  ├──────────► LINE Messaging API
  │            Push notification
  │            "Call acceptance timeout. You can receive a call again in 5 minutes."
  │            [5분 후 다시 받기] button
  │
  └──────────► User receives retry option
```

#### 4️⃣ **재시도 스케줄링**

```
User clicks [5분 후 다시 받기]
  │
  ├──────────► LIFF opens
  │            /schedule-retry?sid=xxx
  │
  ├──────────► Vercel API
  │            POST /api/schedule-retry
  │            { sid, retry_attempt }
  │
  ├──────────► Neon DB
  │            INSERT INTO agent_call_retry_queue
  │            (original_sid, status='scheduled')
  │
  ├──────────► Upstash QStash
  │            POST with 300-second delay
  │            → /api/execute-retry
  │
  ├──────────► LINE Messaging API
  │            Confirmation message
  │            "✅ Retry scheduled. You will receive a call in about 5 minutes."
  │
  │
  │ ⏳ Wait 5 minutes...
  │
  │
QStash triggers after 5 minutes
  │
  ├──────────► Vercel API
  │            POST /api/execute-retry
  │            { queueId, originalSid, calleeUserId }
  │
  ├──────────► Check if user is busy
  │            Query agent_call_sessions
  │            WHERE status IN ('ringing', 'answered', 'initiated')
  │            AND created_at > NOW() - INTERVAL '2 minutes'
  │
  │ If not busy:
  │
  ├──────────► PlanetKit Agent Call API
  │            POST /agent-call/make-call
  │            (Same as step 1)
  │
  ├──────────► Neon DB
  │            UPDATE retry_queue SET status='executed'
  │            INSERT new session with retry_count++
  │
  └──────────► Repeat from step 2 (Callback 수신)
               Maximum 3 retry attempts
```

---

## Key Differences: Conference Call vs Agent Call

| Feature | Conference Call 🎥 | Agent Call 📞 |
|---------|-------------------|---------------|
| **Direction** | Peer-to-peer (양방향) | Outbound only (발신 전용) |
| **Media** | Video + Audio | Audio only |
| **Connection** | Direct WebRTC | Agent → User (단방향) |
| **Backend State** | ❌ None | ✅ Database tracking |
| **Callbacks** | ❌ None | ✅ Multiple callbacks |
| **Database** | ❌ Not used | ✅ Sessions, Events, Queue |
| **Retry Logic** | ❌ N/A | ✅ QStash scheduling |
| **LINE Notifications** | ❌ None | ✅ Push messages |
| **Token Generation** | Client-side | Client-side (Dev only) |
| **Complexity** | Simple | Complex |

---

## Database Schema

### `agent_call_sessions`

```sql
CREATE TABLE agent_call_sessions (
  id SERIAL PRIMARY KEY,
  sid VARCHAR(255) UNIQUE NOT NULL,
  room_id VARCHAR(255),
  callee_user_id VARCHAR(255) NOT NULL,
  audio_file_ids JSONB,
  language VARCHAR(10) DEFAULT 'ko',
  status VARCHAR(50) DEFAULT 'initiated',
  cc_param TEXT,
  retry_count INTEGER DEFAULT 0,
  timeout_notification_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  initiated_at TIMESTAMP,
  answered_at TIMESTAMP,
  timeout_at TIMESTAMP,
  ended_at TIMESTAMP,
  data JSONB
);
```

### `agent_call_events`

```sql
CREATE TABLE agent_call_events (
  id SERIAL PRIMARY KEY,
  sid VARCHAR(255) NOT NULL,
  event_type VARCHAR(100),
  status VARCHAR(100),
  timestamp BIGINT,
  data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### `agent_call_retry_queue`

```sql
CREATE TABLE agent_call_retry_queue (
  id SERIAL PRIMARY KEY,
  original_sid VARCHAR(255) NOT NULL,
  callee_user_id VARCHAR(255) NOT NULL,
  audio_file_ids JSONB,
  language VARCHAR(10) DEFAULT 'ko',
  retry_attempt INTEGER NOT NULL,
  status VARCHAR(50) DEFAULT 'scheduled',
  scheduled_at TIMESTAMP DEFAULT NOW(),
  executed_at TIMESTAMP,
  data JSONB
);
```

---

## Environment Variables

```bash
# LINE LIFF
VITE_LIFF_ID=your-liff-id

# PlanetKit Evaluation
VITE_PLANETKIT_EVAL_SERVICE_ID=your-eval-service-id
VITE_PLANETKIT_EVAL_API_KEY=your-eval-api-key
VITE_PLANETKIT_EVAL_API_SECRET=your-eval-api-secret

# PlanetKit Real (Production)
VITE_PLANETKIT_REAL_SERVICE_ID=your-real-service-id
VITE_PLANETKIT_REAL_API_KEY=your-real-api-key
VITE_PLANETKIT_REAL_API_SECRET=your-real-api-secret

# PlanetKit Agent Call
PLANETKIT_AGENT_CALL_BASE_URL=https://vpnx-stn-api.line-apps-rc.com

# Audio Files
VITE_PLANETKIT_AUDIO_FILE_GREETING=contentId-for-greeting

# LINE Messaging API
LINE_CHANNEL_ID=your-channel-id
LINE_CHANNEL_SECRET=your-channel-secret

# Upstash QStash
QSTASH_TOKEN=your-qstash-token

# Database (Auto-configured by Vercel)
POSTGRES_URL=postgres://...
```

---

## Deployment

### Vercel Configuration

```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "outputDirectory": "dist"
}
```

### Auto Deployment

- **GitHub Integration**: Push to `main` branch triggers auto-deployment
- **Preview Deployments**: Every PR gets a unique preview URL
- **Environment Variables**: Managed via Vercel dashboard

---

## Security Considerations

1. **Token Generation**
   - ⚠️ Current: Client-side JWT generation (Development/Testing only)
   - ✅ Production: Implement server-side token endpoint

2. **API Credentials**
   - Store in Vercel environment variables
   - Never commit to repository
   - Rotate regularly

3. **Database**
   - Vercel Postgres uses SSL by default
   - Connection pooling enabled
   - Automatic backups

4. **CORS**
   - Configured for Vercel domain
   - Supports localhost for development

5. **LIFF Authentication**
   - LINE Platform validates user identity
   - No password management required

---

## Monitoring & Logging

### Vercel Logs
- **Function Logs**: Each API call logged with timestamps
- **Build Logs**: Deployment history and build outputs
- **Runtime Logs**: Error tracking and performance metrics

### Console Logging
- `[Agent Call Callback]` - Agent Call status updates
- `[1-to-1 Call Callback]` - Timeout and disconnect events
- `[Timeout Notification]` - LINE message sending
- `[QStash]` - Retry scheduling and execution

### Database Monitoring
- Neon dashboard for query performance
- Connection pool metrics
- Storage usage tracking

---

## Future Improvements

1. **Server-side Token Generation**
   - Create `/api/generate-token` endpoint
   - Remove client-side JWT generation

2. **Enhanced Retry Logic**
   - Exponential backoff (5 min → 15 min → 30 min)
   - Custom retry intervals per user

3. **Call History**
   - Store all call records
   - User dashboard for call logs

4. **Analytics**
   - Call success rate tracking
   - Average call duration
   - Retry effectiveness metrics

5. **Multi-language Support**
   - Add Thai, Traditional Chinese
   - User language preference storage

6. **Webhook Security**
   - Signature verification for PlanetKit callbacks
   - Request origin validation

---

**Last Updated**: December 29, 2025
**Version**: 1.1.0
