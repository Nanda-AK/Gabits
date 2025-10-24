import { useState } from "react";
import { HomePage } from "@/components/HomePage";
import { QuizGame } from "@/components/QuizGame";

const Index = () => {
  const [gameStarted, setGameStarted] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState<'easy' | 'moderate' | 'difficult'>('moderate');

  const handleStartGame = (name: string, difficulty: 'easy' | 'moderate' | 'difficult') => {
    setPlayerName(name);
    setSelectedDifficulty(difficulty);
    setGameStarted(true);
  };

  if (!gameStarted) {
    return <HomePage onStartGame={handleStartGame} />;
  }

  return <QuizGame difficulty={selectedDifficulty} />;
};

export default Index;
