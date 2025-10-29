import { useMemo, useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

import { questions, getDifficultyCoins, getHintCost } from "@/data/questions";
import type { Question, Difficulty } from "@/data/questions";
import { QuestionCard } from "./QuestionCard";
import { GameHeader } from "./GameHeader";
import { MonkeyProgress } from "./MonkeyProgress";
import { ResultScreen } from "./ResultScreen";
import { CoinAnimation } from "./CoinAnimation";
import { AchievementModal } from "./AchievementModal";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogAction } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getOrCreateDailySet, getDailyProgress, saveDailyProgressSnapshot } from "@/services/progress";
import { getAchievements, unlockAchievement } from "@/services/achievements";
import type { AchievementKey } from "@/services/achievements";
import { incrementTotals } from "@/services/totals";

interface QuizGameProps {
  difficulty?: Difficulty;
  mode?: 'practice' | 'speed' | 'battle-ai';
}

// Utility: Fisher-Yates shuffle
function shuffleArray<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Shuffle question order and each question's options, remapping correctAnswer
function shuffleQuestionSet(src: Question[]): Question[] {
  const ordered = shuffleArray(src);
  return ordered.map((q) => {
    const idxs = q.options.map((_, i) => i);
    const shuffledIdxs = shuffleArray(idxs);
    const newOptions = shuffledIdxs.map((i) => q.options[i]);
    const newCorrect = shuffledIdxs.indexOf(q.correctAnswer);
    return { ...q, options: newOptions, correctAnswer: newCorrect };
  });
}

// Deterministic daily pick of 10 questions from the full set using date-based seed
function seededRandom(seed: number) {
  return function () {
    // xorshift32
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 0xffffffff;
  };
}

function pickDailyQuestions(all: Question[], count = 10): Question[] {
  const d = new Date();
  const ymd = parseInt(`${d.getFullYear()}${(d.getMonth() + 1).toString().padStart(2, "0")}${d.getDate().toString().padStart(2, "0")}`);
  const rand = seededRandom(ymd);
  const idxs = all.map((_, i) => i);
  // shuffle indices with seeded rng
  for (let i = idxs.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
  }
  const chosen = idxs.slice(0, Math.min(count, all.length)).map(i => all[i]);
  return chosen;
}

// Local fallback using localStorage for guests/offline
function fallbackLocal(pool: Question[], difficulty: Difficulty): Question[] {
  const today = new Date().toISOString().split('T')[0];
  const key = `dailyQuizData:${difficulty}`;
  const storedData = localStorage.getItem(key);
  if (storedData) {
    try {
      const { date, questions: storedQuestions } = JSON.parse(storedData);
      if (date === today) return storedQuestions as Question[];
    } catch {}
  }
  const newQuestions = pickDailyQuestions(pool, 10);
  try { localStorage.setItem(key, JSON.stringify({ date: today, questions: newQuestions })); } catch {}
  return newQuestions;
}

