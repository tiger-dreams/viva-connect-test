# Viva Connect - AI Agent Render Service

Headless Chrome service that runs AI Agent in server-side for PlanetKit group calls.

## Architecture

```
User A (Browser) ←→ PlanetKit Room ←→ AI Agent (Headless Chrome on Render)
User B (Browser) ←→ PlanetKit Room ←→ AI Agent (Headless Chrome on Render)
```

## Features

- ✅ Runs AI Agent in headless Chrome via Puppeteer
- ✅ Joins PlanetKit Conference as separate participant
- ✅ Gemini 2.0 Multimodal Live API integration
- ✅ Free tier: 750 hours/month (enough for 24/7)
- ✅ On-demand: First request ~30s wake-up, then instant

## Deployment to Render.com

### 1. Create Render Account

1. Go to [https://render.com](https://render.com)
2. Sign up with GitHub account

### 2. Create New Web Service

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository
3. Select the repository: `viva-connect-test`
4. Configure:
   - **Name**: `viva-connect-ai-agent`
   - **Region**: Oregon (or Singapore for Asia)
   - **Branch**: `main`
   - **Root Directory**: `render-service`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free`

### 3. Set Environment Variables

In Render dashboard, add these environment variables:

| Key | Value | Description |
|-----|-------|-------------|
| `FRONTEND_URL` | `https://your-vercel-app.vercel.app` | Your Vercel frontend URL |
| `NODE_ENV` | `production` | Node environment |

### 4. Deploy

1. Click **"Create Web Service"**
2. Wait for deployment (~5-10 minutes first time)
3. Copy the service URL: `https://viva-connect-ai-agent.onrender.com`

## Testing the Service

### Health Check
```bash
curl https://viva-connect-ai-agent.onrender.com/health
```

Expected response:
```json
{
  "status": "ok",
  "activeSessions": 0,
  "uptime": 123.45
}
```

### Join AI Agent to Room
```bash
curl -X POST https://viva-connect-ai-agent.onrender.com/join-as-agent \
  -H "Content-Type: application/json" \
  -d '{
    "roomId": "test-room",
    "userId": "AI_AGENT_test",
    "language": "ko",
    "voice": "Kore"
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "AI Agent joined successfully",
  "roomId": "test-room",
  "userId": "AI_AGENT_test",
  "browserId": "12345"
}
```

## Render Sleep Behavior

**Free Plan:**
- Sleeps after 15 minutes of inactivity
- First request takes ~30 seconds to wake up
- 750 hours/month = 24/7 for full month (720h + 30h buffer)

**Keep-Alive Strategy:**

Option 1: **Cron keep-alive** (0-second wait)
```bash
# Add cron job (every 14 minutes)
curl https://viva-connect-ai-agent.onrender.com/health
```

Option 2: **On-demand** (30-second first wait)
- No keep-alive
- Wake up on first user request
- Show "AI 준비 중..." for 30 seconds

## Local Development

```bash
cd render-service
npm install
npm run dev
```

Environment variables (create `.env`):
```
PORT=3000
FRONTEND_URL=http://localhost:8080
```

## API Endpoints

### POST /join-as-agent
Join AI Agent to PlanetKit room

**Request:**
```json
{
  "roomId": "test-room",
  "userId": "AI_AGENT_12345",
  "language": "ko",
  "voice": "Kore"
}
```

**Response:**
```json
{
  "success": true,
  "message": "AI Agent joined successfully",
  "roomId": "test-room",
  "userId": "AI_AGENT_12345",
  "browserId": "67890"
}
```

### POST /disconnect-agent
Disconnect AI Agent from room

**Request:**
```json
{
  "roomId": "test-room"
}
```

**Response:**
```json
{
  "success": true,
  "message": "AI Agent disconnected successfully",
  "roomId": "test-room"
}
```

### GET /sessions
List active sessions

**Response:**
```json
{
  "success": true,
  "count": 2,
  "sessions": [
    {
      "roomId": "test-room-1",
      "userId": "AI_AGENT_12345",
      "createdAt": "2026-02-13T10:30:00.000Z",
      "browserId": "67890"
    }
  ]
}
```

### GET /health
Health check endpoint

**Response:**
```json
{
  "status": "ok",
  "activeSessions": 2,
  "uptime": 3600.5
}
```

## Troubleshooting

### Chrome Not Found
If Puppeteer fails to launch Chrome, check logs for:
```
Error: Could not find Chrome
```

Solution: Render installs Chrome automatically. If error persists, contact Render support.

### Memory Limit
Free plan: 512 MB RAM

If out of memory:
- Limit concurrent sessions
- Upgrade to Starter plan ($7/month, 512 MB → 1 GB)

### Timeout
If agent takes > 90 seconds to connect:
- Check Vercel frontend URL
- Check PlanetKit credentials
- Check Gemini API key

## Monitoring

View logs in Render dashboard:
1. Go to your service
2. Click "Logs" tab
3. Look for:
   - `[Render Service] 🚀 Server running`
   - `[Render Service] ✅ Agent connected successfully`
   - `[Headless Page] [log] ...`

## Cost

**Free Plan:**
- 750 hours/month
- 512 MB RAM
- Sleeps after 15 min inactivity

**Starter Plan ($7/month):**
- Unlimited hours
- 512 MB → 1 GB RAM
- No sleep

## Next Steps

After deploying to Render:

1. Copy Render service URL
2. Update Vercel environment variable:
   ```
   RENDER_SERVICE_URL=https://viva-connect-ai-agent.onrender.com
   ```
3. Test the integration:
   - User A joins via AI Bridge
   - User B joins via regular meeting
   - Both should hear AI Agent
