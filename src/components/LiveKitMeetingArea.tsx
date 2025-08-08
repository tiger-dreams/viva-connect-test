import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
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
  PhoneOff,
  Monitor,
  Users,
  Activity,
  Wifi,
  WifiOff,
  Settings,
  Clock,
  Camera,
  MicIcon,
  Speaker,
  Crown,
  UserX,
  MoreVertical,
} from "lucide-react";
import { LiveKitConfig, ConnectionStatus, Participant } from "@/types/video-sdk";
import { generateLiveKitToken } from "@/utils/token-generator";
import { TileView, TileParticipant } from "@/components/TileView";
import { useToast } from "@/hooks/use-toast";
import { useMediaDevices } from "@/hooks/use-media-devices";
import { 
  Room, 
  LocalParticipant,
  RemoteParticipant,
  Track,
  RoomEvent,
  ParticipantEvent,
  TrackPublication,
  LocalTrackPublication,
  LocalVideoTrack,
  LocalAudioTrack
} from 'livekit-client';
// 내부 타입 접근을 위한 안전한 any 캐스트(테스트용 통계 수집)
type AnyRoom = any;

interface LiveKitMeetingAreaProps {
  config: LiveKitConfig;
  showVideoStats?: boolean;
}

export const LiveKitMeetingArea = ({ config, showVideoStats = false }: LiveKitMeetingAreaProps) => {
  const { toast } = useToast();
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const videoElementByParticipantRef = useRef<Record<string, HTMLVideoElement>>({});
  const videoTrackByParticipantRef = useRef<Record<string, Track>>({});
  const audioPublicationByParticipantRef = useRef<Record<string, TrackPublication | undefined>>({});
  const audioElementByParticipantRef = useRef<Record<string, HTMLAudioElement | undefined>>({});
  const statsByParticipantRef = useRef<Record<string, TileParticipant['videoStats']>>({});
  const lastFrameCountRef = useRef<Record<string, number>>({});
  const audioLevelRef = useRef<Record<string, number>>({});
  const speakingRef = useRef<Record<string, boolean>>({});
  // 요약 지표 계산용 이전 샘플 저장
  const lastSampleTimeRef = useRef<number | null>(null);
  const prevTxBytesRef = useRef<number>(0); // local outbound bytes
  const prevRxBytesRef = useRef<Record<string, number>>({}); // per remote pid inbound bytes
  const prevRxPacketsRef = useRef<Record<string, number>>({});
  const prevRxPacketsLostRef = useRef<Record<string, number>>({});
  // 수신 디코딩/지터 지표 누적치 추적
  const prevFramesDecodedRef = useRef<Record<string, number>>({});
  const prevFramesDroppedRef = useRef<Record<string, number>>({});
  const prevTotalDecodeTimeRef = useRef<Record<string, number>>({}); // seconds
  const prevQpSumRef = useRef<Record<string, number>>({});
  const prevJbDelayRef = useRef<Record<string, number>>({}); // seconds
  const prevJbEmittedRef = useRef<Record<string, number>>({});
  const [statsTick, setStatsTick] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    connecting: false,
  });
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [room, setRoom] = useState<Room | null>(null);
  // AI Agent용 별도 룸 연결/상태
  const [agentRoom, setAgentRoom] = useState<Room | null>(null);
  const agentPcRef = useRef<RTCPeerConnection | null>(null);
  const agentRemoteAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const [agentRunning, setAgentRunning] = useState(false);
  const [agentStarting, setAgentStarting] = useState(false);
  const [openAiKey, setOpenAiKey] = useState("");
  const [openAiModel, setOpenAiModel] = useState("gpt-4o-realtime-preview-2024-12-17");
  const [openAiVoice, setOpenAiVoice] = useState("alloy");
  const [agentStatus, setAgentStatus] = useState<string>("");
  const [localVideoTrack, setLocalVideoTrack] = useState<LocalVideoTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<LocalAudioTrack | null>(null);
  const [showDeviceSettings, setShowDeviceSettings] = useState(false);
  const [connectionStartTime, setConnectionStartTime] = useState<Date | null>(null);
  const [callDuration, setCallDuration] = useState<string>("00:00:00");
  const [summaryStats, setSummaryStats] = useState<{ txBitrateBps: number; rxBitrateBps: number; rxPacketLossPctAvg: number }>({ txBitrateBps: 0, rxBitrateBps: 0, rxPacketLossPctAvg: 0 });
  
  // 미디어 디바이스 관리
  const {
    videoDevices,
    audioDevices,
    selectedVideoDevice,
    selectedAudioDevice,
    setSelectedVideoDevice,
    setSelectedAudioDevice,
  } = useMediaDevices();

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

  // 안전한 비디오 엘리먼트 정리 (타일뷰 기반)
  const cleanupVideoContainer = () => {
    try {
      for (const [pid, el] of Object.entries(videoElementByParticipantRef.current)) {
        const track = videoTrackByParticipantRef.current[pid];
        if (track) {
          try { track.detach(el); } catch {}
        }
      }
      videoElementByParticipantRef.current = {};
      videoTrackByParticipantRef.current = {} as any;
    } catch (error) {
      console.warn('비디오 트랙/엘리먼트 정리 중 오류 (무시됨):', error);
    }
  };

  // LiveKit 룸 연결
  const connectToRoom = async () => {
    if (!config.token || !config.serverUrl || !config.participantName) {
      toast({
        title: "설정 오류",
        description: "모든 필수 설정값을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    setConnectionStatus({ connected: false, connecting: true });

    try {
      console.log('LiveKit 연결 시작:', {
        serverUrl: config.serverUrl,
        roomName: config.roomName,
        participantName: config.participantName,
        hasToken: !!config.token
      });

      // Room 인스턴스 생성
      const newRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      // 이벤트 리스너 등록

      // 로컬 트랙 발행 이벤트 처리
      newRoom.on(RoomEvent.LocalTrackPublished, (publication: LocalTrackPublication, participant: LocalParticipant) => {
        console.log('Local track published:', publication.kind);
        if (publication.kind === 'video' && publication.track) {
          const videoTrack = publication.track as LocalVideoTrack;
          const videoElement = videoTrack.attach() as HTMLVideoElement;
          videoElement.muted = true;
          (videoElement as HTMLVideoElement).playsInline = true;
          videoElement.style.width = '100%';
          videoElement.style.height = '100%';
          videoElement.style.objectFit = 'cover';
          videoElement.id = 'livekit-local-video';
          videoElementByParticipantRef.current['local'] = videoElement;
          videoTrackByParticipantRef.current['local'] = videoTrack as unknown as Track;
          setLocalVideoTrack(videoTrack);
          console.log('✅ 로컬 비디오 트랙 연결됨:', videoElement);
          
          // 참가자 상태 즉시 업데이트
          updateParticipantTracks(participant);
        } else if (publication.kind === 'audio' && publication.track) {
          const audioTrack = publication.track as LocalAudioTrack;
          setLocalAudioTrack(audioTrack);
          console.log('✅ 로컬 오디오 트랙 연결됨');
          
          // 참가자 상태 즉시 업데이트
          updateParticipantTracks(participant);
        }
      });

      // 로컬 트랙 언발행 이벤트 처리
      newRoom.on(RoomEvent.LocalTrackUnpublished, (publication: LocalTrackPublication, participant: LocalParticipant) => {
        console.log('Local track unpublished:', publication.kind);
        if (publication.kind === 'video') {
          // 비디오 엘리먼트 정리
          const existingElement = videoElementByParticipantRef.current['local'];
          if (existingElement) {
            try {
              videoTrackByParticipantRef.current['local']?.detach(existingElement);
            } catch {}
            delete videoElementByParticipantRef.current['local'];
            delete videoTrackByParticipantRef.current['local'];
          }
          setLocalVideoTrack(null);
          console.log('🔇 로컬 비디오 트랙 연결 해제됨');
          
          // 참가자 상태 즉시 업데이트
          updateParticipantTracks(participant);
        } else if (publication.kind === 'audio') {
          setLocalAudioTrack(null);
          console.log('🔇 로컬 오디오 트랙 연결 해제됨');
          
          // 참가자 상태 즉시 업데이트
          updateParticipantTracks(participant);
        }
      });

      // 트랙 음소거/음소거 해제 이벤트 (추가 안전장치)
      newRoom.on(RoomEvent.TrackMuted, (publication: TrackPublication, participant: LocalParticipant | RemoteParticipant) => {
        console.log('Track muted:', publication.kind, participant.identity);
        if (participant.identity === 'local' || participant === newRoom.localParticipant) {
          updateParticipantTracks(participant);
        }
      });

      newRoom.on(RoomEvent.TrackUnmuted, (publication: TrackPublication, participant: LocalParticipant | RemoteParticipant) => {
        console.log('Track unmuted:', publication.kind, participant.identity);
        if (participant.identity === 'local' || participant === newRoom.localParticipant) {
          updateParticipantTracks(participant);
        }
      });

      newRoom.on(RoomEvent.Disconnected, (reason) => {
        console.log('LiveKit room disconnected:', reason);
        setConnectionStatus({ connected: false, connecting: false });
        setParticipants([]);
        toast({
          title: "연결 종료",
          description: "LiveKit 룸 연결이 종료되었습니다.",
        });
      });

      newRoom.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        console.log('Participant connected:', participant.identity);
        addParticipant(participant);
        
        // 기존 참가자들의 발행된 트랙들도 확인하고 구독
        participant.trackPublications.forEach((publication) => {
          if (publication.track && publication.isSubscribed) {
            console.log('Found existing subscribed track:', publication.track.kind, participant.identity);
          } else if (publication.track && !publication.isSubscribed) {
            console.log('Found existing unsubscribed track, subscribing:', publication.track.kind, participant.identity);
            // 구독되지 않은 트랙이 있다면 구독 시도
            publication.setSubscribed(true);
          }
        });
      });

      newRoom.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        console.log('Participant disconnected:', participant.identity);
        removeParticipant(participant.identity);
      });

      // Data Channel 이벤트 처리 (퇴장 신호 등)
      newRoom.on(RoomEvent.DataReceived, (payload: Uint8Array, participant: RemoteParticipant) => {
        try {
          const data = JSON.parse(new TextDecoder().decode(payload));
          console.log('Data received:', data, 'from:', participant.identity);
          
          if (data.type === 'kick' && data.target === config.participantName) {
            console.log('Received kick signal from host:', data);
            toast({
              title: "퇴장 요청",
              description: "호스트가 회의에서 퇴장시켰습니다.",
              variant: "destructive",
            });
            
            // 즉시 퇴장 (3초 대기 없이)
            disconnect();
          } else if (data.type === 'kick' && data.target === participant.identity) {
            // 다른 참가자에게 보낸 퇴장 신호를 받은 경우 (호스트가 보낸 경우)
            console.log('Received kick signal for another participant:', data.target);
          } else if (data.type === 'kick') {
            // 일반적인 퇴장 신호 로깅
            console.log('Kick signal received:', data);
          }
        } catch (error) {
          console.warn('Failed to parse data channel message:', error);
        }
      });

      // 디버깅: 연결 시 호스트 권한 확인
      newRoom.on(RoomEvent.Connected, () => {
        console.log('LiveKit room connected');
        console.log('Host status:', config.isHost);
        console.log('Local participant permissions:', (newRoom.localParticipant as any).permissions);
        setConnectionStatus({ connected: true, connecting: false });
        
        // 통화 시작 시간 설정
        setConnectionStartTime(new Date());
        
        // 로컬 참가자를 먼저 추가
        const localParticipant: Participant = {
          id: "local",
          name: config.participantName,
          isVideoOn: true,
          isAudioOn: true,
          isScreenSharing: false
        };
        setParticipants([localParticipant]);
        
        // 연결된 후 기존 원격 참가자들을 참가자 목록에 추가
        newRoom.remoteParticipants.forEach((participant) => {
          console.log('Found existing remote participant:', participant.identity);
          addParticipant(participant);
          
          // 기존 참가자의 발행된 트랙들도 확인하고 구독
          participant.trackPublications.forEach((publication) => {
            if (publication.track && publication.isSubscribed) {
              console.log('Found existing subscribed track:', publication.track.kind, participant.identity);
              // TrackSubscribed 이벤트가 자동으로 호출되므로 별도 처리 불필요
            } else if (publication.track && !publication.isSubscribed) {
              console.log('Found existing unsubscribed track, subscribing:', publication.track.kind, participant.identity);
              // 구독되지 않은 트랙이 있다면 구독 시도
              publication.setSubscribed(true);
            }
          });
        });
        
        toast({
          title: "연결 성공",
          description: "LiveKit 룸에 성공적으로 연결되었습니다.",
        });
        
        // 연결 후 약간의 지연을 두고 오디오 분석 강제 재시작 (speaking 감지를 위해)
        setTimeout(() => {
          setStatsTick((x) => (x + 1) % 1000000); // useEffect 재실행 트리거
        }, 1000);
      });

      newRoom.on(RoomEvent.TrackSubscribed, (track: Track, publication: TrackPublication, participant: RemoteParticipant) => {
        console.log('Track subscribed:', track.kind, participant.identity);
        if (track.kind === 'video') {
          const remoteVideoElement = track.attach() as HTMLVideoElement;
          (remoteVideoElement as HTMLVideoElement).playsInline = true;
          remoteVideoElement.style.width = '100%';
          remoteVideoElement.style.height = '100%';
          remoteVideoElement.style.objectFit = 'cover';
          remoteVideoElement.id = `remote-video-${participant.identity}`;
          videoElementByParticipantRef.current[participant.identity] = remoteVideoElement as HTMLVideoElement;
          videoTrackByParticipantRef.current[participant.identity] = track;
          console.log('✅ 원격 비디오 엘리먼트 생성됨:', participant.identity);
        } else if (track.kind === 'audio') {
          audioPublicationByParticipantRef.current[participant.identity] = publication;
          // 원격 오디오 재생
          try {
            const audioEl = track.attach() as HTMLAudioElement;
            audioEl.autoplay = true;
            audioEl.volume = 1;
            audioElementByParticipantRef.current[participant.identity] = audioEl;
          } catch (e) {
            console.warn('원격 오디오 attach 실패:', e);
          }
        } else {
          track.detach();
        }
        updateParticipantTracks(participant);
      });

      newRoom.on(RoomEvent.TrackUnsubscribed, (track: Track, publication: TrackPublication, participant: RemoteParticipant) => {
        console.log('Track unsubscribed:', track.kind, participant.identity);
        if (track.kind === 'video') {
          const el = videoElementByParticipantRef.current[participant.identity];
          try { 
            if (el) {
              track.detach(el);
              console.log('✅ 원격 비디오 엘리먼트 제거됨:', participant.identity);
            }
          } catch {}
          delete videoElementByParticipantRef.current[participant.identity];
          delete videoTrackByParticipantRef.current[participant.identity];
        } else if (track.kind === 'audio') {
          delete audioPublicationByParticipantRef.current[participant.identity];
          try {
            const el = audioElementByParticipantRef.current[participant.identity];
            if (el) track.detach(el);
          } catch {}
          delete audioElementByParticipantRef.current[participant.identity];
          track.detach();
        }
        updateParticipantTracks(participant);
      });

      // 룸에 연결
      await newRoom.connect(config.serverUrl, config.token);
      setRoom(newRoom);

      // 로컬 트랙 활성화
      await enableCameraAndMicrophone(newRoom);

      console.log('LiveKit 연결 완료');

    } catch (error) {
      console.error('LiveKit 연결 실패:', error);
      setConnectionStatus({ 
        connected: false, 
        connecting: false, 
        error: error instanceof Error ? error.message : '연결 실패' 
      });
      toast({
        title: "연결 실패",
        description: error instanceof Error ? error.message : "LiveKit 룸 연결에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  // 카메라와 마이크 활성화
  const enableCameraAndMicrophone = async (room: Room) => {
    try {
      // 디바이스 제약 조건 설정
      const videoConstraints = selectedVideoDevice 
        ? { deviceId: { exact: selectedVideoDevice } }
        : true;
      const audioConstraints = selectedAudioDevice 
        ? { deviceId: { exact: selectedAudioDevice } }
        : true;

      // 비디오와 오디오 활성화 (이벤트 리스너에서 UI 업데이트 처리)
      await room.localParticipant.setCameraEnabled(true);
      await room.localParticipant.setMicrophoneEnabled(true);

      console.log('미디어 활성화 완료');
      
      // 미디어 활성화 후 speaking 감지 시작을 위해 오디오 분석 재시작
      setTimeout(() => {
        setStatsTick((x) => (x + 1) % 1000000); // useEffect 재실행 트리거
      }, 1500);

    } catch (error) {
      console.error('미디어 활성화 실패:', error);
    }
  };

  // 카메라 디바이스 변경
  const changeVideoDevice = async (deviceId: string) => {
    if (!room) return;

    try {
      setSelectedVideoDevice(deviceId);
      
      if (isVideoOn) {
        // 현재 비디오가 켜져 있다면 새 디바이스로 재활성화
        await room.localParticipant.setCameraEnabled(false);
        await new Promise(resolve => setTimeout(resolve, 100)); // 잠시 대기
        await room.localParticipant.setCameraEnabled(true);
      }
      
      toast({
        title: "카메라 변경 완료",
        description: "새 카메라 디바이스로 전환되었습니다.",
      });
    } catch (error) {
      console.error('카메라 디바이스 변경 실패:', error);
      toast({
        title: "카메라 변경 실패",
        description: "카메라 디바이스 변경에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  // 마이크 디바이스 변경
  const changeAudioDevice = async (deviceId: string) => {
    if (!room) return;

    try {
      setSelectedAudioDevice(deviceId);
      
      if (isAudioOn) {
        // 현재 오디오가 켜져 있다면 새 디바이스로 재활성화
        await room.localParticipant.setMicrophoneEnabled(false);
        await new Promise(resolve => setTimeout(resolve, 100)); // 잠시 대기
        await room.localParticipant.setMicrophoneEnabled(true);
      }
      
      toast({
        title: "마이크 변경 완료",
        description: "새 마이크 디바이스로 전환되었습니다.",
      });
    } catch (error) {
      console.error('마이크 디바이스 변경 실패:', error);
      toast({
        title: "마이크 변경 실패",
        description: "마이크 디바이스 변경에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  // 참가자 추가
  const addParticipant = (participant: RemoteParticipant | LocalParticipant) => {
    const newParticipant: Participant = {
      id: participant.identity,
      name: participant.identity,
      isVideoOn: participant.isCameraEnabled,
      isAudioOn: participant.isMicrophoneEnabled,
      isScreenSharing: participant.isScreenShareEnabled,
    };
    
    setParticipants(prev => [...prev.filter(p => p.id !== participant.identity), newParticipant]);
  };

  // 참가자 제거
  const removeParticipant = (identity: string) => {
    setParticipants(prev => prev.filter(p => p.id !== identity));
  };

  // 참가자 트랙 상태 업데이트
  const updateParticipantTracks = (participant: RemoteParticipant | LocalParticipant) => {
    setParticipants(prev => prev.map(p => 
      p.id === participant.identity 
        ? { 
            ...p, 
            isVideoOn: participant.isCameraEnabled,
            isAudioOn: participant.isMicrophoneEnabled,
            isScreenSharing: participant.isScreenShareEnabled 
          }
        : p
    ));

    // 로컬 참가자인 경우 비디오 엘리먼트 상태도 확인
    if (participant.identity === 'local' || (room && participant === room.localParticipant)) {
      console.log('🔄 로컬 참가자 상태 동기화:', {
        video: participant.isCameraEnabled,
        audio: participant.isMicrophoneEnabled,
        screen: participant.isScreenShareEnabled
      });
      
      // 비디오가 꺼진 경우 엘리먼트 정리
      if (!participant.isCameraEnabled) {
        const existingElement = videoElementByParticipantRef.current['local'];
        if (existingElement) {
          console.log('🔇 비디오 꺼짐으로 엘리먼트 정리');
          try {
            videoTrackByParticipantRef.current['local']?.detach(existingElement);
          } catch {}
          delete videoElementByParticipantRef.current['local'];
          delete videoTrackByParticipantRef.current['local'];
        }
        setLocalVideoTrack(null);
      }
      // 비디오가 켜진 경우 엘리먼트 생성 (아직 없다면)
      else if (participant.isCameraEnabled && !videoElementByParticipantRef.current['local']) {
        // 약간의 지연을 두고 트랙을 확인 (트랙이 늦게 발행되는 경우 대비)
        setTimeout(() => {
          const videoPublication = participant.getTrackPublication(Track.Source.Camera);
          if (videoPublication?.track && !videoElementByParticipantRef.current['local']) {
            const videoTrack = videoPublication.track as LocalVideoTrack;
            const videoElement = videoTrack.attach() as HTMLVideoElement;
            videoElement.muted = true;
            videoElement.playsInline = true;
            videoElement.style.width = '100%';
            videoElement.style.height = '100%';
            videoElement.style.objectFit = 'cover';
            videoElement.id = 'livekit-local-video';
            
            videoElementByParticipantRef.current['local'] = videoElement;
            videoTrackByParticipantRef.current['local'] = videoTrack as unknown as Track;
            setLocalVideoTrack(videoTrack);
            console.log('✅ 비디오 켜짐으로 엘리먼트 생성:', videoElement);
          }
        }, 100);
      }
    }
  };

  // 연결 해제
  const disconnect = async () => {
    try {
      // 먼저 DOM 정리
      cleanupVideoContainer();
      
      if (room) {
        await room.disconnect();
        setRoom(null);
      }
      setConnectionStatus({ connected: false, connecting: false });
      setParticipants([]);
      setIsVideoOn(true);
      setIsAudioOn(true);
      setIsScreenSharing(false);
      setLocalVideoTrack(null);
      setLocalAudioTrack(null);
      setConnectionStartTime(null);
      setCallDuration("00:00:00");
    } catch (error) {
      console.error('연결 해제 오류:', error);
    }
  };

  // 비디오 토글
  const toggleVideo = async () => {
    if (!room) return;

    try {
      const enabled = !isVideoOn;
      console.log(`🎥 비디오 ${enabled ? '켜기' : '끄기'} 요청`);
      
      // UI 상태를 먼저 업데이트 (즉각적인 반응을 위해)
      setIsVideoOn(enabled);
      
      await room.localParticipant.setCameraEnabled(enabled);
      console.log(`🎥 비디오 ${enabled ? '켜기' : '끄기'} 완료`);
      
      // 참가자 상태 업데이트
      updateParticipantTracks(room.localParticipant);
    } catch (error) {
      console.error('비디오 토글 오류:', error);
      // 에러 발생 시 UI 상태 되돌리기
      setIsVideoOn(!enabled);
      toast({
        title: "비디오 오류",
        description: "비디오 설정 변경에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  // 오디오 토글
  const toggleAudio = async () => {
    if (!room) return;

    try {
      const enabled = !isAudioOn;
      console.log(`🎤 오디오 ${enabled ? '켜기' : '끄기'} 요청`);
      
      // UI 상태를 먼저 업데이트 (즉각적인 반응을 위해)
      setIsAudioOn(enabled);
      
      await room.localParticipant.setMicrophoneEnabled(enabled);
      console.log(`🎤 오디오 ${enabled ? '켜기' : '끄기'} 완료`);
      
      // 참가자 상태 업데이트
      updateParticipantTracks(room.localParticipant);
    } catch (error) {
      console.error('오디오 토글 오류:', error);
      // 에러 발생 시 UI 상태 되돌리기
      setIsAudioOn(!enabled);
      toast({
        title: "오디오 오류",
        description: "오디오 설정 변경에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  // 화면 공유 토글
  const toggleScreenShare = async () => {
    if (!room) return;

    try {
      const enabled = !isScreenSharing;
      await room.localParticipant.setScreenShareEnabled(enabled);
      setIsScreenSharing(enabled);
      updateParticipantTracks(room.localParticipant);
    } catch (error) {
      console.error('화면 공유 오류:', error);
      toast({
        title: "화면 공유 오류",
        description: "화면 공유 설정 변경에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  // 컴포넌트 언마운트 시 정리 (사용자 룸)
  useEffect(() => {
    return () => {
      cleanupVideoContainer();
      if (room) {
        room.disconnect();
      }
    };
  }, []); // room 의존성 제거

  // 컴포넌트 언마운트 시 정리 (에이전트 룸/PC)
  useEffect(() => {
    return () => {
      if (agentRoom) {
        agentRoom.disconnect();
      }
      if (agentPcRef.current) {
        try { agentPcRef.current.close(); } catch {}
        agentPcRef.current = null;
      }
    };
  }, [agentRoom]);

  // 품질 정보 수집 (간단 FPS/해상도 중심)
  useEffect(() => {
    if (!showVideoStats || !connectionStatus.connected) return;
    const interval = setInterval(async () => {
      const nowTs = performance.now();
      const elapsedSec = lastSampleTimeRef.current ? Math.max(0.001, (nowTs - lastSampleTimeRef.current) / 1000) : 1;
      let latestTxBitrate = 0;
      let latestRxBitrateTotal = 0;
      const latestLossList: number[] = [];
      Object.entries(videoElementByParticipantRef.current).forEach(([pid, el]) => {
        try {
          const quality: any = (el as any).getVideoPlaybackQuality ? (el as any).getVideoPlaybackQuality() : undefined;
          const totalFrames: number | undefined = quality?.totalVideoFrames;
          const prev = lastFrameCountRef.current[pid] ?? totalFrames ?? 0;
          let frameRate = 0;
          if (typeof totalFrames === 'number') {
            const deltaFrames = Math.max(0, totalFrames - prev);
            frameRate = Math.round(deltaFrames / (elapsedSec || 1));
            lastFrameCountRef.current[pid] = totalFrames;
          }
          const resolution = `${el.videoWidth || 0}x${el.videoHeight || 0}`;
          const baseStats: TileParticipant['videoStats'] = {
            bitrate: 0,
            frameRate,
            resolution,
            packetLoss: 0,
            rawStats: quality,
          };
          statsByParticipantRef.current[pid] = baseStats;
        } catch {}
      });
      // LiveKit 원시 통계(테스트용): 퍼블리셔/서브스크라이버의 getStats 수집
      try {
        const lkRoom = room as unknown as AnyRoom;
        const pcPublisher: RTCPeerConnection | undefined = lkRoom?.engine?.pcManager?.publisher?.pc;
        const pcSubscriber: RTCPeerConnection | undefined = lkRoom?.engine?.pcManager?.subscriber?.pc;

        // 1) 퍼블리셔(송신) 통계는 로컬 참가자에 그대로 부착
        if (pcPublisher) {
          const pubStats = await pcPublisher.getStats();
          const aggregatedPub: Record<string, any> = {};
          // 송신 비트레이트 계산 (outbound-rtp video 기준)
          let totalTxBytes = 0;
          pubStats.forEach((report) => {
            aggregatedPub[`${report.type}:${report.id}`] = Object.fromEntries(Object.entries(report as any));
            const r: any = report as any;
            if (r.type === 'outbound-rtp' && (r.kind === 'video' || r.mediaType === 'video')) {
              if (typeof r.bytesSent === 'number') {
                totalTxBytes += r.bytesSent as number;
              }
            }
          });
          const localId = 'local';
          const prevTxBytes = prevTxBytesRef.current || totalTxBytes;
          const deltaTxBytes = Math.max(0, totalTxBytes - prevTxBytes);
          const txBitrate = (deltaTxBytes * 8) / (elapsedSec || 1); // bps
          prevTxBytesRef.current = totalTxBytes;
          latestTxBitrate = txBitrate;
          statsByParticipantRef.current[localId] = {
            ...(statsByParticipantRef.current[localId] || { bitrate: 0, frameRate: 0, resolution: '0x0', packetLoss: 0 }),
            bitrate: Math.round(txBitrate),
            rawStats: aggregatedPub,
          };
        }

        // 2) 서브스크라이버(수신) 통계는 원격 참가자별로 매핑하여 부착
        if (pcSubscriber) {
          const subStats = await pcSubscriber.getStats();

          // a) 현재 원격 비디오 트랙(MediaStreamTrack) id -> 참가자 id 매핑 구성
          const msTrackIdToPid: Record<string, string> = {};
          Object.entries(videoTrackByParticipantRef.current).forEach(([pid, lkTrack]) => {
            if (pid === 'local') return; // 원격만
            const msTrack: MediaStreamTrack | undefined = (lkTrack as any)?.mediaStreamTrack;
            if (msTrack?.id) {
              msTrackIdToPid[msTrack.id] = pid;
            }
          });

          // b) getStats 결과에서 track 리포트 id -> 참가자 id 매핑 (trackIdentifier == MediaStreamTrack.id)
          const trackReportIdToPid: Record<string, string> = {};
          const reportsById: Record<string, any> = {};
          subStats.forEach((r: any) => {
            reportsById[r.id] = r;
            if (r.type === 'track') {
              const trackIdentifier: string | undefined = r.trackIdentifier;
              if (trackIdentifier && msTrackIdToPid[trackIdentifier]) {
                trackReportIdToPid[r.id] = msTrackIdToPid[trackIdentifier];
              }
            }
          });

          // c) 참가자별로 관련 리포트를 모아 aggregated 구조 생성
          const perPidAggregated: Record<string, Record<string, any>> = {};
          // 요약 지표 계산용 누적값
          const perPidRxBytes: Record<string, number> = {};
          const perPidRxPackets: Record<string, number> = {};
          const perPidRxPacketsLost: Record<string, number> = {};
          const perPidFramesDecoded: Record<string, number> = {};
          const perPidFramesDropped: Record<string, number> = {};
          const perPidTotalDecodeTime: Record<string, number> = {}; // seconds
          const perPidQpSum: Record<string, number> = {};
          const perPidJbDelay: Record<string, number> = {}; // seconds (누계)
          const perPidJbEmitted: Record<string, number> = {};
          let rttMs: number | undefined = undefined;

          subStats.forEach((r: any) => {
            // inbound-rtp(video) 리포트에서 trackId를 통해 참가자를 찾는다
            if (r.type === 'inbound-rtp' && (r.kind === 'video' || r.mediaType === 'video')) {
              const trackId: string | undefined = r.trackId;
              const pid = trackId ? trackReportIdToPid[trackId] : undefined;
              if (!pid) return;
              perPidAggregated[pid] ||= {};

              // 기본 리포트 추가
              perPidAggregated[pid][`${r.type}:${r.id}`] = Object.fromEntries(Object.entries(r));

              // 요약 지표 누적 (bytes/packets)
              if (typeof r.bytesReceived === 'number') {
                perPidRxBytes[pid] = (perPidRxBytes[pid] || 0) + r.bytesReceived;
              }
              if (typeof r.packetsReceived === 'number') {
                perPidRxPackets[pid] = (perPidRxPackets[pid] || 0) + r.packetsReceived;
              }
              if (typeof r.packetsLost === 'number') {
                perPidRxPacketsLost[pid] = (perPidRxPacketsLost[pid] || 0) + r.packetsLost;
              }
              if (typeof r.framesDecoded === 'number') {
                perPidFramesDecoded[pid] = (perPidFramesDecoded[pid] || 0) + r.framesDecoded;
              }
              if (typeof r.framesDropped === 'number') {
                perPidFramesDropped[pid] = (perPidFramesDropped[pid] || 0) + r.framesDropped;
              }
              if (typeof r.totalDecodeTime === 'number') {
                perPidTotalDecodeTime[pid] = (perPidTotalDecodeTime[pid] || 0) + r.totalDecodeTime;
              }
              if (typeof r.qpSum === 'number') {
                perPidQpSum[pid] = (perPidQpSum[pid] || 0) + r.qpSum;
              }
              if (typeof r.jitterBufferDelay === 'number') {
                perPidJbDelay[pid] = (perPidJbDelay[pid] || 0) + r.jitterBufferDelay;
              }
              if (typeof r.jitterBufferEmittedCount === 'number') {
                perPidJbEmitted[pid] = (perPidJbEmitted[pid] || 0) + r.jitterBufferEmittedCount;
              }

              // 연관된 track/codec/remote-outbound-rtp/transport 리포트도 끌어온다
              const relatedIds: string[] = [];
              if (r.trackId) relatedIds.push(r.trackId);
              if (r.codecId) relatedIds.push(r.codecId);
              if (r.remoteId) relatedIds.push(r.remoteId);
              if (r.transportId) relatedIds.push(r.transportId);

              relatedIds.forEach((relId) => {
                const rel = reportsById[relId];
                if (rel) {
                  perPidAggregated[pid][`${rel.type}:${rel.id}`] = Object.fromEntries(Object.entries(rel));
                }
              });
            }
            // 선택된 ICE pair의 RTT (구독 연결 전체 공통)
            if (r.type === 'candidate-pair' && r.state === 'succeeded' && (r.selected || r.nominated)) {
              if (typeof r.currentRoundTripTime === 'number') {
                rttMs = Math.round(r.currentRoundTripTime * 1000);
              }
            }
          });

          // d) 수집된 원시 수신 통계를 각 원격 참가자의 rawStats에 반영 + 요약 지표(비트레이트/손실률)
          Object.entries(perPidAggregated).forEach(([pid, aggregated]) => {
            const rxBytes = perPidRxBytes[pid] || 0;
            const prevRxBytes = prevRxBytesRef.current[pid] ?? rxBytes;
            const deltaRxBytes = Math.max(0, rxBytes - prevRxBytes);
            const rxBitrate = (deltaRxBytes * 8) / (elapsedSec || 1); // bps
            prevRxBytesRef.current[pid] = rxBytes;

            const rxPkts = perPidRxPackets[pid] || 0;
            const prevPkts = prevRxPacketsRef.current[pid] ?? rxPkts;
            const deltaPkts = Math.max(0, rxPkts - prevPkts);
            prevRxPacketsRef.current[pid] = rxPkts;

            const rxLost = perPidRxPacketsLost[pid] || 0;
            const prevLost = prevRxPacketsLostRef.current[pid] ?? rxLost;
            const deltaLost = Math.max(0, rxLost - prevLost);
            prevRxPacketsLostRef.current[pid] = rxLost;

            const lossPct = (deltaPkts + deltaLost) > 0 ? (deltaLost / (deltaPkts + deltaLost)) * 100 : 0;

            // 디코딩/지터/품질 QP 요약 계산 (delta 기반)
            const framesDecoded = perPidFramesDecoded[pid] || 0;
            const prevFramesDecoded = prevFramesDecodedRef.current[pid] ?? framesDecoded;
            const deltaFramesDecoded = Math.max(0, framesDecoded - prevFramesDecoded);
            prevFramesDecodedRef.current[pid] = framesDecoded;

            const framesDropped = perPidFramesDropped[pid] || 0;
            const prevFramesDropped = prevFramesDroppedRef.current[pid] ?? framesDropped;
            const deltaFramesDropped = Math.max(0, framesDropped - prevFramesDropped);
            prevFramesDroppedRef.current[pid] = framesDropped;

            const totalDecodeTime = perPidTotalDecodeTime[pid] || 0; // seconds
            const prevTotalDecodeTime = prevTotalDecodeTimeRef.current[pid] ?? totalDecodeTime;
            const deltaTotalDecodeTime = Math.max(0, totalDecodeTime - prevTotalDecodeTime);
            prevTotalDecodeTimeRef.current[pid] = totalDecodeTime;

            const qpSum = perPidQpSum[pid] || 0;
            const prevQp = prevQpSumRef.current[pid] ?? qpSum;
            const deltaQp = Math.max(0, qpSum - prevQp);
            prevQpSumRef.current[pid] = qpSum;

            const jbDelay = perPidJbDelay[pid] || 0; // seconds
            const prevJbDelay = prevJbDelayRef.current[pid] ?? jbDelay;
            const deltaJbDelay = Math.max(0, jbDelay - prevJbDelay);
            prevJbDelayRef.current[pid] = jbDelay;

            const jbEmitted = perPidJbEmitted[pid] || 0;
            const prevJbEmitted = prevJbEmittedRef.current[pid] ?? jbEmitted;
            const deltaJbEmitted = Math.max(0, jbEmitted - prevJbEmitted);
            prevJbEmittedRef.current[pid] = jbEmitted;

            const decodeFps = deltaFramesDecoded / (elapsedSec || 1);
            const dropPct = (deltaFramesDecoded + deltaFramesDropped) > 0 ? (deltaFramesDropped / (deltaFramesDecoded + deltaFramesDropped)) * 100 : 0;
            const decodeMsPerFrame = deltaFramesDecoded > 0 ? (deltaTotalDecodeTime * 1000) / deltaFramesDecoded : 0;
            const avgQp = deltaFramesDecoded > 0 ? (deltaQp / deltaFramesDecoded) : 0;
            const jbAvgMs = (deltaJbEmitted > 0) ? (deltaJbDelay * 1000) / deltaJbEmitted : 0;

            // 참가자 rawStats에 요약 블록 추가
            aggregated['rxSummary'] = {
              rxBitrateBps: Math.round(rxBitrate),
              packetLossPct: Math.max(0, Math.min(100, lossPct)),
              decodeFps: Math.round(decodeFps),
              dropPct: Math.max(0, Math.min(100, dropPct)),
              decodeMsPerFrame: Number(decodeMsPerFrame.toFixed(2)),
              avgQp: Number(avgQp.toFixed(1)),
              jitterBufferAvgMs: Number(jbAvgMs.toFixed(2)),
              rttMs: rttMs,
            };

            latestRxBitrateTotal += rxBitrate;
            if (deltaPkts + deltaLost > 0) {
              latestLossList.push(lossPct);
            }

            statsByParticipantRef.current[pid] = {
              ...(statsByParticipantRef.current[pid] || { bitrate: 0, frameRate: 0, resolution: '0x0', packetLoss: 0 }),
              bitrate: Math.round(rxBitrate),
              packetLoss: Math.max(0, Math.min(100, lossPct)),
              rawStats: aggregated,
            };
          });
        }
      } catch {}
      // 상단 요약 지표 갱신
      if (showVideoStats) {
        const lossAvg = latestLossList.length > 0 ? (latestLossList.reduce((a, b) => a + b, 0) / latestLossList.length) : 0;
        setSummaryStats({ txBitrateBps: Math.round(latestTxBitrate), rxBitrateBps: Math.round(latestRxBitrateTotal), rxPacketLossPctAvg: Math.max(0, Math.min(100, lossAvg)) });
      }
      lastSampleTimeRef.current = nowTs;
      setStatsTick((x) => (x + 1) % 1000000);
    }, 1000);
    return () => clearInterval(interval);
  }, [showVideoStats, connectionStatus.connected, room]); // Added 'room' dependency

  // 오디오 레벨 측정(로컬/원격 포함) - speaking 하이라이트를 위해 항상 실행
  useEffect(() => {
    if (!connectionStatus.connected || !room) return;
    
    // 약간의 지연을 두고 실행 (오디오 트랙이 완전히 준비될 때까지 대기)
    const setupAudioAnalysis = () => {
      let rafId: number;
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyzers: Array<{ pid: string; analyser: AnalyserNode; source: MediaStreamAudioSourceNode }> = [];

      // 로컬 참가자 마이크 - 모든 방법 시도
      let localAnalyzerAdded = false;
      
      // 방법 1: LiveKit room에서 직접 가져오기
      try {
        const localMicPublication = room.localParticipant.getTrackPublication('microphone');
        if (localMicPublication?.track && !localMicPublication.isMuted) {
          const micTrack = localMicPublication.track as any;
          if (micTrack.mediaStreamTrack && micTrack.mediaStreamTrack.readyState === 'live') {
            const stream = new MediaStream([micTrack.mediaStreamTrack]);
            const src = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            src.connect(analyser);
            analyzers.push({ pid: 'local', analyser, source: src });
            console.log('🎤 로컬 오디오 분석기 추가됨 (방법1)');
            localAnalyzerAdded = true;
          }
        }
      } catch (err) {
        console.warn('방법1 실패:', err);
      }

      // 방법 2: Track.Source.Microphone 사용
      if (!localAnalyzerAdded) {
        try {
          const micPublication = room.localParticipant.getTrackPublication(Track.Source.Microphone);
          if (micPublication?.track) {
            const micTrack = micPublication.track as any;
            if (micTrack.mediaStreamTrack && micTrack.mediaStreamTrack.readyState === 'live') {
              const stream = new MediaStream([micTrack.mediaStreamTrack]);
              const src = audioCtx.createMediaStreamSource(stream);
              const analyser = audioCtx.createAnalyser();
              analyser.fftSize = 256;
              src.connect(analyser);
              analyzers.push({ pid: 'local', analyser, source: src });
              console.log('🎤 로컬 오디오 분석기 추가됨 (방법2)');
              localAnalyzerAdded = true;
            }
          }
        } catch (err) {
          console.warn('방법2 실패:', err);
        }
      }

      // 방법 3: localAudioTrack 상태 변수 사용 (폴백)
      if (!localAnalyzerAdded && localAudioTrack) {
        try {
          const mediaStreamTrack = (localAudioTrack as any).mediaStreamTrack;
          if (mediaStreamTrack && mediaStreamTrack.readyState === 'live') {
            const stream = new MediaStream([mediaStreamTrack]);
            const src = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            src.connect(analyser);
            analyzers.push({ pid: 'local', analyser, source: src });
            console.log('🎤 로컬 오디오 분석기 추가됨 (폴백)');
            localAnalyzerAdded = true;
          }
        } catch (err) {
          console.warn('폴백 방법 실패:', err);
        }
      }
      
      if (!localAnalyzerAdded) {
        console.warn('⚠️ 로컬 오디오 분석기 추가 실패 - 모든 방법 실패');
      }

      // 원격 참가자 오디오
      for (const [pid, pub] of Object.entries(audioPublicationByParticipantRef.current)) {
        const mt: any = pub?.track ? (pub.track as any).mediaStreamTrack : undefined;
        if (mt && mt.readyState === 'live') {
          try {
            const stream = new MediaStream([mt]);
            const src = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            src.connect(analyser);
            analyzers.push({ pid, analyser, source: src });
            console.log(`📢 원격 오디오 분석기 추가됨: ${pid}`);
          } catch (err) {
            console.warn(`원격 오디오 분석기 생성 실패 (${pid}):`, err);
          }
        }
      }

      if (analyzers.length === 0) {
        console.warn('⚠️ 분석 가능한 오디오 트랙이 없음');
        try { audioCtx.close(); } catch {}
        return;
      }

      const data = new Uint8Array(128);
      const loop = () => {
        analyzers.forEach(({ pid, analyser }) => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / data.length);
          audioLevelRef.current[pid] = rms;
          const isSpeaking = rms > 0.01;
          const wasSpeaking = speakingRef.current[pid] || false;
          speakingRef.current[pid] = isSpeaking;
          
        });
        setStatsTick((x) => (x + 1) % 1000000);
        rafId = requestAnimationFrame(loop);
      };
      rafId = requestAnimationFrame(loop);

      return () => {
        if (rafId) cancelAnimationFrame(rafId);
        try { audioCtx.close(); } catch {}
      };
    };

    // 즉시 실행 + 재시도 로직
    const cleanup1 = setupAudioAnalysis();
    
    // 2초 후 재시도 (트랙이 늦게 준비될 경우 대비)
    const retryTimer = setTimeout(() => {
      if (cleanup1) cleanup1();
      setupAudioAnalysis();
    }, 2000);

    return () => {
      clearTimeout(retryTimer);
      if (cleanup1) cleanup1();
    };
  }, [connectionStatus.connected, room, localAudioTrack, isAudioOn]);

  // ---------- AI Voice Agent (브라우저 내 OpenAI Realtime 브리지) ----------
  const startAgent = async () => {
    try {
      if (agentStarting) return;
      setAgentStarting(true);
      if (!config.serverUrl || !config.apiKey || !config.apiSecret) {
        toast({ title: "LiveKit 설정 필요", description: "서버 URL / API Key / Secret을 입력하세요.", variant: "destructive" });
        return;
      }
      if (!openAiKey) {
        toast({ title: "OpenAI 키 필요", description: "OpenAI API Key를 입력하세요.", variant: "destructive" });
        return;
      }
      setAgentStatus("에이전트 시작 중...");

      // 1) LiveKit에 에이전트용 별도 참가자로 조인
      const agentToken = await generateLiveKitToken(
        config.apiKey,
        config.apiSecret,
        config.roomName || "test-agent",
        "ai-agent"
      );
      const aRoom = new Room({});
      await aRoom.connect(config.serverUrl, agentToken);
      setAgentRoom(aRoom);

      // 2) OpenAI Realtime(WebRTC) 연결 생성
      // 먼저 마이크 권한 및 트랙 확보
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const micTrack = mic.getAudioTracks()[0];

      // 기존 PC 정리 후 새로 생성
      if (agentPcRef.current) {
        try { agentPcRef.current.close(); } catch {}
        agentPcRef.current = null;
      }
      let pc = new RTCPeerConnection({ iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }] });
      agentPcRef.current = pc;

      // 트랜시버 생성(오디오 송수신)
      let audioTransceiver = pc.addTransceiver('audio', { direction: 'sendrecv' });
      if (micTrack) await audioTransceiver.sender.replaceTrack(micTrack);

      // OpenAI에서 오는 오디오 트랙 수신 → LiveKit에 발행
      pc.ontrack = async (e) => {
        const stream = e.streams[0];
        const [track] = stream?.getAudioTracks() || [];
        if (track) {
          // 1) 로컬 재생(사용자에게 들리도록)
          try {
            const audioEl: HTMLAudioElement = document.createElement('audio');
            audioEl.autoplay = true;
            (audioEl as any).playsInline = true;
            audioEl.muted = false;
            audioEl.volume = 1;
            audioEl.srcObject = stream;
            document.body.appendChild(audioEl);
            setTimeout(() => {
              try { audioEl.play().catch(() => {}); } catch {}
            }, 0);
          } catch {}

          // 2) LiveKit에 발행(다른 참가자도 들을 수 있게)
          if (aRoom) {
            agentRemoteAudioTrackRef.current = track;
            try {
              const pub = await aRoom.localParticipant.publishTrack(track, { name: 'ai-voice' });
              // 강제로 mute가 걸려 있으면 해제
              try { await aRoom.localParticipant.setMicrophoneEnabled(true); } catch {}
              try { if (pub?.track) (pub.track as any).setMuted(false); } catch {}
            } catch (err) {
              console.error('에이전트 오디오 발행 실패:', err);
            }
          }
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'closed' || pc.signalingState === 'closed') {
          console.warn('OpenAI RTCPeerConnection closed.');
          setAgentRunning(false);
        }
      };

      // SDP 교환
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
      await pc.setLocalDescription(offer);

      const resp = await fetch(`/api/openai-realtime?model=${encodeURIComponent(openAiModel)}&voice=${encodeURIComponent(openAiVoice)}`, {
        method: "POST",
        headers: {
          "x-openai-key": openAiKey,
          "Content-Type": "application/sdp",
          "Accept": "application/sdp",
        },
        body: offer.sdp || "",
      });
      if (!resp.ok) {
        throw new Error(`OpenAI Realtime 연결 실패: ${resp.status} ${resp.statusText}`);
      }
      const answerSdp = await resp.text();
      // 연결이 도중에 닫혔으면 재시도
      if (pc.signalingState === 'closed') {
        console.warn('PC closed before remote description, recreating...');
        pc = new RTCPeerConnection({ iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }] });
        agentPcRef.current = pc;
        audioTransceiver = pc.addTransceiver('audio', { direction: 'sendrecv' });
        if (micTrack) await audioTransceiver.sender.replaceTrack(micTrack);
        pc.ontrack = async (e) => {
          const [track] = e.streams[0]?.getAudioTracks() || [];
          if (track && aRoom) {
            agentRemoteAudioTrackRef.current = track;
            try { await aRoom.localParticipant.publishTrack(track, { name: 'ai-voice' }); } catch {}
          }
        };
        const retryOffer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
        await pc.setLocalDescription(retryOffer);
        // 재요청
        const resp2 = await fetch(`/api/openai-realtime?model=${encodeURIComponent(openAiModel)}&voice=${encodeURIComponent(openAiVoice)}`, {
          method: 'POST',
          headers: { 'x-openai-key': openAiKey, 'Content-Type': 'application/sdp', 'Accept': 'application/sdp' },
          body: retryOffer.sdp || ''
        });
        const answer2 = await resp2.text();
        await pc.setRemoteDescription({ type: 'answer', sdp: answer2 });
      } else {
        await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
      }

      // 데이터 채널 생성(명령 전송)
      const dc = pc.createDataChannel('oai-events');
      dc.onopen = () => {
        // 서버 VAD로 턴 감지 + 음성 인식 활성화
        const sessionUpdate = {
          type: 'session.update',
          session: {
            turn_detection: { type: 'server_vad' },
            input_audio_transcription: { model: 'gpt-4o-transcribe' },
          },
        };
        dc.send(JSON.stringify(sessionUpdate));

        // 첫 응답 트리거(대화 시작)
        const first = {
          type: 'response.create',
          response: { instructions: '한국어로 간단히 인사하고, 마이크 입력을 듣고 대화해줘.' },
        };
        dc.send(JSON.stringify(first));
      };

      setAgentRunning(true);
      setAgentStatus("에이전트 실행 중");
      toast({ title: "AI Agent 시작", description: "이제 마이크로 말하면 에이전트가 응답합니다." });
    } catch (error) {
      console.error("에이전트 시작 실패:", error);
      setAgentStatus(error instanceof Error ? error.message : "시작 실패");
      toast({ title: "AI Agent 시작 실패", description: String(error), variant: "destructive" });
    }
    finally {
      setAgentStarting(false);
    }
  };

  const stopAgent = async () => {
    try {
      if (agentRoom) {
        await agentRoom.disconnect();
        setAgentRoom(null);
      }
      if (agentPcRef.current) {
        try { agentPcRef.current.close(); } catch {}
        agentPcRef.current = null;
      }
      agentRemoteAudioTrackRef.current = null;
      setAgentRunning(false);
      setAgentStatus("중지됨");
      toast({ title: "AI Agent 중지", description: "에이전트를 종료했습니다." });
    } catch (error) {
      console.error("에이전트 중지 실패:", error);
      toast({ title: "AI Agent 중지 실패", description: String(error), variant: "destructive" });
    }
  };

  // Host controls - kick participant function
  const kickParticipant = async (participantId: string, participantName: string) => {
    if (!room || !config.isHost) {
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
      console.log('Room state:', {
        isHost: config.isHost,
        roomConnected: connectionStatus.connected,
        localParticipant: room.localParticipant.identity,
        remoteParticipants: Array.from(room.remoteParticipants.keys())
      });
      
      // 방법 1: Data Channel을 통해 참가자에게 퇴장 신호 전송 (가장 확실한 방법)
      const kickData = {
        type: 'kick',
        target: participantId,
        reason: 'Host requested removal',
        timestamp: Date.now(),
        from: room.localParticipant.identity
      };
      
      console.log('Sending kick data:', kickData);
      
      await room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(kickData)),
        { topic: 'admin' }
      );

      toast({
        title: "퇴장 신호 전송",
        description: `${participantName} 참가자에게 퇴장 신호를 전송했습니다.`,
      });

      console.log(`[SUCCESS] Kick signal sent to ${participantName} (${participantId})`);

      // 참가자 목록에서 즉시 제거 (UI 반응성 향상)
      setParticipants(prev => prev.filter(p => p.id !== participantId));
      
      // 비디오/오디오 엘리먼트 정리
      const videoEl = videoElementByParticipantRef.current[participantId];
      if (videoEl) {
        try {
          videoTrackByParticipantRef.current[participantId]?.detach(videoEl);
        } catch {}
        delete videoElementByParticipantRef.current[participantId];
        delete videoTrackByParticipantRef.current[participantId];
      }
      
      const audioEl = audioElementByParticipantRef.current[participantId];
      if (audioEl) {
        try {
          audioEl.pause();
          audioEl.srcObject = null;
        } catch {}
        delete audioElementByParticipantRef.current[participantId];
      }
      delete audioPublicationByParticipantRef.current[participantId];

    } catch (error) {
      console.error('Failed to kick participant:', error);
      toast({
        title: "강제 퇴장 실패",
        description: "참가자 강제 퇴장에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* 연결 상태 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-600/20 rounded-lg flex items-center justify-center">
                {connectionStatus.connected ? (
                  <Wifi className="w-4 h-4 text-green-600" />
                ) : (
                  <WifiOff className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
              LiveKit 화상회의
              <Badge variant={connectionStatus.connected ? "default" : "secondary"} 
                     className={connectionStatus.connected ? "bg-green-600 text-white" : ""}>
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
                {showVideoStats && (
                  <div className="hidden md:flex items-center gap-3 text-xs font-mono px-2 py-1 rounded bg-muted/30">
                    <span>TX:</span>
                    <span className="text-green-600">{(summaryStats.txBitrateBps/1000).toFixed(0)} kbps</span>
                    <span className="opacity-60">|</span>
                    <span>RX:</span>
                    <span className="text-cyan-600">{(summaryStats.rxBitrateBps/1000).toFixed(0)} kbps</span>
                    <span className="opacity-60">|</span>
                    <span>Loss:</span>
                    <span className={summaryStats.rxPacketLossPctAvg > 5 ? 'text-red-600' : 'text-emerald-600'}>
                      {summaryStats.rxPacketLossPctAvg.toFixed(1)}%
                    </span>
                  </div>
                )}
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeviceSettings(!showDeviceSettings)}
                  className="flex items-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  디바이스 설정
                </Button>
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
                onClick={connectToRoom}
                disabled={connectionStatus.connecting || !config.token}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {connectionStatus.connecting ? "연결 중..." : "LiveKit 룸 참여"}
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
        </CardContent>
      </Card>

      {connectionStatus.connected && (
        <>
          {/* 타일뷰 화상회의 화면 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="w-5 h-5" />
                화상회의 화면 ({participants.length}명)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="w-full min-h-[400px] bg-gray-900 rounded-lg p-2">
                <TileView
                  participants={participants.map<TileParticipant>((p) => {
                    // 참가자 ID 매핑 디버깅
                    console.log('Participant mapping:', {
                      participantId: p.id,
                      participantName: p.name,
                      availableKeys: Object.keys(videoElementByParticipantRef.current),
                      hasVideoElement: !!videoElementByParticipantRef.current[p.id],
                      hasVideoElementByName: !!videoElementByParticipantRef.current[p.name]
                    });
                    
                    // ID와 이름 모두 시도
                    const videoElement = videoElementByParticipantRef.current[p.id] || 
                                      videoElementByParticipantRef.current[p.name];
                    
                    return {
                      ...p,
                      videoElement: videoElement,
                      isLocal: p.id === 'local',
                      audioLevel: audioLevelRef.current[p.id] || 0,
                      isSpeaking: speakingRef.current[p.id] || false,
                      videoStats: showVideoStats ? statsByParticipantRef.current[p.id] : undefined,
                    };
                  })}
                  maxVisibleTiles={4}
                  showVideoStats={showVideoStats}
                />
              </div>

              {/* 미디어 컨트롤 */}
              <div className="flex items-center justify-center gap-2 mt-4">
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
                >
                  <Monitor className="w-4 h-4" />
                  {isScreenSharing ? "화면 공유 중지" : "화면 공유"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 디바이스 설정 */}
          {showDeviceSettings && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  디바이스 설정
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 카메라 선택 */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Camera className="w-4 h-4" />
                      카메라
                    </Label>
                    <Select 
                      value={selectedVideoDevice} 
                      onValueChange={changeVideoDevice}
                      disabled={!connectionStatus.connected}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="카메라를 선택하세요" />
                      </SelectTrigger>
                      <SelectContent>
                        {videoDevices.map((device) => (
                          <SelectItem key={device.deviceId} value={device.deviceId}>
                            {device.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 마이크 선택 */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <MicIcon className="w-4 h-4" />
                      마이크
                    </Label>
                    <Select 
                      value={selectedAudioDevice} 
                      onValueChange={changeAudioDevice}
                      disabled={!connectionStatus.connected}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="마이크를 선택하세요" />
                      </SelectTrigger>
                      <SelectContent>
                        {audioDevices.map((device) => (
                          <SelectItem key={device.deviceId} value={device.deviceId}>
                            {device.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-muted/20 rounded-md text-xs text-muted-foreground">
                  <p>💡 디바이스 변경 시 현재 통화 중인 상태에서 자동으로 전환됩니다.</p>
                </div>
              </CardContent>
            </Card>
          )}


          {/* AI Agent 제어(UI) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MicIcon className="w-5 h-5" />
                AI Voice Agent (OpenAI Realtime)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>OpenAI API Key</Label>
                  <input
                    type="password"
                    placeholder="sk-..."
                    value={openAiKey}
                    onChange={(e) => setOpenAiKey(e.target.value)}
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <Label>Model</Label>
                  <input
                    type="text"
                    value={openAiModel}
                    onChange={(e) => setOpenAiModel(e.target.value)}
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <Label>Voice</Label>
                  <input
                    type="text"
                    value={openAiVoice}
                    onChange={(e) => setOpenAiVoice(e.target.value)}
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                {!agentRunning ? (
                  <Button size="sm" onClick={startAgent} className="bg-emerald-600 hover:bg-emerald-700 text-white">시작</Button>
                ) : (
                  <Button size="sm" variant="destructive" onClick={stopAgent}>중지</Button>
                )}
                <span className="text-xs text-muted-foreground">{agentStatus}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">테스트용: 키는 클라이언트 메모리에만 저장됩니다. 보안 민감 환경에서는 서버 에이전트 사용을 권장합니다.</p>
            </CardContent>
          </Card>

          {/* 참가자 목록 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                참가자 ({participants.length})
                {config.isHost && (
                  <Crown className="w-4 h-4 text-yellow-500" title="호스트 권한 활성화됨" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {participants.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  참가자가 없습니다
                </p>
              ) : (
                <ScrollArea className="h-32">
                  <div className="space-y-2">
                    {participants.map((participant) => (
                      <div
                        key={participant.id}
                        className="flex items-center justify-between p-2 rounded-md border"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                            <span className="text-xs font-semibold">
                              {participant.name.charAt(0).toUpperCase()}
                            </span>
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
                            <Video className="w-4 h-4 text-green-500" />
                          ) : (
                            <VideoOff className="w-4 h-4 text-gray-400" />
                          )}
                          {participant.isAudioOn ? (
                            <Mic className="w-4 h-4 text-green-500" />
                          ) : (
                            <MicOff className="w-4 h-4 text-gray-400" />
                          )}
                          {participant.isScreenSharing && (
                            <Monitor className="w-4 h-4 text-blue-500" />
                          )}
                          
                          {/* Host controls for remote participants */}
                          {config.isHost && participant.id !== 'local' && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
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
                                <DropdownMenuItem disabled className="text-muted-foreground">
                                  <MicOff className="w-4 h-4 mr-2" />
                                  음소거 (준비 중)
                                </DropdownMenuItem>
                                <DropdownMenuItem disabled className="text-muted-foreground">
                                  <VideoOff className="w-4 h-4 mr-2" />
                                  비디오 끄기 (준비 중)
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* 룸 정보 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                룸 정보
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">룸명:</span>
                  <p className="font-medium">{config.roomName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">참가자명:</span>
                  <p className="font-medium">{config.participantName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">서버:</span>
                  <p className="font-mono text-xs">
                    {config.serverUrl ? new URL(config.serverUrl).host : 'N/A'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">상태:</span>
                  <Badge variant={connectionStatus.connected ? "default" : "secondary"}>
                    {connectionStatus.connected ? "연결됨" : "연결 안됨"}
                  </Badge>
                </div>
                {config.isHost && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">권한:</span>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">
                        <Crown className="w-3 h-3 mr-1" />
                        호스트 권한 활성화
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        참가자 관리 권한 보유
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};