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
import Dashboard from "./pages/Dashboard";
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
import TasksHub from "./pages/TasksHub";
import TeacherReports from "./pages/TeacherReports";
import TaskDetail from "./pages/TaskDetail";
import StudentInspect from "./pages/StudentInspect";
import ClassOverview from "./pages/ClassOverview";
import TeacherStudents from "./pages/TeacherStudents";

const queryClient = new QueryClient();

const App = () => (
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
                <Route path="/dashboard" element={<Dashboard />} />
              </Route>
              <Route path="/tasks" element={<TasksHub />} />
              {/* Role-gated routes */}
              <Route element={<ProtectedRoleRoute roles={["teacher"]} />}>
                <Route path="/portal/teacher" element={<TeacherPortal />} />
                <Route path="/portal/class" element={<ClassOverview />} />
                <Route path="/portal/students" element={<TeacherStudents />} />
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
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
