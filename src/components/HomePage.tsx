import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlayCircle, Brain, User } from "lucide-react";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";

interface FloatingElementProps {
  children: React.ReactNode;
  delay: number;
  duration: number;
  x: string;
  y: string;
  mouseX: number;
  mouseY: number;
  depth: number;
}

const FloatingElement = ({ children, delay, duration, x, y, mouseX, mouseY, depth }: FloatingElementProps) => {
  // Calculate parallax offset based on mouse position and depth
  const parallaxX = (mouseX - 50) * depth;
  const parallaxY = (mouseY - 50) * depth;
  
  return (
    <div
      className="absolute text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold opacity-15 hover:opacity-50 hover:scale-110 transition-all duration-500 pointer-events-none select-none"
      style={{
        left: x,
        top: y,
        animation: `float-3d ${duration}s ease-in-out ${delay}s infinite`,
        transform: `translate3d(${parallaxX}px, ${parallaxY}px, 0) translateZ(0)`,
        transition: 'transform 0.3s ease-out, opacity 0.3s ease-out',
        filter: 'drop-shadow(0 10px 30px rgba(0, 0, 0, 0.15)) drop-shadow(0 4px 10px rgba(0, 0, 0, 0.1))',
      }}
    >
      {children}
    </div>
  );
};

interface HomePageProps {
  onStartGame: (name: string, difficulty: 'easy' | 'moderate' | 'difficult') => void;
}

