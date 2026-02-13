#!/bin/bash

echo "[Xvfb] Starting virtual display..."

# Start Xvfb (X Virtual Frame Buffer)
Xvfb :99 -screen 0 ${SCREEN_WIDTH}x${SCREEN_HEIGHT}x${SCREEN_DEPTH} -ac -nolisten tcp -nolisten unix &
XVFB_PID=$!

# Wait for Xvfb to start
sleep 2

# Start PulseAudio (for audio simulation)
pulseaudio --start --log-target=syslog

echo "[Xvfb] ✅ Virtual display started on DISPLAY=:99"
echo "[PulseAudio] ✅ Audio system started"

# Start Node.js application
echo "[App] Starting Selenium WebDriver service..."
node server.js

# If Node.js exits, kill Xvfb
kill $XVFB_PID
