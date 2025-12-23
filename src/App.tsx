import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { VideoSDKProvider } from "@/contexts/VideoSDKContext";
import { LiffProvider } from "@/contexts/LiffContext";
import Index from "./pages/Index";
import SetupPage from "./pages/SetupPage";
import PlanetKitMeeting from "./pages/PlanetKitMeeting";
import MeetingPage from "./pages/MeetingPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
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

            {/* 기존 미팅 페이지 (호환성 유지) */}
            <Route path="/meeting" element={<MeetingPage />} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </VideoSDKProvider>
  </LiffProvider>
  </QueryClientProvider>
);

export default App;
