import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Activity,
  Clock,
  Users,
} from "lucide-react";
import { PlanetKitConfig, ConnectionStatus, Participant } from "@/types/video-sdk";
import { useToast } from "@/hooks/use-toast";
import { TileView, TileParticipant } from "@/components/TileView";
import { useLanguage } from "@/contexts/LanguageContext";
import { getTranslations } from "@/utils/translations";
import { LanguageSelector } from "@/components/LanguageSelector";
// PlanetKit 환경별 빌드 import
import * as PlanetKitReal from "@line/planet-kit";
import * as PlanetKitEval from "@line/planet-kit/dist/planet-kit-eval";

interface PlanetKitMeetingAreaProps {
  config: PlanetKitConfig;
  onDisconnect?: () => void;
}

export const PlanetKitMeetingArea = ({ config, onDisconnect }: PlanetKitMeetingAreaProps) => {
  const { toast } = useToast();
  const { language } = useLanguage();
  const t = getTranslations(language);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    connecting: false
  });
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [connectionStartTime, setConnectionStartTime] = useState<Date | null>(null);
  const [callDuration, setCallDuration] = useState<string>("00:00:00");

  // 비디오 엘리먼트 refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const audioElementRef = useRef<HTMLAudioElement>(null);
  const [conference, setConference] = useState<any>(null);
  // 원격 참가자 비디오 엘리먼트 맵
  const remoteVideoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());

  // 페이지 타이틀 업데이트
  useEffect(() => {
    if (connectionStatus.connected) {
      document.title = language === 'ko'
        ? `WebPlanet SDK 테스트 - 통화 중`
        : `WebPlanet SDK Test - In Call`;
    } else {
      document.title = language === 'ko' ? 'WebPlanet SDK 테스트' : 'WebPlanet SDK Test';
    }
  }, [language, connectionStatus.connected]);

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

    if (!config.environment) {
      toast({
        title: "환경 선택 필요",
        description: "Evaluation 또는 Real 환경을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    setConnectionStatus({ connected: false, connecting: true });

    // 명시적으로 로컬 미디어 스트림 획득 (PlanetKit 연결 전)
    try {
      const localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      // 로컬 비디오 엘리먼트에 스트림 연결
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
        await localVideoRef.current.play();
      }
    } catch (mediaError) {
      toast({
        title: "카메라/마이크 권한 필요",
        description: "카메라와 마이크 권한을 허용해주세요.",
        variant: "destructive",
      });
      setConnectionStatus({ connected: false, connecting: false });
      return;
    }

    try {
      const attemptJoin = async (PlanetKitModule: any, envLabel: 'eval' | 'real') => {
        const planetKitConference = new PlanetKitModule.Conference({
          logLevel: 'error' // SIP 내부 로그 최소화 (error만 표시)
        });

        const conferenceDelegate = {
          evtConnected: () => {
            setConnectionStatus({ connected: true, connecting: false });
            setConnectionStartTime(new Date());

            setParticipants([{
              id: "local",
              name: config.displayName || config.userId,
              isVideoOn: true,
              isAudioOn: true,
              videoElement: localVideoRef.current || undefined
            }]);

            // 로컬 비디오 미러링 활성화 (비디오 엘리먼트가 완전히 렌더링된 후 호출)
            setTimeout(async () => {
              // 비디오 미러링 적용
              if (planetKitConference && typeof planetKitConference.setVideoMirror === 'function' && localVideoRef.current) {
                try {
                  const mirrorResult = planetKitConference.setVideoMirror(true, localVideoRef.current);
                  // Promise인지 확인하고 await
                  if (mirrorResult && typeof mirrorResult.then === 'function') {
                    await mirrorResult;
                  }
                } catch (err: any) {
                  // 미러링 실패는 무시
                }
              }

            }, 500);

            toast({
              title: t.connectionSuccessTitle,
              description: t.connectionSuccessDescription,
            });
          },

          evtDisconnected: (disconnectDetails: any) => {
            // 로컬 미디어 스트림 정리 (카메라/마이크 끄기)
            if (localVideoRef.current && localVideoRef.current.srcObject) {
              const stream = localVideoRef.current.srcObject as MediaStream;
              stream.getTracks().forEach(track => {
                track.stop();
              });
              localVideoRef.current.srcObject = null;
            }

            // 원격 비디오 엘리먼트 정리
            remoteVideoElementsRef.current.clear();

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
            // PlanetKit은 addedPeers, removedPeers 배열을 제공
            const addedPeers = peerUpdateInfo.addedPeers || [];
            const removedPeers = peerUpdateInfo.removedPeers || [];

            // 제거된 peer 처리
            removedPeers.forEach((peer: any) => {
              const peerId = peer.userId || peer.peerId || peer.id || peer.myId;

              // PlanetKit에 비디오 제거 요청
              if (planetKitConference && typeof planetKitConference.removePeerVideo === 'function') {
                try {
                  planetKitConference.removePeerVideo({ peerId: peerId });
                } catch (err) {
                  // 비디오 제거 실패는 무시
                }
              }

              // 비디오 엘리먼트 정리
              const videoElement = remoteVideoElementsRef.current.get(peerId);
              if (videoElement) {
                if (videoElement.srcObject) {
                  const stream = videoElement.srcObject as MediaStream;
                  stream.getTracks().forEach(track => track.stop());
                  videoElement.srcObject = null;
                }
                if (videoElement.parentNode) {
                  videoElement.parentNode.removeChild(videoElement);
                }
                remoteVideoElementsRef.current.delete(peerId);
              }
            });

            // 새로 추가된 peer에 대해 비디오 요청
            addedPeers.forEach((peer: any) => {
              const peerId = peer.userId || peer.peerId || peer.id || peer.myId;

              // 비디오 엘리먼트 생성
              const videoElement = document.createElement('video');
              videoElement.autoplay = true;
              videoElement.playsInline = true;
              videoElement.muted = false;
              videoElement.style.width = '100%';
              videoElement.style.height = '100%';
              videoElement.style.objectFit = 'cover';
              videoElement.style.backgroundColor = '#000';

              // PlanetKit에 비디오 요청
              if (planetKitConference && typeof planetKitConference.requestPeerVideo === 'function') {
                try {
                  planetKitConference.requestPeerVideo({
                    userId: peerId,
                    resolution: 'vga',
                    videoViewElement: videoElement
                  });

                  remoteVideoElementsRef.current.set(peerId, videoElement);

                  videoElement.onerror = () => {
                    // 비디오 에러는 무시
                  };
                } catch (err) {
                  // 비디오 요청 실패는 무시
                }
              }
            });

            setParticipants(prev => {
              // 기존 참가자 목록에서 제거된 참가자 삭제
              let updated = prev.filter(p => {
                const isRemoved = removedPeers.some((removedPeer: any) => {
                  const removedPeerId = removedPeer.userId || removedPeer.peerId || removedPeer.id || removedPeer.myId;
                  return removedPeerId === p.id;
                });
                return !isRemoved;
              });

              // 새로 추가된 참가자 추가
              const newParticipants = addedPeers.map((peer: any, index: number) => {
                const peerId = peer.userId || peer.peerId || peer.id || peer.myId || `peer-${index}`;
                const peerName = peer.displayName || peer.peerName || peer.userId || `User ${index}`;
                const videoElement = remoteVideoElementsRef.current.get(peerId);

                return {
                  id: peerId,
                  name: peerName,
                  isVideoOn: peer.videoState !== undefined ? peer.videoState === 'enabled' : true,
                  isAudioOn: peer.audioState !== undefined ? peer.audioState === 'enabled' : true,
                  videoElement: videoElement
                };
              });

              // 로컬 참가자 + 업데이트된 원격 참가자
              const localParticipant = updated.find(p => p.id === "local") || {
                id: "local",
                name: config.displayName || config.userId,
                isVideoOn: isVideoOn,
                isAudioOn: isAudioOn,
                videoElement: localVideoRef.current || undefined
              };

              const remoteParticipants = updated.filter(p => p.id !== "local");
              return [localParticipant, ...remoteParticipants, ...newParticipants];
            });
          },

          evtPeersVideoUpdated: (videoUpdateInfo: any) => {
            const updates = Array.isArray(videoUpdateInfo) ? videoUpdateInfo : [];

            updates.forEach((update: any) => {
              const peer = update.peer || {};
              const peerId = peer.userId || peer.peerId || peer.id;
              const videoStatus = update.videoStatus || {};

              setParticipants(prev => prev.map(p => {
                if (p.id === peerId) {
                  return {
                    ...p,
                    isVideoOn: videoStatus.state === 'enabled'
                  };
                }
                return p;
              }));
            });
          },

          // 비디오 일시정지 이벤트
          evtPeersVideoPaused: (peerInfoArray: any) => {
            const peers = Array.isArray(peerInfoArray) ? peerInfoArray : [peerInfoArray];

            peers.forEach((peerInfo: any) => {
              const peerId = peerInfo.userId || peerInfo.peerId || peerInfo.id;

              setParticipants(prev => prev.map(p => {
                if (p.id === peerId) {
                  // 비디오 엘리먼트 숨기기
                  if (p.videoElement) {
                    p.videoElement.style.display = 'none';
                  }
                  return { ...p, isVideoOn: false };
                }
                return p;
              }));
            });
          },

          // 비디오 재개 이벤트
          evtPeersVideoResumed: (peerInfoArray: any) => {
            const peers = Array.isArray(peerInfoArray) ? peerInfoArray : [peerInfoArray];

            peers.forEach((peerInfo: any) => {
              const peerId = peerInfo.userId || peerInfo.peerId || peerInfo.id;

              setParticipants(prev => prev.map(p => {
                if (p.id === peerId) {
                  // 비디오 엘리먼트 표시
                  if (p.videoElement) {
                    p.videoElement.style.display = 'block';
                  }
                  return { ...p, isVideoOn: true };
                }
                return p;
              }));
            });
          },

          // 마이크 음소거 이벤트
          evtPeersMicMuted: (peerInfoArray: any) => {
            const peers = Array.isArray(peerInfoArray) ? peerInfoArray : [peerInfoArray];

            peers.forEach((peerInfo: any) => {
              const peerId = peerInfo.userId || peerInfo.peerId || peerInfo.id;

              setParticipants(prev => prev.map(p => {
                if (p.id === peerId) {
                  return { ...p, isAudioOn: false };
                }
                return p;
              }));
            });
          },

          // 마이크 음소거 해제 이벤트
          evtPeersMicUnmuted: (peerInfoArray: any) => {
            const peers = Array.isArray(peerInfoArray) ? peerInfoArray : [peerInfoArray];

            peers.forEach((peerInfo: any) => {
              const peerId = peerInfo.userId || peerInfo.peerId || peerInfo.id;

              setParticipants(prev => prev.map(p => {
                if (p.id === peerId) {
                  return { ...p, isAudioOn: true };
                }
                return p;
              }));
            });
          }
        };

        const conferenceParams = {
          myId: config.userId,
          displayName: config.displayName || config.userId, // 정확한 파라미터 이름: displayName (not myDisplayName)
          myServiceId: config.serviceId,
          roomId: config.roomId,
          roomServiceId: config.serviceId,
          accessToken: config.accessToken,
          mediaType: "video",
          mediaHtmlElement: {
            roomAudio: audioElementRef.current,
            localVideo: localVideoRef.current
          },
          delegate: conferenceDelegate
        };

        await planetKitConference.joinConference(conferenceParams);
        setConference(planetKitConference);
      };

      // 선택한 환경의 SDK 사용 (Fallback 없음)
      const PlanetKitModule = config.environment === 'eval' ? PlanetKitEval : PlanetKitReal;
      await attemptJoin(PlanetKitModule, config.environment);

    } catch (error) {
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
      // 로컬 미디어 스트림 정리 (카메라/마이크 끄기)
      if (localVideoRef.current && localVideoRef.current.srcObject) {
        const stream = localVideoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => {
          track.stop();
        });
        localVideoRef.current.srcObject = null;
      }

      // Conference 연결 해제
      if (conference && typeof conference.leaveConference === 'function') {
        try {
          await conference.leaveConference();
        } catch (leaveError) {
          // Conference 해제 오류는 무시
        }
        setConference(null);
      }

      // 원격 비디오 엘리먼트 정리
      remoteVideoElementsRef.current.clear();

      // 상태 초기화
      setConnectionStatus({ connected: false, connecting: false });
      setParticipants([]);
      setConnectionStartTime(null);
      setCallDuration("00:00:00");

      toast({
        title: "통화 종료",
        description: "미디어 장치가 해제되었습니다.",
      });

      // 페이지 리디렉션
      if (onDisconnect) {
        setTimeout(() => onDisconnect(), 500);
      }
    } catch (error) {
      // Conference 연결 해제 오류는 무시
    }
  };

  // 마이크 토글
  const toggleAudio = async () => {
    if (connectionStatus.connected) {
      try {
        const newAudioState = !isAudioOn;

        // PlanetKit API: muteMyAudio(isMuted) - true면 음소거, false면 음소거 해제
        if (conference && typeof conference.muteMyAudio === 'function') {
          await conference.muteMyAudio(!newAudioState);
        }

        setIsAudioOn(newAudioState);

        // 로컬 참가자 상태 업데이트
        setParticipants(prev => prev.map(p =>
          p.id === "local" ? { ...p, isAudioOn: newAudioState } : p
        ));
      } catch (error) {
        // 마이크 토글 실패는 무시
      }
    }
  };

  // 비디오 토글
  const toggleVideo = async () => {
    if (connectionStatus.connected) {
      try {
        const newVideoState = !isVideoOn;

        // PlanetKit API: pauseMyVideo() / resumeMyVideo()
        if (conference) {
          if (newVideoState) {
            if (typeof conference.resumeMyVideo === 'function') {
              await conference.resumeMyVideo();
            }
          } else {
            if (typeof conference.pauseMyVideo === 'function') {
              await conference.pauseMyVideo();
            }
          }
        }

        setIsVideoOn(newVideoState);

        // 로컬 참가자 상태 업데이트
        setParticipants(prev => prev.map(p =>
          p.id === "local" ? { ...p, isVideoOn: newVideoState } : p
        ));
      } catch (error) {
        // 비디오 토글 실패는 무시
      }
    }
  };

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      // 로컬 미디어 스트림 정리
      if (localVideoRef.current && localVideoRef.current.srcObject) {
        const stream = localVideoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => {
          track.stop();
        });
        localVideoRef.current.srcObject = null;
      }

      // Conference 정리
      const currentConference = conference;
      if (currentConference && typeof currentConference.leaveConference === 'function') {
        try {
          currentConference.leaveConference().catch(() => {
            // 언마운트 시 Conference 해제 오류는 무시
          });
        } catch (error) {
          // 언마운트 시 Conference 해제 오류는 무시
        }
      }

      // 원격 비디오 엘리먼트 정리
      remoteVideoElementsRef.current.clear();
    };
  }, []);

  // 참가자를 TileParticipant로 변환
  const tileParticipants: TileParticipant[] = participants.map(p => ({
    ...p,
    isLocal: p.id === "local"
  }));

  return (
    <div className="h-screen w-screen flex flex-col bg-black">
      {/* 숨겨진 미디어 엘리먼트들 */}
      <audio ref={audioElementRef} autoPlay playsInline />
      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        style={{ display: 'none' }}
      />

      {/* 연결 전: 중앙 연결 카드 */}
      {!connectionStatus.connected && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-card rounded-lg p-6 max-w-sm w-full space-y-4 border border-border">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold text-foreground">
                {config.roomId ? `${config.roomId.charAt(0).toUpperCase() + config.roomId.slice(1)} Room` : (language === 'ko' ? 'PlanetKit 회의' : 'PlanetKit Meeting')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {connectionStatus.connecting ? t.connecting : (language === 'ko' ? '회의에 참여하시겠습니까?' : 'Would you like to join the meeting?')}
              </p>
            </div>

            {connectionStatus.error && (
              <div className="text-sm text-destructive p-3 bg-destructive/10 rounded-md">
                {t.error}: {connectionStatus.error}
              </div>
            )}

            <Button
              onClick={connectToConference}
              disabled={connectionStatus.connecting}
              className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700"
            >
              {connectionStatus.connecting ? (
                <>
                  <Activity className="w-5 h-5 mr-2 animate-spin" />
                  {t.connecting}
                </>
              ) : (
                <>{t.joinMeeting}</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* 연결 후: 전체 화면 레이아웃 */}
      {connectionStatus.connected && (
        <>
          {/* 상단 상태 바 */}
          <div className="fixed top-0 left-0 right-0 z-20 bg-black/70 backdrop-blur-sm border-b border-white/10">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3 text-white">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-mono">{callDuration}</span>
                </div>
                <div className="w-px h-4 bg-white/20" />
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  <span className="text-sm">{participants.length}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <LanguageSelector />
                <div className="text-xs text-white/70">
                  {config.roomId ? config.roomId.toUpperCase() : 'PlanetKit'}
                </div>
              </div>
            </div>
          </div>

          {/* 비디오 그리드 - 전체 화면 */}
          <div className="absolute top-[52px] bottom-[100px] left-0 right-0 w-full">
            <TileView participants={tileParticipants} />
          </div>

          {/* 하단 컨트롤 */}
          <div className="fixed bottom-0 left-0 right-0 z-20 bg-black/70 backdrop-blur-sm border-t border-white/10">
            <div className="flex items-center justify-center gap-4 px-4 py-6">
              {/* 비디오 토글 */}
              <Button
                onClick={toggleVideo}
                size="lg"
                className={`w-14 h-14 rounded-full ${
                  isVideoOn
                    ? 'bg-white/20 hover:bg-white/30 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {isVideoOn ? (
                  <Video className="w-6 h-6" />
                ) : (
                  <VideoOff className="w-6 h-6" />
                )}
              </Button>

              {/* 마이크 토글 */}
              <Button
                onClick={toggleAudio}
                size="lg"
                className={`w-14 h-14 rounded-full ${
                  isAudioOn
                    ? 'bg-white/20 hover:bg-white/30 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {isAudioOn ? (
                  <Mic className="w-6 h-6" />
                ) : (
                  <MicOff className="w-6 h-6" />
                )}
              </Button>

              {/* 연결 해제 */}
              <Button
                onClick={disconnect}
                size="lg"
                className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white"
              >
                <PhoneOff className="w-6 h-6" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
