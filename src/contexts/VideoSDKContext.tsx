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
  const [selectedSDK, setSelectedSDK] = useState<SDKType>('agora');
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
  const [planetKitConfig, setPlanetKitConfig] = useState<PlanetKitConfig>({
    serviceId: '',
    apiKey: '',
    apiSecret: '',
    userId: '',
    roomId: 'test-planet-room',
    accessToken: '',
    environment: 'real' // Default to Real environment (Evaluation WebSocket may be blocked)
  });

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
        setPlanetKitConfig(JSON.parse(savedPlanetKitConfig));
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
      ? !!(agoraConfig.appId) // Agora는 App ID만 있으면 기본 테스트 가능 (App Certificate는 선택사항)
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