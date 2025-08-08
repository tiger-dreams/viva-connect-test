import { useNavigate } from "react-router-dom";
import { SDKSelector } from "@/components/SDKSelector";
import { AgoraConfigPanel } from "@/components/AgoraConfigPanel";
import { LiveKitConfigPanel } from "@/components/LiveKitConfigPanel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Activity, FileText, Zap, ArrowRight } from "lucide-react";
import { useVideoSDK } from "@/contexts/VideoSDKContext";

const SetupPage = () => {
  const navigate = useNavigate();
  const { selectedSDK, setSelectedSDK, agoraConfig, setAgoraConfig, liveKitConfig, setLiveKitConfig, isConfigured } = useVideoSDK();

  const handleJoinMeeting = () => {
    if (isConfigured) {
      if (selectedSDK === 'agora') {
        navigate('/agora_meeting');
      } else {
        navigate('/livekit_meeting');
      }
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* 헤더 */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold text-primary">
                Video SDK 테스트 도구
              </h1>
              <p className="text-muted-foreground">
                Agora와 LiveKit을 테스트하고 디버깅하는 개발자 도구
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30">
                <Activity className="w-3 h-3 mr-1" />
                개발 모드
              </Badge>
              <Badge variant="outline" className="bg-accent/20 text-accent border-accent/30">
                <Zap className="w-3 h-3 mr-1" />
                실시간 테스트
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* 프로젝트 정보 */}
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <FileText className="w-4 h-4" />
                프로젝트 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">버전:</span>
                <span>v1.1.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Agora SDK:</span>
                <span>4.24.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">LiveKit:</span>
                <span>2.15.4</span>
              </div>
              <Separator className="my-2" />
              <p className="text-muted-foreground">
                이 도구는 개발자용 테스트 환경입니다. API Key와 Secret은 로컬에만 저장됩니다.
              </p>
            </CardContent>
          </Card>

          {/* SDK 선택 */}
          <SDKSelector 
            selectedSDK={selectedSDK} 
            onSDKChange={setSelectedSDK}
          />

          {/* 설정 패널 */}
          {selectedSDK === 'agora' ? (
            <AgoraConfigPanel 
              config={agoraConfig} 
              onConfigChange={setAgoraConfig} 
            />
          ) : (
            <LiveKitConfigPanel 
              config={liveKitConfig} 
              onConfigChange={setLiveKitConfig} 
            />
          )}

          {/* 참여하기 버튼 */}
          <Card className="bg-card border-border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                화상회의 참여
              </CardTitle>
              <CardDescription>
                설정을 완료하고 화상회의에 참여하세요
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleJoinMeeting}
                disabled={!isConfigured}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                size="lg"
              >
                {isConfigured ? (
                  <>
                    화상회의 참여하기
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                ) : (
                  "설정을 완료해주세요"
                )}
              </Button>
              
              {!isConfigured && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  {selectedSDK === 'agora' 
                    ? "App ID를 입력해주세요 (App Certificate는 토큰 생성 시에만 필요합니다)"
                    : "Server URL, API Key, API Secret을 입력하고 토큰을 생성해주세요"
                  }
                </p>
              )}
            </CardContent>
          </Card>

          {/* 하단 정보 */}
          <div className="text-center text-xs text-muted-foreground">
            <p>
              💡 이 도구는 테스트용으로만 사용하세요. 
              실제 프로덕션 환경에서는 서버에서 토큰을 생성하는 것이 안전합니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupPage;