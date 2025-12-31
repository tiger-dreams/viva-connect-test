/**
 * Web Push Utility Functions
 * Viva Connect Test - Desktop Browser Support
 */

/**
 * Convert VAPID public key from base64 to Uint8Array
 * Required for PushManager.subscribe() applicationServerKey parameter
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

/**
 * Check if Web Push is supported in current browser
 */
export function isWebPushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Check if notification permission is granted
 */
export function isNotificationGranted(): boolean {
  return Notification.permission === 'granted';
}

/**
 * Check if notification permission is denied
 */
export function isNotificationDenied(): boolean {
  return Notification.permission === 'denied';
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('[Web Push] Notifications not supported');
    return 'denied';
  }

  return await Notification.requestPermission();
}

/**
 * Show a local notification (for testing)
 */
export function showLocalNotification(
  title: string,
  options?: NotificationOptions
): void {
  if (!isNotificationGranted()) {
    console.warn('[Web Push] Notification permission not granted');
    return;
  }

  new Notification(title, options);
}
