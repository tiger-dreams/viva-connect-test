import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Copy, Key, Shield, Users, Video } from "lucide-react";
import { AgoraConfig } from "@/types/video-sdk";
import { generateAgoraToken, getTokenExpiration } from "@/utils/token-generator";
import { useToast } from "@/hooks/use-toast";

interface AgoraConfigPanelProps {
  config: AgoraConfig;
  onConfigChange: (config: AgoraConfig) => void;
}

export const AgoraConfigPanel = ({ config, onConfigChange }: AgoraConfigPanelProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [expirationTime, setExpirationTime] = useState("3600");
  const [role, setRole] = useState<"publisher" | "subscriber">("publisher");
  const { toast } = useToast();

  const handleInputChange = (field: keyof AgoraConfig, value: string) => {
    onConfigChange({ ...config, [field]: value });
  };

  const generateToken = async () => {
    if (!config.appId || !config.appCertificate || !config.channelName) {
      toast({
        title: "설정 오류",
        description: "App ID, App Certificate, Channel Name을 모두 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const token = generateAgoraToken(
        config.appId,
        config.appCertificate,
        config.channelName,
        config.uid || "0",
        role,
        parseInt(expirationTime)
      );
      
      handleInputChange("token", token);
      toast({
        title: "토큰 생성 완료",
        description: "Agora 토큰이 성공적으로 생성되었습니다.",
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
    <Card className="bg-gradient-card border-border shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="w-8 h-8 bg-agora-primary/20 rounded-lg flex items-center justify-center">
            <Video className="w-4 h-4 text-agora-primary" />
          </div>
          Agora 설정
        </CardTitle>
        <CardDescription>
          Agora Web SDK 연결을 위한 설정을 입력하세요
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="appId">App ID</Label>
            <div className="relative">
              <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="appId"
                placeholder="Agora App ID"
                value={config.appId}
                onChange={(e) => handleInputChange("appId", e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="appCertificate">App Certificate</Label>
            <div className="relative">
              <Shield className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="appCertificate"
                type="password"
                placeholder="App Certificate"
                value={config.appCertificate}
                onChange={(e) => handleInputChange("appCertificate", e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="channelName">Channel Name</Label>
            <div className="relative">
              <Users className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="channelName"
                placeholder="test-channel"
                value={config.channelName}
                onChange={(e) => handleInputChange("channelName", e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="uid">User ID</Label>
            <Input
              id="uid"
              placeholder="0 (자동 할당)"
              value={config.uid}
              onChange={(e) => handleInputChange("uid", e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-border">
          <h4 className="font-semibold text-sm">토큰 생성</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="role">역할</Label>
              <Select value={role} onValueChange={(value) => setRole(value as "publisher" | "subscriber")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="publisher">Publisher (송신)</SelectItem>
                  <SelectItem value="subscriber">Subscriber (수신)</SelectItem>
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
            className="w-full bg-agora-primary hover:bg-agora-primary/90"
          >
            {isGenerating ? "토큰 생성 중..." : "Agora 토큰 생성"}
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