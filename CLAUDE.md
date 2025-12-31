# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a mobile-first LINE LIFF video conferencing application using LINE's PlanetKit Web SDK 5.5. The app provides enterprise-grade group video calling with seamless LINE authentication, optimized for mobile portrait mode with multi-room support (Japan, Korea, Taiwan, Thailand).

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (runs on port 8080)
npm run dev

# Build for production
npm run build

# Lint code
npm run lint

# Preview production build
npm run preview
```

## Architecture Overview

### Tech Stack
- **Frontend**: Vite + React 18 + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components (complete component library)
- **Video SDK**: LINE PlanetKit 5.5.0 (`@line/planet-kit`)
- **Authentication**: LINE LIFF (LINE Front-end Framework)
- **Token Generation**: Client-side JWT using `jose` library
- **State Management**: React Context API + localStorage for persistence
- **Routing**: React Router DOM

### Project Structure

```
src/
├── components/
│   ├── ui/                        # shadcn/ui component library (40+ components)
│   ├── PlanetKitConfigPanel.tsx   # PlanetKit configuration panel
│   ├── PlanetKitMeetingArea.tsx   # Main meeting interface (770+ lines)
│   └── TileView.tsx               # Adaptive video grid layout
├── pages/
│   ├── SetupPage.tsx              # Setup wizard with LINE LIFF login
│   └── PlanetKitMeeting.tsx       # Meeting page wrapper
├── contexts/
│   ├── LiffContext.tsx            # LINE LIFF authentication state
│   └── VideoSDKContext.tsx        # PlanetKit configuration state
├── hooks/
│   ├── use-liff.ts                # LINE LIFF authentication hook
│   ├── use-media-devices.ts       # Media device management
│   ├── use-mobile.tsx             # Mobile detection
│   └── use-toast.ts               # Toast notification system
├── types/
│   └── video-sdk.ts               # TypeScript interfaces
├── utils/
│   └── token-generator.ts         # PlanetKit JWT generation
└── lib/
    └── utils.ts                   # Utility functions
