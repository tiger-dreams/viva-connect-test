import { useNavigate } from "react-router-dom";
import { useVideoSDK } from "@/contexts/VideoSDKContext";
import { PlanetKitMeetingArea } from "@/components/PlanetKitMeetingArea";

const BetaPlanetKitMeeting = () => {
  const navigate = useNavigate();
  const { planetKitConfig } = useVideoSDK();
  const isBeta = true; // Beta 전용 Conference 페이지

  return (
    <div className="h-screen w-screen bg-black overflow-hidden">
      <PlanetKitMeetingArea
        config={planetKitConfig}
        isBeta={isBeta}
        onDisconnect={() => navigate('/beta/setup')}
      />
    </div>
  );
};

export default BetaPlanetKitMeeting;