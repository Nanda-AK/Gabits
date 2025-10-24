import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Trophy, Award, Medal, Coins } from "lucide-react";

interface AchievementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coins: number;
  correctAnswers: number;
  totalQuestions: number;
}

export const AchievementModal = ({
  open,
  onOpenChange,
  coins,
  correctAnswers,
  totalQuestions
}: AchievementModalProps) => {
  const progressPercentage = (correctAnswers / totalQuestions) * 100;
  
  // Determine which achievements have been unlocked
  const achievements = [
    {
      icon: <Medal className="w-10 h-10 text-amber-600" />,
      name: "10% Progress",
      description: "+5 Coins",
      unlocked: progressPercentage >= 10,
      image: null
    },
    {
      icon: null,
      name: "Silver Bar",
      description: "25% Complete",
      unlocked: progressPercentage >= 25,
      image: "/assets/silverimage.png"
    },
    {
      icon: null,
      name: "Gold Bar",
      description: "50% Complete",
      unlocked: progressPercentage >= 50,
      image: "/assets/goldimage.png"
    },
    {
      icon: null,
      name: "Platinum Bar",
      description: "75% Complete",
      unlocked: progressPercentage >= 75,
      image: "/assets/platinuumimage.png"
    },
    {
      icon: <Trophy className="w-10 h-10 text-blue-400" />,
      name: "Diamond",
      description: "100% Complete!",
      unlocked: progressPercentage >= 100,
      image: null
    }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-gradient-to-br from-card via-card/95 to-card/90 border-2 border-primary/30 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <img src="/treasureboximg.png" alt="Treasure" className="w-8 h-8" />
            Your Achievements
          </DialogTitle>
          <DialogDescription className="text-base">
            Progress: {correctAnswers}/{totalQuestions} • {coins} Coins Collected
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 py-4">
          {achievements.map((achievement, index) => (
            <div
              key={index}
              className={`relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-300 ${
                achievement.unlocked
                  ? 'bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/40 shadow-lg scale-100'
                  : 'bg-muted/20 border-muted/30 opacity-40 grayscale'
              }`}
            >
              {achievement.unlocked && (
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-lg">
                  <Award className="w-4 h-4 text-white" />
                </div>
              )}
              
              <div className="mb-2">
                {achievement.image ? (
                  <img 
                    src={achievement.image} 
                    alt={achievement.name}
                    className="w-16 h-12 object-contain drop-shadow-lg"
                  />
                ) : achievement.icon ? (
                  <div className="w-16 h-12 flex items-center justify-center">
                    {achievement.icon}
                  </div>
                ) : (
                  <div className="w-16 h-12 text-4xl flex items-center justify-center">
                    💎
                  </div>
                )}
              </div>
              
              <div className="text-center">
                <div className="text-xs font-bold text-foreground">
                  {achievement.name}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {achievement.description}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Total Coins Display */}
        <div className="flex items-center justify-center gap-3 p-4 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl border-2 border-amber-300 shadow-inner">
          <Coins className="w-8 h-8 text-amber-600" />
          <div className="text-center">
            <div className="text-2xl font-black text-amber-900">{coins}</div>
            <div className="text-xs font-semibold text-amber-700">Total Coins</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
