# Use Ubuntu base image
FROM ubuntu:22.04

# Prevent interactive prompts during installation
ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    curl \
    unzip \
    xvfb \
    x11vnc \
    fluxbox \
    pulseaudio \
    alsa-utils \
    supervisor \
    # Chrome dependencies
    libnss3 \
    libgconf-2-4 \
    libfontconfig1 \
    libxss1 \
    libappindicator3-1 \
    libindicator7 \
    libpango1.0-0 \
    fonts-liberation \
    libgbm1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxi6 \
    libxtst6 \
    libxrandr2 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
RUN apt-get install -y nodejs

# Install Google Chrome (stable)
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -
RUN echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list
RUN apt-get update && apt-get install -y google-chrome-stable

# Install ChromeDriver (matching Chrome version)
RUN CHROME_VERSION=$(google-chrome --version | awk '{print $3}' | cut -d'.' -f1) && \
    wget -q "https://storage.googleapis.com/chrome-for-testing-public/${CHROME_VERSION}.0.6778.204/linux64/chromedriver-linux64.zip" -O /tmp/chromedriver.zip || \
    wget -q "https://edgedl.me.gvt1.com/edgedl/chrome/chrome-for-testing/131.0.6778.204/linux64/chromedriver-linux64.zip" -O /tmp/chromedriver.zip
RUN unzip /tmp/chromedriver.zip -d /tmp/ && \
    mv /tmp/chromedriver-linux64/chromedriver /usr/local/bin/ && \
    chmod +x /usr/local/bin/chromedriver && \
    rm -rf /tmp/chromedriver*

# Set up virtual display
ENV DISPLAY=:99
ENV SCREEN_WIDTH=1280
ENV SCREEN_HEIGHT=720
ENV SCREEN_DEPTH=24

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy application files
COPY server-selenium.js ./server.js
COPY start-xvfb.sh ./

# Make start script executable
RUN chmod +x start-xvfb.sh

# Expose port
EXPOSE 3000

# Start Xvfb + Application
CMD ["./start-xvfb.sh"]
