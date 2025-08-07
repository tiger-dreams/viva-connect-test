import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Key, Shield, Users, Video, Globe } from "lucide-react";
import { LiveKitConfig } from "@/types/video-sdk";
import { generateLiveKitToken, getTokenExpiration } from "@/utils/token-generator";
import { useToast } from "@/hooks/use-toast";

interface LiveKitConfigPanelProps {
  config: LiveKitConfig;
  onConfigChange: (config: LiveKitConfig) => void;
}

export const LiveKitConfigPanel = ({ config, onConfigChange }: LiveKitConfigPanelProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handleInputChange = (field: keyof LiveKitConfig, value: string) => {
    onConfigChange({ ...config, [field]: value });
  };

  const generateToken = async () => {
    if (!config.apiKey || !config.apiSecret || !config.roomName || !config.participantName) {
      toast({
        title: "설정 오류",
        description: "API Key, API Secret, Room Name, Participant Name을 모두 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const token = await generateLiveKitToken(
        config.apiKey,
        config.apiSecret,
        config.roomName,
        config.participantName
      );
      
      handleInputChange("token", token);
      toast({
        title: "토큰 생성 완료",
        description: "LiveKit 토큰이 성공적으로 생성되었습니다.",
      });
    } catch (error) {
      toast({
        title: "토큰 생성 실패",
        description: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "복사 완료",
      description: `${label}이(가) 클립보드에 복사되었습니다.`,
    });
  };

  const clearToken = () => {
    onConfigChange({ ...config, token: undefined });
    toast({
      title: "토큰 초기화",
      description: "토큰이 삭제되었습니다.",
    });
  };

  const tokenExpiration = config.token ? getTokenExpiration(config.token) : null;

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-600/20 rounded-lg flex items-center justify-center">
            <Video className="w-4 h-4 text-green-600" />
          </div>
          LiveKit 설정
        </CardTitle>
        <CardDescription>
          LiveKit 서버 연결을 위한 설정을 입력하세요
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <Label htmlFor="serverUrl">Server URL</Label>
            <div className="relative">
              <Globe className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="serverUrl"
                placeholder="wss://your-livekit-server.com"
                value={config.serverUrl}
                onChange={(e) => handleInputChange("serverUrl", e.target.value)}
                className="pl-10"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              LiveKit 서버 URL (예: wss://localhost:7880 또는 클라우드 URL)
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <div className="relative">
              <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="apiKey"
                placeholder="API Key"
                value={config.apiKey}
                onChange={(e) => handleInputChange("apiKey", e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="apiSecret">API Secret</Label>
            <div className="relative">
              <Shield className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="apiSecret"
                type="password"
                placeholder="API Secret"
                value={config.apiSecret}
                onChange={(e) => handleInputChange("apiSecret", e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="roomName">Room Name</Label>
            <div className="relative">
              <Users className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="roomName"
                placeholder="my-room"
                value={config.roomName}
                onChange={(e) => handleInputChange("roomName", e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="participantName">Participant Name</Label>
            <Input
              id="participantName"
              placeholder="참가자 이름"
              value={config.participantName}
              onChange={(e) => handleInputChange("participantName", e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">토큰 생성</h4>
            <p className="text-xs text-muted-foreground">
              토큰은 자동으로 1시간 유효
            </p>
          </div>

          <Button
            onClick={generateToken}
            disabled={isGenerating}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
          >
            {isGenerating ? "토큰 생성 중..." : "LiveKit 토큰 생성"}
          </Button>
        </div>

        {config.token && (
          <div className="space-y-2 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <Label htmlFor="token">생성된 토큰</Label>
              <div className="flex items-center gap-2">
                {tokenExpiration && (
                  <Badge variant="outline" className="text-xs">
                    만료: {tokenExpiration.toLocaleString()}
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(config.token!, "토큰")}
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearToken}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  ×
                </Button>
              </div>
            </div>
            <div className="relative">
              <Input
                id="token"
                value={config.token}
                readOnly
                className="font-mono text-xs"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              이 토큰으로 LiveKit 룸에 연결할 수 있습니다.
            </p>
          </div>
        )}

        <div className="bg-muted/20 rounded-lg p-3 text-xs">
          <h5 className="font-medium mb-1">💡 LiveKit 서버 설정</h5>
          <ul className="space-y-1 text-muted-foreground">
            <li>• 로컬 테스트: <code>wss://localhost:7880</code></li>
            <li>• LiveKit Cloud: <code>wss://your-project.livekit.cloud</code></li>
            <li>• 자체 호스팅: 본인의 LiveKit 서버 URL</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};