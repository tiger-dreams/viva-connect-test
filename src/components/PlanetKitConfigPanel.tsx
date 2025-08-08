import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Copy, Key, Users, Hash, Trash2, Eye, EyeOff, Lock } from "lucide-react";
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
    if (!config.serviceId || !config.apiKey || !config.userId) {
      toast({
        title: "필수 정보 누락",
        description: "Service ID, API Key, User ID를 모두 입력해주세요.",
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
        3600 // 1시간 유효
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
            LINE Planet 콘솔에서 발급받은 API Key입니다. Access Token 생성에 필요합니다.
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

        {/* Room ID */}
        <div className="space-y-2">
          <Label htmlFor="roomId" className="flex items-center gap-2">
            <Hash className="w-4 h-4" />
            Room ID
          </Label>
          <Input
            id="roomId"
            placeholder="룸 ID를 입력하세요"
            value={config.roomId}
            onChange={(e) => onConfigChange({ ...config, roomId: e.target.value })}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            참여할 화상회의 룸의 ID입니다.
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
            <p className="font-medium text-amber-800 dark:text-amber-200">⚠️ 개발 모드</p>
            <p className="mt-1 text-amber-700 dark:text-amber-300">
              현재는 임시 토큰을 생성하고 모의 연결로 동작합니다. 
              Service ID가 'planetkit' 또는 'dev'를 포함하면 개발 모드로 실행됩니다.
            </p>
            <p className="mt-2 text-amber-700 dark:text-amber-300">
              실제 LINE Planet 서비스를 사용하려면:
            </p>
            <ul className="mt-1 text-amber-700 dark:text-amber-300 list-disc list-inside space-y-1">
              <li>LINE Planet Console에서 발급받은 실제 Service ID 사용</li>
              <li>서버에서 올바른 Access Token 생성</li>
              <li>CORS 설정 또는 서버 프록시 구성</li>
            </ul>
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
              <span className="text-muted-foreground">Service ID:</span>
              <span className="font-mono">{config.serviceId || "미설정"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">API Key:</span>
              <span className="font-mono">{config.apiKey ? "설정됨" : "미설정"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">User ID:</span>
              <span className="font-mono">{config.userId || "미설정"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Room ID:</span>
              <span className="font-mono">{config.roomId || "미설정"}</span>
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