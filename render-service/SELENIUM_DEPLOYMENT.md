# Selenium + Xvfb Deployment Guide for Render.com

## Overview

This guide explains how to deploy the AI Agent service using **Selenium WebDriver + Xvfb** instead of Puppeteer. This approach provides a more realistic browser environment that may bypass PlanetKit's automation detection.

## Architecture

```
Render.com Docker Container
├── Xvfb (Virtual Display :99)
│   └── 1280x720x24 resolution
├── PulseAudio (Virtual Audio)
├── Google Chrome (Stable)
├── ChromeDriver (Selenium WebDriver)
└── Node.js + Express API
    └── server-selenium.js
```

## Key Differences from Puppeteer

| Feature | Puppeteer | Selenium + Xvfb |
|---------|-----------|-----------------|
| **Browser Control** | Node.js native | Standard WebDriver protocol |
| **Display** | Headless (no display) | Xvfb virtual display |
| **Audio** | Fake devices | PulseAudio simulation |
| **Stealth** | puppeteer-extra-plugin-stealth | CDP + manual injection |
| **Detection Risk** | High (headless flags) | Lower (real display environment) |

## Deployment Steps

### 1. Render.com Setup

1. Go to [render.com](https://render.com) and sign in
2. Click **New** → **Web Service**
3. Connect your GitHub repository: `viva-connect-test`
4. Configure settings:

   - **Name**: `viva-connect-selenium-agent`
   - **Region**: Oregon (US West) - closest to your users
   - **Branch**: `main`
   - **Root Directory**: `render-service`
   - **Runtime**: `Docker`
   - **Instance Type**: `Free` (512MB RAM) - **Note: May be insufficient, see below**

### 2. Environment Variables

Add these in Render dashboard (Environment tab):

```
FRONTEND_URL=https://your-vercel-app.vercel.app
NODE_ENV=production
DISPLAY=:99
SCREEN_WIDTH=1280
SCREEN_HEIGHT=720
SCREEN_DEPTH=24
```

### 3. Build Configuration

Render will automatically detect the `Dockerfile` and build the Docker image.

**Build Command**: (automatic from Dockerfile)
```bash
docker build -t selenium-agent .
```

**Start Command**: (automatic from Dockerfile CMD)
```bash
./start-xvfb.sh
```

### 4. Deploy

Click **Create Web Service** and wait for deployment (5-10 minutes first time).

## Resource Requirements

### ⚠️ Important: Free Tier Limitations

The **Free tier (512MB RAM)** may NOT be sufficient for:
- Chrome browser (~200MB)
- Xvfb virtual display (~50MB)
- ChromeDriver (~100MB)
- Node.js + Express (~50MB)
- PlanetKit SDK + Gemini AI (~100MB)

**Total estimated usage: ~500-600MB**

### Recommended: Upgrade to Starter Plan

If you encounter OOM (Out of Memory) errors, upgrade to:

- **Starter Plan**: $7/month
- **RAM**: 512MB → **2GB**
- **CPU**: Shared → **1 dedicated CPU**
- **Sleep**: None (always on)

To upgrade:
1. Go to your service dashboard
2. Click **Settings** → **Plan**
3. Select **Starter ($7/month)**
4. Confirm

## Testing

### 1. Health Check

```bash
curl https://your-render-service.onrender.com/health
```

Expected response:
```json
{
  "status": "ok",
  "activeSessions": 0,
  "uptime": 123.45,
  "method": "Selenium WebDriver + Xvfb"
}
```

### 2. Join AI Agent

From your Vercel frontend, call the Render service:

```bash
curl -X POST https://your-render-service.onrender.com/join-as-agent \
  -H "Content-Type: application/json" \
  -d '{
    "roomId": "test-room",
    "userId": "AI_SELENIUM_test",
    "language": "ko",
    "voice": "Kore"
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "AI Agent joined successfully via Selenium",
  "roomId": "test-room",
  "userId": "AI_SELENIUM_test",
  "sessionId": "abc123...",
  "method": "Selenium WebDriver + Xvfb"
}
```

### 3. Check Logs

In Render dashboard, go to **Logs** tab to see:

```
[Xvfb] Starting virtual display...
[Xvfb] ✅ Virtual display started on DISPLAY=:99
[PulseAudio] ✅ Audio system started
[Selenium Service] 🚀 Server running on port 3000
[Selenium Service] Method: Selenium WebDriver + Xvfb
[Selenium Service] DISPLAY: :99
```

## Troubleshooting

### Issue 1: "Cannot find Chrome binary"

**Cause**: Chrome not installed in Docker image

**Fix**: Rebuild with updated Dockerfile (already included)

### Issue 2: "Display :99 cannot be opened"

**Cause**: Xvfb not started properly

**Fix**: Check `start-xvfb.sh` permissions:
```bash
chmod +x start-xvfb.sh
```

### Issue 3: OOM (Out of Memory) errors

**Symptoms**:
- Build fails with "Killed" message
- Chrome crashes during execution
- Service restarts frequently

**Fix**: Upgrade to Starter plan ($7/month, 2GB RAM)

### Issue 4: "ChromeDriver version mismatch"

**Cause**: Chrome and ChromeDriver versions don't match

**Fix**: Dockerfile automatically matches versions. If error persists, check Render logs and update ChromeDriver URL in Dockerfile.

### Issue 5: PlanetKit still blocks (browser_not_supported)

**Symptoms**:
```
[HeadlessAgent] Error: The WebPlanetKit is not supported by this browser.
```

**Possible causes**:
- PlanetKit checks for real audio/video hardware
- Xvfb virtual display detected
- WebRTC MediaDevices API not fully simulated

**Next steps**:
1. Check Render logs for specific PlanetKit error messages
2. Try additional Chrome flags (see Advanced Stealth section below)
3. If still fails, consider Flutter + Android Emulator approach

## Advanced Stealth Techniques

If PlanetKit still detects automation, try these additional bypasses:

### 1. Add more Chrome arguments in `server-selenium.js`:

```javascript
chromeOptions.addArguments(
  // ... existing args ...
  '--disable-features=IsolateOrigins,site-per-process,SitePerProcess',
  '--disable-site-isolation-trials',
  '--disable-features=BlockInsecurePrivateNetworkRequests',
  '--disable-web-security',
  '--allow-running-insecure-content',
  '--autoplay-policy=no-user-gesture-required'
);
```

### 2. Enhanced CDP stealth injection:

```javascript
await driver.executeCdpCommand('Page.addScriptToEvaluateOnNewDocument', {
  source: `
    // Hide all automation indicators
    delete navigator.__proto__.webdriver;

    // Mock getUserMedia for real device simulation
    const originalGetUserMedia = navigator.mediaDevices.getUserMedia;
    navigator.mediaDevices.getUserMedia = function(constraints) {
      console.log('[Mock getUserMedia] Called with:', constraints);
      return originalGetUserMedia.call(this, constraints);
    };

    // Mock screen properties
    Object.defineProperty(screen, 'availWidth', { get: () => 1280 });
    Object.defineProperty(screen, 'availHeight', { get: () => 720 });
  `,
});
```

### 3. Use undetected-chromedriver (Python alternative)

If Selenium still fails, consider using Python's `undetected-chromedriver`:

```python
import undetected_chromedriver as uc
driver = uc.Chrome(use_subprocess=True)
```

This would require a separate Python service instead of Node.js.

## Cost Summary

| Plan | RAM | CPU | Cost/Month | Sleep | Recommended |
|------|-----|-----|------------|-------|-------------|
| **Free** | 512MB | Shared | $0 | 15min inactive | ⚠️ May OOM |
| **Starter** | 2GB | 1 CPU | $7 | None | ✅ Recommended |
| **Standard** | 4GB | 2 CPU | $25 | None | Enterprise |

## Support

If you encounter issues:

1. Check Render logs for specific error messages
2. Test locally with Docker:
   ```bash
   cd render-service
   docker build -t selenium-test .
   docker run -p 3000:3000 -e FRONTEND_URL=http://localhost:8080 selenium-test
   ```
3. Report issues with full logs

## Next Steps After Deployment

1. Update `.env` in Vercel with Render URL:
   ```
   VITE_RENDER_SERVICE_URL=https://your-render-service.onrender.com
   ```

2. Test from Vercel frontend by joining an AI Agent Bridge room

3. Monitor Render logs for success/failure messages

4. If successful, PlanetKit Conference should show AI Agent as a participant
