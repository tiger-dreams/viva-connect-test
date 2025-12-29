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
- Click "Join Meeting" button
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
  - Option: "Retry in 5 min" button
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

This feature allows customers who are already operating a PlanetKit App Service to integrate their own Service ID, API Key, and API Secret with this LIFF Demo, enabling Group Calls between existing services and LIFF.

### How to Use

1. Go to **Setup Page** and find the "Advanced Settings" section
2. Toggle the switch to **ON**
3. Enter the following information:
   - **Environment**: Select Evaluation or Real
   - **Service ID**: Your PlanetKit Service ID
   - **API Key**: Your PlanetKit API Key
   - **API Secret**: Your PlanetKit API Secret
4. All information is **automatically saved to localStorage** and persists across visits
5. After selecting a room and joining, Group Calls will be created using your credentials

### Security & Privacy

- ⚠️ **All credentials are stored only in the user's browser localStorage**
- ✅ **LIFF Demo developers do NOT collect or access your Service ID, API Key, or API Secret**
- ⚠️ **Token generation occurs client-side; server-side token generation is recommended for production**
- 🔒 **API Secret is entered as a password field and is not displayed on screen**

### Feature Limitations

When using custom credentials, the following features are restricted:

#### ❌ Unavailable Features
- **Recent Call Contacts**: Group Call callback information doesn't match different Service IDs
- **User Directory**: Database stores user information based on LIFF Demo's Service ID only
- **Direct LINE Message Invites**: Uses LIFF Demo's LINE Channel credentials

#### ✅ Available Features
- **LIFF Share Target Picker**: Friend selection screen for invitations works normally
- **Copy Invitation URL**: Link copying and sharing functionality works normally
- **Group Call Core Features**: All video/audio calling and screen sharing features work normally

### Technical Details

**Credentials Priority:**
```
1st: Custom Credentials (User-entered information)
2nd: Environment Variables (LIFF Demo default settings)
3rd: Default Empty Values
```

**Why Group Call Callbacks Are Limited:**
- PlanetKit Group Call callbacks are managed per Service ID
- LIFF Demo's Database only stores callback information for the demo Service ID
- Callback information from Group Calls created with different Service IDs is not stored in LIFF Demo Database
- Therefore, recent call contacts feature does not work when using custom credentials

### Disabling Custom Credentials

When you toggle the switch to **OFF**:
- Immediately reverts to LIFF Demo's default credentials (environment variables)
- All restricted features are re-enabled
- Your custom credentials remain saved in localStorage for reuse

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
- **LINE Official Account**: https://line.me/R/ti/p/@005fevgv
- **LINE PlanetKit Docs**: https://docs.lineplanet.me/
- **LINE LIFF Docs**: https://developers.line.biz/en/docs/liff/
