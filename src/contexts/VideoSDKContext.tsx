import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SDKType, AgoraConfig, LiveKitConfig, PlanetKitConfig } from '@/types/video-sdk';

interface VideoSDKContextType {
  selectedSDK: SDKType;
  setSelectedSDK: (sdk: SDKType) => void;
  agoraConfig: AgoraConfig;
  setAgoraConfig: (config: AgoraConfig) => void;
  liveKitConfig: LiveKitConfig;
  setLiveKitConfig: (config: LiveKitConfig) => void;
  planetKitConfig: PlanetKitConfig;
  setPlanetKitConfig: (config: PlanetKitConfig) => void;
  isConfigured: boolean;
}

const VideoSDKContext = createContext<VideoSDKContextType | undefined>(undefined);

interface VideoSDKProviderProps {
  children: ReactNode;
}

export const VideoSDKProvider = ({ children }: VideoSDKProviderProps) => {
  const [selectedSDK, setSelectedSDK] = useState<SDKType>('planetkit'); // Default to PlanetKit

  const [agoraConfig, setAgoraConfig] = useState<AgoraConfig>({
    appId: '',
    appCertificate: '',
    channelName: 'test-channel',
    uid: '0'
  });

  const [liveKitConfig, setLiveKitConfig] = useState<LiveKitConfig>({
    serverUrl: 'wss://localhost:7880',
    apiKey: '',
    apiSecret: '',
    roomName: 'test-room',
    participantName: 'Test User'
  });

  // PlanetKit: 환경 변수에서 설정 로드
  const getDefaultPlanetKitConfig = (env: 'eval' | 'real' = 'eval'): PlanetKitConfig => ({
    serviceId: env === 'eval'
      ? import.meta.env.VITE_PLANETKIT_EVAL_SERVICE_ID || ''
      : import.meta.env.VITE_PLANETKIT_REAL_SERVICE_ID || '',
    apiKey: env === 'eval'
      ? import.meta.env.VITE_PLANETKIT_EVAL_API_KEY || ''
      : import.meta.env.VITE_PLANETKIT_REAL_API_KEY || '',
    apiSecret: env === 'eval'
      ? import.meta.env.VITE_PLANETKIT_EVAL_API_SECRET || ''
      : import.meta.env.VITE_PLANETKIT_REAL_API_SECRET || '',
    userId: '', // LINE 프로필에서 자동으로 설정됨
    roomId: 'planet-room-' + Date.now().toString().slice(-6), // 고유한 룸 ID 생성
    accessToken: '',
    environment: env
  });

  const [planetKitConfig, setPlanetKitConfig] = useState<PlanetKitConfig>(
    getDefaultPlanetKitConfig('eval')
  );

  // localStorage에서 설정 복원
  useEffect(() => {
    const savedAgoraConfig = localStorage.getItem('agoraConfig');
    const savedLiveKitConfig = localStorage.getItem('liveKitConfig');
    const savedPlanetKitConfig = localStorage.getItem('planetKitConfig');
    const savedSDK = localStorage.getItem('selectedSDK');

    if (savedAgoraConfig) {
      try {
        setAgoraConfig(JSON.parse(savedAgoraConfig));
      } catch (error) {
        console.error('Failed to parse Agora config:', error);
      }
    }

    if (savedLiveKitConfig) {
      try {
        setLiveKitConfig(JSON.parse(savedLiveKitConfig));
      } catch (error) {
        console.error('Failed to parse LiveKit config:', error);
      }
    }

    if (savedPlanetKitConfig) {
      try {
        const saved = JSON.parse(savedPlanetKitConfig);
        // 환경 변수에서 로드한 값과 병합 (환경 변수 우선)
        setPlanetKitConfig(prev => ({
          ...prev,
          ...saved,
          // Service ID, API Key, API Secret은 환경 변수 우선
          serviceId: prev.serviceId || saved.serviceId,
          apiKey: prev.apiKey || saved.apiKey,
          apiSecret: prev.apiSecret || saved.apiSecret,
        }));
      } catch (error) {
        console.error('Failed to parse PlanetKit config:', error);
      }
    }

    if (savedSDK) {
      setSelectedSDK(savedSDK as SDKType);
    }
  }, []);

  // 설정 변경 시 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('agoraConfig', JSON.stringify(agoraConfig));
  }, [agoraConfig]);

  useEffect(() => {
    localStorage.setItem('liveKitConfig', JSON.stringify(liveKitConfig));
  }, [liveKitConfig]);

  useEffect(() => {
    localStorage.setItem('planetKitConfig', JSON.stringify(planetKitConfig));
  }, [planetKitConfig]);

  useEffect(() => {
    localStorage.setItem('selectedSDK', selectedSDK);
  }, [selectedSDK]);

  // 설정이 완료되었는지 확인
  const isConfigured =
    selectedSDK === 'agora'
      ? !!(agoraConfig.appId)
      : selectedSDK === 'livekit'
        ? !!(liveKitConfig.serverUrl && liveKitConfig.apiKey && liveKitConfig.apiSecret && liveKitConfig.token)
        : selectedSDK === 'planetkit'
          ? !!(planetKitConfig.serviceId && planetKitConfig.apiKey && planetKitConfig.userId && planetKitConfig.accessToken)
          : false;

  const value = {
    selectedSDK,
    setSelectedSDK,
    agoraConfig,
    setAgoraConfig,
    liveKitConfig,
    setLiveKitConfig,
    planetKitConfig,
    setPlanetKitConfig,
    isConfigured,
  };

  return (
    <VideoSDKContext.Provider value={value}>
      {children}
    </VideoSDKContext.Provider>
  );
};

export const useVideoSDK = () => {
  const context = useContext(VideoSDKContext);
  if (context === undefined) {
    throw new Error('useVideoSDK must be used within a VideoSDKProvider');
  }
  return context;
};
