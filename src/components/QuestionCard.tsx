import { Button } from "@/components/ui/button";
import { Question, getDifficultyCoins, getHintCost } from "@/data/questions";
import { Lightbulb, SkipForward, CheckCircle2, ArrowRight } from "lucide-react";

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
  questionNumber: number;
  totalQuestions: number;
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
  questionNumber,
  totalQuestions
}: QuestionCardProps) => {
  const difficultyColors = {
    easy: "bg-primary/10 text-primary border-primary/30",
    moderate: "bg-secondary/10 text-secondary border-secondary/30",
    difficult: "bg-destructive/10 text-destructive border-destructive/30"
  };

  const hintCost = getHintCost(question.difficulty);
  const coinValue = getDifficultyCoins(question.difficulty);

  return (
    <div className="relative bg-gradient-to-br from-card to-card/90 rounded-3xl shadow-2xl p-8 border-2 border-primary/20 animate-slide-up backdrop-blur-sm">
      {/* Question Number & Difficulty Badge */}
      <div className="flex items-center justify-between mb-6">
        <div className="text-sm font-semibold text-muted-foreground">
          Question {questionNumber} of {totalQuestions}
        </div>
        <div className={`px-4 py-1 rounded-full text-xs font-bold border-2 ${difficultyColors[question.difficulty]}`}>
          {question.difficulty.toUpperCase()} • {coinValue} coins
        </div>
      </div>

      {/* Question Text with Character */}
      <div className="mb-8">
        <div className="flex gap-4 items-start">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-secondary via-secondary to-secondary/80 flex items-center justify-center text-3xl flex-shrink-0 shadow-lg border-2 border-secondary/30">
            🦉
          </div>
          <div className="flex-1 bg-gradient-to-br from-muted/60 to-muted/40 rounded-2xl p-5 rounded-tl-none shadow-md border border-muted-foreground/10">
            <p className="text-xl font-semibold text-foreground leading-relaxed">
              {question.question}
            </p>
          </div>
        </div>
      </div>

      {/* Answer Options */}
      <div className="space-y-3 mb-6">
        {question.options.map((option, index) => {
          const isSelected = selectedAnswer === index;
          const isCorrectAnswer = index === question.correctAnswer;
          
          let buttonClass = "w-full justify-start text-left h-auto py-4 px-6 text-base font-medium transition-all duration-200 rounded-2xl border-2 ";
          
          if (!showResult) {
            buttonClass += isSelected
              ? "bg-secondary/20 border-secondary text-secondary-foreground shadow-md scale-[1.02]"
              : "bg-card border-border hover:border-secondary/50 hover:bg-muted/50 hover:scale-[1.01]";
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
              disabled={showResult}
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
        <div className="mb-6 bg-accent/10 border-2 border-accent/30 rounded-2xl p-4 animate-slide-up">
          <div className="flex items-start gap-3">
            <Lightbulb className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
            <p className="text-sm text-foreground">
              <span className="font-bold">Hint:</span> {question.hint}
            </p>
          </div>
        </div>
      )}

      {/* Coin animation start anchor (invisible) */}
      <div id="coin-source" className="absolute bottom-5 right-6 w-3 h-3"></div>

      {/* Action Buttons with inline result status */}
      <div
        className={`flex flex-wrap items-center gap-3 rounded-2xl p-3 border-2 ${
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
          className="rounded-xl border-2 hover:bg-muted hover:-translate-y-0.5 transition-all duration-200 ring-1 ring-transparent hover:ring-secondary/40 shadow-sm hover:shadow-md"
        >
          <SkipForward className="w-4 h-4 mr-2" />
          Skip
        </Button>

        <Button
          onClick={onHint}
          variant="outline"
          disabled={showResult || showHint || coins < hintCost}
          className="rounded-xl border-2 border-accent/40 text-accent bg-accent/5 hover:bg-accent/15 hover:-translate-y-0.5 transition-all duration-200 ring-1 ring-transparent hover:ring-accent/40 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Lightbulb className="w-4 h-4 mr-2" />
          Hint (-{hintCost} coins)
        </Button>

        {/* Center status */}
        <div className="flex-1 text-center">
          {showResult && (
            <span
              className={`font-extrabold text-lg tracking-wide ${
                isCorrect ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {isCorrect ? "Correct" : "Wrong"}
            </span>
          )}
        </div>

        {!showResult ? (
          <Button
            onClick={onCheckAnswer}
            disabled={selectedAnswer === null}
            className="rounded-xl px-8 bg-gradient-to-r from-secondary to-secondary/80 hover:from-secondary/90 hover:to-secondary/70 text-secondary-foreground font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 focus:ring-2 focus:ring-secondary/50 active:scale-[0.98]"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Check Answer
          </Button>
        ) : (
          <Button
            onClick={onNext}
            className="rounded-xl px-8 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-bold shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 focus:ring-2 focus:ring-primary/50 active:scale-[0.98]"
          >
            Next
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}
