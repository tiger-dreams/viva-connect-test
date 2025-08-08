# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Video SDK testing application that supports both Agora and LiveKit Web SDKs. It's a developer tool for testing group video conferencing capabilities with real-time SDK switching, token generation, and debugging features.

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
- **Styling**: Tailwind CSS + shadcn/ui components
- **Video SDKs**: 
  - Agora Web SDK 4.x (`agora-rtc-sdk-ng`)
  - LiveKit Client (`livekit-client`)
- **Token Generation**: Client-side JWT using `jose` library
- **State Management**: React hooks + localStorage for persistence
- **Routing**: React Router DOM

### Project Structure

- `src/components/` - React components
  - `ui/` - shadcn/ui component library (complete set)
  - `SDKSelector.tsx` - SDK selection interface (Agora/LiveKit)
  - `AgoraConfigPanel.tsx` - Agora configuration panel
  - `LiveKitConfigPanel.tsx` - LiveKit configuration panel
  - `LiveKitMeetingArea.tsx` - LiveKit-specific meeting interface with real WebRTC integration
  - `VideoMeetingArea.tsx` - Main video conferencing router component
- `src/types/video-sdk.ts` - TypeScript interfaces for SDK configurations
- `src/utils/token-generator.ts` - JWT token generation utilities
- `src/pages/` - Route components (Index, NotFound)
- `src/hooks/` - Custom React hooks
- `docs/project-plan.md` - Detailed project planning document

### Key Features

1. **Dual SDK Support**: Switch between Agora and LiveKit Web SDKs
2. **Token Generation**: Client-side JWT token generation for both SDKs
3. **Configuration Management**: Persistent storage of API keys and settings
4. **Video Controls**: Camera, microphone, screen sharing controls
5. **Real-time WebRTC**: Full LiveKit integration with actual video streaming
6. **Participant Management**: Show connected users and their status
7. **Room Management**: Join/leave rooms with real-time participant updates

### Configuration Details

- **Vite Config**: Uses port 8080, includes path aliases (`@/` → `src/`)
- **TypeScript**: Relaxed configuration with disabled strict checks for development
- **ESLint**: React-focused rules with unused variable checks disabled
- **Tailwind**: Custom theme with video conferencing specific colors and variables

### Development Notes

- The app uses Korean text in the UI (화상회의 = video conferencing)
- API keys and secrets are stored in localStorage for development purposes
- Token generation happens client-side using the `jose` library
- LiveKit integration is fully functional with real WebRTC connections
- Agora SDK integration remains for comparison testing
- The LiveKitMeetingArea component provides actual video conferencing capabilities

### Security Considerations

- API keys/secrets stored in localStorage (development only)
- Tokens have configurable expiration times
- No server-side authentication required for testing
- Sensitive information should not be logged to console

### Component Integration

The main Index page orchestrates the entire application:
- Manages SDK selection state between Agora and LiveKit
- Handles configuration for both Agora and LiveKit
- Routes to appropriate meeting components (LiveKitMeetingArea for LiveKit)
- Persists all settings to localStorage

The token generators in `src/utils/token-generator.ts` create valid JWT tokens for both SDKs:
- `generateAgoraToken()` - Creates Agora RTC tokens
- `generateLiveKitToken()` - Creates LiveKit access tokens with room permissions

### LiveKit Integration Details

- **Real WebRTC Connection**: Uses `livekit-client` for actual video/audio streaming
- **Room Events**: Handles participant join/leave, track subscription/unsubscription  
- **Media Controls**: Camera, microphone, and screen sharing with real device access
- **Token-based Authentication**: JWT tokens with room permissions and participant identity
- **Server Compatibility**: Works with LiveKit Cloud, self-hosted, or local development servers