```

### Key Features

#### 1. **LINE LIFF Integration**
- Seamless LINE authentication
- Auto-populated user ID and display name from LINE profile
- LIFF ID configuration support
- Native LINE browser integration

#### 2. **Mobile-First UI Design**
- **Portrait Mode Optimized**: Full-screen layout for mobile devices
- **Fixed Top Bar**: Call duration, participant count, room name
- **Adaptive Video Grid**: 
  - 1 person: Full screen
  - 2 people: Vertical split (50/50)
  - 3-4 people: 2×2 grid
- **Fixed Bottom Controls**: Large circular touch-friendly buttons
- **Auto-Redirect**: Returns to setup after disconnect

#### 3. **Multi-Room Support**
- **4 Geographic Rooms**: Japan, Korea, Taiwan, Thailand
- Users in same room can see each other
- Visual room indicators with flags
- Easy room switching in setup

#### 4. **Environment Configuration**
- **Evaluation Environment**: Testing (`voipnx-saturn.line-apps-rc.com`)
- **Real Environment**: Production (`voipnx-saturn.line-apps.com`)
- Auto-loading of Service ID, API Key, API Secret from env vars
- Client-side JWT token generation

#### 5. **Real-time Communication**
- HD video/audio with PlanetKit Conference API
- Low-latency WebRTC connection
- Camera and microphone controls
- Speaking detection with visual indicators
- Network quality monitoring

#### 6. **Developer Tools**
- localStorage-based configuration persistence
- Comprehensive error handling and logging
- Toast notifications for user feedback
- Environment variable support

### Configuration Details

- **Vite Config**: Port 8080, path aliases (`@/` → `src/`)
- **TypeScript**: Relaxed configuration for rapid development
- **ESLint**: React-focused rules with development-friendly settings
- **Tailwind**: Custom theme with video conferencing utilities
- **Component Library**: Complete shadcn/ui integration

### Recent Major Updates

#### December 2024
- **Mobile UI Optimization**: Complete redesign for portrait mode
- **Simplified Architecture**: Removed unused LiveKit/Agora code
- **Fixed Video Grid**: 2-person vertical split with equal height (grid-rows-[1fr_1fr])
- **Absolute Positioning**: Video grid fills space between top bar (52px) and bottom controls (100px)
- **Auto-Redirect**: Seamless navigation after disconnect
- **Removed Agent Folder**: Cleaned up obsolete LiveKit agent code

#### November 2024
- **PlanetKit 5.5 Integration**: Latest SDK with enhanced device APIs
- **LINE LIFF Support**: Full authentication integration
- **Multi-Room System**: Geographic room selection
- **Enhanced Mobile Responsiveness**: Optimized for touch devices

### Development Workflow

#### Local Development
1. Install dependencies: `npm install`
2. Configure environment variables in `.env`
3. Start dev server: `npm run dev` (localhost:8080)
4. Test with LINE LIFF browser or local browser

#### Testing
1. Set up LINE LIFF app and get LIFF ID
2. Configure PlanetKit credentials (Service ID, API Key, API Secret)
3. Test with multiple users in different rooms
4. Verify mobile responsiveness on actual devices

#### Beta/Production Deployment Policy

**IMPORTANT**: This project uses a Beta/Production separation strategy for safe feature testing.

**Beta Environment** (`/beta/*` routes):
- Used for testing new features before production release
- Completely isolated component tree from production
- Safe to deploy and test without affecting live users
- Automatically deployed to Vercel on `main` branch push

**Production Environment** (`/` routes):
- Serves actual users and live traffic
- Should only contain stable, well-tested features

**Deployment Rules**:
1. ✅ **Always deploy Beta features automatically** after implementation and testing
2. ❌ **NEVER automatically update Production code** based on Beta testing
3. ⏸️ **Wait for explicit user approval** before copying Beta features to Production
4. 🚀 **Only deploy to Production when user explicitly requests** with clear confirmation

**Workflow**:
```
1. Implement feature in Beta components (e.g., BetaPlanetKitMeetingArea)
2. Deploy and test in Beta environment (/beta/*)
3. Report results to user and wait for feedback
4. If user says "deploy to production" or "update production":
   → Copy changes from Beta to Production components
   → Deploy to Production
5. If user doesn't explicitly request:
   → Do NOT update Production components
   → Keep Beta and Production separate
```

**Example Phrases That Trigger Production Deployment**:
- "프로덕션에 배포해줘" / "Deploy to production"
- "리얼 쪽도 업데이트해줘" / "Update the real environment too"
- "프로덕션 코드에도 적용해줘" / "Apply to production code"

**Example Phrases That Do NOT Trigger Production Deployment**:
- "베타에서 테스트해줘" / "Test in beta"
- "확인했어" / "Confirmed"
- "잘 작동해" / "Working well"

**Key Principle**: Be conservative with Production deployments. When in doubt, ask the user explicitly.

### Environment Variables

Required environment variables:

```env
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
```

### Security Considerations

- **Client-side Token Generation**: Development/testing only, not for production
- **API Credentials**: Store securely in environment variables, never commit to repo
- **Production Deployment**: Implement server-side token generation
- **LIFF Authentication**: Validated through LINE Platform
- **CORS Configuration**: Configured for local and Vercel deployment

### Component Architecture

#### Core Components

**PlanetKitMeetingArea** (770+ lines)
- Full meeting interface with connection management
- Video/audio track handling
- Device management (camera, microphone)
- Participant state management
- Call duration timer
- Error handling and logging

**TileView** (400+ lines)
- Adaptive grid layout based on participant count
- Video element management and cleanup
- Speaking detection indicators
- Participant sorting (local user first)
- Mobile-optimized spacing

**PlanetKitConfigPanel** (380+ lines)
- Environment selection (Eval/Real)
- Room selection with visual indicators
- Token generation with validation
- Configuration persistence
- API credential management

**SetupPage** (500+ lines)
- LINE LIFF authentication flow
- Configuration management
- Token generation workflow
- Navigation to meeting

#### UI Component Library
Complete shadcn/ui integration with 40+ components:
- Form controls, buttons, inputs, labels
- Cards, badges, separators
- Radio groups, toast notifications
- Mobile-responsive design patterns

### Browser Support

- **Chrome/Edge**: 100+ (full support)
- **Safari**: 16.4+ (Desktop/iOS)
- **LINE In-App Browser**: Full LIFF support
- **WebView**: Limited support (no screen share)

### File Statistics
- **Total TypeScript Files**: ~30 active files
- **Core Components**: 4 major components
- **Lines of Code**: ~2500+ lines in core logic
- **SDK**: PlanetKit only (simplified from multi-SDK)

This is a production-ready LINE LIFF video conferencing application optimized for mobile devices with enterprise-grade PlanetKit integration.
