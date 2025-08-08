import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
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
  // 브라우저(Chrome) 재실행 기반의 WebRTC 네트워크 시뮬레이션 명령 생성용 상태
  const [simLossPercent, setSimLossPercent] = useState<number>(0);
  const [simDelayMs, setSimDelayMs] = useState<number>(50);
  const [simCapacityKbps, setSimCapacityKbps] = useState<number>(1500);
  
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
      newRoom.on(RoomEvent.Connected, () => {
        console.log('LiveKit room connected');
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
        });
        
        toast({
          title: "연결 성공",
          description: "LiveKit 룸에 성공적으로 연결되었습니다.",
        });
      });

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
        
        // 기존 참가자들의 발행된 트랙들도 확인
        participant.trackPublications.forEach((publication) => {
          if (publication.track) {
            console.log('Found existing track:', publication.track.kind, participant.identity);
          }
        });
      });

      newRoom.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        console.log('Participant disconnected:', participant.identity);
        removeParticipant(participant.identity);
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
          try { if (el) track.detach(el); } catch {}
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
      
      if (!enabled) {
        // 비디오를 끄기 전에 먼저 DOM 정리
        cleanupVideoContainer();
        setLocalVideoTrack(null);
      }
      
      await room.localParticipant.setCameraEnabled(enabled);
      
      if (enabled && videoContainerRef.current) {
        // 비디오 켤 때 트랙 가져와서 attach
        const videoPublication = room.localParticipant.getTrackPublication(Track.Source.Camera);
        if (videoPublication && videoPublication.track) {
          const videoTrack = videoPublication.track as LocalVideoTrack;
          const videoElement = videoTrack.attach();
          videoElement.style.width = '100%';
          videoElement.style.height = '100%';
          videoElement.style.objectFit = 'cover';
          videoElement.id = 'local-video';
          
          // 기존 엘리먼트가 있다면 정리 후 추가
          cleanupVideoContainer();
          videoContainerRef.current.appendChild(videoElement);
          setLocalVideoTrack(videoTrack);
        }
      }

      setIsVideoOn(enabled);
      updateParticipantTracks(room.localParticipant);
    } catch (error) {
      console.error('비디오 토글 오류:', error);
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
      await room.localParticipant.setMicrophoneEnabled(enabled);
      
      if (enabled) {
        const audioPublication = room.localParticipant.getTrackPublication(Track.Source.Microphone);
        if (audioPublication && audioPublication.track) {
          setLocalAudioTrack(audioPublication.track as LocalAudioTrack);
        }
      } else {
        setLocalAudioTrack(null);
      }

      setIsAudioOn(enabled);
      updateParticipantTracks(room.localParticipant);
    } catch (error) {
      console.error('오디오 토글 오류:', error);
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
  }, [room]);

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

  // 오디오 레벨 측정(로컬/원격 포함)
  useEffect(() => {
    if (!connectionStatus.connected || !showVideoStats) return;
    let rafId: number;
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

    const analyzers: Array<{ pid: string; analyser: AnalyserNode; source: MediaStreamAudioSourceNode }> = [];

    // 로컬 참가자 마이크
    if (localAudioTrack && (localAudioTrack as any).mediaStreamTrack) {
      const stream = new MediaStream([ (localAudioTrack as any).mediaStreamTrack ]);
      const src = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyzers.push({ pid: 'local', analyser, source: src });
    }

    // 원격 참가자 오디오
    for (const [pid, pub] of Object.entries(audioPublicationByParticipantRef.current)) {
      const mt: any = pub?.track ? (pub.track as any).mediaStreamTrack : undefined;
      if (mt) {
        const stream = new MediaStream([ mt ]);
        const src = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        analyzers.push({ pid, analyser, source: src });
      }
    }

    const data = new Uint8Array(128);
    const loop = () => {
      analyzers.forEach(({ pid, analyser }) => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128; // -1..1
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length); // 0..1
        audioLevelRef.current[pid] = rms;
        speakingRef.current[pid] = rms > 0.08; // 임계값
      });
      setStatsTick((x) => (x + 1) % 1000000);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      try { audioCtx.close(); } catch {}
    };
  }, [connectionStatus.connected, showVideoStats, localAudioTrack]);

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
                  participants={participants.map<TileParticipant>((p) => ({
                    ...p,
                    videoElement: videoElementByParticipantRef.current[p.id],
                    isLocal: p.id === 'local',
                    audioLevel: audioLevelRef.current[p.id] || 0,
                    isSpeaking: speakingRef.current[p.id] || false,
                    videoStats: showVideoStats ? statsByParticipantRef.current[p.id] : undefined,
                  }))}
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

          {/* 네트워크 시뮬레이터(가이드) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                네트워크 시뮬레이터 (Chrome 재실행 필요)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div>
                  <Label>패킷 손실률(%)</Label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={simLossPercent}
                    onChange={(e) => setSimLossPercent(Math.max(0, Math.min(100, Number(e.target.value))))}
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <Label>지연(ms)</Label>
                  <input
                    type="number"
                    min={0}
                    value={simDelayMs}
                    onChange={(e) => setSimDelayMs(Math.max(0, Number(e.target.value)))}
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <Label>링크 용량(kbps)</Label>
                  <input
                    type="number"
                    min={64}
                    value={simCapacityKbps}
                    onChange={(e) => setSimCapacityKbps(Math.max(64, Number(e.target.value)))}
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <Button
                  type="button"
                  size="sm"
                  onClick={async () => {
                    const appPath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
                    const userDataDir = '/tmp/chrome-webrtc-sim';
                    const fieldTrials = `WebRTC-FakeNetworkConditions/Enabled/BurstLossPercent/0/DelayMs/${simDelayMs}/LossPercent/${simLossPercent}/QueueDelayMs/0/QueueLength/100/LinkCapacityKbps/${simCapacityKbps}`;
                    const cmd = `${appPath} --user-data-dir=${userDataDir} --force-fieldtrials=${fieldTrials}`;
                    try {
                      await navigator.clipboard.writeText(cmd);
                      toast({ title: '명령어 복사됨', description: '터미널에서 붙여넣어 Chrome을 실행하세요.' });
                    } catch {
                      toast({ title: '복사 실패', description: '클립보드 권한을 확인해주세요.', variant: 'destructive' });
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Chrome 실행 명령어 복사
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    toast({
                      title: '사용 안내',
                      description: '이 기능은 브라우저 전역 WebRTC 엔진에 적용되며, 페이지 내에서 즉시 On/Off 할 수 없습니다. 복사한 명령으로 Chrome을 별도 인스턴스로 실행해 테스트하세요.',
                    });
                  }}
                >
                  사용 안내
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                실제 패킷 손실은 브라우저/OS 레벨에서만 강제할 수 있습니다. 위 명령으로 실행된 Chrome 인스턴스에서 이 페이지를 열면, WebRTC 스트림에 Loss/Delay/대역 제한이 적용됩니다.
              </p>
            </CardContent>
          </Card>

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
                            <Badge variant="outline" className="text-xs">나</Badge>
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
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};