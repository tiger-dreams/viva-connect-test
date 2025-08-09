import { useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";
// @ts-ignore
import AgoraRTM from "agora-rtm-sdk";
import VirtualBackgroundExtension from "agora-extension-virtual-background";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Monitor, 
  MonitorOff, 
  Phone, 
  PhoneOff,
  Signal,
  Activity,
  ArrowLeft,
  Settings,
  Clock,
  Camera,
  MicIcon,
  Speaker,
  BarChart3,
  Palette,
  Image,
  Circle,
  X,
  Crown,
  UserX,
  MoreVertical,
  Users,
} from "lucide-react";
import { AgoraConfig, ConnectionStatus, VideoMetrics, Participant } from "@/types/video-sdk";

// 전역 타입 선언
declare global {
  interface Window {
    AgoraRTM?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  }
}
import { useToast } from "@/hooks/use-toast";
import { useVideoSDK } from "@/contexts/VideoSDKContext";
import { useMediaDevices } from "@/hooks/use-media-devices";
import { TileView, TileParticipant } from "@/components/TileView";

const AgoraMeeting = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { agoraConfig } = useVideoSDK();
  
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    connecting: false
  });
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [participants, setParticipants] = useState<TileParticipant[]>([]);
  const [localAgoraUid, setLocalAgoraUid] = useState<string | number | null>(null);
  
  // Agora RTM 관련 상태
  const [rtmClient, setRtmClient] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [rtmChannel, setRtmChannel] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [rtmConnected, setRtmConnected] = useState(false);
  const [videoMetrics, setVideoMetrics] = useState<VideoMetrics>({
    frameRate: 30,
    resolution: "1280x720",
    bitrate: 1500,
    packetLoss: 0
  });
  const [showDeviceSettings, setShowDeviceSettings] = useState(false);
  const [showVideoStats, setShowVideoStats] = useState(false);
  const [showVirtualBackground, setShowVirtualBackground] = useState(false);
  const [connectionStartTime, setConnectionStartTime] = useState<Date | null>(null);
  const [callDuration, setCallDuration] = useState<string>("00:00:00");
  
  // 음성 감지 상태 관리 (디바운싱용)
  const [speakingCounters, setSpeakingCounters] = useState<Map<string, number>>(new Map());
  const [virtualBackgroundExtension, setVirtualBackgroundExtension] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [virtualBackgroundProcessor, setVirtualBackgroundProcessor] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [backgroundOptions] = useState([
    { id: 'none', name: '배경 없음', type: 'none' },
    { id: 'blur', name: '블러 효과', type: 'blur' },
    { id: 'office', name: '사무실', type: 'image', url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=600&fit=crop' },
    { id: 'room', name: '거실', type: 'image', url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&h=600&fit=crop' },
    { id: 'nature', name: '자연', type: 'image', url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&h=600&fit=crop' }
  ]);
  const [selectedBackground, setSelectedBackground] = useState('none');

  // 미디어 디바이스 관리
  const {
    videoDevices,
    audioDevices,
    selectedVideoDevice,
    selectedAudioDevice,
    setSelectedVideoDevice,
    setSelectedAudioDevice,
  } = useMediaDevices();

  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [client, setClient] = useState<IAgoraRTCClient | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [statsInterval, setStatsInterval] = useState<NodeJS.Timeout | null>(null);

  const handleBackToSetup = () => {
    navigate('/setup');
  };

  // 가상 배경 초기화
  const initVirtualBackground = async () => {
    try {
      console.log("🎭 가상 배경 초기화 시작...");
      
      // Virtual Background Extension이 사용 가능한지 확인
      if (!VirtualBackgroundExtension) {
        console.warn("Virtual Background Extension을 사용할 수 없습니다.");
        return null;
      }
      
      // 이미 초기화된 프로세서가 있는지 확인
      if (virtualBackgroundProcessor) {
        console.log("🎭 이미 초기화된 프로세서가 있습니다.");
        return { extension: virtualBackgroundExtension, processor: virtualBackgroundProcessor };
      }
      
      // Extension 인스턴스 생성 및 호환성 확인
      console.log("🎭 Extension 인스턴스 생성 중...");
      const extension = new VirtualBackgroundExtension();

      console.log("🎭 Extension 호환성 확인 중...");
      const compatibility = (extension as any).checkCompatibility
        ? (extension as any).checkCompatibility()
        : (VirtualBackgroundExtension as any)?.checkCompatibility?.();
      if (compatibility && compatibility.supported === false) {
        throw new Error(`가상 배경이 지원되지 않습니다: ${compatibility.reason || '알 수 없는 이유'}`);
      }

      // Extension 등록은 "인스턴스"로 수행해야 함
      console.log("🎭 Extension 등록 시도 중...");
      AgoraRTC.registerExtensions([extension]);
      console.log("🎭 Extension 등록 완료");
      
      // Extension 로딩 완료 대기
      console.log("🎭 Extension 로딩 대기 중...");
      await extension.onloaded;
      console.log("🎭 Extension 로딩 완료");
      
      // 프로세서 생성
      console.log("🎭 프로세서 생성 시도 중...");
      const processor = extension.createProcessor();
      console.log("🎭 프로세서 생성 완료");
      
      // 프로세서 초기화
      console.log("🎭 프로세서 초기화 중...");
      await processor.init();
      console.log("🎭 프로세서 초기화 완료");
      
      setVirtualBackgroundExtension(extension);
      setVirtualBackgroundProcessor(processor);
      
      console.log("🎭 가상 배경 초기화 완료");
      return { extension, processor };
    } catch (error) {
      console.error("🔴 가상 배경 초기화 실패:", error);
      toast({
        title: "가상 배경 초기화 실패",
        description: `오류: ${error.message || '알 수 없는 오류'}`,
        variant: "destructive",
      });
      return null;
    }
  };

  // RTM 클라이언트 초기화
  const initRTMClient = async () => {
    console.log("🚀 RTM 초기화 시작:", {
      appId: agoraConfig.appId,
      channelName: agoraConfig.channelName,
      uid: agoraConfig.uid,
      isHost: agoraConfig.isHost
    });
    
    if (!agoraConfig.appId) {
      console.error("RTM 초기화 실패: App ID가 없습니다.")
      return;
    }

    try {
      // 동적 RTM SDK 로드 (ESM/CJS 양쪽 호환)
      let RTMModule: any; // eslint-disable-line @typescript-eslint/no-explicit-any
      try {
        RTMModule = await import('agora-rtm-sdk');
      } catch (e) {
        console.warn('RTM SDK 동적 임포트 실패, 정적 임포트로 대체 시도', e);
        RTMModule = AgoraRTM as any;
      }

      const candidates: any[] = [
        RTMModule?.default?.AgoraRTM,
        RTMModule?.AgoraRTM,
        RTMModule?.default?.RTM,
        RTMModule?.RTM,
        RTMModule?.default,
        RTMModule,
      ].filter(Boolean);

      const debugShapes = candidates.map((c, idx) => ({
        idx,
        type: typeof c,
        keys: typeof c === 'object' ? Object.keys(c) : [],
        hasCreateInstance: !!(c as any)?.createInstance,
        hasRTMCreateInstance: !!(c as any)?.RTM?.createInstance,
        isCtor: typeof c === 'function',
      }));
      console.log('🔍 RTM SDK 확인:', debugShapes);

      let rtmClient: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
      let factorySource: string | null = null;

      for (const c of candidates) {
        if (!c) continue;
        if (typeof c.createInstance === 'function') {
          rtmClient = c.createInstance(agoraConfig.appId);
          factorySource = 'createInstance@candidate';
          break;
        }
        if (c.RTM && typeof c.RTM.createInstance === 'function') {
          rtmClient = c.RTM.createInstance(agoraConfig.appId);
          factorySource = 'RTM.createInstance@candidate';
          break;
        }
      }

      // 최후의 수단: CDN UMD 빌드 로드 후 window.AgoraRTM 사용
      if (!rtmClient && typeof window !== 'undefined') {
        try {
          console.warn('모듈 해석 실패. CDN UMD 빌드를 로드합니다...');
          await new Promise<void>((resolve, reject) => {
            const existing = document.querySelector('script[data-agora-rtm-cdn]') as HTMLScriptElement | null;
            if (existing) {
              existing.addEventListener('load', () => resolve());
              existing.addEventListener('error', () => reject(new Error('CDN 스크립트 로드 실패')));
            } else {
              const s = document.createElement('script');
              s.src = 'https://download.agora.io/sdk/release/AgoraRTM.min.js';
              s.async = true;
              s.defer = true;
              s.setAttribute('data-agora-rtm-cdn', 'true');
              s.onload = () => resolve();
              s.onerror = () => reject(new Error('CDN 스크립트 로드 실패'));
              document.head.appendChild(s);
            }
          });
          const globalRTM = (window as any).AgoraRTM; // eslint-disable-line @typescript-eslint/no-explicit-any
          console.log('CDN 로드 결과 window.AgoraRTM 존재 여부:', !!globalRTM, 'keys:', globalRTM ? Object.keys(globalRTM) : []);
          if (globalRTM?.createInstance) {
            rtmClient = globalRTM.createInstance(agoraConfig.appId);
            factorySource = 'window.AgoraRTM.createInstance (CDN)';
          }
        } catch (cdnErr) {
          console.error('CDN UMD 로드 실패:', cdnErr);
        }
      }

      if (!rtmClient) {
        throw new Error('agora-rtm-sdk에서 유효한 RTM 생성 API를 찾지 못했습니다. 번들/버전 또는 CDN 로드를 확인해 주세요.');
      }

      // RTM UID는 문자열이어야 하며 최대 64바이트 권장. 안전 문자만 허용
      const rawUid = (agoraConfig.uid && String(agoraConfig.uid)) || Math.random().toString(36).slice(2, 11);
      const safeUid = rawUid.trim().replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 64);

      console.log("🔧 RTM 생성 시도 - AppId:", agoraConfig.appId, "UID:", safeUid, "via:", factorySource);

      // 일부 번들에서는 createInstance 시점에 uid를 요구할 수 있으므로 시그니처를 순차 시도
      const tryCreateInstance = (factory: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        const attempts = [
          { sig: 'createInstance(appId)', args: [agoraConfig.appId] },
          { sig: 'createInstance(appId, { uid })', args: [agoraConfig.appId, { uid: safeUid }] },
          { sig: 'createInstance(appId, uid)', args: [agoraConfig.appId, safeUid] },
        ];
        for (const a of attempts) {
          try {
            console.log('🧪 RTM createInstance 시도:', a.sig);
            return { client: factory.createInstance(...a.args), sig: a.sig };
          } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
            const msg = String(e?.message || e);
            console.warn('❌ createInstance 실패:', a.sig, msg);
            // -10006 (Invalid user id) 등인 경우 다음 시그니처로 시도
          }
        }
        return { client: null, sig: null };
      };

      if (factorySource === 'createInstance@candidate' || factorySource === 'RTM.createInstance@candidate' || factorySource === null) {
        const factory = candidates.find((c) => typeof c?.createInstance === 'function')
          || candidates.find((c) => c?.RTM && typeof c.RTM.createInstance === 'function')?.RTM;
        if (factory) {
          const { client, sig } = tryCreateInstance(factory);
          if (client) {
            rtmClient = client;
            factorySource = `resolved ${sig}`;
          }
        }
      }

      // RTM 로그인 (토큰이 필요한 경우 생성)
      let loginOptions: any = { uid: safeUid }; // eslint-disable-line @typescript-eslint/no-explicit-any
      
      if (agoraConfig.appCertificate) {
        console.log("🔐 RTM 토큰 생성 중...");
        try {
          // RTM 토큰 생성 (동적 import 사용)
          const { generateAgoraRTMToken } = await import('@/utils/token-generator');
          const rtmToken = await generateAgoraRTMToken(
            agoraConfig.appId,
            agoraConfig.appCertificate,
            safeUid,
            3600
          );
          loginOptions.token = rtmToken;
          console.log("✅ RTM 토큰 생성 완료");
        } catch (tokenError) {
          console.error("❌ RTM 토큰 생성 실패:", tokenError);
          throw new Error(`RTM 토큰 생성 실패: ${tokenError.message}`);
        }
      } else {
        console.log("🔓 RTM 토큰 없이 로그인 (테스트 모드)");
      }
      
      await rtmClient.login(loginOptions);
      const channel = rtmClient.createChannel(agoraConfig.channelName);
      
      // 채널 이벤트 리스너 등록
      channel.on('ChannelMessage', (message, memberId) => {
        console.log(`RTM 메시지 수신: ${memberId} - ${message.text}`);
        
        try {
          const data = JSON.parse(message.text);
          
          // 강퇴 메시지 처리
          if (data.type === 'kick' && data.targetUid === agoraConfig.uid) {
            toast({
              title: "강퇴되었습니다",
              description: "호스트에 의해 회의에서 제외되었습니다.",
              variant: "destructive",
            });
            setTimeout(() => {
              leaveChannel();
              navigate('/setup');
            }, 2000);
          }
          
          // 음소거 메시지 처리
          if (data.type === 'mute' && data.targetUid === agoraConfig.uid) {
            if (data.mediaType === 'audio' && localAudioTrack) {
              localAudioTrack.setEnabled(false);
              setIsAudioEnabled(false);
              toast({
                title: "음소거 되었습니다",
                description: "호스트에 의해 마이크가 음소거되었습니다.",
              });
            } else if (data.mediaType === 'video' && localVideoTrack) {
              localVideoTrack.setEnabled(false);
              setIsVideoEnabled(false);
              toast({
                title: "비디오가 꺼졌습니다",
                description: "호스트에 의해 비디오가 비활성화되었습니다.",
              });
            }
          }
        } catch (error) {
          console.log("RTM 메시지 파싱 실패:", error);
        }
      });
      
      await channel.join();
      
      setRtmClient(rtmClient);
      setRtmChannel(channel);
      setRtmConnected(true);
      
      console.log("✅ RTM 클라이언트 초기화 완료:", {
        rtmClient: !!rtmClient,
        rtmChannel: !!channel,
        rtmConnected: true,
        isHost: agoraConfig.isHost
      });
      
    } catch (error) {
      console.error("RTM 초기화 실패:", error);
    }
  };

  // 참가자 강퇴
  const kickParticipant = async (participantId: string) => {
    console.log("🔍 강퇴 권한 체크:", {
      rtmChannel: !!rtmChannel,
      rtmConnected,
      isHost: agoraConfig.isHost,
      agoraConfig
    });
    
    if (!rtmChannel || !agoraConfig.isHost) {
      console.log("강퇴 권한이 없습니다. RTM Channel:", !!rtmChannel, "isHost:", agoraConfig.isHost);
      toast({
        title: "권한 없음",
        description: `강퇴 권한이 없습니다. RTM 연결: ${!!rtmChannel}, 호스트: ${agoraConfig.isHost}`,
        variant: "destructive",
      });
      return;
    }

    try {
      const message = JSON.stringify({
        type: 'kick',
        targetUid: participantId,
        timestamp: Date.now()
      });
      
      await rtmChannel.sendMessage({ text: message });
      
      // 로컬에서 참가자 제거
      setParticipants(prev => prev.filter(p => p.id !== participantId));
      
      toast({
        title: "참가자 강퇴",
        description: `참가자가 성공적으로 강퇴되었습니다.`,
      });
      
    } catch (error) {
      console.error("참가자 강퇴 실패:", error);
      toast({
        title: "강퇴 실패",
        description: "참가자 강퇴에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  // 참가자 음소거
  const muteParticipant = async (participantId: string, mediaType: 'audio' | 'video') => {
    console.log("🔍 음소거 권한 체크:", {
      rtmChannel: !!rtmChannel,
      rtmConnected,
      isHost: agoraConfig.isHost,
      agoraConfig
    });
    
    if (!rtmChannel || !agoraConfig.isHost) {
      console.log("음소거 권한이 없습니다. RTM Channel:", !!rtmChannel, "isHost:", agoraConfig.isHost);
      toast({
        title: "권한 없음",
        description: `음소거 권한이 없습니다. RTM 연결: ${!!rtmChannel}, 호스트: ${agoraConfig.isHost}`,
        variant: "destructive",
      });
      return;
    }

    try {
      const message = JSON.stringify({
        type: 'mute',
        targetUid: participantId,
        mediaType,
        timestamp: Date.now()
      });
      
      await rtmChannel.sendMessage({ text: message });
      
      toast({
        title: "음소거 요청 전송",
        description: `참가자의 ${mediaType === 'audio' ? '마이크' : '비디오'}를 음소거 요청했습니다.`,
      });
      
    } catch (error) {
      console.error("음소거 실패:", error);
      toast({
        title: "음소거 실패",
        description: "참가자 음소거에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  // RTM 정리
  const cleanupRTM = async () => {
    try {
      if (rtmChannel) {
        await rtmChannel.leave();
      }
      if (rtmClient) {
        await rtmClient.logout();
      }
      setRtmChannel(null);
      setRtmClient(null);
      setRtmConnected(false);
    } catch (error) {
      console.error("RTM 정리 실패:", error);
    }
  };

  // 가상 배경 적용
  const applyVirtualBackground = async (backgroundType: string, backgroundUrl?: string) => {
    console.log(`🎭 가상 배경 적용 요청: ${backgroundType}, URL: ${backgroundUrl}`);
    
    // 로컬 트랙이 없으면 적용 불가
    if (!localVideoTrack) {
      console.error("🔴 가상 배경 적용 실패: 로컬 비디오 트랙 없음");
      toast({
        title: "가상 배경 적용 실패",
        description: "비디오 트랙이 없습니다. 먼저 채널에 참여하세요.",
        variant: "destructive",
      });
      return;
    }

    // 트랙 상태 확인
    console.log("🎭 로컬 비디오 트랙 상태:", {
      enabled: localVideoTrack.enabled,
      muted: localVideoTrack.muted,
      playbackState: localVideoTrack.getMediaStreamTrack()?.readyState
    });

    // 프로세서 준비 확인 및 초기화
    let processor = virtualBackgroundProcessor;
    let extension = virtualBackgroundExtension;
    
    if (!processor || !extension) {
      console.log("🎭 프로세서 또는 extension이 없어 초기화 시도 중...");
      const result = await initVirtualBackground();
      if (!result || !result.processor || !result.extension) {
        console.error("🔴 가상 배경 초기화 실패");
        toast({
          title: "가상 배경 적용 실패",
          description: "가상 배경 초기화에 실패했습니다.",
          variant: "destructive",
        });
        return;
      }
      processor = result.processor;
      extension = result.extension;
    }

    try {
      console.log(`🎭 가상 배경 적용 시작: ${backgroundType}`);
      
      if (backgroundType === 'none') {
        // 가상 배경 제거 - pipe 해제
        try {
          console.log("🎭 기존 파이프 해제 시도...");
          if (typeof (localVideoTrack as any).unpipe === 'function') {
            await (localVideoTrack as any).unpipe();
          }
          console.log("🎭 가상 배경 제거 완료");
        } catch (unpipeError: any) {
          console.log("🎭 unpipe 실패 (이미 제거되었을 수 있음):", unpipeError?.message || unpipeError);
        }
        try {
          if (virtualBackgroundProcessor && typeof virtualBackgroundProcessor.disable === 'function') {
            await virtualBackgroundProcessor.disable();
          }
        } catch {}
      } else {
        // 기존 파이프가 있다면 먼저 해제
        try {
          if (typeof (localVideoTrack as any).unpipe === 'function') {
            await (localVideoTrack as any).unpipe();
          }
          console.log("🎭 기존 파이프 해제 완료");
        } catch (unpipeError: any) {
          console.log("🎭 기존 파이프 없음 또는 해제 실패:", unpipeError?.message || unpipeError);
        }
        
        // 잠시 대기 (안정성을 위해)
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (backgroundType === 'blur') {
          // 블러 효과 적용
          console.log("🎭 블러 효과 옵션 설정 중...");
          await processor.setOptions({
            type: 'blur',
            blurDegree: 3
          });
          // 기능 활성화 (최초/재설정 시 필요)
          if (typeof processor.enable === 'function') {
            await processor.enable();
          }
          console.log("🎭 블러 효과 파이프 연결 중...");
          const destination = (localVideoTrack as any).processorDestination;
          if (typeof (localVideoTrack as any).pipe === 'function' && destination) {
            await (localVideoTrack as any).pipe(processor).pipe(destination);
          }
          console.log("🎭 블러 효과 적용 완료");
          // 재생 새로고침 (파이프라인 반영)
          try {
            (localVideoTrack as any).stop();
            const existingVideo = document.querySelector('video#local-video-tile') as HTMLVideoElement | null;
            if (existingVideo) {
              (localVideoTrack as any).play(existingVideo);
            }
          } catch {}
          
        } else if (backgroundType === 'image' && backgroundUrl) {
          // 이미지 배경 적용
          console.log("🎭 이미지 배경 옵션 설정 중...");
          // 이미지 객체로 로드 필요 (URL 문자열 불가)
          const img: HTMLImageElement = document.createElement('img');
          img.crossOrigin = 'anonymous';
          const loadPromise = new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = (e) => reject(e);
          });
          img.src = backgroundUrl;
          await loadPromise;
          await processor.setOptions({ type: 'img', source: img as any });
          if (typeof processor.enable === 'function') {
            await processor.enable();
          }
          console.log("🎭 이미지 배경 파이프 연결 중...");
          const destination = (localVideoTrack as any).processorDestination;
          if (typeof (localVideoTrack as any).pipe === 'function' && destination) {
            await (localVideoTrack as any).pipe(processor).pipe(destination);
          }
          console.log("🎭 이미지 배경 적용 완료");
          // 재생 새로고침 (파이프라인 반영)
          try {
            (localVideoTrack as any).stop();
            const existingVideo = document.querySelector('video#local-video-tile') as HTMLVideoElement | null;
            if (existingVideo) {
              (localVideoTrack as any).play(existingVideo);
            }
          } catch {}
        }
      }
      
      setSelectedBackground(backgroundType === 'image' ? backgroundUrl || backgroundType : backgroundType);
      
      toast({
        title: "가상 배경 적용 완료",
        description: `${backgroundType === 'none' ? '배경 제거' : backgroundType === 'blur' ? '블러 효과' : '이미지 배경'}가 적용되었습니다.`,
      });
      
    } catch (error) {
      console.error("🔴 가상 배경 적용 실패:", error);
      console.error("🔴 Error stack:", error.stack);
      toast({
        title: "가상 배경 적용 실패",
        description: `오류: ${error.message || '알 수 없는 오류'}`,
        variant: "destructive",
      });
    }
  };

  // 비디오 통계 수집
  const collectVideoStats = async () => {
    if (!client) return;

    try {
      const stats = await client.getRTCStats();
      
      // 로컬 트랙 개별 통계 수집 및 업데이트
      let localTrackStatsUpdated = false;
      try {
        if (localVideoTrack) {
          const localTrackStats = await localVideoTrack.getStats();
          
          if (localTrackStats && Object.keys(localTrackStats).length > 0) {
            const videoStats = {
              // 기본 비디오 통계
              bitrate: Math.round(localTrackStats.sendBitrate || localTrackStats.bitrate || 0),
              frameRate: Math.round(localTrackStats.sendFrameRate || localTrackStats.frameRate || 30),
              resolution: `${localTrackStats.sendResolutionWidth || localTrackStats.width || 640}x${localTrackStats.sendResolutionHeight || localTrackStats.height || 480}`,
              packetLoss: Math.round((localTrackStats.sendPacketsLost || localTrackStats.packetsLost || 0) * 100) / 100,
              
              // 추가 상세 통계
              codecType: localTrackStats.codecType || localTrackStats.codec,
              sendBytes: localTrackStats.sendBytes || localTrackStats.bytesSent,
              sendPackets: localTrackStats.sendPackets || localTrackStats.packetsSent,
              jitter: localTrackStats.jitter,
              rtt: localTrackStats.rtt || localTrackStats.roundTripTime,
              bandwidth: localTrackStats.sendBandwidth || localTrackStats.availableOutgoingBitrate,
              encoderType: localTrackStats.encoderType || localTrackStats.encoder,
              totalDuration: localTrackStats.totalDuration,
              freezeRate: localTrackStats.freezeRate,
              
              // 원시 통계 객체 (디버깅용)
              rawStats: localTrackStats
            };
            
            setParticipants(prev => prev.map(p => 
              p.id === "local" 
                ? { ...p, videoStats }
                : p
            ));
            
            localTrackStatsUpdated = true;
          }
        }
      } catch (trackError) {
        // 로컬 트랙 통계 수집 실패 시 무시
      }
      
      // 원격 참가자들의 개별 트랙 통계 수집 및 업데이트
      const remoteUsers = client.remoteUsers;
      
      for (const user of remoteUsers) {
        if (user.videoTrack) {
          try {
            const remoteTrackStats = await user.videoTrack.getStats();
            
            if (remoteTrackStats && Object.keys(remoteTrackStats).length > 0) {
              const videoStats = {
                // 기본 비디오 통계
                bitrate: Math.round(remoteTrackStats.receiveBitrate || remoteTrackStats.bitrate || 0),
                frameRate: Math.round(remoteTrackStats.receiveFrameRate || remoteTrackStats.frameRate || 30),
                resolution: `${remoteTrackStats.receiveResolutionWidth || remoteTrackStats.width || 1280}x${remoteTrackStats.receiveResolutionHeight || remoteTrackStats.height || 720}`,
                packetLoss: Math.round((remoteTrackStats.receivePacketsLost || remoteTrackStats.packetsLost || 0) * 100) / 100,
                
                // 추가 상세 통계
                codecType: remoteTrackStats.codecType || remoteTrackStats.codec,
                receiveBytes: remoteTrackStats.receiveBytes || remoteTrackStats.bytesReceived,
                receivePackets: remoteTrackStats.receivePackets || remoteTrackStats.packetsReceived,
                jitter: remoteTrackStats.jitter,
                rtt: remoteTrackStats.rtt || remoteTrackStats.roundTripTime,
                bandwidth: remoteTrackStats.receiveBandwidth || remoteTrackStats.availableIncomingBitrate,
                encoderType: remoteTrackStats.decoderType || remoteTrackStats.decoder,
                totalDuration: remoteTrackStats.totalDuration,
                freezeRate: remoteTrackStats.freezeRate,
                
                // 원시 통계 객체 (디버깅용)
                rawStats: remoteTrackStats
              };
              
              setParticipants(prev => prev.map(p => 
                p.id === user.uid.toString() 
                  ? { ...p, videoStats }
                  : p
              ));
            }
          } catch (remoteTrackError) {
            // 원격 트랙 통계 수집 실패 시 무시
          }
        }
      }
      

      // 기본 통계에서 비트레이트 정보 추출 (fallback)
      if (stats.SendBitrate || stats.RecvBitrate) {
        
        setParticipants(prev => prev.map(p => {
          if (p.id === "local" && !localTrackStatsUpdated) {
            // 로컬 참가자는 SendBitrate 사용 (개별 트랙 통계가 없는 경우에만)
            return {
              ...p,
              videoStats: {
                bitrate: Math.round(stats.SendBitrate || 0),
                frameRate: 30,
                resolution: "640x480",
                packetLoss: Math.round(((stats.RTT || 0) / 1000) * 100) / 100,
                
                // 전체 통계에서 추가 정보
                sendBytes: stats.SendBytes,
                totalDuration: stats.Duration,
                rtt: stats.RTT,
                bandwidth: stats.OutgoingAvailableBandwidth,
                
                // 원시 통계
                rawStats: stats
              }
            };
          } else if (!p.isLocal && !p.videoStats) {
            // 원격 참가자들 중 개별 통계가 없는 경우에만 RecvBitrate 분배
            const remoteParticipantCount = prev.filter(participant => !participant.isLocal).length;
            const avgRecvBitrate = remoteParticipantCount > 0 ? Math.round((stats.RecvBitrate || 0) / remoteParticipantCount) : 0;
            
            return {
              ...p,
              videoStats: {
                bitrate: avgRecvBitrate,
                frameRate: 30,
                resolution: "1280x720",
                packetLoss: Math.round(((stats.RTT || 0) / 1000) * 100) / 100,
                
                // 전체 통계에서 추가 정보
                receiveBytes: Math.round((stats.RecvBytes || 0) / remoteParticipantCount),
                totalDuration: stats.Duration,
                rtt: stats.RTT,
                
                // 원시 통계
                rawStats: stats
              }
            };
          }
          return p;
        }));
      }

    } catch (error) {
      // 통계 수집 실패 시 무시
    }
  };

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

  // 비디오 통계 수집 주기적 실행
  useEffect(() => {
    if (connectionStatus.connected && showVideoStats) {
      const interval = setInterval(collectVideoStats, 1000);
      setStatsInterval(interval);
      
      return () => {
        clearInterval(interval);
        setStatsInterval(null);
      };
    } else if (statsInterval) {
      clearInterval(statsInterval);
      setStatsInterval(null);
    }
  }, [connectionStatus.connected, showVideoStats, client, localVideoTrack]);

  // 볼륨 인디케이터 설정 함수
  const setupVolumeIndicator = (agoraClient: IAgoraRTCClient, currentLocalUid: string | number) => {
    try {
      // 200ms 간격으로 레벨 리포트 (기본값 200ms)
      // @ts-ignore
      agoraClient.enableAudioVolumeIndicator?.();
      console.log("🔈 볼륨 인디케이터 활성화됨");
    } catch (e) {
      console.warn("🔈 enableAudioVolumeIndicator 실패 또는 미지원:", e);
    }

    // 볼륨 이벤트 처리: 각 참가자의 isSpeaking, audioLevel 업데이트
    agoraClient.on("volume-indicator", (volumes: any[]) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      console.log("🔊 Volume indicator event:", {
        volumes,
        currentLocalUid,
        participantCount: participants.length
      });

      setParticipants(prev => {
        // 미리 uid->level 매핑 생성
        const levelMap = new Map<string, number>();
        for (const v of volumes || []) {
          const uidStr = (typeof v?.uid === 'number' ? String(v.uid) : String(v?.uid ?? ''));
          if (uidStr) {
            levelMap.set(uidStr, Number(v.level ?? 0));
            console.log(`🔊 UID ${uidStr} level: ${v.level}`);
          }
        }

        const localUidStr = String(currentLocalUid);
        const threshold = 45; // 말하기로 간주할 임계값
        const requiredSpeakingCount = 1; // 임계값을 넘으면 즉시 감지 (1로 변경)
        const maxSilenceCount = 4; // 말하기 상태에서 이 횟수만큼 임계값 미만이면 중지 (더 오래 유지)
        
        console.log(`🔊 Local UID: ${localUidStr}, Threshold: ${threshold}`);

        // 현재 카운터 상태 가져오기
        const currentCounters = speakingCounters;
        const newCounters = new Map(currentCounters);

        const updatedParticipants = prev.map(p => {
          let level = 0;
          
          if (p.isLocal) {
            // 로컬 참가자는 currentLocalUid로 매핑
            level = levelMap.get(localUidStr) ?? 0;
            console.log(`🔊 Local participant level: ${level} (from UID ${localUidStr})`);
          } else {
            // 원격 참가자는 p.id로 매핑
            level = levelMap.get(p.id) ?? 0;
            console.log(`🔊 Remote participant ${p.id} level: ${level}`);
          }
          
          const participantKey = p.isLocal ? 'local' : p.id;
          const currentCounter = currentCounters.get(participantKey) || 0;
          const isAboveThreshold = level >= threshold;
          
          let newCounter = currentCounter;
          let isSpeaking = p.isSpeaking || false; // 현재 상태 유지
          
          if (isAboveThreshold) {
            // 임계값 이상: 카운터 증가
            newCounter = Math.min(currentCounter + 1, requiredSpeakingCount);
            if (newCounter >= requiredSpeakingCount) {
              isSpeaking = true;
            }
          } else {
            // 임계값 미만: 현재 말하고 있다면 감소, 아니면 0으로 리셋
            if (isSpeaking) {
              newCounter = Math.max(currentCounter - 1, -maxSilenceCount);
              if (newCounter <= -maxSilenceCount) {
                isSpeaking = false;
                newCounter = 0;
              }
            } else {
              newCounter = 0;
            }
          }
          
          newCounters.set(participantKey, newCounter);
          
          const normalized = Math.max(0, Math.min(1, level / 100));
          
          if (p.isLocal || level > 0) {
            console.log(`🔊 Participant ${p.name} (${p.isLocal ? 'local' : 'remote'}): level=${level}, counter=${newCounter}, speaking=${isSpeaking}`);
          }
          
          return { ...p, isSpeaking, audioLevel: normalized };
        });

        // 카운터 상태 업데이트
        setSpeakingCounters(newCounters);
        
        return updatedParticipants;
      });
    });
  };

  // Agora 클라이언트 초기화
  useEffect(() => {
    const agoraClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
    
    // 원격 참가자 이벤트 리스너 등록
    agoraClient.on("user-joined", async (user) => {
      console.log("원격 사용자 참가:", user.uid);
      
      // 새로운 원격 참가자 추가
      setParticipants(prev => {
        const existingUser = prev.find(p => p.id === user.uid.toString());
        if (!existingUser) {
          return [...prev, {
            id: user.uid.toString(),
            name: `User ${user.uid}`,
            isVideoOn: user.hasVideo,
            isAudioOn: user.hasAudio,
            isScreenSharing: false,
            isLocal: false,
            isHost: false
          }];
        }
        return prev;
      });
    });

    agoraClient.on("user-left", (user) => {
      console.log("원격 사용자 퇴장:", user.uid);
      
      // 퇴장한 참가자 제거
      setParticipants(prev => prev.filter(p => p.id !== user.uid.toString()));
    });

    agoraClient.on("user-published", async (user, mediaType) => {
      console.log("원격 사용자 미디어 발행:", user.uid, mediaType);
      
      // 원격 사용자의 스트림 구독
      await agoraClient.subscribe(user, mediaType);

      if (mediaType === "video" && user.videoTrack) {
        // 비디오 엘리먼트 생성 및 참가자 정보 업데이트
        const videoElement = document.createElement("video");
        user.videoTrack.play(videoElement);
        
        setParticipants(prev => prev.map(p => 
          p.id === user.uid.toString() 
            ? { 
                ...p, 
                isVideoOn: true,
                videoElement 
              }
            : p
        ));
      }

      if (mediaType === "audio") {
        // 오디오는 자동으로 재생됨
        setParticipants(prev => prev.map(p => 
          p.id === user.uid.toString() 
            ? { ...p, isAudioOn: true }
            : p
        ));
      }
    });

    agoraClient.on("user-unpublished", (user, mediaType) => {
      console.log("원격 사용자 미디어 중지:", user.uid, mediaType);
      
      if (mediaType === "video") {
        setParticipants(prev => prev.map(p => 
          p.id === user.uid.toString() 
            ? { ...p, isVideoOn: false, videoElement: undefined }
            : p
        ));
      }

      if (mediaType === "audio") {
        setParticipants(prev => prev.map(p => 
          p.id === user.uid.toString() 
            ? { ...p, isAudioOn: false }
            : p
        ));
      }
    });

    setClient(agoraClient);

    return () => {
      agoraClient.leave();
    };
  }, []);

  // 채널 참여
  const joinChannel = async () => {
    if (!client || !agoraConfig.appId || !agoraConfig.channelName) {
      toast({
        title: "설정 오류",
        description: "Agora 설정이 올바르지 않습니다.",
        variant: "destructive",
      });
      return;
    }

    setConnectionStatus({ connected: false, connecting: true });

    try {
      // 토큰이 있으면 사용, 없으면 null (테스트 모드)
      const token = agoraConfig.token || null;
      const uid = parseInt(agoraConfig.uid) || 0;
      const joinedUid = await client.join(agoraConfig.appId, agoraConfig.channelName, token, uid);
      setLocalAgoraUid(joinedUid);
      
      setConnectionStatus({ connected: true, connecting: false });
      setConnectionStartTime(new Date());

      // 오디오/비디오 트랙 생성 및 발행 먼저 수행
      await createAndPublishTracks(typeof joinedUid === 'number' ? joinedUid : uid);

      // 볼륨 인디케이터 설정 (트랙 생성 후)
      setupVolumeIndicator(client, joinedUid);

      // RTM 클라이언트 초기화 (모든 참가자)
      console.log("🔄 RTM 초기화 시도 중...", { isHost: agoraConfig.isHost });
      await initRTMClient();

      toast({
        title: "연결 성공",
        description: "Agora 채널에 성공적으로 연결되었습니다.",
      });

    } catch (error) {
      console.error("Agora 연결 실패:", error);
      setConnectionStatus({ 
        connected: false, 
        connecting: false, 
        error: error instanceof Error ? error.message : '연결 실패' 
      });
      toast({
        title: "연결 실패",
        description: error instanceof Error ? error.message : "Agora 채널 연결에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  // 트랙 생성 및 발행
  const createAndPublishTracks = async (uid: number) => {
    if (!client) return;

    try {
      const videoTrack = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: "720p_2",
        ...(selectedVideoDevice && { cameraId: selectedVideoDevice })
      });
      const audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        ...(selectedAudioDevice && { microphoneId: selectedAudioDevice })
      });

      // 로컬 비디오 엘리먼트 생성
      const localVideoElement = document.createElement("video");
      localVideoElement.id = 'local-video-tile';
      localVideoElement.muted = true;
      localVideoElement.playsInline = true;
      videoTrack.play(localVideoElement);

      // 로컬 참가자를 타일뷰에 추가
      setParticipants(prev => [{
        id: "local",
        name: agoraConfig.participantName || `UID: ${uid}`,
        isVideoOn: true,
        isAudioOn: true,
        isScreenSharing: false,
        isLocal: true,
        isHost: agoraConfig.isHost || false,
        videoElement: localVideoElement
      }, ...prev.filter(p => p.id !== "local")]);

      await client.publish([videoTrack, audioTrack]);
      
      setLocalVideoTrack(videoTrack);
      setLocalAudioTrack(audioTrack);

      // 가상 배경 초기화 (비동기로 백그라운드에서 수행)
      initVirtualBackground().then(() => {
        console.log("🎭 백그라운드에서 가상 배경 초기화 완료");
      }).catch((error) => {
        console.warn("🎭 백그라운드 가상 배경 초기화 실패:", error);
      });

    } catch (error) {
      console.error("트랙 생성/발행 실패:", error);
    }
  };

  // 채널 나가기
  const leaveChannel = async () => {
    try {
      // 가상 배경 프로세서 정리 (가능 시)
      try {
        if (localVideoTrack && typeof (localVideoTrack as any).unpipe === 'function') {
          await (localVideoTrack as any).unpipe();
        }
      } catch {}

      try {
        if (virtualBackgroundProcessor && typeof virtualBackgroundProcessor.release === 'function') {
          virtualBackgroundProcessor.release();
        }
      } catch {}

      // RTM 정리
      await cleanupRTM();

      // 통계 수집 중지
      if (statsInterval) {
        clearInterval(statsInterval);
        setStatsInterval(null);
      }

      if (localVideoTrack) {
        localVideoTrack.close();
        setLocalVideoTrack(null);
      }
      if (localAudioTrack) {
        localAudioTrack.close();
        setLocalAudioTrack(null);
      }

      if (client) {
        await client.leave();
      }

      setConnectionStatus({ connected: false, connecting: false });
      setParticipants([]);
      setConnectionStartTime(null);
      setCallDuration("00:00:00");

    } catch (error) {
      console.error("채널 나가기 실패:", error);
    }
  };

  // 비디오 토글
  const toggleVideo = async () => {
    if (localVideoTrack) {
      const newVideoEnabled = !isVideoEnabled;
      await localVideoTrack.setEnabled(newVideoEnabled);
      setIsVideoEnabled(newVideoEnabled);
      
      // 타일뷰 상태 업데이트
      setParticipants(prev => prev.map(p => 
        p.id === "local" ? { ...p, isVideoOn: newVideoEnabled } : p
      ));
    }
  };

  // 오디오 토글
  const toggleAudio = async () => {
    if (localAudioTrack) {
      const newAudioEnabled = !isAudioEnabled;
      await localAudioTrack.setEnabled(newAudioEnabled);
      setIsAudioEnabled(newAudioEnabled);
      
      // 타일뷰 상태 업데이트
      setParticipants(prev => prev.map(p => 
        p.id === "local" ? { ...p, isAudioOn: newAudioEnabled } : p
      ));
    }
  };

  // 카메라 디바이스 변경
  const changeVideoDevice = async (deviceId: string) => {
    if (!client || !localVideoTrack) return;

    try {
      setSelectedVideoDevice(deviceId);
      await localVideoTrack.setDevice(deviceId);
      
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
    if (!client || !localAudioTrack) return;

    try {
      setSelectedAudioDevice(deviceId);
      await localAudioTrack.setDevice(deviceId);
      
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
                <h1 className="text-xl font-semibold">Agora 화상회의</h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-agora-primary/20 text-agora-primary border-agora-primary/30">
                Agora
              </Badge>

              <div className="text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>채널: <span className="font-mono">{agoraConfig.channelName}</span></span>
                  <span>|</span>
                  <span>UID: {agoraConfig.uid}</span>
                </div>
              </div>

              {connectionStatus.connected && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span className="font-mono">{callDuration}</span>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const newState = !showVideoStats;
                      console.log(`🔄 품질 정보 토글: ${showVideoStats} -> ${newState}`);
                      setShowVideoStats(newState);
                    }}
                    className="flex items-center gap-2"
                  >
                    <BarChart3 className="w-4 h-4" />
                    품질 정보
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowVirtualBackground(!showVirtualBackground)}
                    className="flex items-center gap-2"
                  >
                    <Palette className="w-4 h-4" />
                    가상 배경
                  </Button>
                  
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
            </div>
          </div>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="container mx-auto px-4 py-6">
        <div className="space-y-4">
          {/* 연결 상태 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-8 h-8 bg-agora-primary/20 rounded-lg flex items-center justify-center">
                  <Activity className="w-4 h-4 text-agora-primary" />
                </div>
                연결 상태
                <Badge variant={connectionStatus.connected ? "default" : "secondary"} 
                       className={connectionStatus.connected ? "bg-agora-primary text-white" : ""}>
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
                    onClick={joinChannel}
                    disabled={connectionStatus.connecting}
                    className="bg-agora-primary hover:bg-agora-primary/90 text-white"
                  >
                    {connectionStatus.connecting ? "연결 중..." : "Agora 채널 참여"}
                  </Button>
                ) : (
                  <Button
                    onClick={leaveChannel}
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
                      participants={participants} 
                      maxVisibleTiles={4} 
                      showVideoStats={showVideoStats}
                    />
                  </div>

                  {/* 호스트인 경우 참가자 관리 UI 추가 */}
                  {agoraConfig.isHost && participants.length > 1 && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          참가자 관리 ({participants.filter(p => !p.isLocal).length}명)
                        </h4>
                        <div className="flex items-center gap-2">
                          <Badge variant={rtmConnected ? "default" : "destructive"} className="text-xs">
                            RTM {rtmConnected ? "연결됨" : "연결 안됨"}
                          </Badge>
                          {!rtmConnected && (
                            <Button
                              onClick={initRTMClient}
                              size="sm"
                              variant="outline"
                              className="text-xs h-6"
                            >
                              RTM 재연결
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        {participants
                          .filter(p => !p.isLocal)
                          .map((participant) => (
                            <div
                              key={participant.id}
                              className="flex items-center justify-between p-3 bg-muted rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1">
                                  {participant.isHost && (
                                    <Crown className="w-4 h-4 text-yellow-500" />
                                  )}
                                  <span className="font-medium">{participant.name}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  {participant.isVideoOn ? (
                                    <Video className="w-3 h-3 text-green-500" />
                                  ) : (
                                    <VideoOff className="w-3 h-3 text-red-500" />
                                  )}
                                  {participant.isAudioOn ? (
                                    <Mic className="w-3 h-3 text-green-500" />
                                  ) : (
                                    <MicOff className="w-3 h-3 text-red-500" />
                                  )}
                                </div>
                              </div>
                              
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => muteParticipant(participant.id, 'audio')}
                                    className="text-orange-600"
                                  >
                                    <MicOff className="mr-2 h-4 w-4" />
                                    마이크 음소거
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => muteParticipant(participant.id, 'video')}
                                    className="text-orange-600"
                                  >
                                    <VideoOff className="mr-2 h-4 w-4" />
                                    비디오 끄기
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => kickParticipant(participant.id)}
                                    className="text-destructive"
                                  >
                                    <UserX className="mr-2 h-4 w-4" />
                                    강퇴하기
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* 미디어 컨트롤 */}
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <Button
                      onClick={toggleVideo}
                      variant={isVideoEnabled ? "default" : "outline"}
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      {isVideoEnabled ? (
                        <Video className="w-4 h-4" />
                      ) : (
                        <VideoOff className="w-4 h-4" />
                      )}
                      {isVideoEnabled ? "비디오 끄기" : "비디오 켜기"}
                    </Button>

                    <Button
                      onClick={toggleAudio}
                      variant={isAudioEnabled ? "default" : "outline"}
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      {isAudioEnabled ? (
                        <Mic className="w-4 h-4" />
                      ) : (
                        <MicOff className="w-4 h-4" />
                      )}
                      {isAudioEnabled ? "음소거" : "음소거 해제"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* 가상 배경 설정 */}
              {showVirtualBackground && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Palette className="w-5 h-5" />
                      가상 배경 설정
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                      {backgroundOptions.map((option) => (
                        <div
                          key={option.id}
                          className={`relative cursor-pointer rounded-lg border-2 transition-all hover:scale-105 ${
                            selectedBackground === option.id || 
                            (option.type === 'image' && selectedBackground === option.url)
                              ? 'border-primary shadow-md' 
                              : 'border-border hover:border-primary/50'
                          }`}
                          onClick={() => {
                            if (option.type === 'none') {
                              applyVirtualBackground('none');
                            } else if (option.type === 'blur') {
                              applyVirtualBackground('blur');
                            } else if (option.type === 'image') {
                              applyVirtualBackground('image', option.url);
                            }
                          }}
                        >
                          <div className="aspect-video bg-muted rounded-md overflow-hidden">
                            {option.type === 'none' && (
                              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                                <X className="w-6 h-6 text-gray-500 mb-1" />
                                <span className="text-xs text-gray-600">없음</span>
                              </div>
                            )}
                            {option.type === 'blur' && (
                              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-100 to-blue-200">
                                <Circle className="w-6 h-6 text-blue-600 mb-1 opacity-50" />
                                <span className="text-xs text-blue-700">블러</span>
                              </div>
                            )}
                            {option.type === 'image' && option.url && (
                              <div className="relative w-full h-full">
                                <img 
                                  src={option.url} 
                                  alt={option.name}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                  <Image className="w-4 h-4 text-white" />
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="p-2">
                            <p className="text-xs font-medium text-center truncate">
                              {option.name}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 p-3 bg-muted/20 rounded-md text-xs text-muted-foreground">
                      <p>🎭 가상 배경 기능을 사용하여 실제 배경을 숨기거나 변경할 수 있습니다.</p>
                      <p className="mt-1">💡 성능을 위해 밝은 조명 환경에서 사용하는 것이 좋습니다.</p>
                    </div>
                  </CardContent>
                </Card>
              )}

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

            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgoraMeeting;