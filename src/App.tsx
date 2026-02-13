import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { VideoSDKProvider } from "@/contexts/VideoSDKContext";
import { LiffProvider } from "@/contexts/LiffContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import Index from "./pages/Index";
import SetupPage from "./pages/SetupPage";
import BetaSetupPage from "./pages/BetaSetupPage";
import PlanetKitMeeting from "./pages/PlanetKitMeeting";
import BetaPlanetKitMeeting from "./pages/BetaPlanetKitMeeting";
import MeetingPage from "./pages/MeetingPage";
import AdminLogs from "./pages/AdminLogs";
import AdminRooms from "./pages/AdminRooms";
import NotFound from "./pages/NotFound";
import { AgentCallTrigger } from "./pages/AgentCallTrigger";
import { AgentCallMeeting } from "./pages/AgentCallMeeting";
import { ScheduleRetryPage } from "./pages/ScheduleRetryPage";
import { BetaAgentCallTrigger } from "./pages/BetaAgentCallTrigger";
import { BetaAgentCallMeeting } from "./pages/BetaAgentCallMeeting";
import { BetaScheduleRetryPage } from "./pages/BetaScheduleRetryPage";
import { WebPushTestPage } from "./pages/WebPushTestPage";
import { AIAgentCallMeeting } from "./pages/AIAgentCallMeeting";
import { AIAgentBridgeMeeting } from "./pages/AIAgentBridgeMeeting";
import { HeadlessAgentPage } from "./pages/HeadlessAgentPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <LiffProvider>
        <VideoSDKProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
            <Routes>
              {/* 새로운 페이지 구조 (기본 페이지) */}
              <Route path="/" element={<SetupPage />} />
              <Route path="/setup" element={<SetupPage />} />

              {/* Beta Setup 페이지 (완전 독립) */}
              <Route path="/beta" element={<BetaSetupPage />} />
              <Route path="/beta/setup" element={<BetaSetupPage />} />

              {/* 기존 페이지 (레거시 UI 호환성 유지) */}
              <Route path="/legacy" element={<Index />} />

              {/* PlanetKit 미팅 페이지 */}
              <Route path="/planetkit_meeting" element={<PlanetKitMeeting />} />
              <Route path="/beta/planetkit_meeting" element={<BetaPlanetKitMeeting />} />

              {/* Agent Call 페이지 - Beta (테스트용) - 별도 컴포넌트 사용 */}
              <Route path="/beta/agent-call" element={<BetaAgentCallTrigger />} />
              <Route path="/beta/agent-call-meeting" element={<BetaAgentCallMeeting />} />
              <Route path="/beta/schedule-retry" element={<BetaScheduleRetryPage />} />

              {/* Web Push Test 페이지 - Beta Only */}
              <Route path="/beta/web-push-test" element={<WebPushTestPage />} />

              {/* Agent Call 페이지 - Production */}
              <Route path="/agent-call" element={<AgentCallTrigger />} />
              <Route path="/agent-call-meeting" element={<AgentCallMeeting />} />
              <Route path="/schedule-retry" element={<ScheduleRetryPage />} />
              
              {/* AI Agent Call - Gemini Voice Call */}
              <Route path="/ai-agent-call" element={<AIAgentCallMeeting />} />
              
              {/* AI Agent Bridge - Browser as Bridge to PlanetKit Conference */}
              <Route path="/ai-agent-bridge" element={<AIAgentBridgeMeeting />} />

              {/* Headless AI Agent - Runs in Puppeteer on Render.com */}
              <Route path="/headless-agent" element={<HeadlessAgentPage />} />

              {/* LIFF Endpoint URL이 /setup인 경우를 위한 리다이렉트 */}
              {/* Beta 경로 */}
              <Route path="/setup/beta/agent-call" element={<BetaAgentCallTrigger />} />
              <Route path="/setup/beta/agent-call-meeting" element={<BetaAgentCallMeeting />} />
              <Route path="/setup/beta/schedule-retry" element={<BetaScheduleRetryPage />} />
              {/* Production 경로 */}
              <Route path="/setup/agent-call" element={<AgentCallTrigger />} />
              <Route path="/setup/agent-call-meeting" element={<AgentCallMeeting />} />
              <Route path="/setup/schedule-retry" element={<ScheduleRetryPage />} />

              {/* 기존 미팅 페이지 (호환성 유지) */}
              <Route path="/meeting" element={<MeetingPage />} />

              {/* 관리 페이지 */}
              <Route path="/admin/logs" element={<AdminLogs />} />
              <Route path="/admin/rooms" element={<AdminRooms />} />

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </VideoSDKProvider>
    </LiffProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
