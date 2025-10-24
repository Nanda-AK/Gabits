import { useMemo, useState, useEffect, useRef } from "react";
import { questions, getDifficultyCoins, getHintCost } from "@/data/questions";
import type { Question } from "@/data/questions";
import { QuestionCard } from "./QuestionCard";
import { GameHeader } from "./GameHeader";
import { MonkeyProgress } from "./MonkeyProgress";
import { ResultScreen } from "./ResultScreen";
import { CoinAnimation } from "./CoinAnimation";
import { AchievementModal } from "./AchievementModal";
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
  const [showAchievements, setShowAchievements] = useState(false);
  const [overallTime, setOverallTime] = useState(0);
  const [questionTime, setQuestionTime] = useState(0);
  const [questionTimeLimit, setQuestionTimeLimit] = useState(30);
  const [overallTimeLimit] = useState(600); // 10 minutes total
  const [isTimeUp, setIsTimeUp] = useState(false);

  // Load or generate daily questions with localStorage persistence
  const daily = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const storedData = localStorage.getItem('dailyQuizData');
    
    if (storedData) {
      const { date, questions: storedQuestions } = JSON.parse(storedData);
      if (date === today) {
        return storedQuestions;
      }
    }
    
    // Generate new questions for today
    const newQuestions = pickDailyQuestions(questions, 10);
    localStorage.setItem('dailyQuizData', JSON.stringify({ date: today, questions: newQuestions }));
    return newQuestions;
  }, []);
  
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
    setQuestionTime(0); // Reset question timer
    
    // Set time limit based on difficulty
    if (question) {
      const timeLimit = question.difficulty === 'easy' ? 45 : question.difficulty === 'moderate' ? 35 : 25;
      setQuestionTimeLimit(timeLimit);
    }
  }, [currentQuestion, baseReward, question]);

  // Track awarded milestones for the current daily set only
  const milestonesAwarded = useRef({ m10: false, m25: false, m50: false, m75: false, m100: false });
  
  // Timer effects
  useEffect(() => {
    const overallInterval = setInterval(() => {
      setOverallTime(prev => prev + 1);
    }, 1000);
    
    return () => clearInterval(overallInterval);
  }, []);
  
  useEffect(() => {
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
  }, [showResult, gameCompleted, currentQuestion, questionTimeLimit]);
  
  // Overall time limit check
  useEffect(() => {
    if (overallTime >= overallTimeLimit && !gameCompleted) {
      setIsTimeUp(true);
      setGameCompleted(true);
    }
  }, [overallTime, overallTimeLimit, gameCompleted]);

  const triggerCoinAnimation = (amount: number) => {
    const id = Date.now();
    setCoinAnimations(prev => [...prev, { id, amount }]);
    setTimeout(() => {
      setCoinAnimations(prev => prev.filter(anim => anim.id !== id));
    }, 2600);
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
      // Add remaining per-question reward (after hints used)
      const earned = Math.max(0, questionReward);
      if (earned > 0) {
        setCoins(prev => prev + earned);
        setCoinGain({ amount: earned, id: Date.now() });
        triggerCoinAnimation(earned);
        // clear badge after a moment
        setTimeout(() => setCoinGain(cg => (cg && cg.id ? null : null)), 1800);
      }
      setCorrectAnswers(prev => {
        const newCount = prev + 1;
        const ratio = newCount / total; // 0..1 for the daily set of 10
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
    setOverallTime(0);
    setQuestionTime(0);
    setIsTimeUp(false);
  };

  if (gameCompleted) {
    return <ResultScreen coins={coins} correctAnswers={correctAnswers} onRestart={handleRestart} gameOver={isTimeUp} />;
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
      />
      
      {/* Achievement Modal */}
      <AchievementModal
        open={showAchievements}
        onOpenChange={setShowAchievements}
        coins={coins}
        correctAnswers={correctAnswers}
        totalQuestions={total}
      />

      {/* Main Game Area */}
      <div className="container mx-auto px-2 sm:px-3 pt-14 sm:pt-16 lg:pt-20 pb-3 sm:pb-4 lg:pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 lg:gap-6 max-w-5xl xl:max-w-6xl mx-auto">
          {/* Left: Monkey Progress */}
          <div className="lg:col-span-2 flex justify-center lg:justify-start min-w-0">
            <MonkeyProgress progress={correctAnswers} total={total} />
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
              questionTime={questionTime}
              questionTimeLimit={questionTimeLimit}
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
