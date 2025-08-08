import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Video, Settings } from "lucide-react";
import { useVideoSDK } from "@/contexts/VideoSDKContext";
import { LiveKitMeetingArea } from "@/components/LiveKitMeetingArea";

const LiveKitMeeting = () => {
  const navigate = useNavigate();
  const { liveKitConfig } = useVideoSDK();

  const handleBackToSetup = () => {
    navigate('/setup');
  };

  const getRoomInfo = () => {
    return {
      room: liveKitConfig.roomName,
      participant: liveKitConfig.participantName
    };
  };

  const roomInfo = getRoomInfo();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* 헤더 */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToSetup}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                설정으로 돌아가기
              </Button>
              
              <div className="flex items-center gap-2">
                <Video className="w-5 h-5 text-primary" />
                <h1 className="text-xl font-semibold">LiveKit 화상회의</h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* 현재 SDK 표시 */}
              <Badge variant="outline" className="bg-green-600/20 text-green-600 border-green-600/30">
                LiveKit
              </Badge>

              {/* 룸 정보 */}
              <div className="text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>룸: <span className="font-mono">{roomInfo.room}</span></span>
                  <span>|</span>
                  <span>{roomInfo.participant}</span>
                </div>
              </div>

              {/* 설정 버튼 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToSetup}
                className="flex items-center gap-2"
              >
                <Settings className="w-4 h-4" />
                설정
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 메인 LiveKit 화상회의 영역 */}
      <div className="container mx-auto px-4 py-6">
        <LiveKitMeetingArea config={liveKitConfig} />
      </div>

      {/* 하단 도움말 */}
      <div className="fixed bottom-4 right-4 z-10">
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg max-w-xs">
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium">💡 도움말</p>
            <p>• 카메라/마이크 버튼으로 미디어 제어</p>
            <p>• 화면 공유 버튼으로 화면 공유</p>
            <p>• 디바이스 설정으로 카메라/마이크 변경</p>
            <p>• 설정 버튼으로 SDK 설정 변경</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveKitMeeting;