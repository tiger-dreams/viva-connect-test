import express from 'express';
import { Builder } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
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
    method: 'Selenium WebDriver + Xvfb',
  });
});

/**
 * Join AI Agent to PlanetKit Conference using Selenium
 * POST /join-as-agent
 */
app.post('/join-as-agent', async (req, res) => {
  const { roomId, userId, language = 'ko', voice = 'Kore' } = req.body;

  if (!roomId || !userId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: roomId, userId',
    });
  }

  console.log('[Selenium Service] Join request:', { roomId, userId, language, voice });

  try {
    // Check if session already exists
    if (activeSessions.has(roomId)) {
      console.log('[Selenium Service] Session already exists for room:', roomId);
      return res.json({
        success: true,
        message: 'Session already active',
        roomId,
        sessionId: activeSessions.get(roomId).sessionId,
      });
    }

    // Configure Chrome options with maximum stealth
    const chromeOptions = new chrome.Options();

    chromeOptions.addArguments(
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      // Media stream arguments
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--allow-running-insecure-content',
      '--disable-web-security',
      // Automation detection bypass
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--disable-extensions',
      '--disable-popup-blocking',
      '--start-maximized',
      // Additional stealth
      '--disable-features=VizDisplayCompositor',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-site-isolation-trials',
      // User agent
      '--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );

    // Set preferences to hide automation
    chromeOptions.setUserPreferences({
      'credentials_enable_service': false,
      'profile.password_manager_enabled': false,
      'profile.default_content_setting_values.media_stream_mic': 1,
      'profile.default_content_setting_values.media_stream_camera': 1,
      'profile.default_content_setting_values.notifications': 1,
    });

    // Exclude automation switches
    chromeOptions.excludeSwitches('enable-automation');
    chromeOptions.excludeSwitches('enable-logging');

    console.log('[Selenium Service] Building Chrome WebDriver...');

    // Build WebDriver
    const driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(chromeOptions)
      .build();

    const sessionId = (await driver.getSession()).getId();
    console.log('[Selenium Service] ✅ Chrome WebDriver started, Session ID:', sessionId);

    // Execute CDP commands to hide webdriver (if supported)
    try {
      await driver.executeCdpCommand('Page.addScriptToEvaluateOnNewDocument', {
        source: `
          // Hide webdriver property
          Object.defineProperty(navigator, 'webdriver', {
            get: () => false,
          });

          // Override permissions
          const originalQuery = window.navigator.permissions.query;
          window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
              Promise.resolve({ state: Notification.permission }) :
              originalQuery(parameters)
          );

          // Mock plugins
          Object.defineProperty(navigator, 'plugins', {
            get: () => [
              { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
              { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
              { name: 'Native Client', filename: 'internal-nacl-plugin' },
            ],
          });

          // Mock languages
          Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en', 'ko'],
          });

          // Mock chrome runtime
          window.chrome = {
            runtime: {},
          };

          console.log('[Stealth] ✅ Automation detection bypass injected');
        `,
      });
      console.log('[Selenium Service] ✅ CDP stealth scripts injected');
    } catch (err) {
      console.warn('[Selenium Service] CDP commands not supported:', err.message);
    }

    // Load headless agent page
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    const agentUrl = `${frontendUrl}/headless-agent?roomId=${encodeURIComponent(roomId)}&userId=${encodeURIComponent(userId)}&lang=${language}&voice=${encodeURIComponent(voice)}`;

    console.log('[Selenium Service] Loading:', agentUrl);
    await driver.get(agentUrl);

    // Wait for page to load
    await driver.sleep(5000);

    // Capture console logs manually (since CDP is not supported)
    const captureLogs = async () => {
      try {
        const logs = await driver.executeScript(`
          if (!window.consoleCapture) return [];
          const captured = window.consoleCapture;
          window.consoleCapture = [];
          return captured;
        `);
        if (logs && logs.length > 0) {
          logs.forEach(log => console.log(`[Headless Page] ${log}`));
        }
      } catch (err) {
        // Ignore
      }
    };

    // Inject console capture on page
    await driver.executeScript(`
      window.consoleCapture = [];
      const originalLog = console.log;
      const originalError = console.error;
      const originalWarn = console.warn;

      console.log = function(...args) {
        window.consoleCapture.push('[log] ' + args.join(' '));
        originalLog.apply(console, args);
      };
      console.error = function(...args) {
        window.consoleCapture.push('[error] ' + args.join(' '));
        originalError.apply(console, args);
      };
      console.warn = function(...args) {
        window.consoleCapture.push('[warn] ' + args.join(' '));
        originalWarn.apply(console, args);
      };
    `);

    console.log('[Selenium Service] Console capture injected, reloading page...');
    await driver.navigate().refresh();
    await driver.sleep(5000);

    // Check if agent connected with periodic log capture
    console.log('[Selenium Service] Waiting for agent connection...');
    const connected = await driver.executeScript(`
      return new Promise(async (resolve) => {
        const checkConnection = async () => {
          if (window.agentConnected === true) {
            resolve(true);
          } else if (window.agentConnected === false) {
            resolve(false);
          } else {
            setTimeout(checkConnection, 1000);
          }
        };
        checkConnection();
        setTimeout(() => resolve(false), 90000); // 90s timeout
      });
    `);

    // Capture final logs
    await captureLogs();

    if (connected) {
      console.log('[Selenium Service] ✅ Agent connected successfully');
    } else {
      console.warn('[Selenium Service] ⚠️ Agent connection failed or timeout');
      // Capture error details
      const errorDetails = await driver.executeScript(`
        return {
          agentConnected: window.agentConnected,
          location: window.location.href,
          errors: window.consoleCapture || []
        };
      `);
      console.error('[Selenium Service] Error details:', JSON.stringify(errorDetails, null, 2));
    }

    // Store session
    activeSessions.set(roomId, {
      driver,
      sessionId,
      roomId,
      userId,
      createdAt: new Date().toISOString(),
    });

    // Return success
    res.json({
      success: true,
      message: 'AI Agent joined successfully via Selenium',
      roomId,
      userId,
      sessionId,
      method: 'Selenium WebDriver + Xvfb',
    });

    console.log('[Selenium Service] Active sessions:', activeSessions.size);

  } catch (error) {
    console.error('[Selenium Service] Failed to join agent:', error);

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
 */
app.post('/disconnect-agent', async (req, res) => {
  const { roomId } = req.body;

  if (!roomId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required field: roomId',
    });
  }

  console.log('[Selenium Service] Disconnect request:', { roomId });

  try {
    const session = activeSessions.get(roomId);

    if (!session) {
      console.log('[Selenium Service] No active session found for room:', roomId);
      return res.json({
        success: true,
        message: 'No active session to disconnect',
      });
    }

    // Quit browser
    await session.driver.quit();
    activeSessions.delete(roomId);

    console.log('[Selenium Service] ✅ Session disconnected');
    console.log('[Selenium Service] Active sessions:', activeSessions.size);

    res.json({
      success: true,
      message: 'AI Agent disconnected successfully',
      roomId,
    });

  } catch (error) {
    console.error('[Selenium Service] Failed to disconnect agent:', error);

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
    sessionId: session.sessionId,
  }));

  res.json({
    success: true,
    count: sessions.length,
    sessions,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`[Selenium Service] 🚀 Server running on port ${PORT}`);
  console.log(`[Selenium Service] Health check: http://localhost:${PORT}/health`);
  console.log(`[Selenium Service] Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:8080'}`);
  console.log(`[Selenium Service] Method: Selenium WebDriver + Xvfb`);
  console.log(`[Selenium Service] DISPLAY: ${process.env.DISPLAY}`);
});

// Cleanup on exit
process.on('SIGTERM', async () => {
  console.log('[Selenium Service] Shutting down...');

  // Quit all active sessions
  for (const [roomId, session] of activeSessions.entries()) {
    try {
      await session.driver.quit();
      console.log(`[Selenium Service] Closed session: ${roomId}`);
    } catch (err) {
      console.error(`[Selenium Service] Failed to close session ${roomId}:`, err);
    }
  }

  process.exit(0);
});
