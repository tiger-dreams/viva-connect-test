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

const SetupPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isLoggedIn, isInitialized, needsLiffId, liffId, profile, error: liffError, login, initializeLiff } = useLiff();
  const { planetKitConfig, setPlanetKitConfig, isConfigured } = useVideoSDK();
  const [liffIdInput, setLiffIdInput] = useState('');

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
        title: "환경 선택 필요",
        description: "Evaluation 또는 Real 환경을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (!planetKitConfig.roomId) {
      toast({
        title: "Room 선택 필요",
        description: "참여할 Room을 선택해주세요.",
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
        title: "설정 누락",
        description: `다음 항목이 누락되었습니다: ${missing.join(', ')}`,
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
        title: "토큰 생성 완료",
        description: "이제 화상회의에 참여할 수 있습니다.",
      });
    } catch (error) {
      console.error('토큰 생성 실패:', error);
      toast({
        title: "토큰 생성 실패",
        description: error instanceof Error ? error.message : "토큰 생성 중 오류가 발생했습니다.",
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
          title: "LIFF ID 입력 필요",
          description: "LIFF ID를 입력해주세요.",
          variant: "destructive",
        });
        return;
      }

      try {
        await initializeLiff(liffIdInput.trim());
        toast({
          title: "LIFF 초기화 성공",
          description: "LIFF가 성공적으로 초기화되었습니다.",
        });
      } catch (error) {
        toast({
          title: "LIFF 초기화 실패",
          description: error instanceof Error ? error.message : "LIFF 초기화에 실패했습니다.",
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
            <CardTitle>LIFF 설정</CardTitle>
            <CardDescription>
              LINE LIFF ID를 입력하여 앱을 시작하세요
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="liffId">LIFF ID</Label>
              <Input
                id="liffId"
                value={liffIdInput}
                onChange={(e) => setLiffIdInput(e.target.value)}
                placeholder="예: 2008742005-3DHkWzkg"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                LINE Developers Console에서 발급받은 LIFF ID를 입력하세요.
              </p>
            </div>
            <Button onClick={handleLiffIdSubmit} className="w-full h-12 text-lg" size="lg">
              초기화
            </Button>
            <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950 p-3 rounded border border-blue-200 dark:border-blue-800">
              <p className="text-blue-800 dark:text-blue-200 font-medium mb-2">
                💡 환경 변수로 설정하기 (권장)
              </p>
              <p className="text-blue-700 dark:text-blue-300">
                Vercel 환경 변수에 <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">VITE_LIFF_ID</code>를 추가하면 자동으로 로드됩니다.
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
              <p className="text-muted-foreground">LIFF 초기화 중...</p>
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
            <CardTitle className="text-destructive">초기화 실패</CardTitle>
            <CardDescription>{liffError}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              LIFF 초기화에 실패했습니다. .env 파일에 VITE_LIFF_ID가 올바르게 설정되어 있는지 확인해주세요.
            </p>
            <Button onClick={() => window.location.reload()} className="w-full">
              다시 시도
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
            <CardTitle>LINE 로그인</CardTitle>
            <CardDescription>
              화상회의에 참여하려면 LINE 로그인이 필요합니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={login} className="w-full h-12 text-lg" size="lg">
              <LogIn className="w-5 h-5 mr-2" />
              LINE으로 로그인
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-primary">
                Planet VoIP Room
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                LINE Planet PlanetKit 화상회의
              </p>
            </div>
            <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30">
              <Activity className="w-3 h-3 mr-1" />
              LIFF
            </Badge>
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
                환경 선택
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
                      <span className="font-medium">Evaluation</span>
                      <span className="text-xs text-muted-foreground">테스트 환경</span>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="real" id="env-real" />
                  <Label htmlFor="env-real" className="flex-1 cursor-pointer">
                    <div className="flex flex-col">
                      <span className="font-medium">Real</span>
                      <span className="text-xs text-muted-foreground">프로덕션 환경</span>
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
                    ⚠️ 환경을 선택해주세요
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
                Room 선택
              </CardTitle>
              <CardDescription className="text-xs">
                같은 Room을 선택한 사용자들과 화상회의를 진행할 수 있습니다
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
                      <span className="font-medium">🇯🇵 Japan</span>
                      <span className="text-xs text-muted-foreground">일본 룸</span>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="korea" id="room-korea" />
                  <Label htmlFor="room-korea" className="flex-1 cursor-pointer">
                    <div className="flex flex-col">
                      <span className="font-medium">🇰🇷 Korea</span>
                      <span className="text-xs text-muted-foreground">한국 룸</span>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="taiwan" id="room-taiwan" />
                  <Label htmlFor="room-taiwan" className="flex-1 cursor-pointer">
                    <div className="flex flex-col">
                      <span className="font-medium">🇹🇼 Taiwan</span>
                      <span className="text-xs text-muted-foreground">대만 룸</span>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="thailand" id="room-thailand" />
                  <Label htmlFor="room-thailand" className="flex-1 cursor-pointer">
                    <div className="flex flex-col">
                      <span className="font-medium">🇹🇭 Thailand</span>
                      <span className="text-xs text-muted-foreground">태국 룸</span>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
              {!planetKitConfig.roomId && (
                <div className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950 p-2 rounded border border-amber-200 dark:border-amber-800">
                  <p className="text-amber-800 dark:text-amber-200">
                    ⚠️ Room을 선택해주세요
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 설정 요약 */}
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-sm">설정 요약</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">환경:</span>
                  <span className="font-mono font-semibold">
                    {planetKitConfig.environment === 'eval' ? 'Evaluation' : planetKitConfig.environment === 'real' ? 'Real' : '미선택'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Room:</span>
                  <span className="font-mono font-semibold">
                    {planetKitConfig.roomId ? planetKitConfig.roomId.charAt(0).toUpperCase() + planetKitConfig.roomId.slice(1) : '미선택'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service ID:</span>
                  <span className="font-mono text-xs">{planetKitConfig.serviceId ? '설정됨' : '미설정'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">User ID:</span>
                  <span className="font-mono text-xs">{planetKitConfig.userId ? '설정됨' : '미설정'}</span>
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
              Access Token 생성
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                <span className="text-sm text-green-800 dark:text-green-200">✓ 토큰 생성 완료</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPlanetKitConfig({ ...planetKitConfig, accessToken: '' })}
                >
                  재생성
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
                화상회의 참여하기
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
