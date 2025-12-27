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
import PlanetKitMeeting from "./pages/PlanetKitMeeting";
import MeetingPage from "./pages/MeetingPage";
import AdminLogs from "./pages/AdminLogs";
import AdminRooms from "./pages/AdminRooms";
import NotFound from "./pages/NotFound";
import { AgentCallTrigger } from "./pages/AgentCallTrigger";
import { AgentCallMeeting } from "./pages/AgentCallMeeting";

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

              {/* 기존 페이지 (레거시 UI 호환성 유지) */}
              <Route path="/legacy" element={<Index />} />

              {/* PlanetKit 미팅 페이지 */}
              <Route path="/planetkit_meeting" element={<PlanetKitMeeting />} />

              {/* Agent Call 페이지 */}
              <Route path="/agent-call" element={<AgentCallTrigger />} />
              <Route path="/agent-call-meeting" element={<AgentCallMeeting />} />
              {/* LIFF Endpoint URL이 /setup인 경우를 위한 리다이렉트 */}
              <Route path="/setup/agent-call" element={<AgentCallTrigger />} />
              <Route path="/setup/agent-call-meeting" element={<AgentCallMeeting />} />

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
