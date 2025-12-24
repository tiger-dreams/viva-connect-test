import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'ko' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider = ({ children }: LanguageProviderProps) => {
  // 브라우저 언어 감지: 한국어면 'ko', 그 외에는 'en'
  const getDefaultLanguage = (): Language => {
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage === 'ko' || savedLanguage === 'en') {
      return savedLanguage as Language;
    }

    // 브라우저 언어 감지
    const browserLang = navigator.language.toLowerCase();
    return browserLang.startsWith('ko') ? 'ko' : 'en';
  };

  const [language, setLanguage] = useState<Language>(getDefaultLanguage());

  // 언어 변경 시 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  const value = {
    language,
    setLanguage,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
