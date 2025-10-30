import { Button } from "@/components/ui/button";
import { Question, getDifficultyCoins, getHintCost } from "@/data/questions";
import { Lightbulb, SkipForward, CheckCircle2, ArrowRight, Timer } from "lucide-react";

interface QuestionCardProps {
  question: Question;
  selectedAnswer: number | null;
  showResult: boolean;
  isCorrect: boolean;
  onAnswerSelect: (index: number) => void;
  onCheckAnswer: () => void;
  onNext: () => void;
  onSkip: () => void;
  onHint: () => void;
  showHint: boolean;
  coins: number;
  questionReward: number;
  questionNumber: number;
  totalQuestions: number;
  questionTime?: number;
  questionTimeLimit?: number;
  showTimer?: boolean;
  lockedWrongIndex?: number | null;
  secondChance?: boolean;
  difficultyLabel?: string;
  battleMode?: boolean;
}

export const QuestionCard = ({
  question,
  selectedAnswer,
  showResult,
  isCorrect,
  onAnswerSelect,
  onCheckAnswer,
  onNext,
  onSkip,
  onHint,
  showHint,
  coins,
  questionReward,
  questionNumber,
  totalQuestions,
  questionTime = 0,
  questionTimeLimit = 30,
  showTimer = true,
  lockedWrongIndex = null,
  secondChance = false,
  difficultyLabel,
  battleMode = false,
}: QuestionCardProps) => {
  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  const timeRemaining = questionTimeLimit - questionTime;
  const isTimeCritical = timeRemaining <= 10;
  const progressPercentage = (questionTime / questionTimeLimit) * 100;
  const difficultyColors = {
    easy: "bg-primary/10 text-primary border-primary/30",
    moderate: "bg-secondary/10 text-secondary border-secondary/30",
    difficult: "bg-destructive/10 text-destructive border-destructive/30"
  };

  const hintCost = getHintCost(question.difficulty);
  const coinValue = getDifficultyCoins(question.difficulty);

  return (
    <div className="relative bg-gradient-to-br from-card to-card/90 rounded-xl sm:rounded-2xl shadow-2xl p-3 sm:p-4 lg:p-6 border-2 border-primary/20 animate-slide-up backdrop-blur-sm hover:shadow-primary/10 transition-all duration-300">
      {/* Subtle corner accents */}
      <div className="absolute top-0 left-0 w-20 h-20 bg-gradient-to-br from-primary/5 to-transparent rounded-tl-xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-20 h-20 bg-gradient-to-tl from-secondary/5 to-transparent rounded-br-xl pointer-events-none" />
      
      {/* Question Number & Difficulty Badge */}
      <div className="relative flex items-center justify-between mb-2 sm:mb-3 lg:mb-4">
        <div className="flex flex-col gap-1">
          <div className="text-xs sm:text-sm font-semibold text-muted-foreground">
            Question {questionNumber} of {totalQuestions}
          </div>
          {/* Per-Question Timer with Countdown (hidden in practice mode) */}
          {showTimer && !battleMode && (
            <div className={`relative flex items-center gap-1.5 rounded-md px-2 py-1.5 border-2 shadow-sm w-fit transition-all duration-300 ${
              isTimeCritical 
                ? 'bg-gradient-to-r from-destructive/20 to-destructive/10 border-destructive/40 animate-pulse' 
                : 'bg-gradient-to-r from-secondary/10 to-secondary/5 border-secondary/20'
            }`}>
              <Timer className={`w-3.5 h-3.5 transition-colors ${
                isTimeCritical ? 'text-destructive' : 'text-secondary'
              }`} />
              <div className="flex flex-col items-start">
                <span className={`text-[10px] sm:text-xs font-extrabold tabular-nums transition-colors ${
                  isTimeCritical ? 'text-destructive' : 'text-secondary'
                }`}>
                  {timeRemaining}s
                </span>
                {isTimeCritical && (
                  <span className="text-[8px] text-destructive/70 font-semibold">Hurry up!</span>
                )}
              </div>
              {/* Progress bar showing time used */}
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-1000 ${
                    isTimeCritical ? 'bg-destructive' : 'bg-secondary'
                  }`}
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          )}
        </div>
        <div className="relative flex flex-col items-end">
          <div className={`px-4 py-1 rounded-full text-xs font-bold border-2 ${difficultyColors[question.difficulty]}`}>
            {(difficultyLabel ?? question.difficulty.toUpperCase())} • {showHint ? questionReward : coinValue} coins
          </div>
          {/* Coin animation start anchor near difficulty badge */}
          <div id="coin-source" className="absolute -right-2 top-1/2 w-3 h-3"></div>
        </div>
      </div>

      {/* Question Text with Character */}
      <div className="mb-3 sm:mb-4 lg:mb-6">
        <div className="flex gap-2 sm:gap-3 items-start">
          <div className="w-9 h-9 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-full bg-gradient-to-br from-secondary via-secondary to-secondary/80 flex items-center justify-center text-xl sm:text-2xl flex-shrink-0 shadow-lg border-2 border-secondary/30">
            🦉
          </div>
          <div className="flex-1 min-w-0 bg-gradient-to-br from-muted/60 to-muted/40 rounded-lg sm:rounded-xl p-2.5 sm:p-3 lg:p-4 rounded-tl-none shadow-md border border-muted-foreground/10">
            <p className="text-sm sm:text-base lg:text-lg font-semibold text-foreground leading-snug">
              {question.question}
            </p>
          </div>
        </div>
      </div>

      {/* Answer Options */}
      <div className="space-y-1.5 sm:space-y-2 mb-3 sm:mb-4">
        {question.options.map((option, index) => {
          const isSelected = selectedAnswer === index;
          const isCorrectAnswer = index === question.correctAnswer;
          const isLockedWrong = !!secondChance && lockedWrongIndex === index;
          
          let buttonClass = "w-full justify-start text-left h-auto py-1.5 sm:py-2 lg:py-3 px-2.5 sm:px-3 lg:px-4 text-xs sm:text-sm lg:text-base font-medium transition-all duration-200 rounded-lg sm:rounded-xl border-2 ";
          
          if (!showResult) {
            if (isLockedWrong) {
              buttonClass += "bg-destructive/20 border-destructive text-destructive-foreground cursor-not-allowed";
            } else {
              buttonClass += isSelected
                ? "bg-secondary/20 border-secondary text-secondary-foreground shadow-md scale-[1.02]"
                : "bg-card border-border hover:border-secondary/50 hover:bg-muted/50 hover:scale-[1.01]";
            }
          } else {
            if (isCorrectAnswer) {
              buttonClass += "bg-primary/20 border-primary text-primary-foreground animate-pulse-success";
            } else if (isSelected && !isCorrect) {
              buttonClass += "bg-destructive/20 border-destructive text-destructive-foreground animate-shake";
            } else {
              buttonClass += "bg-card border-border opacity-50";
            }
          }

          return (
            <Button
              key={index}
              onClick={() => onAnswerSelect(index)}
              disabled={showResult || isLockedWrong}
              className={buttonClass}
              variant="outline"
            >
              <span className="mr-3 font-bold text-muted-foreground">
                {String.fromCharCode(65 + index)}.
              </span>
              {option}
            </Button>
          );
        })}
      </div>

      {/* Hint Section */}
      {showHint && (
        <div className="mb-3 sm:mb-4 bg-accent/10 border-2 border-accent/30 rounded-lg sm:rounded-xl p-2 sm:p-3 animate-slide-up">
          <div className="flex items-start gap-2">
            <Lightbulb className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
            <p className="text-xs sm:text-sm text-foreground">
              <span className="font-bold">Hint:</span> {question.hint}
            </p>
          </div>
        </div>
      )}

      {/* Coin animation anchor moved to difficulty badge */}

      {/* Action Buttons with inline result status */}
      <div
        className={`flex flex-wrap items-center gap-1.5 sm:gap-2 rounded-lg sm:rounded-xl p-1.5 sm:p-2 border-2 ${
          showResult
            ? isCorrect
              ? "bg-emerald-100/70 border-emerald-300"
              : "bg-rose-100/70 border-rose-300"
            : "border-muted/30"
        }`}
      >
        <Button
          onClick={onSkip}
          variant="outline"
          disabled={showResult}
          className="text-xs sm:text-sm rounded-lg border-2 hover:bg-muted hover:-translate-y-0.5 transition-all duration-200 ring-1 ring-transparent hover:ring-secondary/40 shadow-sm hover:shadow-md py-1 sm:py-1.5 px-2 sm:px-3"
        >
          <SkipForward className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
          Skip
        </Button>

        <Button
          onClick={onHint}
          variant="outline"
          disabled={showResult || showHint || questionReward < hintCost}
          className="text-xs sm:text-sm rounded-lg border-2 border-accent/40 text-accent bg-accent/5 hover:bg-accent/15 hover:-translate-y-0.5 transition-all duration-200 ring-1 ring-transparent hover:ring-accent/40 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed py-1 sm:py-1.5 px-2 sm:px-3"
        >
          <Lightbulb className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
          Hint (-{hintCost})
        </Button>

        {/* Center status */}
        <div className="flex-1 text-center">
          {!battleMode && showResult && (
            <span
              className={`font-extrabold text-sm sm:text-base lg:text-lg tracking-wide ${
                isCorrect ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {isCorrect ? "Correct" : "Wrong"}
            </span>
          )}
        </div>

        {battleMode ? (
          <Button
            onClick={onNext}
            disabled={selectedAnswer === null}
            className="text-xs sm:text-sm rounded-lg px-3 sm:px-5 lg:px-8 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 focus:ring-2 focus:ring-blue-500/50 active:scale-[0.98] py-1 sm:py-1.5"
          >
            {questionNumber === totalQuestions ? 'Finish' : 'Next'}
            <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" />
          </Button>
        ) : (
          !showResult ? (
            <Button
              onClick={onCheckAnswer}
              disabled={selectedAnswer === null}
              className="text-xs sm:text-sm rounded-lg px-3 sm:px-5 lg:px-8 bg-gradient-to-r from-secondary to-secondary/80 hover:from-secondary/90 hover:to-secondary/70 text-secondary-foreground font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 focus:ring-2 focus:ring-secondary/50 active:scale-[0.98] py-1 sm:py-1.5"
            >
              <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              Check
            </Button>
          ) : (
            <Button
              onClick={onNext}
              className="text-xs sm:text-sm rounded-lg px-3 sm:px-5 lg:px-8 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-bold shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 focus:ring-2 focus:ring-blue-500/50 active:scale-[0.98] py-1 sm:py-1.5"
            >
              {questionNumber === totalQuestions ? 'Finish' : 'Next'}
              <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" />
            </Button>
          )
        )}
      </div>
    </div>
  );
}
