import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import liff from '@line/liff';

interface LiffContextType {
  isLoggedIn: boolean;
  isInClient: boolean;
  isInitialized: boolean;
  profile: {
    userId: string;
    displayName: string;
    pictureUrl?: string;
    statusMessage?: string;
  } | null;
  error: string | null;
  login: () => Promise<void>;
  logout: () => void;
}

const LiffContext = createContext<LiffContextType | undefined>(undefined);

interface LiffProviderProps {
  children: ReactNode;
}

export const LiffProvider = ({ children }: LiffProviderProps) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isInClient, setIsInClient] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [profile, setProfile] = useState<LiffContextType['profile']>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initLiff = async () => {
      const liffId = import.meta.env.VITE_LIFF_ID;

      if (!liffId) {
        setError('LIFF ID가 설정되지 않았습니다. .env 파일에 VITE_LIFF_ID를 설정해주세요.');
        setIsInitialized(true);
        return;
      }

      try {
        console.log('LIFF 초기화 시작:', liffId);
        await liff.init({ liffId });

        setIsInClient(liff.isInClient());
        setIsInitialized(true);

        // 이미 로그인되어 있는지 확인
        if (liff.isLoggedIn()) {
          console.log('✅ 이미 LIFF에 로그인되어 있습니다');
          setIsLoggedIn(true);

          // 프로필 가져오기
          const userProfile = await liff.getProfile();
          console.log('LINE 사용자 프로필:', userProfile);
          setProfile({
            userId: userProfile.userId,
            displayName: userProfile.displayName,
            pictureUrl: userProfile.pictureUrl,
            statusMessage: userProfile.statusMessage
          });
        } else {
          console.log('❌ LIFF에 로그인되어 있지 않습니다');
        }
      } catch (err) {
        console.error('LIFF 초기화 실패:', err);
        setError(err instanceof Error ? err.message : 'LIFF 초기화 실패');
        setIsInitialized(true);
      }
    };

    initLiff();
  }, []);

  const login = async () => {
    if (!liff.isLoggedIn()) {
      liff.login();
    }
  };

  const logout = () => {
    if (liff.isLoggedIn()) {
      liff.logout();
      setIsLoggedIn(false);
      setProfile(null);
      // 페이지 새로고침
      window.location.reload();
    }
  };

  const value = {
    isLoggedIn,
    isInClient,
    isInitialized,
    profile,
    error,
    login,
    logout
  };

  return (
    <LiffContext.Provider value={value}>
      {children}
    </LiffContext.Provider>
  );
};

export const useLiff = () => {
  const context = useContext(LiffContext);
  if (context === undefined) {
    throw new Error('useLiff must be used within a LiffProvider');
  }
  return context;
};
