import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Activity, LogIn, User, Video, Server, Hash, Settings, Globe } from "lucide-react";
import { useVideoSDK } from "@/contexts/VideoSDKContext";
import { useLiff } from "@/contexts/LiffContext";
import { useToast } from "@/hooks/use-toast";
import { generatePlanetKitToken } from "@/utils/token-generator";
import { useLanguage } from "@/contexts/LanguageContext";
import { getTranslations } from "@/utils/translations";
import { LanguageSelector } from "@/components/LanguageSelector";

const SetupPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { language } = useLanguage();
  const t = getTranslations(language);
  const { isLoggedIn, isInitialized, needsLiffId, liffId, profile, error: liffError, login, initializeLiff } = useLiff();
  const { planetKitConfig, setPlanetKitConfig, isConfigured } = useVideoSDK();
  const [liffIdInput, setLiffIdInput] = useState('');

  // 페이지 타이틀 업데이트
  useEffect(() => {
    document.title = language === 'ko' ? 'WebPlanet SDK 테스트' : 'WebPlanet SDK Test';
  }, [language]);

  // LIFF 로그인 후 자동으로 User ID와 Display Name 설정
  useEffect(() => {
    if (isLoggedIn && profile && !planetKitConfig.userId) {
      console.log('LINE 프로필로 User ID 및 Display Name 자동 설정:', {
        userId: profile.userId,
        displayName: profile.displayName
      });
      setPlanetKitConfig({
        ...planetKitConfig,
        userId: profile.userId,
        displayName: profile.displayName
      });
    }
  }, [isLoggedIn, profile, planetKitConfig.userId]);

  const handleGenerateToken = async () => {
    // 디버깅: 현재 설정 상태 출력
    console.log('토큰 생성 시도:', {
      serviceId: planetKitConfig.serviceId,
      apiKey: planetKitConfig.apiKey ? '설정됨' : '누락',
      apiSecret: planetKitConfig.apiSecret ? '설정됨' : '누락',
      userId: planetKitConfig.userId,
      roomId: planetKitConfig.roomId,
      environment: planetKitConfig.environment
    });

    if (!planetKitConfig.environment) {
      toast({
        title: language === 'ko' ? "환경 선택 필요" : "Environment Required",
        description: language === 'ko' ? "Evaluation 또는 Real 환경을 선택해주세요." : "Please select Evaluation or Real environment.",
        variant: "destructive",
      });
      return;
    }

    if (!planetKitConfig.roomId) {
      toast({
        title: language === 'ko' ? "Room 선택 필요" : "Room Required",
        description: language === 'ko' ? "참여할 Room을 선택해주세요." : "Please select a room to join.",
        variant: "destructive",
      });
      return;
    }

    if (!planetKitConfig.serviceId || !planetKitConfig.apiKey || !planetKitConfig.userId) {
      const missing = [];
      if (!planetKitConfig.serviceId) missing.push('Service ID');
      if (!planetKitConfig.apiKey) missing.push('API Key');
      if (!planetKitConfig.userId) missing.push('User ID');

      toast({
        title: language === 'ko' ? "설정 누락" : "Configuration Missing",
        description: language === 'ko' ? `다음 항목이 누락되었습니다: ${missing.join(', ')}` : `Missing items: ${missing.join(', ')}`,
        variant: "destructive",
      });
      return;
    }

    try {
      const token = await generatePlanetKitToken(
        planetKitConfig.serviceId,
        planetKitConfig.apiKey,
        planetKitConfig.userId,
        planetKitConfig.roomId,
        3600,
        planetKitConfig.apiSecret
      );

      setPlanetKitConfig({
        ...planetKitConfig,
        accessToken: token
      });

      toast({
        title: t.tokenGeneratedSuccess,
        description: language === 'ko' ? "이제 화상회의에 참여할 수 있습니다." : "You can now join the meeting.",
      });
    } catch (error) {
      console.error('토큰 생성 실패:', error);
      toast({
        title: t.tokenGenerationFailed,
        description: error instanceof Error ? error.message : (language === 'ko' ? "토큰 생성 중 오류가 발생했습니다." : "An error occurred while generating the token."),
        variant: "destructive",
      });
    }
  };

  const handleJoinMeeting = () => {
    if (isConfigured) {
      navigate('/planetkit_meeting');
    }
  };

  // LIFF ID 입력 필요
  if (needsLiffId) {
    const handleLiffIdSubmit = async () => {
      if (!liffIdInput.trim()) {
        toast({
          title: language === 'ko' ? "LIFF ID 입력 필요" : "LIFF ID Required",
          description: language === 'ko' ? "LIFF ID를 입력해주세요." : "Please enter a LIFF ID.",
          variant: "destructive",
        });
        return;
      }

      try {
        await initializeLiff(liffIdInput.trim());
        toast({
          title: language === 'ko' ? "LIFF 초기화 성공" : "LIFF Initialized",
          description: language === 'ko' ? "LIFF가 성공적으로 초기화되었습니다." : "LIFF has been successfully initialized.",
        });
      } catch (error) {
        toast({
          title: language === 'ko' ? "LIFF 초기화 실패" : "LIFF Initialization Failed",
          description: error instanceof Error ? error.message : (language === 'ko' ? "LIFF 초기화에 실패했습니다." : "Failed to initialize LIFF."),
          variant: "destructive",
        });
      }
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Settings className="w-8 h-8 text-primary" />
            </div>
            <CardTitle>{language === 'ko' ? 'LIFF 설정' : 'LIFF Setup'}</CardTitle>
            <CardDescription>
              {language === 'ko' ? 'LINE LIFF ID를 입력하여 앱을 시작하세요' : 'Enter LINE LIFF ID to start the app'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="liffId">LIFF ID</Label>
              <Input
                id="liffId"
                value={liffIdInput}
                onChange={(e) => setLiffIdInput(e.target.value)}
                placeholder={language === 'ko' ? '예: 2008742005-3DHkWzkg' : 'e.g., 2008742005-3DHkWzkg'}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                {language === 'ko' ? 'LINE Developers Console에서 발급받은 LIFF ID를 입력하세요.' : 'Enter the LIFF ID issued from LINE Developers Console.'}
              </p>
            </div>
            <Button onClick={handleLiffIdSubmit} className="w-full h-12 text-lg" size="lg">
              {language === 'ko' ? '초기화' : 'Initialize'}
            </Button>
            <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950 p-3 rounded border border-blue-200 dark:border-blue-800">
              <p className="text-blue-800 dark:text-blue-200 font-medium mb-2">
                💡 {language === 'ko' ? '환경 변수로 설정하기 (권장)' : 'Set via Environment Variable (Recommended)'}
              </p>
              <p className="text-blue-700 dark:text-blue-300">
                {language === 'ko' ? 'Vercel 환경 변수에' : 'Add'} <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">VITE_LIFF_ID</code>{language === 'ko' ? '를 추가하면 자동으로 로드됩니다.' : ' to Vercel environment variables to auto-load.'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // LIFF 초기화 중
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6">
            <div className="text-center">
              <Activity className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
              <p className="text-muted-foreground">{language === 'ko' ? 'LIFF 초기화 중...' : 'Initializing LIFF...'}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // LIFF 에러
  if (liffError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">{language === 'ko' ? '초기화 실패' : 'Initialization Failed'}</CardTitle>
            <CardDescription>{liffError}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {language === 'ko' ? 'LIFF 초기화에 실패했습니다. .env 파일에 VITE_LIFF_ID가 올바르게 설정되어 있는지 확인해주세요.' : 'Failed to initialize LIFF. Please check if VITE_LIFF_ID is correctly set in the .env file.'}
            </p>
            <Button onClick={() => window.location.reload()} className="w-full">
              {language === 'ko' ? '다시 시도' : 'Retry'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // LINE 로그인 필요
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <LogIn className="w-8 h-8 text-primary" />
            </div>
            <CardTitle>{t.liffLogin}</CardTitle>
            <CardDescription>
              {t.liffLoginDescription}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={login} className="w-full h-12 text-lg" size="lg">
              <LogIn className="w-5 h-5 mr-2" />
              {t.loginWithLine}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 메인 설정 화면
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* 헤더 */}
      <div className="border-b border-border bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-primary">
                Planet VoIP Room
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {t.setupDescription}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <LanguageSelector />
              <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30">
                <Activity className="w-3 h-3 mr-1" />
                LIFF
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="space-y-4">
          {/* 사용자 프로필 */}
          {profile && (
            <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  {profile.pictureUrl ? (
                    <img
                      src={profile.pictureUrl}
                      alt={profile.displayName}
                      className="w-16 h-16 rounded-full border-2 border-primary"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                      <User className="w-8 h-8 text-primary" />
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{profile.displayName}</h3>
                    <p className="text-sm text-muted-foreground font-mono">{profile.userId}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 환경 선택 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Server className="w-4 h-4" />
                {t.environment}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <RadioGroup
                value={planetKitConfig.environment}
                onValueChange={(value: 'eval' | 'real') => {
                  // 환경 변경 시 해당 환경의 설정으로 업데이트
                  const newConfig = {
                    ...planetKitConfig,
                    environment: value,
                    serviceId: value === 'eval'
                      ? import.meta.env.VITE_PLANETKIT_EVAL_SERVICE_ID || ''
                      : import.meta.env.VITE_PLANETKIT_REAL_SERVICE_ID || '',
                    apiKey: value === 'eval'
                      ? import.meta.env.VITE_PLANETKIT_EVAL_API_KEY || ''
                      : import.meta.env.VITE_PLANETKIT_REAL_API_KEY || '',
                    apiSecret: value === 'eval'
                      ? import.meta.env.VITE_PLANETKIT_EVAL_API_SECRET || ''
                      : import.meta.env.VITE_PLANETKIT_REAL_API_SECRET || '',
                    accessToken: '' // 환경 변경 시 토큰 초기화
                  };
                  setPlanetKitConfig(newConfig);
                }}
                className="grid grid-cols-2 gap-3"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="eval" id="env-eval" />
                  <Label htmlFor="env-eval" className="flex-1 cursor-pointer">
                    <div className="flex flex-col">
                      <span className="font-medium">{t.evaluationEnv}</span>
                      <span className="text-xs text-muted-foreground">{language === 'ko' ? '테스트 환경' : 'Testing'}</span>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="real" id="env-real" />
                  <Label htmlFor="env-real" className="flex-1 cursor-pointer">
                    <div className="flex flex-col">
                      <span className="font-medium">{t.realEnv}</span>
                      <span className="text-xs text-muted-foreground">{language === 'ko' ? '프로덕션 환경' : 'Production'}</span>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
              {planetKitConfig.environment && (
                <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950 p-2 rounded border border-blue-200 dark:border-blue-800">
                  <p className="text-blue-800 dark:text-blue-200">
                    {planetKitConfig.environment === 'eval'
                      ? '📍 Evaluation: voipnx-saturn.line-apps-rc.com'
                      : '📍 Real: voipnx-saturn.line-apps.com'}
                  </p>
                </div>
              )}
              {!planetKitConfig.environment && (
                <div className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950 p-2 rounded border border-amber-200 dark:border-amber-800">
                  <p className="text-amber-800 dark:text-amber-200">
                    {t.pleaseSelectEnvironment}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Room 선택 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="w-4 h-4" />
                {t.room}
              </CardTitle>
              <CardDescription className="text-xs">
                {t.roomDescription}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <RadioGroup
                value={planetKitConfig.roomId}
                onValueChange={(value) => setPlanetKitConfig({ ...planetKitConfig, roomId: value, accessToken: '' })}
                className="grid grid-cols-2 gap-3"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="japan" id="room-japan" />
                  <Label htmlFor="room-japan" className="flex-1 cursor-pointer">
                    <div className="flex flex-col">
                      <span className="font-medium">🇯🇵 {t.roomJapan}</span>
                      <span className="text-xs text-muted-foreground">{language === 'ko' ? '일본 룸' : 'Japan Room'}</span>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="korea" id="room-korea" />
                  <Label htmlFor="room-korea" className="flex-1 cursor-pointer">
                    <div className="flex flex-col">
                      <span className="font-medium">🇰🇷 {t.roomKorea}</span>
                      <span className="text-xs text-muted-foreground">{language === 'ko' ? '한국 룸' : 'Korea Room'}</span>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="taiwan" id="room-taiwan" />
                  <Label htmlFor="room-taiwan" className="flex-1 cursor-pointer">
                    <div className="flex flex-col">
                      <span className="font-medium">🇹🇼 {t.roomTaiwan}</span>
                      <span className="text-xs text-muted-foreground">{language === 'ko' ? '대만 룸' : 'Taiwan Room'}</span>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="thailand" id="room-thailand" />
                  <Label htmlFor="room-thailand" className="flex-1 cursor-pointer">
                    <div className="flex flex-col">
                      <span className="font-medium">🇹🇭 {t.roomThailand}</span>
                      <span className="text-xs text-muted-foreground">{language === 'ko' ? '태국 룸' : 'Thailand Room'}</span>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
              {!planetKitConfig.roomId && (
                <div className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950 p-2 rounded border border-amber-200 dark:border-amber-800">
                  <p className="text-amber-800 dark:text-amber-200">
                    {t.pleaseSelectRoom}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 설정 요약 */}
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-sm">{t.currentConfig}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t.environment}:</span>
                  <span className="font-mono font-semibold">
                    {planetKitConfig.environment === 'eval' ? 'Evaluation' : planetKitConfig.environment === 'real' ? 'Real' : (language === 'ko' ? '미선택' : 'Not selected')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t.room}:</span>
                  <span className="font-mono font-semibold">
                    {planetKitConfig.roomId ? planetKitConfig.roomId.charAt(0).toUpperCase() + planetKitConfig.roomId.slice(1) : (language === 'ko' ? '미선택' : 'Not selected')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service ID:</span>
                  <span className="font-mono text-xs">{planetKitConfig.serviceId ? (language === 'ko' ? '설정됨' : 'Set') : (language === 'ko' ? '미설정' : 'Not set')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">User ID:</span>
                  <span className="font-mono text-xs">{planetKitConfig.userId ? (language === 'ko' ? '설정됨' : 'Set') : (language === 'ko' ? '미설정' : 'Not set')}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 토큰 생성 */}
          {!planetKitConfig.accessToken ? (
            <Button
              onClick={handleGenerateToken}
              className="w-full h-12 text-base"
              size="lg"
            >
              {t.generateToken}
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                <span className="text-sm text-green-800 dark:text-green-200">✓ {t.tokenGenerated}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPlanetKitConfig({ ...planetKitConfig, accessToken: '' })}
                >
                  {language === 'ko' ? '재생성' : 'Regenerate'}
                </Button>
              </div>

              {/* 참여 버튼 */}
              <Button
                onClick={handleJoinMeeting}
                disabled={!isConfigured}
                className="w-full h-14 text-lg bg-primary hover:bg-primary/90"
                size="lg"
              >
                <Video className="w-5 h-5 mr-2" />
                {t.joinMeeting}
              </Button>
            </div>
          )}

          {/* 안내 메시지 */}
          <div className="text-center text-xs text-muted-foreground">
            <p>
              💡 이 앱은 LINE Planet PlanetKit Web SDK를 사용한 테스트용 LIFF 앱입니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupPage;
