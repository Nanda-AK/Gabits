import { useState, useEffect } from "react";
import { questions, getDifficultyCoins, getHintCost } from "@/data/questions";
import type { Question } from "@/data/questions";
import { QuestionCard } from "./QuestionCard";
import { GameHeader } from "./GameHeader";
import { MonkeyProgress } from "./MonkeyProgress";
import { TreasureChest } from "./TreasureChest";
import { ResultScreen } from "./ResultScreen";
import { CoinAnimation } from "./CoinAnimation";

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

  const [shuffledQuestions, setShuffledQuestions] = useState<Question[]>(() => shuffleQuestionSet(questions));
  const total = shuffledQuestions.length || questions.length;
  const question = shuffledQuestions[currentQuestion];
  const progress = ((currentQuestion + 1) / total) * 100;

  const triggerCoinAnimation = (amount: number) => {
    const id = Date.now();
    setCoinAnimations(prev => [...prev, { id, amount }]);
    setTimeout(() => {
      setCoinAnimations(prev => prev.filter(anim => anim.id !== id));
    }, 1900);
  };

  const handleAnswerSelect = (index: number) => {
    if (!showResult) {
      setSelectedAnswer(index);
    }
  };

  const handleCheckAnswer = () => {
    if (selectedAnswer === null) return;

    const correct = selectedAnswer === question.correctAnswer;
    setIsCorrect(correct);
    setShowResult(true);

    if (correct) {
      const earnedCoins = getDifficultyCoins(question.difficulty);
      setCoins(prev => prev + earnedCoins);
      setCorrectAnswers(prev => prev + 1);
      triggerCoinAnimation(earnedCoins);
    } else {
      setHearts(prev => Math.max(0, prev - 1));
      const lostCoins = getDifficultyCoins(question.difficulty);
      setCoins(prev => Math.max(0, prev - lostCoins));
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
    const hintCost = getHintCost(question.difficulty);
    if (coins >= hintCost && !showHint) {
      setCoins(prev => prev - hintCost);
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
    setShuffledQuestions(shuffleQuestionSet(questions));
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
      <GameHeader hearts={hearts} coins={coins} progress={progress} />

      {/* Main Game Area */}
      <div className="container mx-auto px-4 pt-28 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-7xl mx-auto">
          {/* Left: Monkey Progress */}
          <div className="lg:col-span-2 flex justify-center lg:justify-start">
            <MonkeyProgress progress={correctAnswers} total={total} />
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
              questionNumber={currentQuestion + 1}
              totalQuestions={total}
            />

            {/* Result message BELOW the question card */}
            {showResult && (
              <div
                className={`mt-4 rounded-2xl p-4 animate-slide-up ${
                  isCorrect ? "bg-primary/20 border-2 border-primary" : "bg-destructive/20 border-2 border-destructive"
                }`}
              >
                <p
                  className={`font-bold text-center ${
                    isCorrect ? "text-primary" : "text-destructive"
                  }`}
                >
                  {isCorrect ? "🎉 Correct! Great job!" : "❌ Incorrect. Keep trying!"}
                </p>
                {!isCorrect && (
                  <p className="text-sm text-center mt-2 text-muted-foreground">
                    Correct answer: <span className="font-bold">{question.options[question.correctAnswer]}</span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Right: Treasure & Info */}
          <div className="lg:col-span-3 flex flex-col items-center gap-8">
            <TreasureChest unlocked={correctAnswers === total} />
            
            <div className="bg-gradient-to-br from-card to-card/80 rounded-3xl p-6 shadow-xl border-2 border-primary/20 w-full max-w-xs backdrop-blur-sm">
              <h3 className="font-bold text-base mb-4 text-foreground flex items-center gap-2">
                <span className="text-2xl">🪙</span>
                Coin Rewards
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between p-2 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-primary shadow-sm"></div>
                    <span className="text-foreground font-medium">Easy</span>
                  </div>
                  <span className="text-primary font-bold">+3 🪙</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/10 border border-secondary/20">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-secondary shadow-sm"></div>
                    <span className="text-foreground font-medium">Moderate</span>
                  </div>
                  <span className="text-secondary font-bold">+5 🪙</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-destructive shadow-sm"></div>
                    <span className="text-foreground font-medium">Difficult</span>
                  </div>
                  <span className="text-destructive font-bold">+8 🪙</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
