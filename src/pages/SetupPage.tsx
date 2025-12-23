import { useNavigate } from "react-router-dom";
// import { SDKSelector } from "@/components/SDKSelector";
// import { AgoraConfigPanel } from "@/components/AgoraConfigPanel";
// import { LiveKitConfigPanel } from "@/components/LiveKitConfigPanel";
import { PlanetKitConfigPanel } from "@/components/PlanetKitConfigPanel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Activity, FileText, Zap, ArrowRight } from "lucide-react";
import { useVideoSDK } from "@/contexts/VideoSDKContext";

const SetupPage = () => {
  const navigate = useNavigate();
  const { selectedSDK, setSelectedSDK, agoraConfig, setAgoraConfig, liveKitConfig, setLiveKitConfig, planetKitConfig, setPlanetKitConfig, isConfigured } = useVideoSDK();

  const handleJoinMeeting = () => {
    if (isConfigured) {
      // if (selectedSDK === 'agora') {
      //   navigate('/agora_meeting');
      // } else if (selectedSDK === 'livekit') {
      //   navigate('/livekit_meeting');
      // } else if (selectedSDK === 'planetkit') {
        navigate('/planetkit_meeting');
      // }
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* 헤더 - 모바일 최적화 */}
      <div className="border-b border-border bg-card sticky top-0 z-50">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
            <div className="space-y-0.5 sm:space-y-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-primary">
                Video SDK 테스트
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                LINE Planet PlanetKit 테스트 도구
              </p>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30 text-xs">
                <Activity className="w-3 h-3 mr-1" />
                개발
              </Badge>
              <Badge variant="outline" className="bg-accent/20 text-accent border-accent/30 text-xs">
                <Zap className="w-3 h-3 mr-1" />
                실시간
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
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
                <span>v1.2.0</span>
              </div>
              {/* <div className="flex justify-between">
                <span className="text-muted-foreground">Agora SDK:</span>
                <span>4.24.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">LiveKit:</span>
                <span>2.15.4</span>
              </div> */}
              <div className="flex justify-between">
                <span className="text-muted-foreground">PlanetKit:</span>
                <span>5.5.1</span>
              </div>
              <Separator className="my-2" />
              <p className="text-muted-foreground">
                이 도구는 개발자용 테스트 환경입니다. API Key와 Secret은 로컬에만 저장됩니다.
              </p>
            </CardContent>
          </Card>

          {/* SDK 선택 - Agora, LiveKit 주석처리 */}
          {/* <SDKSelector
            selectedSDK={selectedSDK}
            onSDKChange={setSelectedSDK}
          /> */}

          {/* 설정 패널 - PlanetKit만 표시 */}
          {/* {selectedSDK === 'agora' ? (
            <AgoraConfigPanel
              config={agoraConfig}
              onConfigChange={setAgoraConfig}
            />
          ) : selectedSDK === 'livekit' ? (
            <LiveKitConfigPanel
              config={liveKitConfig}
              onConfigChange={setLiveKitConfig}
            />
          ) : ( */}
            <PlanetKitConfigPanel
              config={planetKitConfig}
              onConfigChange={setPlanetKitConfig}
            />
          {/* )} */}

          {/* 참여하기 버튼 - 모바일 최적화 */}
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-3 sm:pb-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                화상회의 참여
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                설정을 완료하고 화상회의에 참여하세요
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleJoinMeeting}
                disabled={!isConfigured}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-12 sm:h-14 text-base sm:text-lg font-semibold touch-manipulation"
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
                  {/* {selectedSDK === 'agora'
                    ? "App ID를 입력해주세요 (App Certificate는 토큰 생성 시에만 필요합니다)"
                    : selectedSDK === 'livekit'
                      ? "Server URL, API Key, API Secret을 입력하고 토큰을 생성해주세요"
                      : */}
                      Service ID, User ID를 입력하고 Access Token을 생성해주세요
                  {/* } */}
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