export const QuizGame = ({ difficulty = 'moderate', mode = 'practice' }: QuizGameProps) => {
  const location = useLocation();
  const practiceMode = mode === 'practice' && location.pathname.startsWith('/play');
  const { user, guest } = useAuth();
  const userId = user?.id;
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [hearts, setHearts] = useState(5);
  const [coins, setCoins] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [gameCompleted, setGameCompleted] = useState(false);
  const [coinAnimations, setCoinAnimations] = useState<Array<{ id: number; amount: number }>>([]);
  const [blinkHeart, setBlinkHeart] = useState(false);
  const [secondChance, setSecondChance] = useState(false);
  const [secondChanceOpen, setSecondChanceOpen] = useState(false);
  const [lockedWrongIndex, setLockedWrongIndex] = useState<number | null>(null);
  const [questionReward, setQuestionReward] = useState(0);
  const [coinGain, setCoinGain] = useState<{ amount: number; id: number } | null>(null);
  const [showAchievements, setShowAchievements] = useState(false);
  const [overallTime, setOverallTime] = useState(0);
  const [questionTime, setQuestionTime] = useState(0);
  const [questionTimeLimit, setQuestionTimeLimit] = useState(30);
  const [overallTimeLimit] = useState(600); // 10 minutes total
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [aiScore, setAiScore] = useState(0);
  const [playerPoints, setPlayerPoints] = useState(0);
  const questionStartAtRef = useRef<number>(Date.now());
  const studentWinProbRef = useRef<number>(0.6 + Math.random() * 0.1); // 60-70% student win bias
  const [milestonesState, setMilestonesState] = useState({ m10: false, m25: false, m50: false, m75: false, m100: false });
  const [lifetimeAchievements, setLifetimeAchievements] = useState<Set<AchievementKey>>(new Set());

  // Load daily set from Supabase for authenticated users; fallback to local for guests
  const [dailyQuestions, setDailyQuestions] = useState<Question[]>([]);
  const [loadingDaily, setLoadingDaily] = useState(true);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingDaily(true);
      const pool = questions.filter(q => q.difficulty === difficulty);
      if (userId && !guest) {
        try {
          const ids = await getOrCreateDailySet(userId, today, difficulty, pool);
          if (cancelled) return;
          const mapped = ids.map(id => pool.find(q => q.id === id)).filter(Boolean) as Question[];
          const arr = mapped.length ? mapped : pool.slice(0, Math.min(10, pool.length));
          setDailyQuestions(arr);
        } catch {
          const arr = fallbackLocal(pool, difficulty);
          setDailyQuestions(arr);
        }
      } else {
        const arr = fallbackLocal(pool, difficulty);
        setDailyQuestions(arr);
      }
      setLoadingDaily(false);
    }
    load();
    return () => { cancelled = true; };
  }, [difficulty, userId, guest, today]);

  const [shuffledQuestions, setShuffledQuestions] = useState<Question[]>([]);
  const total = shuffledQuestions.length || dailyQuestions.length;
  const question = shuffledQuestions[currentQuestion];
  const progress = ((currentQuestion + 1) / total) * 100;

  // When daily set loads or refreshes, refresh the shuffled questions
  useEffect(() => {
    setShuffledQuestions(shuffleQuestionSet(dailyQuestions));
    setCurrentQuestion(0);
  }, [dailyQuestions]);

  // Initialize per-question reward when question changes
  const baseReward = question ? getDifficultyCoins(question.difficulty) : 0;
  useEffect(() => {
    setQuestionReward(baseReward);
    setShowHint(false);
    setSelectedAnswer(null);
    setSecondChance(false);
    setLockedWrongIndex(null);
    setBlinkHeart(false);
    setShowResult(false);
    setQuestionTime(0); // Reset question timer
    
    // Set time limit based on difficulty
    if (question) {
      if (mode === 'speed' || mode === 'battle-ai') {
        setQuestionTimeLimit(30); // fixed for speed/battle
      } else {
        const timeLimit = question.difficulty === 'easy' ? 45 : question.difficulty === 'moderate' ? 35 : 25;
        setQuestionTimeLimit(timeLimit);
      }
    }
  }, [currentQuestion, baseReward, question, mode]);

  // Battle-AI: we no longer pre-pick AI answers; decision happens on Check click per round

  // Track awarded milestones for the current daily set only
  const milestonesAwarded = useRef({ m10: false, m25: false, m50: false, m75: false, m100: false });

  // Load existing daily progress for authenticated users to resume
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userId || guest) return;
      try {
        const p = await getDailyProgress(userId, today, difficulty);
        if (cancelled || !p) return;
        setCorrectAnswers(p.correct_count || 0);
        setCoins(p.coins_earned || 0);
        const loaded = {
          m10: !!(p.milestones as any)?.m10,
          m25: !!(p.milestones as any)?.m25,
          m50: !!(p.milestones as any)?.m50,
          m75: !!(p.milestones as any)?.m75,
          m100: !!(p.milestones as any)?.m100,
        };
        setMilestonesState(loaded);
        milestonesAwarded.current = { ...milestonesAwarded.current, ...loaded };
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [userId, guest, today, difficulty]);

  // Load lifetime achievements for authenticated users
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userId || guest) { setLifetimeAchievements(new Set()); return; }
      try {
        const set = await getAchievements(userId);
        if (!cancelled) setLifetimeAchievements(set);
      } catch { if (!cancelled) setLifetimeAchievements(new Set()); }
    })();
    return () => { cancelled = true; };
  }, [userId, guest]);
  
  // Timer effects (disabled in Solo Practice route)
  useEffect(() => {
    if (practiceMode || mode === 'battle-ai') return; // no overall timer in practice or battle AI
    const overallInterval = setInterval(() => {
      setOverallTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(overallInterval);
  }, [practiceMode, mode]);
  
  useEffect(() => {
    if (practiceMode || mode === 'battle-ai') return; // no per-question timer in practice or battle AI
    if (!showResult && !gameCompleted) {
      const questionInterval = setInterval(() => {
        setQuestionTime(prev => {
          const newTime = prev + 1;
          // Auto-skip when question time limit reached
          if (newTime >= questionTimeLimit) {
            handleTimeUp();
          }
          return newTime;
        });
      }, 1000);
      
      return () => clearInterval(questionInterval);
    }
  }, [showResult, gameCompleted, currentQuestion, questionTimeLimit, practiceMode, mode]);
  
  // Overall time limit check (disabled in practice mode)
  useEffect(() => {
    if (practiceMode) return;
    if (overallTime >= overallTimeLimit && !gameCompleted) {
      setIsTimeUp(true);
      setGameCompleted(true);
    }
  }, [overallTime, overallTimeLimit, gameCompleted, practiceMode]);

  const triggerCoinAnimation = (amount: number) => {
    const id = Date.now();
    setCoinAnimations(prev => [...prev, { id, amount }]);
    setTimeout(() => {
      setCoinAnimations(prev => prev.filter(anim => anim.id !== id));
    }, 2600);
  };

  // Persist wallet coins in localStorage (cumulative outside the current session)
  const addToWallet = (amount: number) => {
    try {
      const curr = Number(localStorage.getItem('player:coins') || '0');
      const next = Math.max(0, curr + amount);
      localStorage.setItem('player:coins', String(next));
    } catch {}
  };
  
  const handleTimeUp = () => {
    // Auto-skip question when time runs out
    if (showResult || gameCompleted) return;
    
    setIsCorrect(false);
    setShowResult(true);
    
    // Lose a heart
    const newHearts = hearts - 1;
    setHearts(newHearts);
    setBlinkHeart(true);
    setTimeout(() => setBlinkHeart(false), 1000);
  };

  const handleAnswerSelect = (index: number) => {
    if (!showResult) {
      setSelectedAnswer(index);
    }
  };

  const handleCheckAnswer = () => {
    if (selectedAnswer === null) return;

    const correct = selectedAnswer === question.correctAnswer;
    if (correct) {
      setIsCorrect(true);
      setShowResult(true);
      // Battle AI round resolution when student correct
      if (mode === 'battle-ai') {
        const studentElapsed = Date.now() - questionStartAtRef.current;
        const studentShouldWin = Math.random() < studentWinProbRef.current;
        // Decide AI correctness and speed
        const aiWillBeCorrect = studentShouldWin ? Math.random() < 0.5 : true; // sometimes let AI be wrong even if student should win
        let aiElapsed = Math.max(1200, Math.min(8000, Math.round(studentElapsed + (studentShouldWin ? 500 + Math.random()*1500 : -500 - Math.random()*1500))));
        let studentWinsRound = false;
        if (!aiWillBeCorrect) {
          // AI wrong => student wins the point implicitly
          studentWinsRound = true;
        } else {
          // both correct, tiebreaker: faster time wins the round point
          if (aiElapsed < studentElapsed) {
            setAiScore(prev => prev + 1);
            studentWinsRound = false;
          } else {
            studentWinsRound = true;
          }
        }
        if (studentWinsRound) setPlayerPoints(p => p + 1);
      }
      // Add remaining per-question reward (after hints used)
      const earned = Math.max(0, questionReward);
      if (earned > 0) {
        setCoins(prev => prev + earned);
        const gainId = Date.now();
        setCoinGain({ amount: earned, id: gainId });
        triggerCoinAnimation(earned);
        addToWallet(earned);
        // Clear coin gain notification after 2 seconds
        setTimeout(() => {
          setCoinGain(prev => prev?.id === gainId ? null : prev);
        }, 2000);
        if (userId && !guest) {
          incrementTotals(userId, earned, 0).catch(() => {});
        }
      }
      // Increment correct count and award milestones
      setCorrectAnswers(prev => {
        const newCount = prev + 1;
        const ratio = newCount / total; // 0..1 for the daily set of 10
        if (userId && !guest) {
          incrementTotals(userId, 0, 1).catch(() => {});
        }
        // 10% milestone: +5 coins
        if (!milestonesAwarded.current.m10 && ratio >= 0.10) {
          milestonesAwarded.current.m10 = true;
          setMilestonesState(s => ({ ...s, m10: true }));
          setCoins(c => c + 5);
          addToWallet(5);
          const gainId = Date.now() + 1;
          setCoinGain({ amount: 5, id: gainId });
          triggerCoinAnimation(5);
          // Clear coin gain notification after 2 seconds
          setTimeout(() => {
            setCoinGain(prev => prev?.id === gainId ? null : prev);
          }, 2000);
          if (userId && !guest) {
            incrementTotals(userId, 5, 0).catch(() => {});
            unlockAchievement(userId, "m10", { date: today, correct: newCount, total }).catch(() => {});
            setLifetimeAchievements(prev => new Set(prev).add("m10"));
          }
          toast({ title: "Milestone reached!", description: "10% complete — +5 coins" });
        }
        // 25% Silver
        if (!milestonesAwarded.current.m25 && ratio >= 0.25) {
          milestonesAwarded.current.m25 = true;
          setMilestonesState(s => ({ ...s, m25: true }));
          if (userId && !guest) {
            unlockAchievement(userId, "m25", { date: today, correct: newCount, total }).catch(() => {});
            setLifetimeAchievements(prev => new Set(prev).add("m25"));
          }
          toast({ title: "Milestone reached!", description: "25% complete — Silver bar earned" });
        }
        // 50% Gold
        if (!milestonesAwarded.current.m50 && ratio >= 0.50) {
          milestonesAwarded.current.m50 = true;
          setMilestonesState(s => ({ ...s, m50: true }));
          if (userId && !guest) {
            unlockAchievement(userId, "m50", { date: today, correct: newCount, total }).catch(() => {});
            setLifetimeAchievements(prev => new Set(prev).add("m50"));
          }
          toast({ title: "Milestone reached!", description: "50% complete — Gold bar earned" });
        }
        // 75% Platinum
        if (!milestonesAwarded.current.m75 && ratio >= 0.75) {
          milestonesAwarded.current.m75 = true;
          setMilestonesState(s => ({ ...s, m75: true }));
          if (userId && !guest) {
            unlockAchievement(userId, "m75", { date: today, correct: newCount, total }).catch(() => {});
            setLifetimeAchievements(prev => new Set(prev).add("m75"));
          }
          toast({ title: "Milestone reached!", description: "75% complete — Platinum bar earned" });
        }
        // 100% Diamond
        if (!milestonesAwarded.current.m100 && ratio >= 1.0) {
          milestonesAwarded.current.m100 = true;
          setMilestonesState(s => ({ ...s, m100: true }));
          if (userId && !guest) {
            unlockAchievement(userId, "m100", { date: today, correct: newCount, total }).catch(() => {});
            setLifetimeAchievements(prev => new Set(prev).add("m100"));
          }
          toast({ title: "Milestone reached!", description: "100% complete — Diamond earned" });
        }
        return newCount;
      });
      // Restore one heart ONLY if correct on first try (not during second chance)
      if (!secondChance && hearts < 5) {
        setHearts(h => Math.min(5, h + 1));
      }
      setBlinkHeart(false);
      setSecondChance(false);
    } else {
      if (!secondChance) {
        // First wrong: warn and allow second chance
        setSecondChance(true);
        setBlinkHeart(true);
        setSecondChanceOpen(true);
        setLockedWrongIndex(selectedAnswer);
        setSelectedAnswer(null); // force new selection from remaining options
        // do not show result yet, and do not change hearts
        return;
      }
      // Second wrong: lose one heart and end question
      setIsCorrect(false);
      setShowResult(true);
      if (mode === 'battle-ai') {
        // Student wrong on final attempt: decide AI outcome in favor of AI unless studentShouldWin flips it
        const studentShouldWin = Math.random() < studentWinProbRef.current;
        if (!studentShouldWin) {
          setAiScore(prev => prev + 1);
        }
        // if studentShouldWin, we treat as both wrong: no AI point
      }
      setHearts(prev => Math.max(0, prev - 1));
      setBlinkHeart(false);
      setSecondChance(false);
    }
  };

  const handleNext = () => {
    if (currentQuestion < shuffledQuestions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
      setSelectedAnswer(null);
      setShowResult(false);
      setShowHint(false);
    } else {
      setGameCompleted(true);
    }
  };

  const handleSkip = () => {
    handleNext();
  };

  const handleHint = () => {
    const cost = getHintCost(question.difficulty);
    if (!showHint && questionReward >= cost) {
      setQuestionReward(prev => Math.max(0, prev - cost));
      setShowHint(true);
    }
  };

  const handleRestart = () => {
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setIsCorrect(false);
    setHearts(5);
    setCoins(0);
    setCorrectAnswers(0);
    setShowHint(false);
    setGameCompleted(false);
    setShuffledQuestions(shuffleQuestionSet(dailyQuestions));
    setBlinkHeart(false);
    setSecondChance(false);
    setCoinGain(null);
    setOverallTime(0);
    setQuestionTime(0);
    setIsTimeUp(false);
    setAiScore(0);
    setPlayerPoints(0);
    questionStartAtRef.current = Date.now();
  };

  // Persist progress snapshot for authenticated users
  useEffect(() => {
    if (!userId || guest) return;
    const snapshot = {
      correct_count: correctAnswers,
      coins_earned: coins,
      milestones: milestonesState as Record<string, boolean>,
      completed: gameCompleted,
    };
    saveDailyProgressSnapshot(userId, today, difficulty, snapshot).catch(() => {});
  }, [userId, guest, today, difficulty, correctAnswers, coins, milestonesState, gameCompleted]);

  // Persist last seen progress snapshot for Treasure page (local)
  useEffect(() => {
    try {
      localStorage.setItem('player:lastProgressCorrect', String(correctAnswers));
      localStorage.setItem('player:lastProgressTotal', String(total));
    } catch {}
  }, [correctAnswers, total]);

  if (loadingDaily) {
    return <div className="min-h-screen flex items-center justify-center">Loading daily set...</div>;
  }

  if (!shuffledQuestions.length) {
    return <div className="min-h-screen flex items-center justify-center">No questions available.</div>;
  }

  if (gameCompleted) {
    return (
      <ResultScreen
        coins={coins}
        correctAnswers={mode === 'battle-ai' ? playerPoints : correctAnswers}
        aiScore={mode === 'battle-ai' ? aiScore : undefined}
        opponentName={mode === 'battle-ai' ? 'AI Bot' : undefined}
        onRestart={handleRestart}
        gameOver={isTimeUp}
      />
    );
  }

  if (hearts === 0) {
    return <ResultScreen coins={coins} correctAnswers={correctAnswers} onRestart={handleRestart} gameOver />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-20 left-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-40 h-40 bg-secondary/10 rounded-full blur-3xl" />
      <div className="absolute top-1/2 left-1/3 w-24 h-24 bg-accent/10 rounded-full blur-2xl" />
      
      {/* Coin Animations */}
      {coinAnimations.map(anim => (
        <CoinAnimation key={anim.id} amount={anim.amount} />
      ))}

      {/* Game Header */}
      <GameHeader 
        hearts={hearts} 
        coins={coins} 
        progress={progress} 
        blinkHeart={blinkHeart} 
        coinGain={coinGain}
        onTreasureClick={() => setShowAchievements(true)}
        overallTime={overallTime}
        overallTimeLimit={overallTimeLimit}
        showTimer={!practiceMode && mode !== 'battle-ai'}
      />
      
      {/* Achievement Modal */}
      <AchievementModal
        open={showAchievements}
        onOpenChange={setShowAchievements}
        coins={coins}
        correctAnswers={correctAnswers}
        totalQuestions={total}
        lifetime={lifetimeAchievements}
      />

      {/* Main Game Area */}
      <div className="container mx-auto px-2 sm:px-3 pt-14 sm:pt-16 lg:pt-20 pb-3 sm:pb-4 lg:pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 lg:gap-6 max-w-5xl xl:max-w-6xl mx-auto">
          {/* Left: AI Panel in Battle-AI, else Monkey Progress */}
          <div className="lg:col-span-2 flex justify-center lg:justify-start min-w-0">
            {mode === 'battle-ai' ? (
              <div className="w-full max-w-[180px] bg-white/70 backdrop-blur rounded-xl border p-3 shadow flex flex-col items-center gap-3">
                <img src="/assets/AIimage.png" alt="AI" className="w-full h-28 object-cover rounded-lg" />
                <div className="text-sm font-bold">AI Answer:</div>
                <div className="px-3 py-1.5 rounded-md border bg-gray-50 text-gray-600 text-xs font-semibold">Answer Masked</div>
              </div>
            ) : (
              <MonkeyProgress progress={correctAnswers} total={total} />
            )}
          </div>

          {/* Center: Question */}
          <div className="lg:col-span-7 min-w-0">
            <QuestionCard
              question={question}
              selectedAnswer={selectedAnswer}
              showResult={showResult}
              isCorrect={isCorrect}
              onAnswerSelect={handleAnswerSelect}
              onCheckAnswer={handleCheckAnswer}
              onNext={handleNext}
              onSkip={handleSkip}
              onHint={handleHint}
              showHint={showHint}
              coins={coins}
              questionReward={questionReward}
              questionNumber={currentQuestion + 1}
              totalQuestions={total}
              questionTime={mode !== 'battle-ai' && !practiceMode ? questionTime : undefined}
              questionTimeLimit={mode !== 'battle-ai' && !practiceMode ? questionTimeLimit : undefined}
              showTimer={mode !== 'battle-ai' && !practiceMode}
              lockedWrongIndex={lockedWrongIndex}
              secondChance={secondChance}
              difficultyLabel={mode === 'battle-ai' ? (difficulty === 'easy' ? 'Steady AI' : (difficulty === 'moderate' ? 'Smart AI' : 'Speed AI')) : undefined}
            />

          </div>

          {/* Right column: User panel in Battle-AI */}
          <div className="lg:col-span-3">
            {mode === 'battle-ai' && (
              <div className="w-full bg-white/70 backdrop-blur rounded-xl border p-4 shadow flex flex-col items-center gap-3">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-200 to-yellow-100 flex items-center justify-center text-4xl">🙂</div>
                <div className="text-sm font-bold">Your Answer:</div>
                <div className="min-w-[72px] text-center px-4 py-2 rounded-md border bg-gray-50 text-gray-800 text-base font-extrabold">
                  {selectedAnswer === null ? '-' : String.fromCharCode(65 + selectedAnswer)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Second chance modal */}
      <AlertDialog open={secondChanceOpen} onOpenChange={setSecondChanceOpen}>
        <AlertDialogContent className="border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-extrabold flex items-center gap-2">
              <span className="text-2xl">⚠️</span> Oops! Try once more!
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              One more chance before you lose a heart. Choose carefully!
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogAction className="bg-amber-500 hover:bg-amber-600 text-white font-bold" onClick={() => setSecondChanceOpen(false)}>
            Try Again
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
