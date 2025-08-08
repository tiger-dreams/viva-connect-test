import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SDKType } from "@/types/video-sdk";

interface SDKSelectorProps {
  selectedSDK: SDKType;
  onSDKChange: (sdk: SDKType) => void;
}

export const SDKSelector = ({ selectedSDK, onSDKChange }: SDKSelectorProps) => {
  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
          Video SDK 선택
        </CardTitle>
        <CardDescription>
          테스트할 Video SDK를 선택하세요
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedSDK} onValueChange={(value) => onSDKChange(value as SDKType)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="agora" className="data-[state=active]:bg-agora-primary data-[state=active]:text-white">
              Agora
            </TabsTrigger>
            <TabsTrigger value="livekit" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">
              LiveKit
            </TabsTrigger>
            <TabsTrigger value="planetkit" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              PlanetKit
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="agora" className="mt-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Agora Web SDK</h3>
                <Badge variant="secondary" className="bg-agora-primary/20 text-agora-primary border-agora-primary/30">
                  v4.x
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                실시간 음성 및 영상 통화를 위한 Agora SDK를 테스트합니다.
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-muted-foreground">• 고품질 영상</div>
                <div className="text-muted-foreground">• 낮은 지연시간</div>
                <div className="text-muted-foreground">• 화면 공유</div>
                <div className="text-muted-foreground">• 다중 플랫폼</div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="livekit" className="mt-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">LiveKit</h3>
                <Badge variant="secondary" className="bg-green-600/20 text-green-600 border-green-600/30">
                  오픈소스
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                오픈소스 WebRTC 플랫폼을 사용한 실시간 커뮤니케이션을 테스트합니다.
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-muted-foreground">• 오픈소스</div>
                <div className="text-muted-foreground">• 자체 호스팅</div>
                <div className="text-muted-foreground">• 확장 가능</div>
                <div className="text-muted-foreground">• 개발자 친화적</div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="planetkit" className="mt-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">LINE Planet PlanetKit</h3>
                <Badge variant="secondary" className="bg-blue-600/20 text-blue-600 border-blue-600/30">
                  LINE
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                LINE Planet의 WebPlanetKit을 사용한 그룹 통화를 테스트합니다.
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-muted-foreground">• 그룹 통화</div>
                <div className="text-muted-foreground">• 안정적 연결</div>
                <div className="text-muted-foreground">• 모바일 최적화</div>
                <div className="text-muted-foreground">• LINE 생태계</div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};