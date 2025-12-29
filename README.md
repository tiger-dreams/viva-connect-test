# LINE PlanetKit LIFF Demo

A mobile-first LINE LIFF application featuring **Conference Call** (multi-party video) and **Agent Call** (outbound audio caller) using LINE's PlanetKit Web SDK 5.5.

## Features

### Conference Call (Group Video) 🎥

- **LINE LIFF Integration**: Seamless authentication with LINE login
- **PlanetKit Conference API**: Enterprise-grade multi-party video conferencing
- **Mobile-Optimized UI**: Portrait-mode layout optimized for mobile devices
- **Multi-Room Support**: Choose from Japan, Korea, Taiwan, or Thailand rooms
- **Real-time Communication**: HD video/audio with low latency
- **Smart Grid Layout**: Adaptive video grid (1x1, 2x1 vertical split, 2x2)
- **Connection Status**: Live call duration, participant count, and room info
- **Auto-Redirect**: Seamless navigation after call disconnect
- **Custom Credentials**: Use your own PlanetKit Service ID for integration with existing services

### Agent Call (Outbound Audio Caller) 📞

- **One-click Outbound Calls**: Initiate audio calls to LINE users
- **Smart Timeout System**: 60-second call acceptance window with clear notification
- **Automatic Retry**: User-controlled retry scheduling (5-minute intervals, max 3 attempts)
- **LINE Push Notifications**: Real-time notifications with interactive buttons
- **Auto-accept Flow**: Seamless call connection from notification tap
- **Multi-language Support**: Korean and English (default for international users)
- **QStash Integration**: Reliable delayed job scheduling for retries
- **Database Tracking**: Full session and event logging with Vercel Postgres

## Tech Stack

- **Frontend**: Vite + React 18 + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **Video/Audio SDK**: LINE PlanetKit Web SDK 5.5.0 (Conference + Agent Call)
- **Authentication**: LINE LIFF (LINE Front-end Framework)
- **Backend**: Vercel Serverless Functions
- **Database**: Vercel Postgres (powered by Neon)
- **Job Scheduling**: Upstash QStash
- **Notifications**: LINE Messaging API
- **State Management**: React Context API + localStorage
- **Routing**: React Router DOM

## Prerequisites

- Node.js 18+ and npm
- LINE Developer Account
- PlanetKit Service ID and API credentials
- LIFF App ID

## Installation

```bash
# Clone the repository
git clone <YOUR_GIT_URL>
cd viva-connect-test

# Install dependencies
npm install
```

## Environment Variables

Create a `.env` file in the root directory:

```env
# LINE LIFF
VITE_LIFF_ID=your-liff-id

# PlanetKit Evaluation Environment
VITE_PLANETKIT_EVAL_SERVICE_ID=your-eval-service-id
VITE_PLANETKIT_EVAL_API_KEY=your-eval-api-key
VITE_PLANETKIT_EVAL_API_SECRET=your-eval-api-secret

# PlanetKit Real Environment (Production)
VITE_PLANETKIT_REAL_SERVICE_ID=your-real-service-id
VITE_PLANETKIT_REAL_API_KEY=your-real-api-key
VITE_PLANETKIT_REAL_API_SECRET=your-real-api-secret

# PlanetKit Agent Call
PLANETKIT_AGENT_CALL_BASE_URL=https://vpnx-stn-api.line-apps-rc.com
VITE_PLANETKIT_AUDIO_FILE_GREETING=contentId-for-greeting

# LINE Messaging API (for Agent Call notifications)
LINE_CHANNEL_ID=your-channel-id
LINE_CHANNEL_SECRET=your-channel-secret

# Upstash QStash (for Agent Call retry scheduling)
QSTASH_TOKEN=your-qstash-token

# Database (Auto-configured by Vercel)
POSTGRES_URL=postgres://...
```

## Development

```bash
# Start development server (runs on port 8080)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## Project Structure

```
src/
├── components/
│   ├── ui/                        # shadcn/ui components
│   ├── PlanetKitConfigPanel.tsx   # Configuration panel
│   ├── PlanetKitMeetingArea.tsx   # Main meeting interface
│   └── TileView.tsx               # Video grid layout
├── pages/
│   ├── SetupPage.tsx              # Setup and configuration
│   ├── PlanetKitMeeting.tsx       # Conference call meeting page
│   ├── AgentCallTrigger.tsx       # Agent call trigger page
│   ├── AgentCallMeeting.tsx       # Agent call meeting page
│   └── ScheduleRetry.tsx          # Retry scheduling page
├── contexts/
│   ├── LiffContext.tsx            # LINE LIFF state management
│   └── VideoSDKContext.tsx        # PlanetKit config management
├── hooks/
│   └── use-liff.ts                # LIFF authentication hook
├── types/
│   └── video-sdk.ts               # TypeScript interfaces
└── utils/
    └── token-generator.ts         # JWT token generation

