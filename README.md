# LINE PlanetKit Video Conference App

A mobile-first LINE LIFF application for group video conferencing using LINE's PlanetKit Web SDK 5.5.

## Features

- **LINE LIFF Integration**: Seamless authentication with LINE login
- **PlanetKit Video SDK**: Enterprise-grade video conferencing powered by LINE
- **Mobile-Optimized UI**: Portrait-mode layout optimized for mobile devices
- **Multi-Room Support**: Choose from Japan, Korea, Taiwan, or Thailand rooms
- **Real-time Communication**: HD video/audio with low latency
- **Smart Grid Layout**: Adaptive video grid (1x1, 2x1 vertical split, 2x2)
- **Connection Status**: Live call duration, participant count, and room info
- **Auto-Redirect**: Seamless navigation after call disconnect

## Tech Stack

- **Frontend**: Vite + React 18 + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **Video SDK**: LINE PlanetKit Web SDK 5.5.0
- **Authentication**: LINE LIFF (LINE Front-end Framework)
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
│   ├── ui/                    # shadcn/ui components
│   ├── PlanetKitConfigPanel.tsx   # Configuration panel
│   ├── PlanetKitMeetingArea.tsx   # Main meeting interface
│   └── TileView.tsx               # Video grid layout
├── pages/
│   ├── SetupPage.tsx              # Setup and configuration
│   └── PlanetKitMeeting.tsx       # Meeting page
├── contexts/
│   ├── LiffContext.tsx            # LINE LIFF state management
│   └── VideoSDKContext.tsx        # PlanetKit config management
├── hooks/
│   └── use-liff.ts                # LIFF authentication hook
├── types/
│   └── video-sdk.ts               # TypeScript interfaces
└── utils/
    └── token-generator.ts         # JWT token generation
```

## Usage

### 1. Setup

- Open the app in LINE browser (LIFF)
- Log in with your LINE account
- Select environment (Evaluation or Real)
- Choose a room (Japan, Korea, Taiwan, or Thailand)
- Generate access token

### 2. Join Meeting

- Click "참여하기" (Join) button
- Allow camera and microphone permissions
- Start video conferencing

### 3. In-Meeting Controls

- **Video Toggle**: Turn camera on/off
- **Audio Toggle**: Mute/unmute microphone
- **Disconnect**: End call and return to setup

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

### December 2024
- Mobile-first UI optimization for portrait mode
- Removed unused LiveKit/Agora code
- Simplified setup flow
- Fixed video grid layout for 2-person calls
- Added auto-redirect after disconnect

### November 2024
- Upgraded to PlanetKit 5.5
- Added LINE LIFF integration
- Implemented multi-room support
- Enhanced mobile responsiveness

## License

MIT

## Support

For issues and questions, please create an issue in the GitHub repository.
