import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
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
} from "lucide-react";
import { LiveKitConfig, ConnectionStatus, Participant } from "@/types/video-sdk";
import { useToast } from "@/hooks/use-toast";
import { 
  Room, 
  connect, 
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

interface LiveKitMeetingAreaProps {
  config: LiveKitConfig;
}

export const LiveKitMeetingArea = ({ config }: LiveKitMeetingAreaProps) => {
  const { toast } = useToast();
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    connecting: false,
  });
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [room, setRoom] = useState<Room | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<LocalVideoTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<LocalAudioTrack | null>(null);

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
        if (publication.kind === 'video' && publication.track && videoContainerRef.current) {
          const videoTrack = publication.track as LocalVideoTrack;
          const videoElement = videoTrack.attach();
          videoElement.style.width = '100%';
          videoElement.style.height = '100%';
          videoElement.style.objectFit = 'cover';
          videoContainerRef.current.innerHTML = '';
          videoContainerRef.current.appendChild(videoElement);
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
        if (track.kind === 'video' && videoContainerRef.current) {
          // 원격 참가자 비디오를 위한 컨테이너 생성 또는 사용
          const remoteVideoElement = track.attach();
          remoteVideoElement.style.width = '100%';
          remoteVideoElement.style.height = '100%';
          remoteVideoElement.style.objectFit = 'cover';
          remoteVideoElement.id = `remote-video-${participant.identity}`;
          
          // 원격 비디오를 위한 별도 컨테이너가 있다면 거기에 추가
          // 지금은 같은 컨테이너를 사용하되, 나중에 분리 가능
          const remoteContainer = document.createElement('div');
          remoteContainer.className = 'absolute top-2 right-2 w-32 h-24 bg-black rounded border-2 border-white';
          remoteContainer.appendChild(remoteVideoElement);
          videoContainerRef.current.appendChild(remoteContainer);
        }
        updateParticipantTracks(participant);
      });

      newRoom.on(RoomEvent.TrackUnsubscribed, (track: Track, publication: TrackPublication, participant: RemoteParticipant) => {
        console.log('Track unsubscribed:', track.kind, participant.identity);
        // 특정 참가자의 비디오 엘리먼트 제거
        if (track.kind === 'video') {
          const remoteVideoElement = document.getElementById(`remote-video-${participant.identity}`);
          if (remoteVideoElement && remoteVideoElement.parentElement) {
            remoteVideoElement.parentElement.remove();
          }
        }
        track.detach();
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
      // 로컬 참가자를 먼저 참가자 목록에 추가
      setParticipants([{
        id: "local",
        name: config.participantName,
        isVideoOn: true,
        isAudioOn: true,
        isScreenSharing: false
      }]);

      // 비디오와 오디오 활성화 (이벤트 리스너에서 UI 업데이트 처리)
      await room.localParticipant.setCameraEnabled(true);
      await room.localParticipant.setMicrophoneEnabled(true);

      console.log('미디어 활성화 완료');

    } catch (error) {
      console.error('미디어 활성화 실패:', error);
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
    } catch (error) {
      console.error('연결 해제 오류:', error);
    }
  };

  // 비디오 토글
  const toggleVideo = async () => {
    if (!room) return;

    try {
      const enabled = !isVideoOn;
      await room.localParticipant.setCameraEnabled(enabled);
      
      if (enabled && videoContainerRef.current) {
        // 비디오 켤 때 트랙 가져와서 attach
        const videoPublication = room.localParticipant.getTrackPublication('camera');
        if (videoPublication && videoPublication.track) {
          const videoTrack = videoPublication.track as LocalVideoTrack;
          const videoElement = videoTrack.attach();
          videoElement.style.width = '100%';
          videoElement.style.height = '100%';
          videoElement.style.objectFit = 'cover';
          videoContainerRef.current.innerHTML = ''; // 기존 콘텐츠 제거
          videoContainerRef.current.appendChild(videoElement);
          setLocalVideoTrack(videoTrack);
        }
      } else if (!enabled) {
        // 비디오 끌 때 비디오 엘리먼트 제거
        if (videoContainerRef.current) {
          videoContainerRef.current.innerHTML = '';
        }
        setLocalVideoTrack(null);
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
        const audioPublication = room.localParticipant.getTrackPublication('microphone');
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

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (room) {
        room.disconnect();
      }
    };
  }, [room]);

  return (
    <div className="space-y-4">
      {/* 연결 상태 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
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
          {/* 비디오 컨테이너 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="w-5 h-5" />
                비디오 화면
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                ref={videoContainerRef}
                className="w-full h-64 bg-black rounded-lg flex items-center justify-center text-white"
              >
                {!isVideoOn && (
                  <div className="text-center">
                    <VideoOff className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-gray-400">비디오가 꺼져 있습니다</p>
                  </div>
                )}
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