api/
├── agent-call-callback.ts         # Agent Call status callback
├── one-to-one-call-callback.ts    # Call end/timeout callback
├── notify-callback.ts             # PlanetKit notify callback
├── schedule-retry.ts              # Retry scheduling endpoint
├── execute-retry.ts               # QStash retry execution
└── get-line-token.ts              # LINE token endpoint

docs/
├── ARCHITECTURE.md                # System architecture documentation
├── RELEASE_NOTES.md               # Release notes (Markdown)
└── RELEASE_NOTES_PLAIN.txt        # Release notes (Plain text)
```

## Usage

### Conference Call (Group Video)

#### 1. Setup
- Open the app in LINE browser (LIFF)
- Log in with your LINE account
- Select environment (Evaluation or Real)
- Choose a room (Japan, Korea, Taiwan, or Thailand)
- Generate access token

#### 2. Join Meeting
- Click "참여하기" (Join) button
- Allow camera and microphone permissions
- Start video conferencing

#### 3. In-Meeting Controls
- **Video Toggle**: Turn camera on/off
- **Audio Toggle**: Mute/unmute microphone
- **Disconnect**: End call and return to setup

### Agent Call (Outbound Audio Caller)

#### 1. Initiate Call
- Navigate to `/agent-call` in LIFF
- Call is automatically initiated
- LIFF window closes after 2 seconds

#### 2. Receive Call
- Receive LINE push notification
- Notification shows: "📞 Incoming call! Please accept within 60 seconds"
- Tap "Accept Call" button
- Call connects automatically

#### 3. Call Timeout & Retry
- If call not answered within 60 seconds:
  - Receive timeout notification
  - Option: "5분 후 다시 받기" (Retry in 5 min)
  - Confirmation: "You will receive a call in about 5 minutes"
  - System automatically retries after 5 minutes
  - Maximum 3 retry attempts

#### 4. During Call
- Audio-only conversation
- Call ends when either party disconnects
- Automatically redirects to setup page

For detailed architecture and data flow, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Custom Credentials (Advanced Settings)

### Overview

기존 고객님의 요청에 따라, 이미 PlanetKit App Service를 운영 중인 고객사가 자신들의 Service ID, API Key, API Secret을 사용하여 이 LIFF Demo와 연동할 수 있는 기능을 추가하였습니다. 이를 통해 기존 서비스와 LIFF 간 Group Call이 가능합니다.

### How to Use

1. **Setup 페이지**에서 "고급 설정 (Advanced Settings)" 섹션을 찾습니다
2. **Switch를 ON**으로 변경합니다
3. 다음 정보를 입력합니다:
   - **Environment**: Evaluation 또는 Real 선택
   - **Service ID**: 귀사의 PlanetKit Service ID
   - **API Key**: 귀사의 PlanetKit API Key
   - **API Secret**: 귀사의 PlanetKit API Secret
4. 입력한 정보는 **localStorage에 자동 저장**되어 재방문 시에도 유지됩니다
5. 룸 선택 후 참여하시면 귀사의 credentials로 Group Call이 생성됩니다

### Security & Privacy

- ⚠️ **모든 인증 정보는 사용자의 브라우저 localStorage에만 저장됩니다**
- ✅ **LIFF Demo 개발자는 입력하신 Service ID, API Key, API Secret 정보를 수집하거나 취득하지 않습니다**
- ⚠️ **토큰 생성은 클라이언트 측에서 이루어지므로, 프로덕션 환경에서는 서버 측 토큰 생성을 권장합니다**
- 🔒 **API Secret은 password 필드로 입력되며 화면에 표시되지 않습니다**

### Feature Limitations

Custom credentials를 사용하시는 경우, 다음 기능이 제한됩니다:

#### ❌ 사용 불가능한 기능
- **최근 통화 상대 목록**: Group Call callback 정보가 다른 Service ID와 매칭되지 않아 사용할 수 없습니다
- **전체 사용자 목록**: Database에 저장된 사용자 정보가 LIFF Demo의 Service ID 기반이므로 조회되지 않습니다
- **직접 LINE 메시지 초대**: LIFF Demo의 LINE Channel credentials를 사용하므로 작동하지 않습니다

#### ✅ 계속 사용 가능한 기능
- **LIFF Share Target Picker**: LINE의 친구 선택 화면을 통한 초대는 정상 작동합니다
- **초대 URL 복사**: 초대 링크를 복사하여 공유하는 기능은 정상 작동합니다
- **Group Call 기본 기능**: 영상/음성 통화, 화면 공유 등 모든 Group Call 기능은 정상 작동합니다

### Technical Details

**Credentials Priority:**
```
1순위: Custom Credentials (사용자가 입력한 정보)
2순위: Environment Variables (LIFF Demo 기본 설정)
3순위: Default Empty Values
```

**Group Call Callback 제한 이유:**
- PlanetKit Group Call callback은 Service ID별로 관리됩니다
- LIFF Demo의 Database는 Demo용 Service ID의 callback 정보만 저장합니다
- 다른 Service ID로 생성된 Group Call의 callback 정보는 LIFF Demo Database에 저장되지 않습니다
- 따라서 Custom credentials 사용 시 최근 통화 상대 목록 기능이 작동하지 않습니다

### Disabling Custom Credentials

고급 설정의 Switch를 **OFF**로 변경하시면:
- 즉시 LIFF Demo의 기본 credentials(환경 변수)로 복원됩니다
- 모든 제한 기능이 다시 활성화됩니다
- 입력하신 Custom credentials 정보는 localStorage에 보관되어 재사용 가능합니다

## Mobile UI Layout

- **Top Bar**: Call duration, participant count, room name
- **Video Grid**: Full-screen adaptive layout
  - 1 participant: Full screen
  - 2 participants: Vertical split (50/50)
  - 3-4 participants: 2x2 grid
- **Bottom Controls**: Large circular buttons for easy touch

## Room Configuration

Choose from 4 available rooms:
- 🇯🇵 **Japan**: For Japan-based users
- 🇰🇷 **Korea**: For Korea-based users
- 🇹🇼 **Taiwan**: For Taiwan-based users
- 🇹🇭 **Thailand**: For Thailand-based users

Users in the same room can see and communicate with each other.

## Environment Types

- **Evaluation**: Testing environment (`voipnx-saturn.line-apps-rc.com`)
- **Real**: Production environment (`voipnx-saturn.line-apps.com`)

## Deployment

Deploy to Vercel:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Deploy to production
vercel --prod
```

