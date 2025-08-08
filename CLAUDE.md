# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a comprehensive Video SDK testing application supporting Agora, LiveKit, and PlanetKit Web SDKs. It serves as a developer tool for testing group video conferencing capabilities with real-time SDK switching, advanced token generation, AI agent integration, and extensive debugging features including detailed video statistics and host/participant role management.

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (runs on port 8080)
npm run dev

# Build for production
npm run build

# Build for development mode
npm run build:dev

# Lint code
npm run lint

# Preview production build
npm run preview
```

## Architecture Overview

### Tech Stack
- **Frontend**: Vite + React 18 + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components (complete component library)
- **Video SDKs**: 
  - Agora Web SDK 4.24.0 (`agora-rtc-sdk-ng`)
  - LiveKit Client 2.15.4 (`livekit-client`)
  - LINE PlanetKit 5.3.0 (`@line/planet-kit`)
- **Token Generation**: Client-side JWT using `jose` library with role-based permissions
- **State Management**: React hooks + localStorage for persistence + Context API
- **Routing**: React Router DOM with multiple page layouts
- **AI Integration**: OpenAI Realtime API for voice agents
- **Statistics**: Comprehensive WebRTC statistics collection and display

### Project Structure

```
src/
├── components/                 # React components (50+ files)
│   ├── ui/                    # Complete shadcn/ui component library (40+ components)
│   ├── SDKSelector.tsx        # Tri-SDK selection interface (Agora/LiveKit/PlanetKit)
│   ├── AgoraConfigPanel.tsx   # Agora configuration with token generation
│   ├── LiveKitConfigPanel.tsx # LiveKit config with host/participant roles
│   ├── PlanetKitConfigPanel.tsx # PlanetKit configuration panel
│   ├── LiveKitMeetingArea.tsx # Full-featured LiveKit meeting with AI agents
│   ├── PlanetKitMeetingArea.tsx # PlanetKit meeting implementation
│   ├── TileView.tsx           # Advanced grid-based video tile system
│   └── VideoMeetingArea.tsx   # Main routing component for meetings
├── pages/                     # Page components
│   ├── Index.tsx             # Main dashboard with legacy interface
│   ├── SetupPage.tsx         # Modern setup wizard
│   ├── MeetingPage.tsx       # Meeting router
│   ├── AgoraMeeting.tsx      # Agora-specific meeting page
│   ├── LiveKitMeeting.tsx    # LiveKit-specific meeting page
│   └── PlanetKitMeeting.tsx  # PlanetKit-specific meeting page
├── types/video-sdk.ts        # Comprehensive TypeScript interfaces
├── utils/
│   ├── token-generator.ts    # JWT generation for all SDKs with role support
│   └── agora-token-builder.ts # Enhanced Agora token utilities
├── hooks/                    # Custom React hooks
│   ├── use-media-devices.ts  # Media device management
│   ├── use-mobile.tsx        # Mobile detection
│   └── use-toast.ts          # Toast notification system
├── contexts/
│   └── VideoSDKContext.tsx   # Global video SDK state management
└── lib/
    └── utils.ts              # Utility functions
```

### Key Features

#### 1. **Multi-SDK Support**
- **Agora Web SDK 4.24.0**: High-performance video with virtual backgrounds
- **LiveKit**: Open-source WebRTC with full host/participant role system
- **PlanetKit**: LINE's enterprise-grade video SDK integration

#### 2. **Advanced Role Management System**
- **Host Role**: Full room control with participant management
- **Participant Role**: Standard video conferencing capabilities
- **Permission-based Token Generation**: JWT tokens with role-specific permissions
- **Kickout Functionality**: Host can remove participants (LiveKit)

#### 3. **Real-time Video Statistics**
- Comprehensive WebRTC statistics collection
- Per-participant bitrate, packet loss, frame rate monitoring
- RTCPeerConnection raw statistics display
- Network quality indicators and debugging information
- Real-time speaking detection with audio level visualization

#### 4. **AI Voice Agent Integration**
- OpenAI Realtime API integration via Vercel serverless functions
- Browser-based WebRTC connection to OpenAI's voice AI
- Live voice conversation with participants
- AI agent voice publishing to LiveKit rooms
- Configurable AI models and voices

#### 5. **Advanced UI/UX**
- **TileView Component**: Smart grid layout (1x1, 2x1, 2x2) with speaking indicators
- **Device Management**: Real-time camera/microphone switching
- **Korean Localization**: Full Korean language interface
- **Dark/Light Themes**: Comprehensive theme support
- **Mobile Responsive**: Optimized for all device sizes

#### 6. **Developer Tools**
- **Token Generation**: Client-side JWT creation with expiration management
- **Configuration Persistence**: localStorage-based settings storage
- **Debug Statistics**: Detailed WebRTC metrics and connection quality
- **Live Logs**: Real-time debugging information display

### LiveKit Host/Participant Role System

#### Host Permissions
- **Room Administration**: `roomAdmin: true` in JWT tokens
- **Participant Management**: Kick out participants, manage room metadata
- **Data Publishing**: Can send data messages and control room settings
- **UI Controls**: Crown icon indicators, dropdown menus with management actions

#### Participant Permissions
- **Standard Access**: Basic join, publish, subscribe permissions
- **Limited Control**: Cannot manage other participants or room settings
- **UI Indication**: Standard participant icons without admin controls

#### Token Generation with Roles
```typescript
// Host token with admin permissions
const hostToken = await generateLiveKitToken(
  apiKey, apiSecret, roomName, participantName, 3600, true // isHost = true
);

