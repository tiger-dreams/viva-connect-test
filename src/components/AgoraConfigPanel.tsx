import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Copy, Key, Shield, Users, Video, X, Crown, User } from "lucide-react";
import { AgoraConfig, ParticipantRole } from "@/types/video-sdk";
import { Checkbox } from "@/components/ui/checkbox";
import { generateAgoraToken, getTokenExpiration } from "@/utils/token-generator";
import { useToast } from "@/hooks/use-toast";

interface AgoraConfigPanelProps {
  config: AgoraConfig;
  onConfigChange: (config: AgoraConfig) => void;
}

export const AgoraConfigPanel = ({ config, onConfigChange }: AgoraConfigPanelProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [expirationTime, setExpirationTime] = useState("3600");
  const [role, setRole] = useState<'publisher' | 'subscriber'>('publisher');
  const { toast } = useToast();

  const handleInputChange = (field: keyof AgoraConfig, value: string) => {
    onConfigChange({ ...config, [field]: value });
  };

  const generateToken = async () => {
    if (!config.appId || !config.channelName) {
      toast({
        title: "필수 정보 누락",
        description: "App ID와 Channel Name을 모두 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    // App Certificate가 없으면 토큰 생성을 건너뛰고 빈 토큰으로 설정
    if (!config.appCertificate) {
      onConfigChange({ ...config, token: "" }); // 빈 토큰으로 설정하여 테스트 모드 활성화
      toast({
        title: "테스트 모드 활성화",
        description: "App Certificate가 없어 테스트 모드로 설정됩니다. 토큰 없이 연결을 시도합니다.",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const token = await generateAgoraToken(
        config.appId,
        config.appCertificate,
        config.channelName,
        config.uid || "0",
        role,
        parseInt(expirationTime),
        config.isHost || false
      );

      onConfigChange({ ...config, token });
      toast({
        title: "토큰 생성 완료",
        description: "Agora 토큰이 성공적으로 생성되었습니다.",
      });
    } catch (error) {
      toast({
        title: "토큰 생성 실패",
        description: error instanceof Error ? error.message : "토큰 생성 중 오류가 발생했습니다.",
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
      description: "토큰이 삭제되었습니다. 이제 App Certificate 없이 연결할 수 있습니다.",
    });
  };

  const tokenExpiration = config.token ? getTokenExpiration(config.token) : null;

  return (
    <Card className="bg-card border-border shadow-sm">
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
                placeholder="Agora App Certificate (선택사항)"
                value={config.appCertificate}
                onChange={(e) => handleInputChange("appCertificate", e.target.value)}
                className="pl-10"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              App Certificate가 비활성화된 경우 비워두세요
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="channelName">Channel Name</Label>
            <div className="relative">
              <Users className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="channelName"
                placeholder="채널 이름"
                value={config.channelName}
                onChange={(e) => handleInputChange("channelName", e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="uid">UID</Label>
            <Input
              id="uid"
              placeholder="사용자 ID (숫자)"
              value={config.uid}
              onChange={(e) => handleInputChange("uid", e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="participantName">참가자 이름</Label>
            <Input
              id="participantName"
              placeholder="화상회의에 표시될 이름"
              value={config.participantName || ""}
              onChange={(e) => handleInputChange("participantName", e.target.value)}
            />
          </div>
        </div>

        {/* 호스트 권한 설정 */}
        <div className="space-y-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Crown className="w-4 h-4 text-yellow-500" />
              참가 권한 설정
            </h4>
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isHost"
                checked={config.isHost || false}
                onCheckedChange={(checked) => {
                  if (checked) {
                    onConfigChange({ 
                      ...config, 
                      isHost: true, 
                      role: ParticipantRole.HOST 
                    });
                  } else {
                    onConfigChange({ 
                      ...config, 
                      isHost: false, 
                      role: ParticipantRole.PARTICIPANT 
                    });
                  }
                }}
              />
              <Label htmlFor="isHost" className="flex items-center gap-2">
                {config.isHost ? <Crown className="w-4 h-4 text-yellow-500" /> : <User className="w-4 h-4" />}
                호스트로 참여
              </Label>
            </div>

            <div className="text-xs text-muted-foreground pl-6">
              {config.isHost ? (
                <div className="space-y-1">
                  <p className="text-yellow-600 font-medium">🎯 호스트 권한:</p>
                  <ul className="space-y-0.5 text-muted-foreground">
                    <li>• 참가자 강제 퇴장 (RTM 메시징)</li>
                    <li>• 참가자 음소거/영상 끄기 제어</li>
                    <li>• 채널 관리 권한</li>
                    <li>• 다른 참가자 역할 변경</li>
                  </ul>
                </div>
              ) : (
                <p>일반 참가자로 입장하며, 기본적인 화상회의 기능만 사용할 수 있습니다.</p>
              )}
            </div>

            {config.isHost && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Shield className="w-4 h-4 text-yellow-600 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                      호스트 모드 주의사항
                    </p>
                    <p className="text-yellow-700 dark:text-yellow-300">
                      호스트 권한으로 생성된 토큰은 참가자 관리 권한을 포함합니다. 
                      RTM 메시징을 통해 실시간 참가자 제어가 가능하지만, 토큰 보안에 주의하세요.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">연결 설정</h4>
            {config.appCertificate ? (
              <p className="text-xs text-muted-foreground">토큰 기반 인증</p>
            ) : (
              <p className="text-xs text-muted-foreground">테스트 모드 (토큰 없음)</p>
            )}
          </div>

          <Button
            onClick={generateToken}
            disabled={isGenerating}
            className="w-full bg-agora-primary hover:bg-agora-primary/90 text-white"
          >
            {isGenerating 
              ? "처리 중..." 
              : config.appCertificate 
                ? "토큰 생성"
                : "테스트 모드로 설정"
            }
          </Button>

          {config.appCertificate && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role">역할</Label>
                  <Select value={role} onValueChange={(value: 'publisher' | 'subscriber') => setRole(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="publisher">Publisher (송신자)</SelectItem>
                      <SelectItem value="subscriber">Subscriber (수신자)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="expiration">만료 시간</Label>
                  <Select value={expirationTime} onValueChange={setExpirationTime}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3600">1시간</SelectItem>
                      <SelectItem value="7200">2시간</SelectItem>
                      <SelectItem value="86400">24시간</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

        {(config.token !== undefined) && (
          <div className="space-y-2 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <Label htmlFor="token">
                {config.token === "" ? "테스트 모드 활성화됨" : "생성된 토큰"}
              </Label>
              <div className="flex items-center gap-2">
                {config.token !== "" && tokenExpiration && (
                  <Badge variant="outline" className="text-xs">
                    만료: {tokenExpiration.toLocaleString()}
                  </Badge>
                )}
                {config.token === "" ? (
                  <Badge variant="outline" className="text-xs bg-green-500/20 text-green-600">
                    App Certificate 없음
                  </Badge>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(config.token!, "토큰")}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearToken}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="relative">
              <Input
                id="token"
                value={config.token === "" ? "테스트 모드: 토큰 없이 연결" : config.token}
                readOnly
                className="font-mono text-xs"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {config.token === "" 
                ? "App Certificate가 없어 토큰 없이 연결합니다."
                : "이 토큰으로 Agora 채널에 연결할 수 있습니다."
              }
            </p>
          </div>
        )}
        </div>
      </CardContent>
    </Card>
  );
};