Make sure to set environment variables in Vercel dashboard.

## Browser Support

- Chrome/Edge 100+
- Safari 16.4+ (Desktop/iOS)
- LINE In-App Browser (LIFF)
- **Note**: WebView has limited support (no screen share)

## Security Notes

- **Client-side token generation**: For development/testing only
- **API credentials**: Store securely in environment variables
- **Production deployment**: Use server-side token generation
- **LIFF authentication**: Validated through LINE Platform

## Recent Updates

### December 28, 2025
- **Agent Call Feature**: Complete outbound audio caller system
  - One-click call initiation with auto-close
  - 60-second timeout with clear warnings
  - Smart retry system with QStash scheduling
  - Multi-language support (Korean + English default)
  - Auto-accept and auto-redirect flow
  - LINE push notifications with interactive buttons
- **Backend Infrastructure**: Vercel Functions + Neon DB + QStash
- **Callback System**: Multiple PlanetKit callback handlers
- **Documentation**: Added ARCHITECTURE.md and RELEASE_NOTES.md

### December 26, 2025
- **Custom Credentials Feature**: Use your own PlanetKit Service credentials
- **Advanced Settings UI**: Toggle and input fields for custom credentials
- **Feature Restrictions**: Clear indication of limitations with custom credentials
- **localStorage Integration**: Automatic saving and restoration

### November 2024
- Upgraded to PlanetKit 5.5
- Added LINE LIFF integration
- Implemented multi-room support
- Mobile-first UI optimization

## License

MIT

## Documentation

- **[Architecture Guide](docs/ARCHITECTURE.md)**: Detailed system architecture, data flows, and technical details
- **[Release Notes (MD)](docs/RELEASE_NOTES.md)**: Customer-facing release notes in Markdown format
- **[Release Notes (TXT)](docs/RELEASE_NOTES_PLAIN.txt)**: Plain text version for LINE Official Account messages

## Support

For issues and questions, please create an issue in the GitHub repository.

## Links

- **Live Demo**: https://viva-connect-test.vercel.app
- **LINE PlanetKit Docs**: https://docs.lineplanet.me/
- **LINE LIFF Docs**: https://developers.line.biz/en/docs/liff/
