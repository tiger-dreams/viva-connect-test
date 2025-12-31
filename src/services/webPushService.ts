/**
 * Web Push Service
 * Manages Service Worker registration and Push notifications
 * Viva Connect Test - Desktop Browser Support
 */

import {
  urlBase64ToUint8Array,
  isWebPushSupported,
  isNotificationGranted,
  requestNotificationPermission
} from '@/utils/webPushUtils';

export class WebPushService {
  private registration: ServiceWorkerRegistration | null = null;
  private subscription: PushSubscription | null = null;
  private isInitialized: boolean = false;

  /**
   * Initialize Service Worker and request notification permission
   */
  async initialize(): Promise<boolean> {
    if (!isWebPushSupported()) {
      console.warn('[Web Push] Not supported in this browser');
      return false;
    }

    try {
      // Register Service Worker
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      console.log('[Web Push] Service Worker registered:', {
        scope: this.registration.scope,
        active: !!this.registration.active,
        waiting: !!this.registration.waiting,
        installing: !!this.registration.installing
      });

      // Wait for Service Worker to be ready
      await navigator.serviceWorker.ready;
      console.log('[Web Push] Service Worker ready');

      // Request notification permission if not yet granted
      if (!isNotificationGranted()) {
        const permission = await requestNotificationPermission();

        if (permission !== 'granted') {
          console.warn('[Web Push] Notification permission denied');
          return false;
        }

        console.log('[Web Push] Notification permission granted');
      }

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('[Web Push] Initialization error:', error);
      return false;
    }
  }

  /**
   * Subscribe to push notifications
   */
  async subscribe(vapidPublicKey: string): Promise<PushSubscription | null> {
    if (!this.registration) {
      console.error('[Web Push] Service Worker not registered');
      return null;
    }

    if (!isNotificationGranted()) {
      console.error('[Web Push] Notification permission not granted');
      return null;
    }

    try {
      // Check if already subscribed
      const existingSubscription = await this.registration.pushManager.getSubscription();

      if (existingSubscription) {
        console.log('[Web Push] Already subscribed:', existingSubscription.endpoint);
        this.subscription = existingSubscription;
        return existingSubscription;
      }

      // Convert VAPID key to Uint8Array
      const convertedKey = urlBase64ToUint8Array(vapidPublicKey);

      // Subscribe to push notifications
      this.subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey
      });

      console.log('[Web Push] Subscribed successfully:', {
        endpoint: this.subscription.endpoint,
        expirationTime: this.subscription.expirationTime
      });

      return this.subscription;
    } catch (error) {
      console.error('[Web Push] Subscription error:', error);
      return null;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(): Promise<boolean> {
    if (!this.subscription) {
      console.warn('[Web Push] No active subscription to unsubscribe');
      return false;
    }

    try {
      const success = await this.subscription.unsubscribe();

      if (success) {
        console.log('[Web Push] Unsubscribed successfully');
        this.subscription = null;
      }

      return success;
    } catch (error) {
      console.error('[Web Push] Unsubscribe error:', error);
      return false;
    }
  }

  /**
   * Get current push subscription
   */
  async getSubscription(): Promise<PushSubscription | null> {
    if (!this.registration) {
      return null;
    }

    try {
      this.subscription = await this.registration.pushManager.getSubscription();
      return this.subscription;
    } catch (error) {
      console.error('[Web Push] Get subscription error:', error);
      return null;
    }
  }

  /**
   * Check if currently subscribed
   */
  async isSubscribed(): Promise<boolean> {
    const subscription = await this.getSubscription();
    return !!subscription;
  }

  /**
   * Get Service Worker registration
   */
  getRegistration(): ServiceWorkerRegistration | null {
    return this.registration;
  }

  /**
   * Check if Web Push is initialized
   */
  isReady(): boolean {
    return this.isInitialized && !!this.registration && isNotificationGranted();
  }

  /**
   * Listen for messages from Service Worker
   */
  onMessage(callback: (data: any) => void): void {
    if (!navigator.serviceWorker) {
      console.warn('[Web Push] Service Worker not supported');
      return;
    }

    navigator.serviceWorker.addEventListener('message', (event) => {
      console.log('[Web Push] Message from Service Worker:', event.data);
      callback(event.data);
    });
  }

  /**
   * Send message to Service Worker
   */
  async sendMessage(message: any): Promise<void> {
    if (!this.registration || !this.registration.active) {
      console.error('[Web Push] No active Service Worker');
      return;
    }

    this.registration.active.postMessage(message);
    console.log('[Web Push] Message sent to Service Worker:', message);
  }
}

// Singleton instance
export const webPushService = new WebPushService();
