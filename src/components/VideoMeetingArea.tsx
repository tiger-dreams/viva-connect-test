import { useState, useRef, useEffect } from "react";
import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";
import AgoraRTM from "agora-rtm-sdk";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
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
  Activity,
  Crown,
  UserX,
  MoreVertical
} from "lucide-react";
import { SDKType, AgoraConfig, LiveKitConfig, ConnectionStatus, VideoMetrics, Participant } from "@/types/video-sdk";
import { useToast } from "@/hooks/use-toast";
import { LiveKitMeetingArea } from "@/components/LiveKitMeetingArea";

interface VideoMeetingAreaProps {
  selectedSDK: SDKType;
  agoraConfig: AgoraConfig;
  liveKitConfig: LiveKitConfig;
}

export const VideoMeetingArea = ({ selectedSDK, agoraConfig, liveKitConfig }: VideoMeetingAreaProps) => {
  // LiveKit을 선택한 경우 별도 컴포넌트 렌더링 (통계정보 표시 활성화)
  if (selectedSDK === 'livekit') {
    return <LiveKitMeetingArea config={liveKitConfig} showVideoStats={true} />;
  }

  // Agora 관련 컴포넌트만 렌더링
  return <AgoraMeetingArea config={agoraConfig} />;
};

// Agora 전용 컴포넌트 분리
const AgoraMeetingArea = ({ config }: { config: AgoraConfig }) => {
  const { toast } = useToast();
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
  
  // Agora RTM 관련 상태
  const [rtmClient, setRtmClient] = useState<any>(null);
  const [rtmChannel, setRtmChannel] = useState<any>(null);
  const [rtmConnected, setRtmConnected] = useState(false);

  const isConfigValid = config.appId && config.channelName;

  // 참가자 목록 변화 모니터링
  useEffect(() => {
    console.log('👥 참가자 목록 변화:', participants.map(p => ({
      id: p.id,
      name: p.name,
      video: p.isVideoOn,
      audio: p.isAudioOn
    })));
  }, [participants]);

  // 컴포넌트 언마운트 시 리소스 정리
  useEffect(() => {
    return () => {
      // Agora SDK 정리
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
      
      // Agora RTM 정리
      if (rtmChannel) {
        rtmChannel.leave().catch(console.error);
      }
      if (rtmClient) {
        rtmClient.logout().catch(console.error);
      }
    };
  }, [agoraClient, localVideoTrack, localAudioTrack, rtmClient, rtmChannel]);

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
      
      await connectToAgora();
    } catch (error) {
      console.error('Connection failed:', error);
      setConnectionStatus({ 
        connected: false, 
        connecting: false, 
        error: error instanceof Error ? error.message : '연결에 실패했습니다.'
      });
    }
  };

  // RTM 클라이언트 연결 함수
  const connectToRTM = async () => {
    try {
      console.log('Agora RTM 연결 시작...');
      
      // RTM 클라이언트 생성
      const client = AgoraRTM.createInstance(config.appId);
      setRtmClient(client);
      
      // RTM 로그인 (UID를 사용자 이름으로 사용)
      const userId = config.participantName || config.uid || 'anonymous';
      await client.login({ uid: userId });
      console.log('RTM 로그인 완료:', userId);
      
      // 채널 생성 및 참여
      const channel = client.createChannel(config.channelName);
      setRtmChannel(channel);
      
      // 채널 메시지 이벤트 리스너 등록
      channel.on('ChannelMessage', ({ text, senderId }: any) => {
        console.log('채널 메시지 수신:', { text, senderId });
        try {
          const data = JSON.parse(text);
          handleRTMMessage(data, senderId);
        } catch (error) {
          console.warn('RTM 메시지 파싱 실패:', error);
        }
      });
      
      // P2P 메시지 이벤트 리스너 등록
      client.on('MessageFromPeer', ({ text, peerId }: any) => {
        console.log('P2P 메시지 수신:', { text, peerId });
        try {
          const data = JSON.parse(text);
          handleRTMMessage(data, peerId);
        } catch (error) {
          console.warn('P2P 메시지 파싱 실패:', error);
        }
      });
      
      // 채널 참여
      await channel.join();
      setRtmConnected(true);
      console.log('RTM 채널 참여 완료');
      
      // 호스트 권한 알림
      if (config.isHost) {
        console.log('🎯 호스트 모드로 RTM 연결됨 - 참가자 관리 권한 활성화');
      }
      
    } catch (error) {
      console.error('RTM 연결 실패:', error);
      toast({
        title: "RTM 연결 실패",
        description: "실시간 메시징 연결에 실패했습니다. 참가자 관리 기능이 제한될 수 있습니다.",
        variant: "destructive",
      });
    }
  };

  // RTM 메시지 처리 함수
  const handleRTMMessage = (data: any, senderId: string) => {
    console.log('RTM 메시지 처리:', data, 'from:', senderId);
    
    switch (data.type) {
      case 'FORCE_LEAVE':
        // 강제 퇴장 신호 수신
        if (data.target === (config.participantName || config.uid)) {
          console.log('강제 퇴장 신호 수신:', data);
          toast({
            title: "퇴장 요청",
            description: `호스트(${senderId})가 회의에서 퇴장시켰습니다.`,
            variant: "destructive",
          });
          handleDisconnect(); // 즉시 퇴장
        }
        break;
        
      case 'MUTE_AUDIO':
        // 음소거 제어 신호
        if (data.target === (config.participantName || config.uid)) {
          console.log('음소거 제어 신호 수신:', data);
          if (data.action === 'mute') {
            toggleAudio(); // 음소거
            toast({
              title: "음소거됨",
              description: `호스트(${senderId})가 마이크를 음소거했습니다.`,
            });
          } else if (data.action === 'unmute') {
            toggleAudio(); // 음소거 해제
            toast({
              title: "음소거 해제됨",
              description: `호스트(${senderId})가 마이크 음소거를 해제했습니다.`,
            });
          }
        }
        break;
        
      case 'MUTE_VIDEO':
        // 비디오 제어 신호
        if (data.target === (config.participantName || config.uid)) {
          console.log('비디오 제어 신호 수신:', data);
          if (data.action === 'mute') {
            toggleVideo(); // 비디오 끄기
            toast({
              title: "비디오 꺼짐",
              description: `호스트(${senderId})가 비디오를 껐습니다.`,
            });
          } else if (data.action === 'unmute') {
            toggleVideo(); // 비디오 켜기
            toast({
              title: "비디오 켜짐",
              description: `호스트(${senderId})가 비디오를 켰습니다.`,
            });
          }
        }
        break;
        
      default:
        console.log('알 수 없는 RTM 메시지 타입:', data.type);
    }
  };

  const connectToAgora = async () => {
    try {
      console.log('Agora 연결 시작:', {
        appId: config.appId,
        channelName: config.channelName,
        uid: config.uid,
        hasToken: !!config.token,
        hasAppCertificate: !!config.appCertificate,
        testMode: !config.appCertificate || !config.token
      });

      if (!config.appCertificate || !config.token) {
        console.log('🧪 테스트 모드로 연결 시도 - 토큰 없이 진행');
      }

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
      const numericUid = config.uid ? parseInt(config.uid) : null;
      const uid = await client.join(
        config.appId,
        config.channelName,
        config.token || null, // 토큰이 있으면 사용, 없으면 null
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
          name: config.participantName || `User ${uid}`,
          isVideoOn: true,
          isAudioOn: true,
          isScreenSharing: false,
          role: config.role,
          permissions: config.isHost ? {
            canKickOut: true,
            canMuteOthers: true,
            canChangeRole: true,
            canManageRoom: true
          } : undefined
        }
      ]);

      // RTC 연결 완료 후 RTM 연결 시작
      await connectToRTM();

      // 원격 사용자 이벤트 리스너
      client.on('user-published', async (user, mediaType) => {
        console.log('🔵 user-published 이벤트:', { uid: user.uid, mediaType });
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
          console.log('참가자 목록 업데이트:', { 
            uid: user.uid, 
            existing: !!existing, 
            currentParticipants: prev.length,
            mediaType 
          });
          
          if (existing) {
            const updated = prev.map(p => 
              p.id === user.uid.toString() 
                ? { ...p, isVideoOn: !!user.videoTrack, isAudioOn: !!user.audioTrack }
                : p
            );
            console.log('기존 참가자 업데이트:', updated);
            return updated;
          } else {
            const newParticipant = {
              id: user.uid.toString(),
              name: `User ${user.uid}`,
              isVideoOn: !!user.videoTrack,
              isAudioOn: !!user.audioTrack,
              isScreenSharing: false
            };
            const updated = [...prev, newParticipant];
            console.log('새 참가자 추가:', newParticipant, 'Total:', updated.length);
            return updated;
          }
        });
      });

      client.on('user-unpublished', (user) => {
        console.log('🔴 user-unpublished 이벤트:', user.uid);
        setParticipants(prev => prev.filter(p => p.id !== user.uid.toString()));
      });

      client.on('user-joined', (user) => {
        console.log('🟢 user-joined 이벤트:', user.uid);
        // 참가자가 채널에 참여했지만 아직 미디어를 발행하지 않은 경우
        setParticipants(prev => {
          const existing = prev.find(p => p.id === user.uid.toString());
          if (!existing) {
            const newParticipant = {
              id: user.uid.toString(),
              name: `User ${user.uid}`,
              isVideoOn: false, // 아직 미디어 발행 안함
              isAudioOn: false, // 아직 미디어 발행 안함
              isScreenSharing: false
            };
            console.log('채널 참여자 추가:', newParticipant);
            return [...prev, newParticipant];
          }
          return prev;
        });
      });

      client.on('user-left', (user) => {
        console.log('🟡 user-left 이벤트:', user.uid);
        setParticipants(prev => {
          const filtered = prev.filter(p => p.id !== user.uid.toString());
          console.log('참가자 제거:', user.uid, 'Remaining:', filtered.length);
          return filtered;
        });
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

      // RTM 연결 해제
      if (rtmChannel) {
        await rtmChannel.leave();
        setRtmChannel(null);
      }
      if (rtmClient) {
        await rtmClient.logout();
        setRtmClient(null);
      }
      setRtmConnected(false);

      toast({
        title: "연결 종료",
        description: "Agora 세션에서 나갔습니다.",
      });
    } catch (error) {
      console.error('Disconnect failed:', error);
    }
  };

  // 호스트 전용 - 참가자 강제 퇴장
  const kickParticipant = async (participantId: string, participantName: string) => {
    if (!rtmClient || !config.isHost) {
      toast({
        title: "권한 없음",
        description: "호스트만 참가자를 강제 퇴장시킬 수 있습니다.",
        variant: "destructive",
      });
      return;
    }

    if (participantId === 'local') {
      toast({
        title: "작업 불가",
        description: "자신을 강제 퇴장시킬 수 없습니다.",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log(`[HOST ACTION] Kicking participant: ${participantName} (${participantId})`);
      
      const kickMessage = {
        type: 'FORCE_LEAVE',
        target: participantId,
        reason: 'Host requested removal',
        timestamp: Date.now(),
        from: config.participantName || config.uid || 'host'
      };

      // RTM P2P 메시지로 퇴장 신호 전송
      await rtmClient.sendMessageToPeer(
        { text: JSON.stringify(kickMessage) },
        participantId
      );

      // 채널에도 브로드캐스트 (다른 참가자들도 알 수 있도록)
      if (rtmChannel) {
        await rtmChannel.sendMessage({
          text: JSON.stringify({
            type: 'PARTICIPANT_REMOVED',
            target: participantId,
            by: config.participantName || config.uid || 'host',
            timestamp: Date.now()
          })
        });
      }

      toast({
        title: "퇴장 신호 전송",
        description: `${participantName} 참가자에게 퇴장 신호를 전송했습니다.`,
      });

      // 참가자 목록에서 즉시 제거 (UI 반응성)
      setParticipants(prev => prev.filter(p => p.id !== participantId));

      console.log(`[SUCCESS] Kick signal sent to ${participantName} (${participantId})`);
    } catch (error) {
      console.error('Failed to kick participant:', error);
      toast({
        title: "강제 퇴장 실패",
        description: "참가자 강제 퇴장에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  // 호스트 전용 - 참가자 음소거 제어
  const muteParticipant = async (participantId: string, participantName: string, isMuted: boolean) => {
    if (!rtmClient || !config.isHost) {
      toast({
        title: "권한 없음",
        description: "호스트만 참가자를 음소거/음소거 해제할 수 있습니다.",
        variant: "destructive",
      });
      return;
    }

    if (participantId === 'local') {
      toast({
        title: "작업 불가",
        description: "자신을 음소거 제어할 수 없습니다.",
        variant: "destructive",
      });
      return;
    }

    try {
      const muteMessage = {
        type: 'MUTE_AUDIO',
        target: participantId,
        action: isMuted ? 'unmute' : 'mute',
        timestamp: Date.now(),
        from: config.participantName || config.uid || 'host'
      };

      await rtmClient.sendMessageToPeer(
        { text: JSON.stringify(muteMessage) },
        participantId
      );

      toast({
        title: isMuted ? "음소거 해제 요청" : "음소거 요청",
        description: `${participantName} 참가자에게 ${isMuted ? '음소거 해제' : '음소거'} 신호를 전송했습니다.`,
      });

      console.log(`[HOST ACTION] ${isMuted ? 'Unmute' : 'Mute'} signal sent to ${participantName}`);
    } catch (error) {
      console.error('Failed to mute participant:', error);
      toast({
        title: "음소거 제어 실패",
        description: "참가자 음소거 제어에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  // 호스트 전용 - 참가자 비디오 제어
  const muteParticipantVideo = async (participantId: string, participantName: string, isVideoOff: boolean) => {
    if (!rtmClient || !config.isHost) {
      toast({
        title: "권한 없음",
        description: "호스트만 참가자 비디오를 제어할 수 있습니다.",
        variant: "destructive",
      });
      return;
    }

    if (participantId === 'local') {
      toast({
        title: "작업 불가",
        description: "자신의 비디오를 제어할 수 없습니다.",
        variant: "destructive",
      });
      return;
    }

    try {
      const muteVideoMessage = {
        type: 'MUTE_VIDEO',
        target: participantId,
        action: isVideoOff ? 'unmute' : 'mute',
        timestamp: Date.now(),
        from: config.participantName || config.uid || 'host'
      };

      await rtmClient.sendMessageToPeer(
        { text: JSON.stringify(muteVideoMessage) },
        participantId
      );

      toast({
        title: isVideoOff ? "비디오 켜기 요청" : "비디오 끄기 요청",
        description: `${participantName} 참가자에게 비디오 ${isVideoOff ? '켜기' : '끄기'} 신호를 전송했습니다.`,
      });

      console.log(`[HOST ACTION] ${isVideoOff ? 'Unmute video' : 'Mute video'} signal sent to ${participantName}`);
    } catch (error) {
      console.error('Failed to control participant video:', error);
      toast({
        title: "비디오 제어 실패",
        description: "참가자 비디오 제어에 실패했습니다.",
        variant: "destructive",
      });
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
      toast({
        title: "비디오 오류",
        description: "비디오 설정 변경에 실패했습니다.",
        variant: "destructive",
      });
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
      toast({
        title: "오디오 오류",
        description: "오디오 설정 변경에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const toggleScreenShare = async () => {
    try {
      // Agora 화면 공유 로직 (추후 구현)
      setIsScreenSharing(!isScreenSharing);
    } catch (error) {
      console.error('Toggle screen share failed:', error);
      toast({
        title: "화면 공유 오류",
        description: "화면 공유 설정 변경에 실패했습니다.",
        variant: "destructive",
      });
    }
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
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-agora-primary/20">
                <Video className="w-4 h-4 text-agora-primary" />
              </div>
              Agora 화상회의
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
                className="flex-1 bg-agora-primary hover:bg-agora-primary/90"
              >
                <Phone className="w-4 h-4 mr-2" />
                {connectionStatus.connecting 
                  ? "연결 중..." 
                  : (!config.appCertificate ? "회의 참여 (테스트 모드)" : "회의 참여")
                }
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
              ⚠️ App ID와 Channel Name을 입력해야 연결할 수 있습니다.
            </div>
          )}

          {isConfigValid && !config.appCertificate && (
            <div className="text-sm text-blue-600 bg-blue-50 p-3 rounded-lg border border-blue-200">
              🧪 <strong>테스트 모드</strong>: App Certificate가 없어 토큰 없이 연결합니다. 
              프로덕션 환경에서는 App Certificate와 토큰을 사용하세요.
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
                      A
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
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4" />
              참가자 목록 ({participants.length})
              {config.isHost && (
                <Crown className="w-4 h-4 text-yellow-500" title="호스트 권한 활성화됨" />
              )}
            </CardTitle>
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
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-xs">나</Badge>
                        {config.isHost && (
                          <Crown className="w-3 h-3 text-yellow-500" title="호스트" />
                        )}
                      </div>
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
                    
                    {/* 호스트 컨트롤 - 원격 참가자만 */}
                    {config.isHost && participant.id !== 'local' && rtmConnected && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-1">
                            <MoreVertical className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem 
                            className="text-destructive focus:text-destructive"
                            onClick={() => kickParticipant(participant.id, participant.name)}
                          >
                            <UserX className="w-4 h-4 mr-2" />
                            강제 퇴장
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => muteParticipant(participant.id, participant.name, !participant.isAudioOn)}
                          >
                            {participant.isAudioOn ? (
                              <>
                                <MicOff className="w-4 h-4 mr-2" />
                                음소거
                              </>
                            ) : (
                              <>
                                <Mic className="w-4 h-4 mr-2" />
                                음소거 해제
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => muteParticipantVideo(participant.id, participant.name, !participant.isVideoOn)}
                          >
                            {participant.isVideoOn ? (
                              <>
                                <VideoOff className="w-4 h-4 mr-2" />
                                비디오 끄기
                              </>
                            ) : (
                              <>
                                <Video className="w-4 h-4 mr-2" />
                                비디오 켜기
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {/* RTM 연결 상태 표시 */}
            {config.isHost && (
              <div className="mt-4 pt-3 border-t border-border">
                <div className="flex items-center gap-2 text-xs">
                  <div className={`w-2 h-2 rounded-full ${rtmConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-muted-foreground">
                    RTM 상태: {rtmConnected ? '연결됨' : '연결 안됨'}
                  </span>
                  {rtmConnected && (
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                      관리 권한 활성화
                    </Badge>
                  )}
                </div>
                {!rtmConnected && (
                  <p className="text-xs text-destructive mt-1">
                    RTM 연결이 필요합니다. 참가자 관리 기능이 제한됩니다.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};