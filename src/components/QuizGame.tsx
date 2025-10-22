import { useMemo, useState, useEffect, useRef } from "react";
import { questions, getDifficultyCoins, getHintCost } from "@/data/questions";
import type { Question } from "@/data/questions";
import { QuestionCard } from "./QuestionCard";
import { GameHeader } from "./GameHeader";
import { MonkeyProgress } from "./MonkeyProgress";
import { ResultScreen } from "./ResultScreen";
import { CoinAnimation } from "./CoinAnimation";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogAction } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";

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

export const QuizGame = () => {
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
  const [questionReward, setQuestionReward] = useState(0);
  const [coinGain, setCoinGain] = useState<{ amount: number; id: number } | null>(null);
  // Global progress across all days
  const [globalCorrect, setGlobalCorrect] = useState<number>(() => {
    const v = localStorage.getItem("globalCorrect");
    return v ? parseInt(v, 10) || 0 : 0;
  });
  const totalAll = questions.length;

  const daily = useMemo(() => pickDailyQuestions(questions, 10), []);
  const [shuffledQuestions, setShuffledQuestions] = useState<Question[]>(() => shuffleQuestionSet(daily));
  const total = shuffledQuestions.length || daily.length;
  const question = shuffledQuestions[currentQuestion];
  const progress = ((currentQuestion + 1) / total) * 100;

  // Initialize per-question reward when question changes
  const baseReward = question ? getDifficultyCoins(question.difficulty) : 0;
  useEffect(() => {
    setQuestionReward(baseReward);
    setShowHint(false);
    setSelectedAnswer(null);
    setSecondChance(false);
    setBlinkHeart(false);
    setShowResult(false);
  }, [currentQuestion, baseReward]);

  // Track awarded milestones to avoid duplicate rewards (persisted)
  const milestonesAwarded = useRef({ m10: false, m25: false, m50: false, m75: false, m100: false });
  useEffect(() => {
    const raw = localStorage.getItem("milestonesAwarded");
    if (raw) {
      try { milestonesAwarded.current = JSON.parse(raw); } catch {}
    }
  }, []);
  useEffect(() => {
    localStorage.setItem("globalCorrect", String(globalCorrect));
  }, [globalCorrect]);

  const triggerCoinAnimation = (amount: number) => {
    const id = Date.now();
    setCoinAnimations(prev => [...prev, { id, amount }]);
    setTimeout(() => {
      setCoinAnimations(prev => prev.filter(anim => anim.id !== id));
    }, 2600);
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
      // Add remaining per-question reward (after hints used)
      const earned = Math.max(0, questionReward);
      if (earned > 0) {
        setCoins(prev => prev + earned);
        setCoinGain({ amount: earned, id: Date.now() });
        triggerCoinAnimation(earned);
        // clear badge after a moment
        setTimeout(() => setCoinGain(cg => (cg && cg.id ? null : null)), 1800);
      }
      setCorrectAnswers(prev => prev + 1);
      const newGlobal = globalCorrect + 1;
      setGlobalCorrect(newGlobal);
      const ratio = newGlobal / totalAll; // 0..1 across all days
        // 10% milestone: +5 coins
        if (!milestonesAwarded.current.m10 && ratio >= 0.10) {
          milestonesAwarded.current.m10 = true;
          setCoins(c => c + 5);
          setCoinGain({ amount: 5, id: Date.now() + 1 });
          triggerCoinAnimation(5);
          toast({ title: "Milestone reached!", description: "10% complete — +5 coins" });
        }
        // 25% Silver
        if (!milestonesAwarded.current.m25 && ratio >= 0.25) {
          milestonesAwarded.current.m25 = true;
          toast({ title: "Milestone reached!", description: "25% complete — Silver bar earned" });
        }
        // 50% Gold
        if (!milestonesAwarded.current.m50 && ratio >= 0.50) {
          milestonesAwarded.current.m50 = true;
          toast({ title: "Milestone reached!", description: "50% complete — Gold bar earned" });
        }
        // 75% Platinum
        if (!milestonesAwarded.current.m75 && ratio >= 0.75) {
          milestonesAwarded.current.m75 = true;
          toast({ title: "Milestone reached!", description: "75% complete — Platinum bar earned" });
        }
        // 100% Diamond
        if (!milestonesAwarded.current.m100 && ratio >= 1.0) {
          milestonesAwarded.current.m100 = true;
          toast({ title: "Milestone reached!", description: "100% complete — Diamond earned" });
        }
      localStorage.setItem("milestonesAwarded", JSON.stringify(milestonesAwarded.current));
      // Restore one heart on correct (up to 5)
      if (hearts < 5) {
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
        // do not show result yet, and do not change hearts
        return;
      }
      // Second wrong: lose one heart and end question
      setIsCorrect(false);
      setShowResult(true);
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
    const nextDaily = pickDailyQuestions(questions, 10);
    setShuffledQuestions(shuffleQuestionSet(nextDaily));
    setBlinkHeart(false);
    setSecondChance(false);
    setCoinGain(null);
  };

  if (gameCompleted) {
    return <ResultScreen coins={coins} correctAnswers={correctAnswers} onRestart={handleRestart} />;
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
      <GameHeader hearts={hearts} coins={coins} progress={progress} blinkHeart={blinkHeart} coinGain={coinGain} />

      {/* Main Game Area */}
      <div className="container mx-auto px-4 pt-28 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-7xl mx-auto">
          {/* Left: Monkey Progress */}
          <div className="lg:col-span-2 flex justify-center lg:justify-start">
            <MonkeyProgress progress={globalCorrect} total={totalAll} />
          </div>

          {/* Center: Question */}
          <div className="lg:col-span-7">
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
            />

          </div>

          {/* Right column intentionally left empty (design no longer shows rewards box) */}
          <div className="lg:col-span-3" />
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