export const HomePage = ({ onStartGame }: HomePageProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [name, setName] = useState("");
  const [difficulty, setDifficulty] = useState<'easy' | 'moderate' | 'difficult'>('moderate');
  const [mousePosition, setMousePosition] = useState({ x: 50, y: 50 });
  const [showForm, setShowForm] = useState(false);
  const { user, guest, loading } = useAuth();
  const { toast } = useToast();
  const [authOpen, setAuthOpen] = useState(false);
  const navigate = useNavigate();

  // Mouse tracking for parallax effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      setMousePosition({ x, y });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Auto-close auth dialog once authenticated or guest selected
  useEffect(() => {
    if ((user || guest) && authOpen) setAuthOpen(false);
  }, [user, guest, authOpen]);

  // Generate floating elements with depth for parallax (25 total elements)
  const mathElements = [
    { content: "∑", x: "5%", y: "10%", delay: 0, duration: 8, depth: 0.15, color: "from-blue-600 to-cyan-600" },
    { content: "∫", x: "85%", y: "15%", delay: 1, duration: 10, depth: 0.25, color: "from-purple-600 to-pink-600" },
    { content: "π", x: "15%", y: "80%", delay: 2, duration: 9, depth: 0.2, color: "from-green-600 to-teal-600" },
    { content: "√", x: "90%", y: "70%", delay: 0.5, duration: 7, depth: 0.3, color: "from-orange-600 to-red-600" },
    { content: "α", x: "10%", y: "45%", delay: 1.5, duration: 11, depth: 0.12, color: "from-indigo-600 to-blue-600" },
    { content: "β", x: "75%", y: "85%", delay: 2.5, duration: 8, depth: 0.18, color: "from-pink-600 to-rose-600" },
    { content: "∞", x: "70%", y: "25%", delay: 1, duration: 9, depth: 0.22, color: "from-violet-600 to-purple-600" },
    { content: "θ", x: "25%", y: "65%", delay: 3, duration: 10, depth: 0.28, color: "from-cyan-600 to-blue-600" },
    { content: "÷", x: "30%", y: "30%", delay: 1.5, duration: 9, depth: 0.19, color: "from-fuchsia-600 to-pink-600" },
    { content: "≈", x: "60%", y: "75%", delay: 0.5, duration: 11, depth: 0.26, color: "from-sky-600 to-cyan-600" },
    { content: "Δ", x: "40%", y: "90%", delay: 2, duration: 8, depth: 0.14, color: "from-lime-600 to-green-600" },
    { content: "λ", x: "95%", y: "40%", delay: 1, duration: 10, depth: 0.21, color: "from-rose-600 to-pink-600" },
    { content: "Ω", x: "8%", y: "70%", delay: 3, duration: 9, depth: 0.17, color: "from-teal-600 to-cyan-600" },
    { content: "γ", x: "55%", y: "5%", delay: 2, duration: 10, depth: 0.23, color: "from-violet-600 to-fuchsia-600" },
    { content: "σ", x: "12%", y: "92%", delay: 1, duration: 11, depth: 0.16, color: "from-cyan-600 to-teal-600" },
    { content: "μ", x: "93%", y: "30%", delay: 0.5, duration: 8, depth: 0.29, color: "from-amber-600 to-yellow-600" },
    { content: "ε", x: "3%", y: "55%", delay: 2.5, duration: 9, depth: 0.13, color: "from-blue-600 to-indigo-600" },
    { content: "φ", x: "78%", y: "8%", delay: 1.5, duration: 12, depth: 0.27, color: "from-red-600 to-pink-600" },
  ];

  const numberElements = [
    { content: "2³", x: "50%", y: "15%", delay: 0, duration: 12, depth: 0.16, color: "from-emerald-600 to-green-600" },
    { content: "x²", x: "80%", y: "50%", delay: 2, duration: 7, depth: 0.24, color: "from-amber-600 to-orange-600" },
    { content: "7", x: "20%", y: "20%", delay: 0.5, duration: 10, depth: 0.2, color: "from-blue-600 to-purple-600" },
    { content: "42", x: "65%", y: "35%", delay: 1.5, duration: 8, depth: 0.25, color: "from-pink-600 to-orange-600" },
    { content: "π²", x: "35%", y: "55%", delay: 2.5, duration: 11, depth: 0.18, color: "from-green-600 to-teal-600" },
    { content: "∛8", x: "88%", y: "60%", delay: 0, duration: 9, depth: 0.23, color: "from-purple-600 to-pink-600" },
    { content: "e", x: "45%", y: "10%", delay: 3, duration: 7, depth: 0.27, color: "from-orange-600 to-red-600" },
  ];

  const handleStartGame = () => {
    // Gate starting the game behind authentication or guest mode
    if (!user && !guest) {
      setAuthOpen(true);
      setShowForm(false);
      return;
    }
    if (name.trim().length < 2) {
      alert("Please enter your name (at least 2 characters)");
      return;
    }
    onStartGame(name.trim(), difficulty);
  };

  const handleGetStarted = () => {
    if (!user && !guest) {
      setAuthOpen(true);
      return;
    }
    // Move to modes selection page
    navigate("/modes");
  };

  return (
    <div className="min-h-screen relative overflow-x-hidden bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Animated gradient orbs with enhanced shadows */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl animate-float shadow-2xl" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-gradient-to-tl from-pink-400/20 to-orange-400/20 rounded-full blur-3xl animate-float shadow-2xl" style={{ animationDelay: '2s' }} />
      <div className="absolute top-1/2 left-1/2 w-72 h-72 bg-gradient-to-r from-green-400/15 to-teal-400/15 rounded-full blur-3xl animate-float shadow-xl" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-gradient-to-br from-yellow-400/15 to-orange-400/15 rounded-full blur-3xl animate-float shadow-xl" style={{ animationDelay: '1.5s' }} />
      <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-gradient-to-tl from-indigo-400/15 to-blue-400/15 rounded-full blur-3xl animate-float shadow-xl" style={{ animationDelay: '2.5s' }} />
      
      {/* Math formulas decoration - subtle background patterns */}
      <div className="absolute top-10 right-10 text-gray-300/30 text-sm font-mono select-none pointer-events-none">
        <div className="animate-pulse">f(x) = ax² + bx + c</div>
      </div>
      <div className="absolute bottom-20 left-16 text-gray-300/30 text-sm font-mono select-none pointer-events-none">
        <div className="animate-pulse" style={{ animationDelay: '1s' }}>E = mc²</div>
      </div>
      <div className="absolute top-1/3 left-8 text-gray-300/30 text-xs font-mono select-none pointer-events-none rotate-12">
        <div className="animate-pulse" style={{ animationDelay: '0.5s' }}>sin²θ + cos²θ = 1</div>
      </div>
      <div className="absolute top-1/2 right-12 text-gray-300/30 text-xs font-mono select-none pointer-events-none -rotate-12">
        <div className="animate-pulse" style={{ animationDelay: '1.5s' }}>∫₀^∞ e⁻ˣ dx = 1</div>
      </div>

      {/* Floating Math Elements with 3D Parallax */}
      {mathElements.map((elem, idx) => (
        <FloatingElement 
          key={`math-${idx}`} 
          {...elem}
          mouseX={mousePosition.x}
          mouseY={mousePosition.y}
        >
          <span className={`bg-gradient-to-br ${elem.color} bg-clip-text text-transparent drop-shadow-2xl`}>
            {elem.content}
          </span>
        </FloatingElement>
      ))}

      {/* Floating Numbers with 3D Parallax */}
      {numberElements.map((elem, idx) => (
        <FloatingElement 
          key={`num-${idx}`} 
          {...elem}
          mouseX={mousePosition.x}
          mouseY={mousePosition.y}
        >
          <span className={`bg-gradient-to-br ${elem.color} bg-clip-text text-transparent drop-shadow-2xl font-black`}>
            {elem.content}
          </span>
        </FloatingElement>
      ))}

      {/* Main Content */}
      <div className={`relative z-10 flex flex-col items-center px-4 sm:px-6 lg:px-8 ${showForm ? 'justify-start py-12' : 'justify-center min-h-screen'}`}>
        <div className="text-center max-w-4xl mx-auto space-y-8 animate-slide-up">
          {/* Logo/Title */}
          <div className="space-y-4">
            <div className="inline-block">
              <div className="relative">
                <h1 className="text-6xl sm:text-7xl md:text-8xl font-black bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent animate-gradient drop-shadow-2xl">
                  Let’s Mine
                </h1>
                <div className="absolute -inset-4 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20 blur-2xl -z-10 animate-pulse shadow-2xl" />
                
                {/* Decorative mathematical notation */}
                <div className="absolute -top-8 -left-8 text-2xl opacity-20 animate-bounce" style={{ animationDelay: '0.5s' }}>📐</div>
                <div className="absolute -bottom-6 -right-6 text-2xl opacity-20 animate-bounce" style={{ animationDelay: '1s' }}>📊</div>
              </div>

          {/* Auth entry button */}
          {!loading && !user && !guest && (
            <div className="mt-6 flex justify-center">
              <Button variant="outline" onClick={() => setAuthOpen(true)}>Sign in / Create account</Button>
            </div>
          )}
            </div>
          </div>

          {/* Feature Cards removed per product requirements */}

          {/* Name & Difficulty Form */}
          {!showForm ? (
            <div className="flex flex-col items-center gap-6 mt-12">
              <Button
                onClick={handleGetStarted}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                size="lg"
                className="group relative px-12 py-8 text-2xl font-black rounded-2xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white shadow-2xl hover:shadow-purple-500/50 transition-all duration-300 hover:scale-105 active:scale-95 overflow-hidden"
              >
                <span className="relative z-10 flex items-center gap-3">
                  <PlayCircle className={`w-8 h-8 transition-transform duration-300 ${isHovered ? 'rotate-90' : ''}`} />
                  Let's Start Mining
                  <PlayCircle className={`w-8 h-8 transition-transform duration-300 ${isHovered ? '-rotate-90' : ''}`} />
                </span>
                
                {/* Animated shimmer effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                
                {/* Pulsing glow */}
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 blur-xl opacity-50 group-hover:opacity-75 transition-opacity duration-300" />
              </Button>

              <p className="text-sm text-gray-500 flex items-center gap-2">
                <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                New questions every 24 hours
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6 mt-12 w-full max-w-md mx-auto animate-slide-up relative">
              {/* Decorative study elements around form */}
              <div className="absolute -left-12 top-10 text-3xl opacity-20 animate-bounce" style={{ animationDelay: '0s' }}>📚</div>
              <div className="absolute -right-12 top-32 text-3xl opacity-20 animate-bounce" style={{ animationDelay: '0.5s' }}>✏️</div>
              <div className="absolute -left-10 bottom-20 text-2xl opacity-20 animate-bounce" style={{ animationDelay: '1s' }}>🎓</div>
              <div className="absolute -right-10 bottom-10 text-2xl opacity-20 animate-bounce" style={{ animationDelay: '1.5s' }}>💡</div>
              
              {/* Name Input */}
              <div className="w-full space-y-2">
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
                  <User className="w-4 h-4" />
                  Your Name
                </label>
                <Input
                  type="text"
                  placeholder="Enter your name..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-6 py-6 text-lg rounded-xl border-2 border-gray-300 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 transition-all duration-300 bg-white/80 backdrop-blur-sm shadow-lg hover:shadow-xl focus:shadow-2xl"
                  maxLength={30}
                  style={{
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)'
                  }}
                />
              </div>

              {/* Difficulty Slider */}
              <div className="w-full space-y-3">
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
                  <Brain className="w-4 h-4" />
                  Difficulty Level
                </label>
                
                {/* Custom Slider */}
                <div className="relative">
                  <div className="flex justify-between mb-2">
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full transition-all duration-300 ${
                      difficulty === 'easy' 
                        ? 'bg-green-500 text-white shadow-lg scale-110' 
                        : 'bg-gray-200 text-gray-600'
                    }`}>Easy</span>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full transition-all duration-300 ${
                      difficulty === 'moderate' 
                        ? 'bg-yellow-500 text-white shadow-lg scale-110' 
                        : 'bg-gray-200 text-gray-600'
                    }`}>Moderate</span>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full transition-all duration-300 ${
                      difficulty === 'difficult' 
                        ? 'bg-red-500 text-white shadow-lg scale-110' 
                        : 'bg-gray-200 text-gray-600'
                    }`}>Difficult</span>
                  </div>
                  
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="1"
                    value={difficulty === 'easy' ? 0 : difficulty === 'moderate' ? 1 : 2}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setDifficulty(val === 0 ? 'easy' : val === 1 ? 'moderate' : 'difficult');
                    }}
                    className="w-full h-3 rounded-full appearance-none cursor-pointer"
                    style={{
                      background: difficulty === 'easy' 
                        ? 'linear-gradient(to right, #10b981 0%, #10b981 100%)'
                        : difficulty === 'moderate'
                        ? 'linear-gradient(to right, #10b981 0%, #eab308 50%, #eab308 100%)'
                        : 'linear-gradient(to right, #10b981 0%, #eab308 50%, #ef4444 100%)'
                    }}
                  />
                </div>
              </div>

              {/* Start Quest Button */}
              <Button
                onClick={handleStartGame}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                size="lg"
                className="group relative w-full px-12 py-6 text-xl font-black rounded-2xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white shadow-2xl hover:shadow-purple-500/50 transition-all duration-300 hover:scale-105 active:scale-95 overflow-hidden"
              >
                <span className="relative z-10 flex items-center justify-center gap-3">
                  <PlayCircle className={`w-6 h-6 transition-transform duration-300 ${isHovered ? 'rotate-90' : ''}`} />
                  Start Quest
                  <PlayCircle className={`w-6 h-6 transition-transform duration-300 ${isHovered ? '-rotate-90' : ''}`} />
                </span>
                
                {/* Animated shimmer effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                
                {/* Pulsing glow */}
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 blur-xl opacity-50 group-hover:opacity-75 transition-opacity duration-300" />
              </Button>

              <button
                onClick={() => setShowForm(false)}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors duration-200 underline"
              >
                ← Back
              </button>
            </div>
          )}

          {/* Stats/Info */}
          <div className="flex flex-wrap justify-center gap-8 mt-12 text-sm sm:text-base text-gray-600">
            <div className="flex flex-col items-center gap-1">
              <span className="text-3xl font-black bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">10</span>
              <span className="font-semibold">Questions</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-3xl font-black bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">5</span>
              <span className="font-semibold">Lives</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-3xl font-black bg-gradient-to-r from-pink-600 to-orange-600 bg-clip-text text-transparent">∞</span>
              <span className="font-semibold">Learning</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom decoration */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white/60 to-transparent backdrop-blur-sm" />

      {/* Auth Dialog */}
      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sign in to Let’s Mine</DialogTitle>
          </DialogHeader>
          <AuthPanel />
        </DialogContent>
      </Dialog>
    </div>
  );
};
