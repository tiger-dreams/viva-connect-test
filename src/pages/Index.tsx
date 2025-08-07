import { useState, useEffect } from "react";
import { SDKSelector } from "@/components/SDKSelector";
import { AgoraConfigPanel } from "@/components/AgoraConfigPanel";
import { ZoomConfigPanel } from "@/components/ZoomConfigPanel";
import { VideoMeetingArea } from "@/components/VideoMeetingArea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Activity, FileText, Zap } from "lucide-react";
import { SDKType, AgoraConfig, ZoomConfig } from "@/types/video-sdk";

const Index = () => {
  const [selectedSDK, setSelectedSDK] = useState<SDKType>('agora');
  const [agoraConfig, setAgoraConfig] = useState<AgoraConfig>({
    appId: '',
    appCertificate: '',
    channelName: 'test-channel',
    uid: '0'
  });
  const [zoomConfig, setZoomConfig] = useState<ZoomConfig>({
    sdkKey: '',
    sdkSecret: '',
    sessionName: 'test-session',
    userName: 'Test User'
  });

  // localStorage에서 설정 복원
  useEffect(() => {
    const savedAgoraConfig = localStorage.getItem('agoraConfig');
    const savedZoomConfig = localStorage.getItem('zoomConfig');
    const savedSDK = localStorage.getItem('selectedSDK');

    if (savedAgoraConfig) {
      try {
        setAgoraConfig(JSON.parse(savedAgoraConfig));
      } catch (error) {
        console.error('Failed to parse Agora config:', error);
      }
    }

    if (savedZoomConfig) {
      try {
        setZoomConfig(JSON.parse(savedZoomConfig));
      } catch (error) {
        console.error('Failed to parse Zoom config:', error);
      }
    }

    if (savedSDK) {
      setSelectedSDK(savedSDK as SDKType);
    }
  }, []);

  // 설정 변경 시 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('agoraConfig', JSON.stringify(agoraConfig));
  }, [agoraConfig]);

  useEffect(() => {
    localStorage.setItem('zoomConfig', JSON.stringify(zoomConfig));
  }, [zoomConfig]);

  useEffect(() => {
    localStorage.setItem('selectedSDK', selectedSDK);
  }, [selectedSDK]);

  return (
    <div className="min-h-screen bg-background">
      {/* 헤더 */}
      <div className="border-b border-border bg-gradient-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                Video SDK 테스트 도구
              </h1>
              <p className="text-muted-foreground">
                Agora와 Zoom Video SDK를 테스트하고 디버깅하는 개발자 도구
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
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* 왼쪽 설정 패널 */}
          <div className="xl:col-span-1 space-y-6">
            {/* 프로젝트 정보 */}
            <Card className="bg-gradient-card border-border shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <FileText className="w-4 h-4" />
                  프로젝트 정보
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">버전:</span>
                  <span>v1.0.0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Agora SDK:</span>
                  <span>4.x</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Zoom SDK:</span>
                  <span>Web</span>
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
              <ZoomConfigPanel 
                config={zoomConfig} 
                onConfigChange={setZoomConfig} 
              />
            )}
          </div>

          {/* 오른쪽 화상회의 영역 */}
          <div className="xl:col-span-2">
            <VideoMeetingArea
              selectedSDK={selectedSDK}
              agoraConfig={agoraConfig}
              zoomConfig={zoomConfig}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
