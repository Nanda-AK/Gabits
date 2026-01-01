import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { AuthProvider } from "@/contexts/AuthContext";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { OnboardingGate } from "@/components/onboarding/OnboardingGate";
import AuthCallback from "./pages/AuthCallback";
import Leaderboard from "./pages/Leaderboard";
import Treasure from "./pages/Treasure";
import { GlobalLogo } from "@/components/GlobalLogo";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { ProtectedRoleRoute } from "./components/auth/ProtectedRoleRoute";
import Modes from "./pages/Modes";
import SoloMode from "./pages/SoloMode";
import PracticeSetup from "./pages/PracticeSetup";
import SpeedDriveSetup from "./pages/SpeedDriveSetup";
import CompeteMode from "./pages/CompeteMode";
import BattleAI from "./pages/BattleAI";
import BattleFriends from "./pages/BattleFriends";
import Play from "./pages/Play";
import Lobby from "./pages/Lobby";
import TeacherPortal from "./pages/TeacherPortal";
import TasksHub from "./pages/TasksHubV2";
import TeacherReports from "./pages/TeacherReports";
import TaskDetail from "./pages/TaskDetail";
import StudentInspect from "./pages/StudentInspect";
import ClassOverview from "./pages/ClassOverview";

const queryClient = new QueryClient();

const App = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handler = (event: MessageEvent) => {
      const data = event.data as any;
      if (!data || data.type !== "APP_VERSION" || !data.version) return;
      const key = "app:version";
      try {
        const last = localStorage.getItem(key);
        if (last === String(data.version)) return;
        localStorage.setItem(key, String(data.version));
      } catch {}
      setUpdateAvailable(true);
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <BrowserRouter>
            <GlobalLogo />
            <AccountMenu />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              {/* Auth required beyond this point (guest allowed) */}
              <Route element={<ProtectedRoute />}> 
                <Route path="/modes" element={<Modes />} />
                <Route path="/modes/solo" element={<SoloMode />} />
                {/* Teacher-only: setup and free-play routes */}
                <Route element={<ProtectedRoleRoute roles={["teacher"]} />}>
                  <Route path="/modes/solo/practice" element={<PracticeSetup />} />
                  <Route path="/modes/solo/speed" element={<SpeedDriveSetup />} />
                  <Route path="/modes/compete" element={<CompeteMode />} />
                  <Route path="/modes/compete/ai" element={<BattleAI />} />
                  <Route path="/modes/compete/friends" element={<BattleFriends />} />
                </Route>
                <Route path="/play" element={<Play />} />
                <Route path="/lobby/:code" element={<Lobby />} />
                <Route path="/leaderboard" element={<Leaderboard />} />
                {/* Student/Parent/Principal only pages */}
                <Route element={<ProtectedRoleRoute roles={["student","parent","principal"]} />}>
                  <Route path="/treasure" element={<Treasure />} />
                  {/* Student Dashboard should show the same landing dashboard as "/" */}
                  <Route path="/dashboard" element={<Index />} />
                </Route>
                <Route path="/tasks" element={<TasksHub />} />
                {/* Role-gated routes */}
                <Route element={<ProtectedRoleRoute roles={["teacher"]} />}>
                  <Route path="/portal/teacher" element={<TeacherPortal />} />
                  <Route path="/portal/class" element={<ClassOverview />} />
                  <Route path="/portal/reports" element={<TeacherReports />} />
                  <Route path="/portal/reports/tasks/:taskId" element={<TaskDetail />} />
                  <Route path="/portal/reports/students/:studentId" element={<StudentInspect />} />
                </Route>
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </BrowserRouter>
          <OnboardingGate />
          {updateAvailable && (
            <div className="fixed bottom-4 left-1/2 z-[9999] -translate-x-1/2 px-4 py-2 rounded-md bg-neutral-900 text-white shadow-lg flex items-center justify-between min-w-[260px] max-w-sm text-xs sm:text-sm">
              <span className="mr-4">A new version is available!</span>
              <button
                className="text-[11px] sm:text-xs font-semibold tracking-wide uppercase text-white/80 hover:text-white"
                onClick={() => window.location.reload()}
              >
                RELOAD
              </button>
            </div>
          )}
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
