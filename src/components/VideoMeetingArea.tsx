import { useState, useRef, useEffect } from "react";
import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";
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
    frameRate: 0,
    resolution: "-",
    bitrate: 0,
    packetLoss: 0
  });

  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideosRef = useRef<HTMLDivElement>(null);
  
  // Agora SDK 관련 상태
  const [agoraClient, setAgoraClient] = useState<IAgoraRTCClient | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);

  const config = selectedSDK === 'agora' ? agoraConfig : zoomConfig;
  const isConfigValid = selectedSDK === 'agora' 
    ? agoraConfig.appId && agoraConfig.channelName  // 토큰 없이도 테스트 가능
    : zoomConfig.sdkKey && zoomConfig.token && zoomConfig.sessionName;

  // 컴포넌트 언마운트 시 리소스 정리
  useEffect(() => {
    return () => {
      if (agoraClient) {
        agoraClient.leave().catch(console.error);
      }
      if (localVideoTrack) {
        localVideoTrack.stop();
        localVideoTrack.close();
      }
      if (localAudioTrack) {
        localAudioTrack.stop();
        localAudioTrack.close();
      }
    };
  }, [agoraClient, localVideoTrack, localAudioTrack]);

  const handleConnect = async () => {
    if (!isConfigValid) return;
    
    // 이미 연결 시도 중이면 무시
    if (connectionStatus.connecting) {
      console.log('이미 연결 시도 중입니다.');
      return;
    }
    
    setConnectionStatus({ connected: false, connecting: true });
    
    try {
      // 이전 연결이 있으면 정리 (단, 연결 시도 중이 아닌 경우만)
      if (agoraClient && agoraClient.connectionState !== 'DISCONNECTED') {
        console.log('이전 연결 정리 중...');
        try {
          await agoraClient.leave();
        } catch (e) {
          console.log('이전 연결 정리 중 오류:', e);
        }
        // 짧은 대기
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      if (selectedSDK === 'agora') {
        await connectToAgora();
      } else {
        // Zoom SDK 연결 로직 (추후 구현)
        console.log('Zoom SDK 연결은 아직 구현되지 않았습니다.');
        setConnectionStatus({ connected: false, connecting: false, error: 'Zoom SDK는 아직 지원되지 않습니다.' });
      }
    } catch (error) {
      console.error('Connection failed:', error);
      setConnectionStatus({ 
        connected: false, 
        connecting: false, 
        error: error instanceof Error ? error.message : '연결에 실패했습니다.'
      });
    }
  };

  const connectToAgora = async () => {
    try {
      console.log('Agora 연결 시작:', {
        appId: agoraConfig.appId,
        channelName: agoraConfig.channelName,
        uid: agoraConfig.uid,
        hasToken: !!agoraConfig.token
      });

      // 새로운 Agora RTC 클라이언트 생성
      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      console.log('클라이언트 생성 완료');

      // 미디어 트랙 생성 (카메라/마이크 권한 요청)
      console.log('미디어 트랙 생성 시작...');
      const videoTrack = await AgoraRTC.createCameraVideoTrack({
        optimizationMode: "motion",
        encoderConfig: {
          width: 1280,
          height: 720,
          frameRate: 30,
          bitrateMax: 1200,
          bitrateMin: 600
        }
      });
      const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      console.log('미디어 트랙 생성 완료');
      
      setLocalVideoTrack(videoTrack);
      setLocalAudioTrack(audioTrack);

      // 로컬 비디오 표시
      if (localVideoRef.current) {
        videoTrack.play(localVideoRef.current);
      }
      
      // 클라이언트를 상태에 저장 (연결 성공 전에 설정)
      setAgoraClient(client);
      setLocalVideoTrack(videoTrack);
      setLocalAudioTrack(audioTrack);

      // Agora 채널 연결 (숫자 UID 사용)
      console.log('채널 조인 시작...');
      const numericUid = agoraConfig.uid ? parseInt(agoraConfig.uid) : null;
      const uid = await client.join(
        agoraConfig.appId,
        agoraConfig.channelName,
        agoraConfig.token || null, // 토큰이 있으면 사용, 없으면 null
        numericUid
      );
      console.log('채널 조인 완료, UID:', uid);

      // 로컬 트랙 발행
      console.log('트랙 퍼블리시 시작...');
      await client.publish([videoTrack, audioTrack]);
      console.log('트랙 퍼블리시 완료');

      // 실시간 통계 모니터링 시작
      startStatsMonitoring(client, videoTrack);

      setConnectionStatus({ connected: true, connecting: false });
      setParticipants([
        {
          id: "local",
          name: `User ${uid}`,
          isVideoOn: true,
          isAudioOn: true,
          isScreenSharing: false
        }
      ]);

      // 원격 사용자 이벤트 리스너
      client.on('user-published', async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        
        if (mediaType === 'video' && remoteVideosRef.current) {
          user.videoTrack?.play(remoteVideosRef.current);
        }
        
        if (mediaType === 'audio') {
          user.audioTrack?.play();
        }

        // 참가자 목록 업데이트
        setParticipants(prev => {
          const existing = prev.find(p => p.id === user.uid.toString());
          if (existing) {
            return prev.map(p => 
              p.id === user.uid.toString() 
                ? { ...p, isVideoOn: !!user.videoTrack, isAudioOn: !!user.audioTrack }
                : p
            );
          } else {
            return [...prev, {
              id: user.uid.toString(),
              name: `User ${user.uid}`,
              isVideoOn: !!user.videoTrack,
              isAudioOn: !!user.audioTrack,
              isScreenSharing: false
            }];
          }
        });
      });

      client.on('user-unpublished', (user) => {
        setParticipants(prev => prev.filter(p => p.id !== user.uid.toString()));
      });

    } catch (error) {
      console.error('Agora 연결 실패:', error);
      // 연결 실패 시 메트릭 리셋
      setMetrics({
        frameRate: 0,
        resolution: "-",
        bitrate: 0,
        packetLoss: 0
      });
      
      // 에러 타입별 메시지 처리
      let errorMessage = '연결에 실패했습니다.';
      if (error instanceof Error) {
        if (error.message.includes('INVALID_TOKEN')) {
          errorMessage = '토큰이 유효하지 않습니다. 새 토큰을 생성해주세요.';
        } else if (error.message.includes('INVALID_PARAMS')) {
          errorMessage = 'App ID나 Channel Name이 올바르지 않습니다.';
        } else if (error.message.includes('OPERATION_ABORTED')) {
          errorMessage = '연결이 취소되었습니다. 네트워크를 확인하고 다시 시도해주세요.';
        } else if (error.message.includes('PERMISSION_DENIED')) {
          errorMessage = '카메라/마이크 권한이 거부되었습니다. 브라우저 설정을 확인해주세요.';
        } else {
          errorMessage = error.message;
        }
      }
      
      throw new Error(errorMessage);
    }
  };

  const handleDisconnect = async () => {
    try {
      // Agora 연결 해제
      if (agoraClient) {
        await agoraClient.leave();
        setAgoraClient(null);
      }

      // 로컬 트랙 정리
      if (localVideoTrack) {
        localVideoTrack.stop();
        localVideoTrack.close();
        setLocalVideoTrack(null);
      }

      if (localAudioTrack) {
        localAudioTrack.stop();
        localAudioTrack.close();
        setLocalAudioTrack(null);
      }

      setConnectionStatus({ connected: false, connecting: false });
      setParticipants([]);
      setIsVideoEnabled(true);
      setIsAudioEnabled(true);
      setIsScreenSharing(false);
      
      // 메트릭 리셋
      setMetrics({
        frameRate: 0,
        resolution: "-",
        bitrate: 0,
        packetLoss: 0
      });
    } catch (error) {
      console.error('Disconnect failed:', error);
    }
  };

  const toggleVideo = async () => {
    try {
      if (localVideoTrack) {
        const newState = !isVideoEnabled;
        await localVideoTrack.setEnabled(newState);
        setIsVideoEnabled(newState);
        
        // 참가자 목록에서 로컬 사용자 상태 업데이트
        setParticipants(prev => 
          prev.map(p => p.id === 'local' ? { ...p, isVideoOn: newState } : p)
        );
      }
    } catch (error) {
      console.error('Toggle video failed:', error);
    }
  };

  const toggleAudio = async () => {
    try {
      if (localAudioTrack) {
        const newState = !isAudioEnabled;
        await localAudioTrack.setEnabled(newState);
        setIsAudioEnabled(newState);
        
        // 참가자 목록에서 로컬 사용자 상태 업데이트
        setParticipants(prev => 
          prev.map(p => p.id === 'local' ? { ...p, isAudioOn: newState } : p)
        );
      }
    } catch (error) {
      console.error('Toggle audio failed:', error);
    }
  };

  const toggleScreenShare = () => {
    setIsScreenSharing(!isScreenSharing);
  };

  // 실시간 통계 모니터링
  const startStatsMonitoring = (client: IAgoraRTCClient, videoTrack: ICameraVideoTrack) => {
    const statsInterval = setInterval(async () => {
      try {
        // 로컬 비디오 트랙 통계
        const localStats = await client.getLocalVideoStats();
        const localAudioStats = await client.getLocalAudioStats();
        
        // 로컬 비디오 트랙에서 해상도 정보 가져오기
        const videoElement = videoTrack.getMediaStreamTrack();
        const settings = videoElement.getSettings();
        
        setMetrics({
          frameRate: Math.round(localStats.sendFrameRate || 0),
          resolution: settings.width && settings.height 
            ? `${settings.width}x${settings.height}`
            : "-",
          bitrate: Math.round((localStats.sendBitrate || 0) + (localAudioStats.sendBitrate || 0)),
          packetLoss: Math.round((localStats.sendPacketsLost || 0) * 100 / Math.max(1, localStats.sendPackets || 1))
        });
        
      } catch (error) {
        console.warn('통계 업데이트 실패:', error);
      }
    }, 2000); // 2초마다 업데이트

    // 연결 해제 시 인터벌 정리
    client.on('connection-state-change', (curState) => {
      if (curState === 'DISCONNECTED' || curState === 'DISCONNECTING') {
        clearInterval(statsInterval);
        setMetrics({
          frameRate: 0,
          resolution: "-",
          bitrate: 0,
          packetLoss: 0
        });
      }
    });
    
    return statsInterval;
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

          {connectionStatus.error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20">
              <div className="flex items-center justify-between">
                <span>❌ 연결 오류: {connectionStatus.error}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConnectionStatus(prev => ({ ...prev, error: undefined }))}
                  className="h-6 px-2 text-xs"
                >
                  닫기
                </Button>
              </div>
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
                    {metrics.frameRate > 0 ? `${metrics.frameRate}fps` : '-'}
                  </div>
                  <div>{metrics.resolution}</div>
                  <div>{metrics.bitrate > 0 ? `${metrics.bitrate}kbps` : '-'}</div>
                  <div className={`${metrics.packetLoss > 5 ? 'text-destructive' : metrics.packetLoss > 2 ? 'text-warning' : ''}`}>
                    손실: {metrics.packetLoss}%
                  </div>
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
              <div 
                ref={localVideoRef} 
                className={`w-full h-full min-h-[200px] ${!connectionStatus.connected || !localVideoTrack ? 'flex items-center justify-center' : ''}`}
                style={{ backgroundColor: connectionStatus.connected && localVideoTrack ? 'transparent' : undefined }}
              >
                {!connectionStatus.connected ? (
                  <div className="text-center text-muted-foreground">
                    <Video className="w-16 h-16 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">회의에 참여하면 비디오가 표시됩니다</p>
                  </div>
                ) : !localVideoTrack ? (
                  <div className="text-center space-y-2">
                    <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center text-2xl font-bold text-white mx-auto">
                      {selectedSDK === 'agora' ? 'A' : 'Z'}
                    </div>
                    <p className="text-sm text-muted-foreground">비디오 로딩 중...</p>
                  </div>
                ) : null}
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
              <div 
                ref={remoteVideosRef} 
                className="w-full h-full min-h-[200px] flex items-center justify-center"
              >
                <div className="text-center text-muted-foreground">
                  <Users className="w-16 h-16 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">다른 참가자가 참여하면 비디오가 표시됩니다</p>
                  {participants.length > 1 && (
                    <Badge variant="outline" className="mt-2">
                      {participants.length - 1}명의 참가자가 연결됨
                    </Badge>
                  )}
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