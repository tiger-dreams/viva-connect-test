import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Monitor, 
  MonitorOff, 
  Phone, 
  PhoneOff,
  Users,
  Signal,
  Activity
} from "lucide-react";
import { SDKType, AgoraConfig, ZoomConfig, ConnectionStatus, VideoMetrics, Participant } from "@/types/video-sdk";

interface VideoMeetingAreaProps {
  selectedSDK: SDKType;
  agoraConfig: AgoraConfig;
  zoomConfig: ZoomConfig;
}

export const VideoMeetingArea = ({ selectedSDK, agoraConfig, zoomConfig }: VideoMeetingAreaProps) => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    connecting: false
  });
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [metrics, setMetrics] = useState<VideoMetrics>({
    frameRate: 30,
    resolution: "1280x720",
    bitrate: 1200,
    packetLoss: 0
  });

  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideosRef = useRef<HTMLDivElement>(null);

  const config = selectedSDK === 'agora' ? agoraConfig : zoomConfig;
  const isConfigValid = selectedSDK === 'agora' 
    ? agoraConfig.appId && agoraConfig.token && agoraConfig.channelName
    : zoomConfig.sdkKey && zoomConfig.token && zoomConfig.sessionName;

  const handleConnect = async () => {
    if (!isConfigValid) return;
    
    setConnectionStatus({ connected: false, connecting: true });
    
    // 실제 SDK 연결 로직은 여기에 구현됩니다
    setTimeout(() => {
      setConnectionStatus({ connected: true, connecting: false });
      setParticipants([
        {
          id: "local",
          name: selectedSDK === 'agora' ? agoraConfig.uid || "Local User" : zoomConfig.userName,
          isVideoOn: true,
          isAudioOn: true,
          isScreenSharing: false
        }
      ]);
    }, 2000);
  };

  const handleDisconnect = () => {
    setConnectionStatus({ connected: false, connecting: false });
    setParticipants([]);
    setIsVideoEnabled(true);
    setIsAudioEnabled(true);
    setIsScreenSharing(false);
  };

  const toggleVideo = () => {
    setIsVideoEnabled(!isVideoEnabled);
  };

  const toggleAudio = () => {
    setIsAudioEnabled(!isAudioEnabled);
  };

  const toggleScreenShare = () => {
    setIsScreenSharing(!isScreenSharing);
  };

  const getConnectionColor = () => {
    if (connectionStatus.connecting) return "warning";
    if (connectionStatus.connected) return "success";
    return "secondary";
  };

  const getConnectionText = () => {
    if (connectionStatus.connecting) return "연결 중...";
    if (connectionStatus.connected) return "연결됨";
    return "연결 안됨";
  };

  return (
    <div className="space-y-4">
      {/* 연결 상태 및 컨트롤 */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                selectedSDK === 'agora' ? 'bg-agora-primary/20' : 'bg-zoom-primary/20'
              }`}>
                <Video className={`w-4 h-4 ${
                  selectedSDK === 'agora' ? 'text-agora-primary' : 'text-zoom-primary'
                }`} />
              </div>
              {selectedSDK === 'agora' ? 'Agora' : 'Zoom'} 화상회의
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge 
                variant="outline" 
                className={`${getConnectionColor() === 'success' ? 'bg-success/20 text-success border-success/30' :
                  getConnectionColor() === 'warning' ? 'bg-warning/20 text-warning border-warning/30' :
                  'bg-muted text-muted-foreground'}`}
              >
                <Signal className="w-3 h-3 mr-1" />
                {getConnectionText()}
              </Badge>
              <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30">
                <Users className="w-3 h-3 mr-1" />
                {participants.length}명 참여
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 메인 연결 버튼 */}
          <div className="flex items-center gap-2">
            {!connectionStatus.connected ? (
              <Button
                onClick={handleConnect}
                disabled={!isConfigValid || connectionStatus.connecting}
                className={`flex-1 ${
                  selectedSDK === 'agora' ? 'bg-agora-primary hover:bg-agora-primary/90' : 'bg-zoom-primary hover:bg-zoom-primary/90'
                }`}
              >
                <Phone className="w-4 h-4 mr-2" />
                {connectionStatus.connecting ? "연결 중..." : "회의 참여"}
              </Button>
            ) : (
              <Button
                onClick={handleDisconnect}
                variant="destructive"
                className="flex-1"
              >
                <PhoneOff className="w-4 h-4 mr-2" />
                회의 나가기
              </Button>
            )}
          </div>

          {!isConfigValid && (
            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
              ⚠️ {selectedSDK === 'agora' ? 'Agora' : 'Zoom'} 설정을 완료하고 토큰을 생성해야 연결할 수 있습니다.
            </div>
          )}

          {/* 컨트롤 패널 */}
          {connectionStatus.connected && (
            <>
              <Separator />
              <div className="flex items-center gap-2">
                <Button
                  variant={isVideoEnabled ? "default" : "secondary"}
                  size="sm"
                  onClick={toggleVideo}
                  className={isVideoEnabled ? "" : "bg-destructive hover:bg-destructive/90"}
                >
                  {isVideoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                </Button>
                <Button
                  variant={isAudioEnabled ? "default" : "secondary"}
                  size="sm"
                  onClick={toggleAudio}
                  className={isAudioEnabled ? "" : "bg-destructive hover:bg-destructive/90"}
                >
                  {isAudioEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </Button>
                <Button
                  variant={isScreenSharing ? "default" : "outline"}
                  size="sm"
                  onClick={toggleScreenShare}
                >
                  {isScreenSharing ? <MonitorOff className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
                </Button>
                <Separator orientation="vertical" className="h-6" />
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Activity className="w-3 h-3" />
                    {metrics.frameRate}fps
                  </div>
                  <div>{metrics.resolution}</div>
                  <div>{metrics.bitrate}kbps</div>
                  <div>손실: {metrics.packetLoss}%</div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 비디오 영역 */}
      <Card className="bg-video-bg border-border shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[400px]">
            {/* 로컬 비디오 */}
            <div className="relative bg-control-panel rounded-lg overflow-hidden">
              <div ref={localVideoRef} className="w-full h-full min-h-[200px] flex items-center justify-center">
                {connectionStatus.connected ? (
                  <div className="text-center space-y-2">
                    <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center text-2xl font-bold text-white mx-auto">
                      {selectedSDK === 'agora' ? 'A' : 'Z'}
                    </div>
                    <p className="text-sm text-muted-foreground">로컬 비디오</p>
                    <Badge variant="outline" className="text-xs">
                      {isVideoEnabled ? '비디오 켜짐' : '비디오 꺼짐'}
                    </Badge>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground">
                    <Video className="w-16 h-16 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">회의에 참여하면 비디오가 표시됩니다</p>
                  </div>
                )}
              </div>
              {connectionStatus.connected && (
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-xs">
                  <Badge variant="secondary" className="bg-black/50 text-white border-none">
                    나
                  </Badge>
                  <div className="flex gap-1">
                    {!isAudioEnabled && <MicOff className="w-3 h-3 text-destructive" />}
                    {!isVideoEnabled && <VideoOff className="w-3 h-3 text-destructive" />}
                  </div>
                </div>
              )}
            </div>

            {/* 원격 비디오 */}
            <div className="relative bg-control-panel rounded-lg overflow-hidden">
              <div ref={remoteVideosRef} className="w-full h-full min-h-[200px] flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Users className="w-16 h-16 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">다른 참가자가 참여하면 비디오가 표시됩니다</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 참가자 목록 */}
      {connectionStatus.connected && participants.length > 0 && (
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">참가자 목록</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {participants.map((participant) => (
                <div key={participant.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-sm font-bold text-white">
                      {participant.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium">{participant.name}</span>
                    {participant.id === 'local' && (
                      <Badge variant="outline" className="text-xs">나</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {participant.isVideoOn ? (
                      <Video className="w-3 h-3 text-success" />
                    ) : (
                      <VideoOff className="w-3 h-3 text-muted-foreground" />
                    )}
                    {participant.isAudioOn ? (
                      <Mic className="w-3 h-3 text-success" />
                    ) : (
                      <MicOff className="w-3 h-3 text-muted-foreground" />
                    )}
                    {participant.isScreenSharing && (
                      <Monitor className="w-3 h-3 text-primary" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};