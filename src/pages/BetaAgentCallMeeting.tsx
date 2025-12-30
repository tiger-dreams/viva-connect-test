import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useVideoSDK } from '@/contexts/VideoSDKContext';
import { useLiff } from '@/contexts/LiffContext';
import { PlanetKitMeetingArea } from '@/components/PlanetKitMeetingArea';
import { generatePlanetKitToken } from '@/utils/token-generator';
import { Loader2 } from 'lucide-react';

export const BetaAgentCallMeeting = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { planetKitConfig, setPlanetKitConfig } = useVideoSDK();
  const { profile, isLoggedIn } = useLiff();
  const sessionId = searchParams.get('sid');
  const [isInitializing, setIsInitializing] = useState(true);

  // Beta 환경 - 항상 true (Beta 전용 컴포넌트이므로)
  const isBeta = true;

  console.log('[BetaAgentCallMeeting] Rendering with sessionId:', sessionId, 'isBeta:', isBeta);

  // Initialize PlanetKit config when LIFF profile is available
  useEffect(() => {
    const initializeConfig = async () => {
      if (isLoggedIn && profile) {
        console.log('[BetaAgentCallMeeting] Initializing PlanetKit config with LIFF profile');

        // Generate access token
        const token = await generatePlanetKitToken(
          planetKitConfig.serviceId,
          planetKitConfig.apiKey,
          profile.userId,
          sessionId || '', // roomId (use sessionId for Agent Call)
          3600,
          planetKitConfig.apiSecret
        );

        // Update config with userId and accessToken
        setPlanetKitConfig({
          ...planetKitConfig,
          userId: profile.userId,
          displayName: profile.displayName,
          accessToken: token,
          environment: 'eval' // Always use eval for Agent Call
        });

        setIsInitializing(false);
      }
    };

    initializeConfig();
  }, [isLoggedIn, profile, sessionId]);

  const handleDisconnect = () => {
    console.log('[BetaAgentCallMeeting] Call ended, navigating to setup');
    navigate('/setup');
  };

  // Show loading while initializing
  if (isInitializing || !planetKitConfig.userId || !planetKitConfig.accessToken) {
    return (
      <div className="h-screen w-screen bg-gradient-to-br from-purple-900 to-blue-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-white" />
          <p className="text-white text-lg">Initializing call...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-purple-900 to-blue-900 overflow-hidden">
      <PlanetKitMeetingArea
        config={planetKitConfig}
        mode="agent-call"
        sessionId={sessionId || undefined}
        isBeta={isBeta}
        onDisconnect={handleDisconnect}
      />
    </div>
  );
};

export default BetaAgentCallMeeting;
