import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AuthCallback from "./pages/AuthCallback";
import { AuthProvider } from "./contexts/AuthContext";
import { AccountMenu } from "./components/auth/AccountMenu";
import { OnboardingGate } from "./components/onboarding/OnboardingGate";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import Modes from "./pages/Modes";
import SoloMode from "./pages/SoloMode";
import PracticeSetup from "./pages/PracticeSetup";
import SpeedDriveSetup from "./pages/SpeedDriveSetup";
import CompeteMode from "./pages/CompeteMode";
import BattleAI from "./pages/BattleAI";
import BattleFriends from "./pages/BattleFriends";
import Play from "./pages/Play";
import Lobby from "./pages/Lobby";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AccountMenu />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            {/* Auth required beyond this point (guest allowed) */}
            <Route element={<ProtectedRoute />}> 
              <Route path="/modes" element={<Modes />} />
              <Route path="/modes/solo" element={<SoloMode />} />
              <Route path="/modes/solo/practice" element={<PracticeSetup />} />
              <Route path="/modes/solo/speed" element={<SpeedDriveSetup />} />
              <Route path="/modes/compete" element={<CompeteMode />} />
              <Route path="/modes/compete/ai" element={<BattleAI />} />
              <Route path="/modes/compete/friends" element={<BattleFriends />} />
              <Route path="/play" element={<Play />} />
              <Route path="/lobby/:code" element={<Lobby />} />
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        <OnboardingGate />
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
