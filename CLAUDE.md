# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Video SDK testing application that supports both Agora and Zoom Video SDK Web versions. It's a developer tool for testing group video conferencing capabilities with real-time SDK switching, token generation, and debugging features.

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
  - Zoom Video SDK for Web (`@zoom/videosdk`)
- **Token Generation**: Client-side JWT using `jose` library
- **State Management**: React hooks + localStorage for persistence
- **Routing**: React Router DOM

### Project Structure

- `src/components/` - React components
  - `ui/` - shadcn/ui component library (complete set)
  - `SDKSelector.tsx` - SDK selection interface
  - `AgoraConfigPanel.tsx` - Agora configuration panel
  - `ZoomConfigPanel.tsx` - Zoom configuration panel  
  - `VideoMeetingArea.tsx` - Main video conferencing interface
- `src/types/video-sdk.ts` - TypeScript interfaces for SDK configurations
- `src/utils/token-generator.ts` - JWT token generation utilities
- `src/pages/` - Route components (Index, NotFound)
- `src/hooks/` - Custom React hooks
- `docs/project-plan.md` - Detailed project planning document

### Key Features

1. **Dual SDK Support**: Switch between Agora and Zoom Video SDKs
2. **Token Generation**: Client-side JWT token generation for both SDKs
3. **Configuration Management**: Persistent storage of API keys and settings
4. **Video Controls**: Camera, microphone, screen sharing controls
5. **Real-time Metrics**: Display connection status, frame rate, resolution, bitrate
6. **Participant Management**: Show connected users and their status

### Configuration Details

- **Vite Config**: Uses port 8080, includes path aliases (`@/` → `src/`)
- **TypeScript**: Relaxed configuration with disabled strict checks for development
- **ESLint**: React-focused rules with unused variable checks disabled
- **Tailwind**: Custom theme with video conferencing specific colors and variables

### Development Notes

- The app uses Korean text in the UI (화상회의 = video conferencing)
- API keys and secrets are stored in localStorage for development purposes
- Token generation happens client-side using the `jose` library
- Both SDKs are integrated but currently show placeholder implementations
- The VideoMeetingArea component simulates connection states and metrics

### Security Considerations

- API keys/secrets stored in localStorage (development only)
- Tokens have configurable expiration times
- No server-side authentication required for testing
- Sensitive information should not be logged to console

### Component Integration

The main Index page orchestrates the entire application:
- Manages SDK selection state
- Handles configuration for both Agora and Zoom
- Passes configuration to the VideoMeetingArea component
- Persists all settings to localStorage

The token generators in `src/utils/token-generator.ts` create valid JWT tokens for both SDKs using the provided API credentials.