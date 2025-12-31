// Service Worker for Web Push Notifications
// Viva Connect Test - Desktop Browser Support

const SW_VERSION = '1.0.0';

// Service Worker Installation
self.addEventListener('install', (event) => {
  console.log(`[Service Worker v${SW_VERSION}] Installing...`);
  self.skipWaiting(); // Activate immediately
});

// Service Worker Activation
self.addEventListener('activate', (event) => {
  console.log(`[Service Worker v${SW_VERSION}] Activated`);
  event.waitUntil(clients.claim()); // Take control of all pages
});

// Push Event Handler
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push event received');

  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    console.error('[Service Worker] Failed to parse push data:', error);
    data = { title: 'Incoming Call', body: 'You have an incoming call' };
  }

  const {
    title = '📞 Incoming Call',
    body = 'Someone is calling you',
    callId,
    callerId,
    callerName,
    roomId,
    icon = '/vite.svg',
    badge = '/vite.svg'
  } = data;

  const notificationOptions = {
    body,
    icon,
    badge,
    tag: `call-${callId || Date.now()}`,
    requireInteraction: true, // Notification stays until user interacts
    vibrate: [200, 100, 200, 100, 200], // Vibration pattern
    actions: [
      {
        action: 'accept',
        title: 'Accept',
        icon: '/vite.svg'
      },
      {
        action: 'decline',
        title: 'Decline',
        icon: '/vite.svg'
      }
    ],
    data: {
      callId,
      callerId,
      callerName,
      roomId,
      timestamp: Date.now(),
      url: `${self.location.origin}/beta/planetkit_meeting?room=${roomId}&mode=1to1&callId=${callId}`
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, notificationOptions)
  );
});

// Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked', {
    action: event.action,
    tag: event.notification.tag,
    data: event.notification.data
  });

  event.notification.close();

  // Handle decline action
  if (event.action === 'decline') {
    console.log('[Service Worker] Call declined');

    // Send decline signal to server
    event.waitUntil(
      fetch(`${self.location.origin}/api/decline-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callId: event.notification.data.callId,
          callerId: event.notification.data.callerId,
          timestamp: Date.now()
        })
      }).catch(error => {
        console.error('[Service Worker] Failed to send decline signal:', error);
      })
    );

    return;
  }

  // Handle accept action (default or explicit accept button)
  const urlToOpen = event.notification.data.url || `${self.location.origin}/beta`;

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      console.log('[Service Worker] Found', clientList.length, 'open windows');

      // Check if there's already a window open on our origin
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          console.log('[Service Worker] Focusing existing window:', client.url);

          // Focus the existing window
          client.focus();

          // Send message to accept the call
          client.postMessage({
            type: 'ACCEPT_CALL',
            callId: event.notification.data.callId,
            callerId: event.notification.data.callerId,
            callerName: event.notification.data.callerName,
            roomId: event.notification.data.roomId,
            timestamp: event.notification.data.timestamp
          });

          return;
        }
      }

      // No window open, open a new one
      if (clients.openWindow) {
        console.log('[Service Worker] Opening new window:', urlToOpen);
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Notification Close Handler
self.addEventListener('notificationclose', (event) => {
  console.log('[Service Worker] Notification closed without interaction', {
    tag: event.notification.tag,
    data: event.notification.data
  });

  // Optionally log missed call to server
  if (event.notification.data.callId) {
    fetch(`${self.location.origin}/api/log-missed-call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callId: event.notification.data.callId,
        timestamp: Date.now()
      })
    }).catch(error => {
      console.error('[Service Worker] Failed to log missed call:', error);
    });
  }
});

// Message Handler (for communication with app)
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message received:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log(`[Service Worker v${SW_VERSION}] Script loaded`);
