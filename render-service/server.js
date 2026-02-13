import express from 'express';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

// Store active browser sessions
const activeSessions = new Map();

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    activeSessions: activeSessions.size,
    uptime: process.uptime(),
  });
});

/**
 * Join AI Agent to PlanetKit Conference
 * POST /join-as-agent
 *
 * Body:
 * - roomId: PlanetKit room ID
 * - userId: AI Agent user ID
 * - language: 'ko' | 'en'
 * - voice: Gemini voice ID
 */
app.post('/join-as-agent', async (req, res) => {
  const { roomId, userId, language = 'ko', voice = 'Kore' } = req.body;

  if (!roomId || !userId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: roomId, userId',
    });
  }

  console.log('[Render Service] Join request:', { roomId, userId, language, voice });

  try {
    // Check if session already exists
    if (activeSessions.has(roomId)) {
      console.log('[Render Service] Session already exists for room:', roomId);
      return res.json({
        success: true,
        message: 'Session already active',
        roomId,
        browserId: activeSessions.get(roomId).pid,
      });
    }

    // Launch headless Chrome with Sparticuz Chromium
    console.log('[Render Service] Launching Puppeteer with optimized Chromium...');
    const browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // Prevent /dev/shm usage (Render limitation)
        '--disable-gpu',
        '--use-fake-ui-for-media-stream', // Allow getUserMedia without prompt
        '--use-fake-device-for-media-stream', // Fake audio/video devices
        '--allow-running-insecure-content',
        '--disable-web-security', // Allow CORS for development
        '--disable-blink-features=AutomationControlled', // Hide automation
      ],
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreDefaultArgs: ['--enable-automation'], // Don't show "Chrome is being controlled"
    });

    const page = await browser.newPage();

    // Hide webdriver property to bypass browser detection
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    });

    // Set viewport and user agent
    await page.setViewport({ width: 1280, height: 720 });
    await page.setUserAgent(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );

    // Enable console logs from page
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      console.log(`[Headless Page] [${type}] ${text}`);
    });

    // Handle page errors
    page.on('pageerror', (error) => {
      console.error('[Headless Page] Error:', error.message);
    });

    // Load headless agent page
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    const agentUrl = `${frontendUrl}/headless-agent?roomId=${encodeURIComponent(roomId)}&userId=${encodeURIComponent(userId)}&lang=${language}&voice=${encodeURIComponent(voice)}`;

    console.log('[Render Service] Loading:', agentUrl);
    await page.goto(agentUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait for agent to connect
    console.log('[Render Service] Waiting for agent connection...');
    await page.waitForFunction(
      () => window.agentConnected === true,
      { timeout: 90000 } // 90 seconds timeout
    );

    console.log('[Render Service] ✅ Agent connected successfully');

    // Store session
    activeSessions.set(roomId, {
      browser,
      page,
      pid: browser.process()?.pid || 'unknown',
      roomId,
      userId,
      createdAt: new Date().toISOString(),
    });

    // Return success
    res.json({
      success: true,
      message: 'AI Agent joined successfully',
      roomId,
      userId,
      browserId: browser.process()?.pid || 'unknown',
    });

    console.log('[Render Service] Active sessions:', activeSessions.size);

  } catch (error) {
    console.error('[Render Service] Failed to join agent:', error);

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to join AI agent',
      details: error.stack,
    });
  }
});

/**
 * Disconnect AI Agent from Conference
 * POST /disconnect-agent
 *
 * Body:
 * - roomId: PlanetKit room ID
 */
app.post('/disconnect-agent', async (req, res) => {
  const { roomId } = req.body;

  if (!roomId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required field: roomId',
    });
  }

  console.log('[Render Service] Disconnect request:', { roomId });

  try {
    const session = activeSessions.get(roomId);

    if (!session) {
      console.log('[Render Service] No active session found for room:', roomId);
      return res.json({
        success: true,
        message: 'No active session to disconnect',
      });
    }

    // Close browser
    await session.browser.close();
    activeSessions.delete(roomId);

    console.log('[Render Service] ✅ Session disconnected');
    console.log('[Render Service] Active sessions:', activeSessions.size);

    res.json({
      success: true,
      message: 'AI Agent disconnected successfully',
      roomId,
    });

  } catch (error) {
    console.error('[Render Service] Failed to disconnect agent:', error);

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to disconnect AI agent',
    });
  }
});

/**
 * List active sessions
 * GET /sessions
 */
app.get('/sessions', (req, res) => {
  const sessions = Array.from(activeSessions.entries()).map(([roomId, session]) => ({
    roomId,
    userId: session.userId,
    createdAt: session.createdAt,
    browserId: session.pid,
  }));

  res.json({
    success: true,
    count: sessions.length,
    sessions,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`[Render Service] 🚀 Server running on port ${PORT}`);
  console.log(`[Render Service] Health check: http://localhost:${PORT}/health`);
  console.log(`[Render Service] Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:8080'}`);
});

// Cleanup on exit
process.on('SIGTERM', async () => {
  console.log('[Render Service] Shutting down...');

  // Close all active sessions
  for (const [roomId, session] of activeSessions.entries()) {
    try {
      await session.browser.close();
      console.log(`[Render Service] Closed session: ${roomId}`);
    } catch (err) {
      console.error(`[Render Service] Failed to close session ${roomId}:`, err);
    }
  }

  process.exit(0);
});
