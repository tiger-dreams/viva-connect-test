import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Copy, Key, Shield, Users, Video } from "lucide-react";
import { ZoomConfig } from "@/types/video-sdk";
import { generateZoomToken, getTokenExpiration } from "@/utils/token-generator";
import { useToast } from "@/hooks/use-toast";

interface ZoomConfigPanelProps {
  config: ZoomConfig;
  onConfigChange: (config: ZoomConfig) => void;
}

export const ZoomConfigPanel = ({ config, onConfigChange }: ZoomConfigPanelProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [expirationTime, setExpirationTime] = useState("3600");
  const [roleType, setRoleType] = useState("1");
  const { toast } = useToast();

  const handleInputChange = (field: keyof ZoomConfig, value: string) => {
    onConfigChange({ ...config, [field]: value });
  };

  const generateToken = async () => {
    if (!config.sdkKey || !config.sdkSecret || !config.sessionName) {
      toast({
        title: "설정 오류",
        description: "SDK Key, SDK Secret, Session Name을 모두 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const token = await generateZoomToken(
        config.sdkKey,
        config.sdkSecret,
        config.sessionName,
        parseInt(roleType),
        parseInt(expirationTime)
      );
      
      handleInputChange("token", token);
      toast({
        title: "토큰 생성 완료",
        description: "Zoom 토큰이 성공적으로 생성되었습니다.",
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

  const tokenExpiration = config.token ? getTokenExpiration(config.token) : null;

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="w-8 h-8 bg-zoom-primary/20 rounded-lg flex items-center justify-center">
            <Video className="w-4 h-4 text-zoom-primary" />
          </div>
          Zoom 설정
        </CardTitle>
        <CardDescription>
          Zoom Video SDK 연결을 위한 설정을 입력하세요
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="sdkKey">SDK Key</Label>
            <div className="relative">
              <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="sdkKey"
                placeholder="Zoom SDK Key"
                value={config.sdkKey}
                onChange={(e) => handleInputChange("sdkKey", e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="sdkSecret">SDK Secret</Label>
            <div className="relative">
              <Shield className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="sdkSecret"
                type="password"
                placeholder="SDK Secret"
                value={config.sdkSecret}
                onChange={(e) => handleInputChange("sdkSecret", e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="sessionName">Session Name</Label>
            <div className="relative">
              <Users className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="sessionName"
                placeholder="test-session"
                value={config.sessionName}
                onChange={(e) => handleInputChange("sessionName", e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="userName">User Name</Label>
            <Input
              id="userName"
              placeholder="사용자 이름"
              value={config.userName}
              onChange={(e) => handleInputChange("userName", e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-border">
          <h4 className="font-semibold text-sm">토큰 생성</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="roleType">역할 타입</Label>
              <Select value={roleType} onValueChange={setRoleType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Host (호스트)</SelectItem>
                  <SelectItem value="0">Attendee (참석자)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="expiration">만료시간 (초)</Label>
              <Select value={expirationTime} onValueChange={setExpirationTime}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3600">1시간</SelectItem>
                  <SelectItem value="7200">2시간</SelectItem>
                  <SelectItem value="86400">24시간</SelectItem>
                  <SelectItem value="604800">1주일</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={generateToken}
            disabled={isGenerating}
            className="w-full bg-zoom-primary hover:bg-zoom-primary/90"
          >
            {isGenerating ? "토큰 생성 중..." : "Zoom 토큰 생성"}
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
              </div>
            </div>
            <div className="relative">
              <Input
                id="token"
                value={config.token}
                readOnly
                className="font-mono text-xs bg-muted pr-12"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};