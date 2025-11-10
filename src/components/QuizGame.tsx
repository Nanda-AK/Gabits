import { useMemo, useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

import { questions, getDifficultyCoins, getHintCost } from "@/data/questions";
import type { Question, Difficulty } from "@/data/questions";
import { QuestionCard } from "./QuestionCard";
import { GameHeader } from "./GameHeader";
import { MonkeyProgress } from "./MonkeyProgress";
import { ResultScreen } from "./ResultScreen";
import { CoinAnimation } from "./CoinAnimation";
import { BattleSummary } from "./BattleSummary";
import { ScribbleBoard } from "./ScribbleBoard";
import { TableBoard } from "./TableBoard";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogAction } from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { getOrCreateDailySet, getDailyProgress, saveDailyProgressSnapshot } from "@/services/progress";
// removed Achievement modal usage; use Treasure page instead
import { incrementTotals } from "@/services/totals";
import { resolveBattleResults, saveBattleMatch, saveBattlePerformance } from "@/services/battle";
import type { Winner } from "@/services/battle";
import { getProfile } from "@/services/profile";
import { logSpeedRun } from "@/services/speed";
import { getLocalYMD } from "@/lib/date";
import { grantPracticeRewards, grantCompeteRewards } from "@/services/rewards";

interface QuizGameProps {
  difficulty?: Difficulty;
  mode?: 'practice' | 'speed' | 'battle-ai';
  topic?: 'mixed' | 'addition' | 'subtraction' | 'multiplication' | 'division' | 'fractions' | 'algebra';
  topics?: string[]; // normalized later
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
  const ymd = parseInt(
    `${d.getFullYear()}${(d.getMonth() + 1).toString().padStart(2, "0")}${d
      .getDate()
      .toString()
      .padStart(2, "0")}`
  );
  const rand = seededRandom(ymd);
  const idxs = all.map((_, i) => i);
  for (let i = idxs.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
  }
  return idxs.slice(0, Math.min(count, all.length)).map((i) => all[i]);
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

export const QuizGame = ({ difficulty = 'moderate', mode = 'practice', topic, topics }: QuizGameProps) => {
  const location = useLocation();
  const practiceMode = mode === 'practice' && location.pathname.startsWith('/play');
  const { user, guest } = useAuth();
  const userId = user?.id;
  const today = useMemo(() => getLocalYMD(), []);
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
  const [overallTime, setOverallTime] = useState(0);
  // Right column tools (Practice & Speed)
  const [showScribble, setShowScribble] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [questionTime, setQuestionTime] = useState(0);
  const [questionTimeLimit, setQuestionTimeLimit] = useState(30);
  const [overallTimeLimit] = useState(600); // 10 minutes total
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [aiScore, setAiScore] = useState(0);
  const [playerPoints, setPlayerPoints] = useState(0);
  const questionStartAtRef = useRef<number>(Date.now());
  const studentWinProbRef = useRef<number>(0.6 + Math.random() * 0.1); // 60-70% student win bias
  const [milestonesState, setMilestonesState] = useState({ m10: false, m25: false, m50: false, m75: false, m100: false });
  // Battle AI (post-quiz resolution)
  const [battleStarted, setBattleStarted] = useState(mode !== 'battle-ai');
  const [studentCorrectList, setStudentCorrectList] = useState<boolean[]>([]);
  const [studentTimesList, setStudentTimesList] = useState<number[]>([]);
  const [aiCorrectList, setAiCorrectList] = useState<boolean[]>([]);
  const [aiTimesList, setAiTimesList] = useState<number[]>([]);
  const [winnersList, setWinnersList] = useState<Winner[]>([]);
  const [battleDone, setBattleDone] = useState(false);
  // Speed-only: track whether each answered question met the within-time threshold
  const [withinTimeList, setWithinTimeList] = useState<boolean[]>([]);
  const [practiceRewards, setPracticeRewards] = useState<{ coins_awarded: number; gems_awarded: number; streak_after: number; badges_awarded: string[] } | null>(null);

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

  // Canonicalize question type and requested topics
  const canonicalize = (t: string): string => {
    const s = (t || '').toLowerCase();
    if (s.startsWith('add')) return 'addition';
    if (s.startsWith('sub')) return 'subtraction';
    if (s.startsWith('mul')) return 'multiplication';
    if (s.startsWith('div')) return 'division';
    if (s.startsWith('frac')) return 'fractions';
    if (s.startsWith('alg')) return 'algebra';
    return s;
  };
  const guessType = (q: Question): string => {
    const allowed = new Set(['addition','subtraction','multiplication','division','fractions','algebra']);
    const byType = canonicalize((q as any).type || '');
    if (allowed.has(byType)) return byType;
    const text = `${q.hint || ''} ${q.question || ''}`.toLowerCase();
    if (text.includes('fraction') || text.includes('/') ) return 'fractions';
    if (text.includes('solve for x') || /\bx\b/.test(text)) return 'algebra';
    if (text.includes('multiply') || text.includes('per hour')) return 'multiplication';
    if (text.includes('divide') || text.includes('each')) return 'division';
    if (text.includes('subtract') || text.includes('remain') || text.includes('left')) return 'subtraction';
    if (text.includes('add') || text.includes('sum') || text.includes('total')) return 'addition';
    return byType || 'addition';
  };
  const selectedTopics = useMemo(() => {
    const arr = Array.isArray(topics) && topics.length > 0
      ? topics
      : (topic && topic !== 'mixed' ? [topic] : []);
    const set = new Set(arr.map(canonicalize));
    return set;
  }, [topic, topics]);

  // Load daily set from Supabase for authenticated users; fallback to local for guests
  const [dailyQuestions, setDailyQuestions] = useState<Question[]>([]);
  const [loadingDaily, setLoadingDaily] = useState(true);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingDaily(true);
      const all = questions.filter(q => q.difficulty === difficulty);
      const filtered = selectedTopics.size
        ? all.filter(q => selectedTopics.has(guessType(q)))
        : all;
      const pool = filtered.length ? filtered : all; // fallback if empty
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
  }, [difficulty, userId, guest, today, selectedTopics]);

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
    
    // Set time threshold / limit based on difficulty
    if (question) {
      if (mode === 'battle-ai') {
        setQuestionTimeLimit(30);
      } else if (mode === 'speed') {
        const thr = question.difficulty === 'easy' ? 15 : (question.difficulty === 'moderate' ? 25 : 30);
        setQuestionTimeLimit(thr); // used for UI only; we won't auto-skip in speed
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

  // Removed lifetime achievements modal usage; /treasure shows wallet and achievements
  
  // Timer effects (keep overall timer even in practice to measure used_seconds; no per-question timer in practice)
  useEffect(() => {
    if (mode === 'battle-ai') return; // no overall timer in battle AI
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
          if (mode !== 'speed' && newTime >= questionTimeLimit) {
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

  // Practice: on completion, grant rewards via server (topic, used_seconds, local date) - streak-based only
  const practiceGrantRef = useRef<boolean>(false);
  useEffect(() => {
    if (mode !== 'practice') return;
    if (!gameCompleted) return;
    if (!userId || guest) return;
    if (practiceGrantRef.current) return;
    practiceGrantRef.current = true;
    const localDate = getLocalYMD();
    const topic = inferMathType(shuffledQuestions);
    grantPracticeRewards({
      user_id: userId,
      topic,
      used_seconds: overallTime,
      date: localDate,
      question_coins: 0, // Practice: NO per-question coins, only streak rewards
    }).then(result => {
      if (result) setPracticeRewards(result);
    }).catch(() => {});
  }, [mode, gameCompleted, userId, guest, shuffledQuestions, overallTime]);

  // Compete (AI): after battle resolved and marked done, grant rewards once
  const competeGrantRef = useRef<boolean>(false);
  useEffect(() => {
    if (mode !== 'battle-ai') return;
    if (!battleDone) return;
    if (!userId || guest) return;
    if (competeGrantRef.current) return;
    competeGrantRef.current = true;
    const localDate = getLocalYMD();
    const result: 'win' | 'loss' | 'draw' = playerPoints > aiScore ? 'win' : (playerPoints < aiScore ? 'loss' : 'draw');
    grantCompeteRewards({
      user_id: userId,
      type: 'ai',
      date: localDate,
      difficulty,
      result,
    }).catch(() => {});
  }, [mode, battleDone, userId, guest, playerPoints, aiScore, difficulty]);

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
      // Coins for this question
      let earned = 0;
      if (mode === 'speed') {
        const thr = question.difficulty === 'easy' ? 15 : (question.difficulty === 'moderate' ? 25 : 30);
        const within = questionTime <= thr;
        setWithinTimeList(prev => { const next = prev.slice(); next[currentQuestion] = within; return next; });
        if (question.difficulty === 'easy') earned = within ? 3 : 1;
        else if (question.difficulty === 'moderate') earned = within ? 5 : 2;
        else earned = within ? 8 : 4;
      } else if (mode !== 'practice') {
        // Battle modes: use existing reward minus hint cost
        earned = Math.max(0, questionReward);
      }
      // Practice mode: NO per-question coins (streak-based only at completion)
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
        if (userId && !guest && mode !== 'speed') {
          // Persist only for non-speed here. Speed session is logged at completion.
          incrementTotals(userId, earned, 0).catch(() => {});
        }
      }
      // Increment correct count and award milestones
      setCorrectAnswers(prev => {
        const newCount = prev + 1;
        const ratio = newCount / total; // 0..1 for the daily set of 10
        if (userId && !guest && mode !== 'speed') {
          incrementTotals(userId, 0, 1).catch(() => {});
        }
        // 10% milestone: internal flag only for speed logging
        if (!milestonesAwarded.current.m10 && ratio >= 0.10) {
          milestonesAwarded.current.m10 = true;
          setMilestonesState(s => ({ ...s, m10: true }));
        }
        // 25% Silver
        if (!milestonesAwarded.current.m25 && ratio >= 0.25) {
          milestonesAwarded.current.m25 = true;
          setMilestonesState(s => ({ ...s, m25: true }));
        }
        // 50% Gold
        if (!milestonesAwarded.current.m50 && ratio >= 0.50) {
          milestonesAwarded.current.m50 = true;
          setMilestonesState(s => ({ ...s, m50: true }));
        }
        // 75% Platinum
        if (!milestonesAwarded.current.m75 && ratio >= 0.75) {
          milestonesAwarded.current.m75 = true;
          setMilestonesState(s => ({ ...s, m75: true }));
        }
        // 100% Diamond
        if (!milestonesAwarded.current.m100 && ratio >= 1.0) {
          milestonesAwarded.current.m100 = true;
          setMilestonesState(s => ({ ...s, m100: true }));
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
        // Internal milestone flags for logging only
        const ratio = sc.length ? (sc.filter(Boolean).length / sc.length) : 0;
        if (ratio >= 0.10) { setMilestonesState(s => ({ ...s, m10: true })); }
        if (ratio >= 0.25) { setMilestonesState(s => ({ ...s, m25: true })); }
        if (ratio >= 0.50) { setMilestonesState(s => ({ ...s, m50: true })); }
        if (ratio >= 0.75) { setMilestonesState(s => ({ ...s, m75: true })); }
        if (ratio >= 1.00) { setMilestonesState(s => ({ ...s, m100: true })); }
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
        if (ratio >= 0.10) { setMilestonesState(s => ({ ...s, m10: true })); }
        if (ratio >= 0.25) { setMilestonesState(s => ({ ...s, m25: true })); }
        if (ratio >= 0.50) { setMilestonesState(s => ({ ...s, m50: true })); }
        if (ratio >= 0.75) { setMilestonesState(s => ({ ...s, m75: true })); }
        if (ratio >= 1.00) { setMilestonesState(s => ({ ...s, m100: true })); }
      }
      setBattleDone(true);
      // Mark daily progress as completed so Week Progress can reflect it
      setGameCompleted(true);
    }
  };

  const handleHint = () => {
    // In practice mode, hints are free and do not reduce rewards
    if (mode === 'practice') {
      if (!showHint) setShowHint(true);
      return;
    }
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
    setWithinTimeList([]);
    questionStartAtRef.current = Date.now();
    // Reset battle state
    setStudentCorrectList([]);
    setStudentTimesList([]);
    setAiCorrectList([]);
    setAiTimesList([]);
    setWinnersList([]);
    setBattleDone(false);
    if (mode === 'battle-ai') setBattleStarted(false);
    // Allow practice rewards to grant again on the next completion
    practiceGrantRef.current = false;
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

  // When a Speed run completes, log it to the server (coins, correct, milestones, fast_flawless)
  useEffect(() => {
    if (mode !== 'speed') return;
    if (!gameCompleted) return;
    if (!userId || guest) return;
    const localDate = getLocalYMD();
    const ff = (correctAnswers === total) && withinTimeList.slice(0, total).every(Boolean);
    const m = milestonesState;
    logSpeedRun({
      user_id: userId,
      date: localDate,
      difficulty,
      correct: correctAnswers,
      coins,
      m10: m.m10,
      m25: m.m25,
      m50: m.m50,
      m75: m.m75,
      m100: m.m100,
      fast_flawless: ff,
    }).catch(() => {});
  }, [mode, gameCompleted, userId, guest, correctAnswers, total, withinTimeList, milestonesState, coins, difficulty]);

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
        mode={mode}
        practiceRewards={mode === 'practice' ? practiceRewards : undefined}
        questions={shuffledQuestions}
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
          overallTime={overallTime}
          overallTimeLimit={overallTimeLimit}
          showTimer={!practiceMode}
        />
      )}
      
      {/* Removed in-game treasure modal; use dedicated /treasure page */}

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
            ) : mode === 'practice' || mode === 'speed' ? (
              <div className="w-full max-w-[200px]" aria-hidden="true" />
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
              showCoinInfo={mode !== 'practice'}
              hintFree={mode === 'practice'}
              showDifficultyBadge={mode !== 'practice'}
            />

          </div>

          {/* Right column: User panel or tools */}
          <div className="lg:col-span-3 hidden lg:block">
            {mode === 'battle-ai' ? (
              <div className="w-full bg-white/80 backdrop-blur rounded-2xl border-2 border-primary/20 p-5 shadow-lg flex flex-col items-center gap-3">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-200 to-yellow-100 flex items-center justify-center text-4xl shadow">🙂</div>
                <div className="text-sm font-bold">Your Answer:</div>
                <div className="min-w-[72px] text-center px-4 py-2 rounded-md border bg-gray-50 text-gray-800 text-base font-extrabold shadow-sm">
                  {selectedAnswer === null ? '-' : String.fromCharCode(65 + selectedAnswer)}
                </div>
              </div>
            ) : (mode === 'practice' || mode === 'speed') ? (
              showScribble ? (
                <ScribbleBoard onClose={() => setShowScribble(false)} />
              ) : showTable ? (
                <TableBoard onClose={() => setShowTable(false)} />
              ) : (
                <div className="w-full bg-white/70 backdrop-blur rounded-2xl border-2 border-primary/10 p-4 shadow-lg flex flex-col gap-2">
                  <div className="text-sm font-semibold text-muted-foreground">Tools</div>
                  <Button variant="outline" className="w-full" onClick={() => { setShowScribble(true); setShowTable(false); }}>Scribble Board</Button>
                  <Button variant="outline" className="w-full" onClick={() => { setShowTable(true); setShowScribble(false); }}>Tables 2–12</Button>
                </div>
              )
            ) : null}
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