// Participant token with standard permissions
const participantToken = await generateLiveKitToken(
  apiKey, apiSecret, roomName, participantName, 3600, false // isHost = false
);
```

### Configuration Details

- **Vite Config**: Port 8080, proxy setup for API routes, path aliases
- **TypeScript**: Relaxed configuration optimized for rapid development
- **ESLint**: React-focused rules with development-friendly settings
- **Tailwind**: Custom theme with video conferencing color schemes and utilities
- **Component Library**: Complete shadcn/ui integration (40+ components)

### Recent Major Updates

#### Latest Commit: LiveKit Host/Participant Role System
- Implemented comprehensive role-based access control
- Added participant kickout functionality for hosts
- Enhanced token generation with permission-based JWT claims
- UI indicators for host privileges (crown icons, management dropdowns)

#### Previous Updates
- **AI Agent Integration**: OpenAI Realtime API voice agents
- **Video Statistics**: Comprehensive WebRTC metrics collection
- **PlanetKit Integration**: LINE's video SDK support
- **TileView Enhancement**: Smart grid layouts with speaking detection

### Development Workflow

#### Local Development
1. Install dependencies: `npm install`
2. Start dev server: `npm run dev` (localhost:8080)
3. Configure SDK credentials in the UI
4. Test real-time video conferencing with multiple browser tabs

#### Testing Multi-SDK Integration
1. Use SDK selector to switch between Agora, LiveKit, and PlanetKit
2. Generate appropriate tokens for each SDK
3. Test cross-SDK compatibility and feature differences
4. Monitor real-time statistics and connection quality

### Security Considerations

- **Client-side Token Generation**: Development-only, not for production
- **API Key Storage**: localStorage for testing purposes only
- **Role-based Permissions**: JWT tokens contain role information
- **CORS Configuration**: Configured for local and cloud deployment
- **OpenAI API Key**: Client-side usage for testing (not production recommended)

### AI Agent System

#### OpenAI Realtime Integration
- **WebRTC Bridge**: Direct browser connection to OpenAI's Realtime API
- **Voice Conversation**: Real-time speech-to-speech AI interaction
- **LiveKit Publishing**: AI responses broadcast to meeting participants
- **Configurable Models**: Support for different OpenAI voice models

#### Implementation Details
- Vercel serverless function proxy (`/api/openai-realtime.ts`)
- RTCPeerConnection for audio streaming
- Automatic audio track publishing to LiveKit rooms
- Browser-based audio context for real-time processing

### Component Architecture

#### Core Components
- **LiveKitMeetingArea**: 1,700+ lines, full-featured meeting interface
- **TileView**: Smart video grid with statistics overlay
- **LiveKitConfigPanel**: Role-based configuration with host controls
- **Token Generators**: Multi-SDK JWT generation with permissions

#### UI Component Library
Complete shadcn/ui integration with 40+ components:
- Form controls, navigation, feedback, layout, data display
- Custom theme integration for video conferencing applications
- Mobile-responsive design patterns

### File Statistics
- **Total TypeScript Files**: 76 files
- **Component Files**: 50+ React components
- **Lines of Code**: 10,000+ lines across all components
- **SDK Integrations**: 3 major video SDKs fully integrated

This is a production-ready, feature-rich video conferencing test platform with enterprise-grade capabilities including role management, AI integration, and comprehensive debugging tools.