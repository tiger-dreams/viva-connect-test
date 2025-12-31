import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff, Send, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { webPushService } from '@/services/webPushService';
import { useToast } from '@/hooks/use-toast';

/**
 * Web Push Test Page
 * Test Web Push Notification functionality on desktop browsers
 */
export const WebPushTestPage = () => {
  const { toast } = useToast();

  const [isSupported, setIsSupported] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  const [testUserId, setTestUserId] = useState('test-user-' + Date.now());
  const [targetUserId, setTargetUserId] = useState('');
  const [callerName, setCallerName] = useState('Test Caller');
  const [roomId, setRoomId] = useState('test-room-123');

  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    checkSupport();
  }, []);

  const checkSupport = () => {
    const supported =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;

    setIsSupported(supported);

    if (!supported) {
      setError('Web Push not supported in this browser');
    }
  };

  const handleInitialize = async () => {
    setStatus('Initializing Service Worker...');
    setError('');

    try {
      const success = await webPushService.initialize();

      if (success) {
        setIsInitialized(true);
        setStatus('Service Worker initialized');

        toast({
          title: 'Success',
          description: 'Service Worker registered and notification permission granted'
        });
      } else {
        setError('Failed to initialize Service Worker or permission denied');
      }
    } catch (err: any) {
      setError(err.message || 'Initialization failed');
    }
  };

  const handleSubscribe = async () => {
    setStatus('Subscribing to push notifications...');
    setError('');

    try {
      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

      if (!vapidPublicKey) {
        throw new Error('VAPID public key not configured');
      }

      const sub = await webPushService.subscribe(vapidPublicKey);

      if (sub) {
        setSubscription(sub);
        setIsSubscribed(true);
        setStatus('Subscribed successfully');

        // Save subscription to backend
        const response = await fetch('/api/web-push?action=subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: testUserId,
            subscription: sub.toJSON()
          })
        });

        if (response.ok) {
          toast({
            title: 'Success',
            description: 'Push subscription saved to database'
          });
        }
      } else {
        setError('Failed to create push subscription');
      }
    } catch (err: any) {
      setError(err.message || 'Subscription failed');
    }
  };

  const handleUnsubscribe = async () => {
    setStatus('Unsubscribing...');
    setError('');

    try {
      const success = await webPushService.unsubscribe();

      if (success) {
        setSubscription(null);
        setIsSubscribed(false);
        setStatus('Unsubscribed successfully');

        toast({
          title: 'Success',
          description: 'Unsubscribed from push notifications'
        });
      }
    } catch (err: any) {
      setError(err.message || 'Unsubscribe failed');
    }
  };

  const handleSendTestNotification = async () => {
    setStatus('Sending test notification...');
    setError('');

    const target = targetUserId || testUserId;

    try {
      const response = await fetch('/api/web-push?action=notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: target,
          callerId: 'test-caller',
          callerName,
          roomId,
          callId: `test-call-${Date.now()}`
        })
      });

      if (response.ok) {
        setStatus('Test notification sent successfully');
        toast({
          title: 'Success',
          description: 'Test notification sent'
        });
      } else {
        const result = await response.json();
        throw new Error(result.error || 'Failed to send notification');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send test notification');
    }
  };

  const handleInitDatabase = async () => {
    setStatus('Initializing database...');
    setError('');

    try {
      const response = await fetch('/api/web-push?action=init-db');
      const result = await response.json();

      if (result.success) {
        setStatus('Database initialized successfully');
        toast({
          title: 'Success',
          description: 'Database tables created'
        });
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      setError(err.message || 'Database initialization failed');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-6 h-6" />
            Web Push Notification Test
          </CardTitle>
          <CardDescription>
            Test Web Push functionality on desktop browsers
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Support Status */}
          <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
            <div>
              <p className="font-semibold">Browser Support</p>
              <p className="text-sm text-muted-foreground">
                Service Worker, Push API, Notifications
              </p>
            </div>
            {isSupported ? (
              <Badge variant="default" className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4" />
                Supported
              </Badge>
            ) : (
              <Badge variant="destructive" className="flex items-center gap-1">
                <XCircle className="w-4 h-4" />
                Not Supported
              </Badge>
            )}
          </div>

          {/* Status Display */}
          {status && (
            <Alert>
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{status}</AlertDescription>
            </Alert>
          )}

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <XCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Step 1: Initialize Database */}
          <div className="space-y-2">
            <Label className="text-lg font-semibold">Step 1: Initialize Database</Label>
            <Button onClick={handleInitDatabase} className="w-full">
              Initialize Database Tables
            </Button>
          </div>

          {/* Step 2: Initialize Service Worker */}
          <div className="space-y-2">
            <Label className="text-lg font-semibold">Step 2: Initialize Service Worker</Label>
            <Button
              onClick={handleInitialize}
              disabled={!isSupported || isInitialized}
              className="w-full"
            >
              {isInitialized ? 'Service Worker Initialized ✓' : 'Initialize Service Worker'}
            </Button>
          </div>

          {/* Step 3: Subscribe */}
          <div className="space-y-2">
            <Label className="text-lg font-semibold">Step 3: Subscribe to Push</Label>
            <div className="space-y-2">
              <div>
                <Label htmlFor="userId">User ID (for testing)</Label>
                <Input
                  id="userId"
                  value={testUserId}
                  onChange={(e) => setTestUserId(e.target.value)}
                  placeholder="test-user-123"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleSubscribe}
                  disabled={!isInitialized || isSubscribed}
                  className="flex-1"
                >
                  {isSubscribed ? 'Subscribed ✓' : 'Subscribe'}
                </Button>
                <Button
                  onClick={handleUnsubscribe}
                  disabled={!isSubscribed}
                  variant="outline"
                  className="flex-1"
                >
                  <BellOff className="w-4 h-4 mr-2" />
                  Unsubscribe
                </Button>
              </div>
            </div>
          </div>

          {/* Subscription Details */}
          {subscription && (
            <div className="p-4 bg-secondary rounded-lg space-y-2">
              <p className="font-semibold">Subscription Details</p>
              <p className="text-xs font-mono break-all text-muted-foreground">
                {subscription.endpoint}
              </p>
            </div>
          )}

          {/* Step 4: Send Test Notification */}
          <div className="space-y-2">
            <Label className="text-lg font-semibold">Step 4: Send Test Notification</Label>
            <div className="space-y-2">
              <div>
                <Label htmlFor="targetUserId">Target User ID</Label>
                <Input
                  id="targetUserId"
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  placeholder={`Leave empty to use: ${testUserId}`}
                />
              </div>
              <div>
                <Label htmlFor="callerName">Caller Name</Label>
                <Input
                  id="callerName"
                  value={callerName}
                  onChange={(e) => setCallerName(e.target.value)}
                  placeholder="Test Caller"
                />
              </div>
              <div>
                <Label htmlFor="roomId">Room ID</Label>
                <Input
                  id="roomId"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  placeholder="test-room-123"
                />
              </div>
              <Button
                onClick={handleSendTestNotification}
                disabled={!isSubscribed}
                className="w-full"
              >
                <Send className="w-4 h-4 mr-2" />
                Send Test Notification
              </Button>
            </div>
          </div>

          {/* Instructions */}
          <Alert>
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              <strong>Note:</strong> This page is for testing Web Push on desktop browsers.
              If you send a test notification to yourself, you'll see a browser notification appear.
              Click the notification to see it in action!
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};

export default WebPushTestPage;
