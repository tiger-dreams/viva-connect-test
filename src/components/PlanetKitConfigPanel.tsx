import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Copy, Key, Users, Hash, Trash2, Eye, EyeOff, Lock, Server, Globe } from "lucide-react";
import { PlanetKitConfig } from "@/types/video-sdk";
import { useToast } from "@/hooks/use-toast";
import { generatePlanetKitToken } from "@/utils/token-generator";

interface PlanetKitConfigPanelProps {
  config: PlanetKitConfig;
  onConfigChange: (config: PlanetKitConfig) => void;
}

export const PlanetKitConfigPanel = ({ config, onConfigChange }: PlanetKitConfigPanelProps) => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // 환경 변경 시 Service ID, API Key, API Secret 자동 업데이트
  useEffect(() => {
    if (config.environment === 'eval') {
      onConfigChange({
        ...config,
        serviceId: import.meta.env.VITE_PLANETKIT_EVAL_SERVICE_ID || config.serviceId,
        apiKey: import.meta.env.VITE_PLANETKIT_EVAL_API_KEY || config.apiKey,
        apiSecret: import.meta.env.VITE_PLANETKIT_EVAL_API_SECRET || config.apiSecret,
      });
    } else if (config.environment === 'real') {
      onConfigChange({
        ...config,
        serviceId: import.meta.env.VITE_PLANETKIT_REAL_SERVICE_ID || config.serviceId,
        apiKey: import.meta.env.VITE_PLANETKIT_REAL_API_KEY || config.apiKey,
        apiSecret: import.meta.env.VITE_PLANETKIT_REAL_API_SECRET || config.apiSecret,
      });
    }
  }, [config.environment]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "복사 완료",
      description: `${label}이(가) 클립보드에 복사되었습니다.`,
    });
  };

  const clearAccessToken = () => {
    onConfigChange({ ...config, accessToken: "" });
    toast({
      title: "토큰 삭제",
      description: "Access Token이 삭제되었습니다.",
    });
  };

  const generateAccessToken = async () => {
    if (!config.environment) {
      toast({
        title: "환경 선택 필요",
        description: "Evaluation 또는 Real 환경을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (!config.roomId) {
      toast({
        title: "Room 선택 필요",
        description: "참여할 Room을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (!config.serviceId || !config.apiKey || !config.userId) {
      toast({
        title: "필수 정보 누락",
        description: "Service ID, API Key, User ID를 모두 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (config.environment === 'real' && !config.apiSecret) {
      toast({
        title: "필수 정보 누락",
        description: "Real 환경에서는 API Secret이 필요합니다.",
        variant: "destructive",
      });
      return;
    }

    if (config.apiKey.includes('.') || config.apiKey.length > 120) {
      toast({
        title: "API Key 형식 확인 필요",
        description: "입력한 API Key가 JWT/토큰처럼 보입니다. LINE Planet Console의 API Key(공개 키)를 입력했는지 확인해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const token = await generatePlanetKitToken(
        config.serviceId,
        config.apiKey,
        config.userId,
        config.roomId,
        3600, // 1시간 유효 (사용되지 않음)
        config.apiSecret || undefined // API Secret 전달
      );
      
      onConfigChange({ ...config, accessToken: token });
      
      toast({
        title: "토큰 생성 완료",
        description: "PlanetKit Access Token이 생성되었습니다.",
      });
    } catch (error) {
      console.error("토큰 생성 실패:", error);
      toast({
        title: "토큰 생성 실패",
        description: error instanceof Error ? error.message : "Access Token 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center">
            <Key className="w-4 h-4 text-blue-600" />
          </div>
          PlanetKit 설정
        </CardTitle>
        <CardDescription>
          LINE Planet PlanetKit Web SDK로 화상회의 설정을 구성합니다
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Environment Selection */}
        <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border">
          <Label className="flex items-center gap-2 text-base font-semibold">
            <Server className="w-4 h-4" />
            환경 선택
          </Label>
          <RadioGroup
            value={config.environment}
            onValueChange={(value: 'eval' | 'real') => onConfigChange({ ...config, environment: value })}
            className="grid grid-cols-2 gap-3"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="eval" id="env-eval" />
              <Label htmlFor="env-eval" className="flex-1 cursor-pointer">
                <div className="flex flex-col">
                  <span className="font-medium">Evaluation</span>
                  <span className="text-xs text-muted-foreground">테스트 환경 (-rc)</span>
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
          {config.environment && (
            <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950 p-2 rounded border border-blue-200 dark:border-blue-800">
              <p className="text-blue-800 dark:text-blue-200">
                {config.environment === 'eval'
                  ? '📍 Evaluation 환경: voipnx-saturn.line-apps-rc.com (WebSocket이 제한될 수 있음)'
                  : '📍 Real 환경: voipnx-saturn.line-apps.com (안정적인 연결)'}
              </p>
            </div>
          )}
          {!config.environment && (
            <div className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950 p-2 rounded border border-amber-200 dark:border-amber-800">
              <p className="text-amber-800 dark:text-amber-200">
                ⚠️ 환경을 선택해주세요
              </p>
            </div>
          )}
        </div>

        <Separator />

        {/* Service ID */}
        <div className="space-y-2">
          <Label htmlFor="serviceId" className="flex items-center gap-2">
            <Hash className="w-4 h-4" />
            Service ID
          </Label>
          <Input
            id="serviceId"
            placeholder="PlanetKit Service ID를 입력하세요"
            value={config.serviceId}
            onChange={(e) => onConfigChange({ ...config, serviceId: e.target.value })}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            LINE Planet 콘솔에서 발급받은 Service ID입니다.
          </p>
        </div>

        {/* API Key */}
        <div className="space-y-2">
          <Label htmlFor="apiKey" className="flex items-center gap-2">
            <Lock className="w-4 h-4" />
            API Key
          </Label>
          <div className="relative">
            <Input
              id="apiKey"
              type={showApiKey ? "text" : "password"}
              placeholder="LINE Planet API Key를 입력하세요"
              value={config.apiKey}
              onChange={(e) => onConfigChange({ ...config, apiKey: e.target.value })}
              className="font-mono pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1 h-8 w-8 p-0"
              onClick={() => setShowApiKey(!showApiKey)}
            >
              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            LINE Planet 콘솔에서 발급받은 API Key입니다. (공개 키)
          </p>
        </div>

        {/* API Secret */}
        <div className="space-y-2">
          <Label htmlFor="apiSecret" className="flex items-center gap-2">
            <Key className="w-4 h-4" />
            API Secret
          </Label>
          <div className="relative">
            <Input
              id="apiSecret"
              type="password"
              placeholder="LINE Planet API Secret을 입력하세요"
              value={config.apiSecret}
              onChange={(e) => onConfigChange({ ...config, apiSecret: e.target.value })}
              className="font-mono"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            LINE Planet 콘솔에서 발급받은 API Secret입니다. (비밀 키 - Access Token 서명용)
          </p>
        </div>

        {/* User ID */}
        <div className="space-y-2">
          <Label htmlFor="userId" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            User ID
          </Label>
          <Input
            id="userId"
            placeholder="사용자 ID를 입력하세요"
            value={config.userId}
            onChange={(e) => onConfigChange({ ...config, userId: e.target.value })}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            통화에 참여할 사용자의 고유 ID입니다.
          </p>
        </div>

        {/* Display Name */}
        <div className="space-y-2">
          <Label htmlFor="displayName" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Display Name
          </Label>
          <Input
            id="displayName"
            placeholder="표시 이름을 입력하세요"
            value={config.displayName || ""}
            onChange={(e) => onConfigChange({ ...config, displayName: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            다른 참가자에게 표시될 이름입니다. (LINE 프로필 이름이 자동 설정됨)
          </p>
        </div>

        {/* Room Selection */}
        <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border">
          <Label className="flex items-center gap-2 text-base font-semibold">
            <Globe className="w-4 h-4" />
            Room 선택
          </Label>
          <RadioGroup
            value={config.roomId}
            onValueChange={(value) => onConfigChange({ ...config, roomId: value })}
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
          <p className="text-xs text-muted-foreground">
            같은 Room을 선택한 사용자들과 화상회의를 진행할 수 있습니다.
          </p>
        </div>

        <Separator className="my-4" />

        {/* Access Token 생성 */}
        <div className="space-y-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Access Token 관리</h4>
            <p className="text-xs text-muted-foreground">통화 인증용</p>
          </div>

          <Button
            onClick={generateAccessToken}
            disabled={isGenerating}
            className="w-full bg-blue-600 hover:bg-blue-600/90 text-white"
          >
            {isGenerating ? "토큰 생성 중..." : "Access Token 생성"}
          </Button>

          <div className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950 p-3 rounded-md border border-amber-200 dark:border-amber-800">
            <p className="font-medium text-amber-800 dark:text-amber-200">⚠️ 보안 경고</p>
            <p className="mt-1 text-amber-700 dark:text-amber-300">
              <strong>API Secret은 반드시 서버에서만 사용해야 합니다!</strong><br/>
              클라이언트(브라우저)에 API Secret을 노출하면 보안 위험이 있습니다.
            </p>
            <p className="mt-2 text-amber-700 dark:text-amber-300">
              <strong>프로덕션 환경에서는:</strong>
            </p>
            <ul className="mt-1 text-amber-700 dark:text-amber-300 list-disc list-inside space-y-1">
              <li>서버에서 Access Token을 생성하세요</li>
              <li>클라이언트는 서버 API를 통해 토큰을 받아야 합니다</li>
              <li>LINE Planet Console에서 도메인 CORS 설정이 필요합니다</li>
            </ul>
            <p className="mt-2 text-amber-700 dark:text-amber-300 text-xs">
              💡 개발 모드: Service ID에 'planetkit' 또는 'dev'가 포함되면 모의 연결로 동작합니다.
            </p>
          </div>
        </div>

        {/* 생성된 Access Token */}
        {config.accessToken && (
          <div className="space-y-2 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <Label htmlFor="accessToken">생성된 Access Token</Label>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs bg-green-500/20 text-green-600">
                  활성
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAccessToken(!showAccessToken)}
                >
                  {showAccessToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(config.accessToken, "Access Token")}
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAccessToken}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div className="relative">
              <Input
                id="accessToken"
                value={showAccessToken ? config.accessToken : config.accessToken.replace(/./g, '•')}
                readOnly
                className="font-mono text-xs"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              이 토큰으로 PlanetKit 화상회의에 참여할 수 있습니다.
            </p>
          </div>
        )}

        {/* 설정 요약 */}
        <div className="mt-6 p-3 bg-muted/20 rounded-md">
          <h4 className="font-semibold text-sm mb-2">설정 요약</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">환경:</span>
              <span className="font-mono font-semibold">
                {config.environment === 'eval' ? 'Evaluation' : config.environment === 'real' ? 'Real' : '미선택'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Room:</span>
              <span className="font-mono font-semibold">
                {config.roomId ? config.roomId.charAt(0).toUpperCase() + config.roomId.slice(1) : '미선택'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Service ID:</span>
              <span className="font-mono">{config.serviceId || "미설정"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">API Key:</span>
              <span className="font-mono">{config.apiKey ? "설정됨" : "미설정"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">API Secret:</span>
              <span className="font-mono">{config.apiSecret ? "설정됨" : "미설정"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">User ID:</span>
              <span className="font-mono">{config.userId || "미설정"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Display Name:</span>
              <span className="font-mono">{config.displayName || "미설정"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Token:</span>
              <span className="font-mono">{config.accessToken ? "설정됨" : "미설정"}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};