import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Phone,
  PhoneOff,
  Activity,
  Wifi,
  WifiOff,
  Clock,
  Users,
  Monitor,
  MonitorOff,
  Settings,
} from "lucide-react";
import { PlanetKitConfig, ConnectionStatus, Participant } from "@/types/video-sdk";
import { useToast } from "@/hooks/use-toast";
import { TileView, TileParticipant } from "@/components/TileView";
// PlanetKit 환경별 빌드 import
import * as PlanetKitReal from "@line/planet-kit";
import * as PlanetKitEval from "@line/planet-kit/dist/planet-kit-eval";

interface PlanetKitMeetingAreaProps {
  config: PlanetKitConfig;
}

export const PlanetKitMeetingArea = ({ config }: PlanetKitMeetingAreaProps) => {
  const { toast } = useToast();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    connecting: false
  });
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [connectionStartTime, setConnectionStartTime] = useState<Date | null>(null);
  const [callDuration, setCallDuration] = useState<string>("00:00:00");
  const [showDeviceSettings, setShowDeviceSettings] = useState(false);
  const [currentDevices, setCurrentDevices] = useState<{
    audioInput?: MediaDeviceInfo;
    audioOutput?: MediaDeviceInfo;
    videoInput?: MediaDeviceInfo;
  }>({});
  const [devicePermissions, setDevicePermissions] = useState<{
    microphone: PermissionState | "unknown";
    camera: PermissionState | "unknown";
  }>({ microphone: "unknown", camera: "unknown" });
  const [isWebView, setIsWebView] = useState(false);

  // 비디오 엘리먼트 refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const audioElementRef = useRef<HTMLAudioElement>(null);
  const [conference, setConference] = useState<any>(null);

  // WebView 환경 감지 (PlanetKit 5.5+)
  useEffect(() => {
    const detectWebView = () => {
      const userAgent = navigator.userAgent || navigator.vendor;
      // iOS WebView 감지
      const isIOSWebView = /(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/i.test(userAgent);
      // Android WebView 감지
      const isAndroidWebView = /Android.*wv\)/i.test(userAgent);

      const detected = isIOSWebView || isAndroidWebView;
      setIsWebView(detected);

      if (detected) {
        toast({
          title: "WebView 환경 감지",
          description: "화면 공유 및 가상 배경 기능은 WebView에서 지원되지 않습니다.",
          variant: "default",
        });
      }
    };

    detectWebView();
  }, []);

  // 디바이스 권한 모니터링 (PlanetKit 5.5+)
  useEffect(() => {
    const checkPermissions = async () => {
      try {
        // 마이크 권한 확인
        const micPermission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        setDevicePermissions(prev => ({ ...prev, microphone: micPermission.state }));

        micPermission.addEventListener('change', () => {
          setDevicePermissions(prev => ({ ...prev, microphone: micPermission.state }));
        });

        // 카메라 권한 확인
        const cameraPermission = await navigator.permissions.query({ name: 'camera' as PermissionName });
        setDevicePermissions(prev => ({ ...prev, camera: cameraPermission.state }));

        cameraPermission.addEventListener('change', () => {
          setDevicePermissions(prev => ({ ...prev, camera: cameraPermission.state }));
        });
      } catch (error) {
        console.warn('권한 확인 API 지원되지 않음:', error);
      }
    };

    checkPermissions();
  }, []);

  // 현재 사용 중인 미디어 디바이스 정보 조회 (PlanetKit 5.5+)
  useEffect(() => {
    const updateCurrentDevices = async () => {
      if (!connectionStatus.connected || !conference) return;

      try {
        // PlanetKit 5.5의 새로운 API를 사용하여 현재 디바이스 정보 가져오기
        if (conference.getCurrentAudioInputDevice) {
          const audioInput = await conference.getCurrentAudioInputDevice();
          setCurrentDevices(prev => ({ ...prev, audioInput }));
        }

        if (conference.getCurrentAudioOutputDevice) {
          const audioOutput = await conference.getCurrentAudioOutputDevice();
          setCurrentDevices(prev => ({ ...prev, audioOutput }));
        }

        if (conference.getCurrentVideoInputDevice) {
          const videoInput = await conference.getCurrentVideoInputDevice();
          setCurrentDevices(prev => ({ ...prev, videoInput }));
        }
      } catch (error) {
        console.warn('현재 디바이스 정보 조회 실패:', error);
      }
    };

    updateCurrentDevices();
  }, [connectionStatus.connected, conference]);

  // 통화 시간 업데이트
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (connectionStatus.connected && connectionStartTime) {
      interval = setInterval(() => {
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - connectionStartTime.getTime()) / 1000);

        const hours = Math.floor(elapsed / 3600);
        const minutes = Math.floor((elapsed % 3600) / 60);
        const seconds = elapsed % 60;

        setCallDuration(
          `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [connectionStatus.connected, connectionStartTime]);

  // 개발 모드 연결 시뮬레이션
  const connectMockConference = async () => {
    setConnectionStatus({ connected: false, connecting: true });
    
    // 연결 시뮬레이션 (2초 지연)
    setTimeout(() => {
      setConnectionStatus({ connected: true, connecting: false });
      setConnectionStartTime(new Date());
      
      // 로컬 참가자 추가 (화상회의)
      setParticipants([{
        id: "local",
        name: config.userId,
        isVideoOn: true,
        isAudioOn: true,
        isScreenSharing: false
      }]);

      // 2명의 가상 참가자 추가 (화상회의)
      setTimeout(() => {
        setParticipants(prev => [...prev, {
          id: "mock-peer-1",
          name: "Demo User 1",
          isVideoOn: true,
          isAudioOn: true,
          isScreenSharing: false
        }]);
      }, 3000);

      setTimeout(() => {
        setParticipants(prev => [...prev, {
          id: "mock-peer-2", 
          name: "Demo User 2",
          isVideoOn: Math.random() > 0.5, // 랜덤하게 비디오 on/off
          isAudioOn: true,
          isScreenSharing: false
        }]);
      }, 5000);

      toast({
        title: "개발 모드 연결 완료",
        description: "PlanetKit 개발 모드로 연결되었습니다. (실제 통화 아님)",
      });
    }, 2000);
  };

  // PlanetKit Conference 연결
  const connectToConference = async () => {
    if (!config.serviceId || !config.userId || !config.accessToken) {
      toast({
        title: "설정 오류",
        description: "PlanetKit 설정이 올바르지 않습니다.",
        variant: "destructive",
      });
      return;
    }

    // 개발 모드 확인을 최우선으로 (PlanetKit 코드 실행 전에)
    const isDevelopmentMode = config.serviceId === 'planetkit' || config.serviceId.includes('dev') || config.serviceId.includes('test');
    
    console.log('PlanetKit 연결 모드 체크:', {
      serviceId: config.serviceId,
      isDevelopmentMode,
      userId: config.userId,
      roomId: config.roomId
    });
    
    if (isDevelopmentMode) {
      console.log('🔧 개발 모드 활성화됨. 실제 PlanetKit 서버 연결 건너뛰기');
      toast({
        title: "개발 모드",
        description: "실제 LINE Planet 서버 대신 개발 모드로 실행합니다.",
      });
      return await connectMockConference();
    }

    // 실제 PlanetKit 연결 (프로덕션 모드에서만 실행)
    console.log('🚀 실제 PlanetKit Conference 연결 시도');
    setConnectionStatus({ connected: false, connecting: true });

    try {
      // 환경에 따라 올바른 PlanetKit 모듈 선택
      const isEvalEnvironment = config.environment === 'eval';
      const PlanetKit = isEvalEnvironment ? PlanetKitEval : PlanetKitReal;

      console.log(`PlanetKit 환경: ${config.environment} (${isEvalEnvironment ? 'Evaluation' : 'Real'})`);

      // PlanetKit Conference 인스턴스 생성
      const planetKitConference = new PlanetKit.Conference({
        logLevel: 'log'
      });

      // 이벤트 델리게이트 객체 정의
      const conferenceDelegate = {
        evtConnected: () => {
          console.log('PlanetKit Conference 연결됨');
          setConnectionStatus({ connected: true, connecting: false });
          setConnectionStartTime(new Date());
          
          // 로컬 참가자 추가 (화상회의)
          setParticipants([{
            id: "local",
            name: config.userId,
            isVideoOn: true, // 화상회의 모드
            isAudioOn: true,
            isScreenSharing: false
          }]);

          toast({
            title: "연결 성공",
            description: "PlanetKit Conference에 성공적으로 연결되었습니다.",
          });
        },

        evtDisconnected: (disconnectDetails: any) => {
          console.log('PlanetKit Conference 연결 해제:', disconnectDetails);
          setConnectionStatus({ connected: false, connecting: false });
          setParticipants([]);
          setConnectionStartTime(null);
          setCallDuration("00:00:00");
          
          toast({
            title: "연결 해제",
            description: "PlanetKit Conference 연결이 해제되었습니다.",
          });
        },

        evtPeerListUpdated: (peerUpdateInfo: any) => {
          console.log('참가자 목록 업데이트:', peerUpdateInfo);
          
          // 원격 참가자 목록 업데이트 (실제 구조에 맞게 조정)
          const peerList = peerUpdateInfo.peerList || peerUpdateInfo || [];
          const remoteParticipants = peerList.map((peer: any, index: number) => ({
            id: peer.peerId || peer.myId || `peer-${index}`,
            name: peer.peerName || peer.myId || `User ${index}`,
            isVideoOn: Math.random() > 0.3, // 화상회의 모드 (70% 비디오 on)
            isAudioOn: true,
            isScreenSharing: false
          }));

          // 로컬 참가자 + 원격 참가자
          setParticipants([
            {
              id: "local",
              name: config.userId,
              isVideoOn: isVideoOn, // 현재 비디오 상태 반영
              isAudioOn: isAudioOn,
              isScreenSharing: isScreenSharing
            },
            ...remoteParticipants
          ]);
        }
      };

      // Conference 참여 (올바른 파라미터 구조 사용)
      const conferenceParams = {
        myId: config.userId,
        myServiceId: config.serviceId,
        roomId: config.roomId,
        roomServiceId: config.serviceId, // roomServiceId 추가
        accessToken: config.accessToken,
        mediaType: "video", // 화상회의 모드로 변경
        mediaHtmlElement: {
          roomAudio: audioElementRef.current,
          localVideo: localVideoRef.current // 로컬 비디오 엘리먼트 추가
        },
        delegate: conferenceDelegate
      };

      console.log('joinConference 파라미터:', conferenceParams);
      
      await planetKitConference.joinConference(conferenceParams);

      setConference(planetKitConference);

    } catch (error) {
      console.error("PlanetKit Conference 연결 실패:", error);
      setConnectionStatus({ 
        connected: false, 
        connecting: false, 
        error: error instanceof Error ? error.message : '연결 실패' 
      });
      toast({
        title: "연결 실패",
        description: error instanceof Error ? error.message : "PlanetKit Conference 연결에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  // Conference 연결 해제
  const disconnect = async () => {
    try {
      if (conference && typeof conference.leaveConference === 'function') {
        try {
          await conference.leaveConference();
        } catch (leaveError) {
          console.warn('Conference 해제 중 오류 (무시됨):', leaveError);
        }
        setConference(null);
      }
      setConnectionStatus({ connected: false, connecting: false });
      setParticipants([]);
      setConnectionStartTime(null);
      setCallDuration("00:00:00");
    } catch (error) {
      console.error('Conference 연결 해제 오류:', error);
    }
  };

  // 마이크 토글
  const toggleAudio = async () => {
    if (connectionStatus.connected) {
      try {
        const newAudioState = !isAudioOn;
        
        // 실제 PlanetKit의 경우
        if (conference && conference.setAudioEnabled) {
          await conference.setAudioEnabled(newAudioState);
        }
        
        setIsAudioOn(newAudioState);
        
        // 로컬 참가자 상태 업데이트
        setParticipants(prev => prev.map(p => 
          p.id === "local" ? { ...p, isAudioOn: newAudioState } : p
        ));
        
        toast({
          title: newAudioState ? "마이크 켜짐" : "음소거",
          description: newAudioState ? "마이크가 활성화되었습니다." : "마이크가 음소거되었습니다.",
        });
      } catch (error) {
        console.error('마이크 토글 실패:', error);
        toast({
          title: "마이크 제어 실패",
          description: "마이크 상태 변경에 실패했습니다.",
          variant: "destructive",
        });
      }
    }
  };

  // 비디오 토글
  const toggleVideo = async () => {
    if (connectionStatus.connected) {
      try {
        const newVideoState = !isVideoOn;
        
        // 실제 PlanetKit의 경우
        if (conference && conference.setVideoEnabled) {
          await conference.setVideoEnabled(newVideoState);
        }
        
        setIsVideoOn(newVideoState);
        
        // 로컬 참가자 상태 업데이트
        setParticipants(prev => prev.map(p => 
          p.id === "local" ? { ...p, isVideoOn: newVideoState } : p
        ));
        
        toast({
          title: newVideoState ? "비디오 켜짐" : "비디오 꺼짐",
          description: newVideoState ? "카메라가 활성화되었습니다." : "카메라가 비활성화되었습니다.",
        });
      } catch (error) {
        console.error('비디오 토글 실패:', error);
        toast({
          title: "비디오 제어 실패",
          description: "카메라 상태 변경에 실패했습니다.",
          variant: "destructive",
        });
      }
    }
  };

  // 화면 공유 토글
  const toggleScreenShare = async () => {
    if (connectionStatus.connected) {
      try {
        const newScreenShareState = !isScreenSharing;
        
        // 실제 PlanetKit의 경우
        if (conference && conference.setScreenShareEnabled) {
          await conference.setScreenShareEnabled(newScreenShareState);
        }
        
        setIsScreenSharing(newScreenShareState);
        
        // 로컬 참가자 상태 업데이트
        setParticipants(prev => prev.map(p => 
          p.id === "local" ? { ...p, isScreenSharing: newScreenShareState } : p
        ));
        
        toast({
          title: newScreenShareState ? "화면 공유 시작" : "화면 공유 종료",
          description: newScreenShareState ? "화면 공유가 시작되었습니다." : "화면 공유가 종료되었습니다.",
        });
      } catch (error) {
        console.error('화면 공유 토글 실패:', error);
        toast({
          title: "화면 공유 실패",
          description: "화면 공유 상태 변경에 실패했습니다.",
          variant: "destructive",
        });
      }
    }
  };

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (conference && typeof conference.leaveConference === 'function') {
        try {
          conference.leaveConference().catch((error: any) => {
            console.warn('언마운트 시 Conference 해제 중 오류 (무시됨):', error);
          });
        } catch (error) {
          console.warn('언마운트 시 Conference 해제 중 동기 오류 (무시됨):', error);
        }
      }
    };
  }, [conference]);

  // 참가자를 TileParticipant로 변환
  const tileParticipants: TileParticipant[] = participants.map(p => ({
    ...p,
    videoElement: p.id === "local" ? localVideoRef.current || undefined : undefined,
    isLocal: p.id === "local"
  }));

  return (
    <div className="space-y-4">
      {/* 숨겨진 미디어 엘리먼트들 */}
      <audio ref={audioElementRef} autoPlay playsInline />
      <video 
        ref={localVideoRef} 
        autoPlay 
        playsInline 
        muted 
        style={{ display: 'none' }}
      />

      {/* 연결 상태 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center">
                {connectionStatus.connected ? (
                  <Wifi className="w-4 h-4 text-blue-600" />
                ) : (
                  <WifiOff className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
              연결 상태
              <Badge variant={connectionStatus.connected ? "default" : "secondary"} 
                     className={connectionStatus.connected ? "bg-blue-600 text-white" : ""}>
                {connectionStatus.connecting
                  ? "연결 중..."
                  : connectionStatus.connected
                  ? "연결됨"
                  : "연결 대기"}
              </Badge>
            </div>
            
            {connectionStatus.connected && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span className="font-mono">{callDuration}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="w-4 h-4" />
                  <span>{participants.length}명</span>
                </div>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {connectionStatus.error && (
            <div className="text-sm text-destructive mb-4 p-3 bg-destructive/10 rounded-md">
              오류: {connectionStatus.error}
            </div>
          )}
          
          <div className="flex gap-2">
            {!connectionStatus.connected ? (
              <Button
                onClick={connectToConference}
                disabled={connectionStatus.connecting}
                className="bg-blue-600 hover:bg-blue-600/90 text-white"
              >
                {connectionStatus.connecting ? (
                  <>
                    <Activity className="w-4 h-4 mr-2 animate-spin" />
                    연결 중...
                  </>
                ) : (
                  <>
                    <Phone className="w-4 h-4 mr-2" />
                    PlanetKit Conference 참여
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={disconnect}
                variant="destructive"
                className="flex items-center gap-2"
              >
                <PhoneOff className="w-4 h-4" />
                연결 해제
              </Button>
            )}
          </div>

          {connectionStatus.connected && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <Button
                  onClick={toggleVideo}
                  variant={isVideoOn ? "default" : "outline"}
                  size="sm"
                  className="flex items-center gap-2"
                >
                  {isVideoOn ? (
                    <Video className="w-4 h-4" />
                  ) : (
                    <VideoOff className="w-4 h-4" />
                  )}
                  {isVideoOn ? "비디오 끄기" : "비디오 켜기"}
                </Button>

                <Button
                  onClick={toggleAudio}
                  variant={isAudioOn ? "default" : "outline"}
                  size="sm"
                  className="flex items-center gap-2"
                >
                  {isAudioOn ? (
                    <Mic className="w-4 h-4" />
                  ) : (
                    <MicOff className="w-4 h-4" />
                  )}
                  {isAudioOn ? "음소거" : "음소거 해제"}
                </Button>

                <Button
                  onClick={toggleScreenShare}
                  variant={isScreenSharing ? "default" : "outline"}
                  size="sm"
                  className="flex items-center gap-2"
                  disabled={isWebView}
                  title={isWebView ? "WebView 환경에서는 화면 공유가 지원되지 않습니다" : ""}
                >
                  {isScreenSharing ? (
                    <MonitorOff className="w-4 h-4" />
                  ) : (
                    <Monitor className="w-4 h-4" />
                  )}
                  {isScreenSharing ? "공유 중지" : "화면 공유"}
                </Button>

                <Button
                  onClick={() => setShowDeviceSettings(!showDeviceSettings)}
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  설정
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 비디오 참가자 타일 뷰 */}
      {connectionStatus.connected && participants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="w-5 h-5" />
              화상회의 ({participants.length}명)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TileView participants={tileParticipants} />
          </CardContent>
        </Card>
      )}

      {/* 디바이스 및 권한 정보 (PlanetKit 5.5+) */}
      {connectionStatus.connected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Settings className="w-4 h-4" />
              디바이스 및 권한 상태
              <Badge variant="outline" className="text-xs">PlanetKit 5.5</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-3">
            {/* 권한 상태 */}
            <div className="space-y-2">
              <div className="font-semibold text-sm">권한 상태</div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Mic className="w-3 h-3" />
                  마이크:
                </span>
                <Badge variant={devicePermissions.microphone === 'granted' ? 'default' : 'secondary'}>
                  {devicePermissions.microphone === 'granted' ? '허용됨' :
                   devicePermissions.microphone === 'denied' ? '거부됨' :
                   devicePermissions.microphone === 'prompt' ? '대기 중' : '알 수 없음'}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Video className="w-3 h-3" />
                  카메라:
                </span>
                <Badge variant={devicePermissions.camera === 'granted' ? 'default' : 'secondary'}>
                  {devicePermissions.camera === 'granted' ? '허용됨' :
                   devicePermissions.camera === 'denied' ? '거부됨' :
                   devicePermissions.camera === 'prompt' ? '대기 중' : '알 수 없음'}
                </Badge>
              </div>
            </div>

            <Separator />

            {/* 현재 사용 중인 디바이스 */}
            <div className="space-y-2">
              <div className="font-semibold text-sm">현재 사용 중인 디바이스</div>
              {currentDevices.audioInput && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">오디오 입력:</span>
                  <span className="font-mono text-right max-w-[60%] truncate" title={currentDevices.audioInput.label}>
                    {currentDevices.audioInput.label || currentDevices.audioInput.deviceId}
                  </span>
                </div>
              )}
              {currentDevices.audioOutput && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">오디오 출력:</span>
                  <span className="font-mono text-right max-w-[60%] truncate" title={currentDevices.audioOutput.label}>
                    {currentDevices.audioOutput.label || currentDevices.audioOutput.deviceId}
                  </span>
                </div>
              )}
              {currentDevices.videoInput && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">비디오 입력:</span>
                  <span className="font-mono text-right max-w-[60%] truncate" title={currentDevices.videoInput.label}>
                    {currentDevices.videoInput.label || currentDevices.videoInput.deviceId}
                  </span>
                </div>
              )}
              {!currentDevices.audioInput && !currentDevices.audioOutput && !currentDevices.videoInput && (
                <p className="text-muted-foreground">디바이스 정보를 가져오는 중...</p>
              )}
            </div>

            {isWebView && (
              <>
                <Separator />
                <div className="bg-amber-50 dark:bg-amber-950 p-2 rounded border border-amber-200 dark:border-amber-800">
                  <p className="text-amber-800 dark:text-amber-200 font-medium">⚠️ WebView 환경</p>
                  <p className="text-amber-700 dark:text-amber-300 mt-1">
                    화면 공유 및 가상 배경 기능은 지원되지 않습니다.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Conference 정보 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Activity className="w-4 h-4" />
            Conference 정보
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Service ID:</span>
            <span className="font-mono">{config.serviceId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">User ID:</span>
            <span className="font-mono">{config.userId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Room ID:</span>
            <span className="font-mono">{config.roomId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">연결 상태:</span>
            <span className={connectionStatus.connected ? "text-green-600" : "text-muted-foreground"}>
              {connectionStatus.connected ? "연결됨" : "연결 안됨"}
            </span>
          </div>
          <Separator className="my-2" />
          <p className="text-muted-foreground">
            LINE Planet PlanetKit 5.5를 사용한 화상회의입니다.
            비디오, 오디오, 화면공유 기능을 사용할 수 있습니다.
          </p>
          <p className="text-muted-foreground mt-2">
            <strong>최소 브라우저 요구사항:</strong> Safari 16.4+ (Desktop/iOS)
          </p>
        </CardContent>
      </Card>
    </div>
  );
};