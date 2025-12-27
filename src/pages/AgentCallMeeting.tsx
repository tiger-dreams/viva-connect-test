import { useNavigate, useSearchParams } from 'react-router-dom';
import { useVideoSDK } from '@/contexts/VideoSDKContext';
import { PlanetKitMeetingArea } from '@/components/PlanetKitMeetingArea';

export const AgentCallMeeting = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { planetKitConfig } = useVideoSDK();
  const sessionId = searchParams.get('sid');

  console.log('[AgentCallMeeting] Rendering with sessionId:', sessionId);

  const handleDisconnect = () => {
    console.log('[AgentCallMeeting] Call ended, navigating to setup');
    navigate('/setup');
  };

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-purple-900 to-blue-900 overflow-hidden">
      <PlanetKitMeetingArea
        config={planetKitConfig}
        mode="agent-call"
        sessionId={sessionId || undefined}
        onDisconnect={handleDisconnect}
      />
    </div>
  );
};

export default AgentCallMeeting;
