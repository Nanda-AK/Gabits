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
import { BattleSummary } from "./BattleSummary";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogAction } from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { getOrCreateDailySet, getDailyProgress, saveDailyProgressSnapshot } from "@/services/progress";
import { getAchievements, unlockAchievement } from "@/services/achievements";
import type { AchievementKey } from "@/services/achievements";
import { incrementTotals } from "@/services/totals";
import { resolveBattleResults, saveBattleMatch, saveBattlePerformance } from "@/services/battle";
import type { Winner } from "@/services/battle";
import { getProfile } from "@/services/profile";

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
  const [displayName, setDisplayName] = useState<string>('You');
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
  // Battle AI (post-quiz resolution)
  const [battleStarted, setBattleStarted] = useState(mode !== 'battle-ai');
  const [studentCorrectList, setStudentCorrectList] = useState<boolean[]>([]);
  const [studentTimesList, setStudentTimesList] = useState<number[]>([]);
  const [aiCorrectList, setAiCorrectList] = useState<boolean[]>([]);
  const [aiTimesList, setAiTimesList] = useState<number[]>([]);
  const [winnersList, setWinnersList] = useState<Winner[]>([]);
  const [battleDone, setBattleDone] = useState(false);

  // Infer a simple math type for HR summary from the active question set
  const inferMathType = (qs: Question[]): string => {
    let add = 0, sub = 0, mul = 0, div = 0;
    const inc = (h: string, q: string) => {
      const H = (h || '').toLowerCase();
      const Q = (q || '').toLowerCase();
      if (H.includes('add') || Q.includes('add') || Q.includes('sum') || Q.includes('total')) add++;
      if (H.includes('subtract') || Q.includes('remain') || Q.includes('left')) sub++;
      if (H.includes('multiply') || Q.includes('multiply') || Q.includes('per hour')) mul++;
      if (H.includes('divide') || Q.includes('divide') || Q.includes('each')) div++;
    };
    qs.forEach(q => inc(q.hint, q.question));
    const arr = [
      { k: 'addition', v: add },
      { k: 'subtraction', v: sub },
      { k: 'multiplication', v: mul },
      { k: 'division', v: div },
    ].sort((a,b) => b.v - a.v);
    return arr[0].v === 0 ? 'mixed' : arr[0].k;
  };

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
    if (mode === 'battle-ai') {
      // Start timing immediately when question becomes visible
      questionStartAtRef.current = Date.now();
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

  // Resolve display name (prefer profile full_name, then metadata, then email username)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const metaName = (user?.user_metadata?.full_name as string) || (user?.user_metadata?.name as string) || (user?.user_metadata?.user_name as string) || (user?.user_metadata?.username as string) || null;
      const emailName = user?.email ? user.email.split('@')[0] : null;
      if (!userId || guest) {
        if (!cancelled) setDisplayName(metaName || emailName || 'You');
        return;
      }
      try {
        const p = await getProfile(userId);
        if (!cancelled) setDisplayName(p?.full_name || metaName || emailName || 'You');
      } catch {
        if (!cancelled) setDisplayName(metaName || emailName || 'You');
      }
    };
    load();
    return () => { cancelled = true; };
  }, [userId, guest, user]);

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
          // removed milestone toast
        }
        // 25% Silver
        if (!milestonesAwarded.current.m25 && ratio >= 0.25) {
          milestonesAwarded.current.m25 = true;
          setMilestonesState(s => ({ ...s, m25: true }));
          if (userId && !guest) {
            unlockAchievement(userId, "m25", { date: today, correct: newCount, total }).catch(() => {});
            setLifetimeAchievements(prev => new Set(prev).add("m25"));
          }
          // removed milestone toast
        }
        // 50% Gold
        if (!milestonesAwarded.current.m50 && ratio >= 0.50) {
          milestonesAwarded.current.m50 = true;
          setMilestonesState(s => ({ ...s, m50: true }));
          if (userId && !guest) {
            unlockAchievement(userId, "m50", { date: today, correct: newCount, total }).catch(() => {});
            setLifetimeAchievements(prev => new Set(prev).add("m50"));
          }
          // removed milestone toast
        }
        // 75% Platinum
        if (!milestonesAwarded.current.m75 && ratio >= 0.75) {
          milestonesAwarded.current.m75 = true;
          setMilestonesState(s => ({ ...s, m75: true }));
          if (userId && !guest) {
            unlockAchievement(userId, "m75", { date: today, correct: newCount, total }).catch(() => {});
            setLifetimeAchievements(prev => new Set(prev).add("m75"));
          }
          // removed milestone toast
        }
        // 100% Diamond
        if (!milestonesAwarded.current.m100 && ratio >= 1.0) {
          milestonesAwarded.current.m100 = true;
          setMilestonesState(s => ({ ...s, m100: true }));
          if (userId && !guest) {
            unlockAchievement(userId, "m100", { date: today, correct: newCount, total }).catch(() => {});
            setLifetimeAchievements(prev => new Set(prev).add("m100"));
          }
          // removed milestone toast
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

  // Battle mode handlers (post-quiz resolution)
  const handleNextBattle = () => {
    if (mode !== 'battle-ai') return handleNext();
    if (selectedAnswer === null) return; // Next disabled until selected
    const idx = currentQuestion;
    const elapsed = Date.now() - questionStartAtRef.current;
    const isLocalCorrect = selectedAnswer === question.correctAnswer;

    setStudentCorrectList(prev => {
      const next = prev.slice();
      next[idx] = isLocalCorrect;
      return next;
    });
    setStudentTimesList(prev => {
      const next = prev.slice();
      next[idx] = elapsed;
      return next;
    });

    if (currentQuestion < shuffledQuestions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
      setSelectedAnswer(null);
      setShowHint(false);
      setShowResult(false);
    } else {
      const sc = [...studentCorrectList];
      sc[idx] = isLocalCorrect;
      const st = [...studentTimesList];
      st[idx] = elapsed;
      const res = resolveBattleResults(difficulty, sc, st);
      setAiCorrectList(res.aiCorrect);
      setAiTimesList(res.aiTimesMs);
      setWinnersList(res.winners);
      setPlayerPoints(res.studentPoints);
      setAiScore(res.aiPoints);
      // Save to Supabase (non-blocking)
      if (userId && !guest) {
        saveBattleMatch({
          user_id: userId,
          date: today,
          difficulty,
          student_correct: sc,
          student_times_ms: st,
          ai_correct: res.aiCorrect,
          ai_times_ms: res.aiTimesMs,
          winners: res.winners,
          student_points: res.studentPoints,
          ai_points: res.aiPoints,
        });
        saveBattlePerformance({
          user_id: userId,
          date: today,
          difficulty,
          math_type: inferMathType(shuffledQuestions),
          student_points: res.studentPoints,
          ai_points: res.aiPoints,
          result: res.studentPoints > res.aiPoints ? 'win' : res.studentPoints < res.aiPoints ? 'loss' : 'draw',
        });
        // Lifetime totals: count correct answers from this battle (no coins here)
        try { incrementTotals(userId, 0, sc.filter(Boolean).length); } catch {}
        // Unlock milestone achievements based on final ratio (safe due to unique on user_id,key)
        const ratio = sc.length ? (sc.filter(Boolean).length / sc.length) : 0;
        if (ratio >= 0.10) { unlockAchievement(userId, "m10", { date: today, correct: sc.filter(Boolean).length, total: sc.length }).catch(() => {}); setMilestonesState(s => ({ ...s, m10: true })); setLifetimeAchievements(prev => new Set(prev).add("m10")); }
        if (ratio >= 0.25) { unlockAchievement(userId, "m25", { date: today, correct: sc.filter(Boolean).length, total: sc.length }).catch(() => {}); setMilestonesState(s => ({ ...s, m25: true })); setLifetimeAchievements(prev => new Set(prev).add("m25")); }
        if (ratio >= 0.50) { unlockAchievement(userId, "m50", { date: today, correct: sc.filter(Boolean).length, total: sc.length }).catch(() => {}); setMilestonesState(s => ({ ...s, m50: true })); setLifetimeAchievements(prev => new Set(prev).add("m50")); }
        if (ratio >= 0.75) { unlockAchievement(userId, "m75", { date: today, correct: sc.filter(Boolean).length, total: sc.length }).catch(() => {}); setMilestonesState(s => ({ ...s, m75: true })); setLifetimeAchievements(prev => new Set(prev).add("m75")); }
        if (ratio >= 1.00) { unlockAchievement(userId, "m100", { date: today, correct: sc.filter(Boolean).length, total: sc.length }).catch(() => {}); setMilestonesState(s => ({ ...s, m100: true })); setLifetimeAchievements(prev => new Set(prev).add("m100")); }
      }
      setBattleDone(true);
      // Mark daily progress as completed so Week Progress can reflect it
      setGameCompleted(true);
    }
  };

  const handleSkipBattle = () => {
    if (mode !== 'battle-ai') return handleSkip();
    const idx = currentQuestion;
    const elapsed = Date.now() - questionStartAtRef.current;
    setSelectedAnswer(null);
    setStudentCorrectList(prev => { const next = prev.slice(); next[idx] = false; return next; });
    setStudentTimesList(prev => { const next = prev.slice(); next[idx] = elapsed; return next; });
    if (currentQuestion < shuffledQuestions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
      setShowHint(false);
      setShowResult(false);
    } else {
      const sc = [...studentCorrectList]; sc[idx] = false;
      const st = [...studentTimesList]; st[idx] = elapsed;
      const res = resolveBattleResults(difficulty, sc, st);
      setAiCorrectList(res.aiCorrect);
      setAiTimesList(res.aiTimesMs);
      setWinnersList(res.winners);
      setPlayerPoints(res.studentPoints);
      setAiScore(res.aiPoints);
      if (userId && !guest) {
        saveBattleMatch({
          user_id: userId,
          date: today,
          difficulty,
          student_correct: sc,
          student_times_ms: st,
          ai_correct: res.aiCorrect,
          ai_times_ms: res.aiTimesMs,
          winners: res.winners,
          student_points: res.studentPoints,
          ai_points: res.aiPoints,
        });
        saveBattlePerformance({
          user_id: userId,
          date: today,
          difficulty,
          math_type: inferMathType(shuffledQuestions),
          student_points: res.studentPoints,
          ai_points: res.aiPoints,
          result: res.studentPoints > res.aiPoints ? 'win' : res.studentPoints < res.aiPoints ? 'loss' : 'draw',
        });
        try { incrementTotals(userId, 0, sc.filter(Boolean).length); } catch {}
        const ratio = sc.length ? (sc.filter(Boolean).length / sc.length) : 0;
        if (ratio >= 0.10) { unlockAchievement(userId, "m10", { date: today, correct: sc.filter(Boolean).length, total: sc.length }).catch(() => {}); setMilestonesState(s => ({ ...s, m10: true })); setLifetimeAchievements(prev => new Set(prev).add("m10")); }
        if (ratio >= 0.25) { unlockAchievement(userId, "m25", { date: today, correct: sc.filter(Boolean).length, total: sc.length }).catch(() => {}); setMilestonesState(s => ({ ...s, m25: true })); setLifetimeAchievements(prev => new Set(prev).add("m25")); }
        if (ratio >= 0.50) { unlockAchievement(userId, "m50", { date: today, correct: sc.filter(Boolean).length, total: sc.length }).catch(() => {}); setMilestonesState(s => ({ ...s, m50: true })); setLifetimeAchievements(prev => new Set(prev).add("m50")); }
        if (ratio >= 0.75) { unlockAchievement(userId, "m75", { date: today, correct: sc.filter(Boolean).length, total: sc.length }).catch(() => {}); setMilestonesState(s => ({ ...s, m75: true })); setLifetimeAchievements(prev => new Set(prev).add("m75")); }
        if (ratio >= 1.00) { unlockAchievement(userId, "m100", { date: today, correct: sc.filter(Boolean).length, total: sc.length }).catch(() => {}); setMilestonesState(s => ({ ...s, m100: true })); setLifetimeAchievements(prev => new Set(prev).add("m100")); }
      }
      setBattleDone(true);
      // Mark daily progress as completed so Week Progress can reflect it
      setGameCompleted(true);
    }
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
    // Reset battle state
    setStudentCorrectList([]);
    setStudentTimesList([]);
    setAiCorrectList([]);
    setAiTimesList([]);
    setWinnersList([]);
    setBattleDone(false);
    if (mode === 'battle-ai') setBattleStarted(false);
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

  // Battle AI: start screen and summary
  if (mode === 'battle-ai') {
    const aiTypeLabel = difficulty === 'easy' ? 'Steady AI' : (difficulty === 'moderate' ? 'Smart AI' : 'Speed AI');
    if (!battleStarted) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 relative overflow-hidden">
          <div className="container mx-auto px-2 sm:px-3 pt-14 sm:pt-16 lg:pt-20 pb-3 sm:pb-4 lg:pb-6">
            <div className="text-center mb-6">
              <h1 className="text-2xl sm:text-3xl font-black">Battle AI</h1>
              <p className="text-muted-foreground">{aiTypeLabel} Vs {displayName || 'You'}</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 max-w-5xl mx-auto">
              <div className="lg:col-span-2 flex justify-center">
                <div className="w-full max-w-[200px] bg-white/80 backdrop-blur rounded-2xl border-2 border-primary/20 p-4 shadow-lg flex flex-col items-center gap-3">
                  <img src="/assets/AIimage.png" alt="AI" className="w-full h-28 object-cover rounded-lg" />
                  <div className="text-sm font-bold text-muted-foreground">Status: Ready</div>
                </div>
              </div>
              <div className="lg:col-span-7 min-w-0">
                <div className="bg-white/90 border-2 border-secondary/20 rounded-3xl p-10 shadow-2xl flex items-center justify-center">
                  <button onClick={() => { setBattleStarted(true); questionStartAtRef.current = Date.now(); }} className="px-10 py-3 rounded-full bg-green-600 hover:bg-green-700 text-white font-extrabold shadow-lg">
                    Start Game
                  </button>
                </div>
              </div>
              <div className="lg:col-span-3 flex justify-center">
                <div className="w-full bg-white/80 backdrop-blur rounded-2xl border-2 border-primary/20 p-5 shadow-lg flex flex-col items-center gap-3">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-200 to-yellow-100 flex items-center justify-center text-4xl shadow">🙂</div>
                  <div className="text-sm font-bold">Your Answer:</div>
                  <div className="min-w-[72px] text-center px-5 py-2 rounded-md border bg-gray-50 text-gray-800 text-base font-extrabold">-</div>
                  <div className="text-xs text-muted-foreground">Status: Ready</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
    if (battleDone) {
      const rows = shuffledQuestions.map((q, i) => ({
        index: i,
        student: { correct: !!studentCorrectList[i], timeMs: studentTimesList[i] ?? 0 },
        ai: { correct: !!aiCorrectList[i], timeMs: aiTimesList[i] ?? 0 },
        winner: winnersList[i] as Winner,
      }));
      return (
        <BattleSummary
          aiTypeLabel={aiTypeLabel}
          studentName={displayName || 'You'}
          studentPoints={playerPoints}
          aiPoints={aiScore}
          rows={rows}
          onRestart={handleRestart}
        />
      );
    }
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

      {/* Game Header (hidden in Battle AI) */}
      {mode !== 'battle-ai' && (
        <GameHeader 
          hearts={hearts} 
          coins={coins} 
          progress={progress} 
          blinkHeart={blinkHeart} 
          coinGain={coinGain}
          onTreasureClick={() => setShowAchievements(true)}
          overallTime={overallTime}
          overallTimeLimit={overallTimeLimit}
          showTimer={!practiceMode}
        />
      )}
      
      {/* Achievement Modal */}
      <AchievementModal
        open={showAchievements}
        onOpenChange={setShowAchievements}
        coins={coins}
        correctAnswers={correctAnswers}
        totalQuestions={total}
        lifetime={lifetimeAchievements}
      />

      {/* Battle header (visible during match) */}
      {mode === 'battle-ai' && (
        <div className="pt-14 sm:pt-16 lg:pt-20 text-center">
          <h1 className="text-2xl sm:text-3xl font-black">Battle AI</h1>
          <p className="text-muted-foreground">
            {(difficulty === 'easy' ? 'Steady AI' : (difficulty === 'moderate' ? 'Smart AI' : 'Speed AI'))} Vs {displayName || 'You'}
          </p>
        </div>
      )}

      {/* Main Game Area */}
      <div className="container mx-auto px-2 sm:px-3 pt-14 sm:pt-16 lg:pt-20 pb-3 sm:pb-4 lg:pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 lg:gap-6 max-w-5xl xl:max-w-6xl mx-auto">
          {/* Left: AI Panel in Battle-AI, else Monkey Progress */}
          <div className="lg:col-span-2 flex justify-center lg:justify-start min-w-0">
            {mode === 'battle-ai' ? (
              <div className="w-full max-w-[200px] bg-white/80 backdrop-blur rounded-2xl border-2 border-primary/20 p-4 shadow-lg flex flex-col items-center gap-3">
                <img src="/assets/AIimage.png" alt="AI" className="w-full h-28 object-cover rounded-lg" />
                <div className="text-sm font-bold">AI Answer:</div>
                <div className="px-3 py-1.5 rounded-md border bg-gray-50 text-gray-600 text-xs font-semibold shadow-sm">Answer Masked</div>
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
              onNext={mode === 'battle-ai' ? handleNextBattle : handleNext}
              onSkip={mode === 'battle-ai' ? handleSkipBattle : handleSkip}
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
              battleMode={mode === 'battle-ai'}
            />

          </div>

          {/* Right column: User panel in Battle-AI */}
          <div className="lg:col-span-3">
            {mode === 'battle-ai' && (
              <div className="w-full bg-white/80 backdrop-blur rounded-2xl border-2 border-primary/20 p-5 shadow-lg flex flex-col items-center gap-3">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-200 to-yellow-100 flex items-center justify-center text-4xl shadow">🙂</div>
                <div className="text-sm font-bold">Your Answer:</div>
                <div className="min-w-[72px] text-center px-4 py-2 rounded-md border bg-gray-50 text-gray-800 text-base font-extrabold shadow-sm">
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
