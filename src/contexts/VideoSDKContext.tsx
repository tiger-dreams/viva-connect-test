import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SDKType, PlanetKitConfig } from '@/types/video-sdk';

interface VideoSDKContextType {
  selectedSDK: SDKType;
  setSelectedSDK: (sdk: SDKType) => void;
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

  // PlanetKit: 환경 변수에서 설정 로드
  const getDefaultPlanetKitConfig = (): PlanetKitConfig => ({
    serviceId: import.meta.env.VITE_PLANETKIT_EVAL_SERVICE_ID || '',
    apiKey: import.meta.env.VITE_PLANETKIT_EVAL_API_KEY || '',
    apiSecret: import.meta.env.VITE_PLANETKIT_EVAL_API_SECRET || '',
    userId: '', // LINE 프로필에서 자동으로 설정됨
    displayName: '', // LINE 프로필에서 자동으로 설정됨
    roomId: '', // 사용자가 선택하도록 빈 값으로 시작
    accessToken: '',
    environment: '' // 사용자가 선택하도록 빈 값으로 시작
  });

  const [planetKitConfig, setPlanetKitConfig] = useState<PlanetKitConfig>(
    getDefaultPlanetKitConfig()
  );

  // localStorage에서 설정 복원
  useEffect(() => {
    const savedPlanetKitConfig = localStorage.getItem('planetKitConfig');
    const savedSDK = localStorage.getItem('selectedSDK');

    if (savedPlanetKitConfig) {
      try {
        const saved = JSON.parse(savedPlanetKitConfig);
        // 환경 변수에서 로드한 값과 병합 (환경 변수 우선)
        setPlanetKitConfig(prev => ({
          ...prev,
          // Service ID, API Key, API Secret은 환경 변수 우선
          serviceId: prev.serviceId || saved.serviceId,
          apiKey: prev.apiKey || saved.apiKey,
          apiSecret: prev.apiSecret || saved.apiSecret,
          // userId와 displayName 복원 (나머지는 사용자가 선택)
          userId: saved.userId || prev.userId,
          displayName: saved.displayName || prev.displayName,
          // environment와 roomId는 항상 빈 값으로 시작 (사용자가 선택해야 함)
          environment: '',
          roomId: '',
          // accessToken은 복원하지 않음 (매번 새로 생성 필요)
          accessToken: ''
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
    localStorage.setItem('planetKitConfig', JSON.stringify(planetKitConfig));
  }, [planetKitConfig]);

  useEffect(() => {
    localStorage.setItem('selectedSDK', selectedSDK);
  }, [selectedSDK]);

  // 설정이 완료되었는지 확인
  const isConfigured = !!(
    planetKitConfig.serviceId &&
    planetKitConfig.apiKey &&
    planetKitConfig.userId &&
    planetKitConfig.accessToken
  );

  const value = {
    selectedSDK,
    setSelectedSDK,
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
