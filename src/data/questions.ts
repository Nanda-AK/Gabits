export type Difficulty = 'easy' | 'moderate' | 'difficult';

export interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  difficulty: Difficulty;
  hint: string;
}

export const questions: Question[] = [
  {
    id: 1,
    question: "A pair of shoes costs ₹1200 after a 20% discount. What was its original price?",
    options: ["₹1000", "₹1400", "₹1500", "₹1600"],
    correctAnswer: 2,
    difficulty: "easy",
    hint: "If 80% of the original price equals ₹1200, divide by 0.8"
  },
  {
    id: 2,
    question: "If 3x + 7 = 22, what is the value of x?",
    options: ["3", "5", "7", "9"],
    correctAnswer: 1,
    difficulty: "easy",
    hint: "Subtract 7 from both sides first, then divide by 3"
  },
  {
    id: 3,
    question: "What is 15% of 240?",
    options: ["30", "36", "42", "48"],
    correctAnswer: 1,
    difficulty: "easy",
    hint: "Convert 15% to decimal (0.15) and multiply by 240"
  },
  {
    id: 4,
    question: "A train travels 180 km in 3 hours. What is its average speed in km/h?",
    options: ["50 km/h", "55 km/h", "60 km/h", "65 km/h"],
    correctAnswer: 2,
    difficulty: "moderate",
    hint: "Speed = Distance ÷ Time"
  },
  {
    id: 5,
    question: "If the ratio of boys to girls in a class is 3:5 and there are 24 boys, how many girls are there?",
    options: ["30", "35", "40", "45"],
    correctAnswer: 2,
    difficulty: "moderate",
    hint: "Set up the proportion: 3/5 = 24/x"
  },
  {
    id: 6,
    question: "What is the area of a circle with radius 7 cm? (Use π ≈ 22/7)",
    options: ["144 cm²", "154 cm²", "164 cm²", "174 cm²"],
    correctAnswer: 1,
    difficulty: "moderate",
    hint: "Area of circle = πr²"
  },
  {
    id: 7,
    question: "Simplify: (x² - 9) ÷ (x - 3)",
    options: ["x - 3", "x + 3", "x² + 3", "x² - 3"],
    correctAnswer: 1,
    difficulty: "moderate",
    hint: "Factor the numerator as a difference of squares first"
  },
  {
    id: 8,
    question: "A compound interest of ₹1331 is earned on a principal of ₹1000 at 10% per annum for 3 years. What is the total amount?",
    options: ["₹2000", "₹2200", "₹2331", "₹2500"],
    correctAnswer: 2,
    difficulty: "difficult",
    hint: "Amount = Principal × (1 + rate)^time"
  },
  {
    id: 9,
    question: "If log₂(x) = 5, what is the value of x?",
    options: ["10", "16", "25", "32"],
    correctAnswer: 3,
    difficulty: "difficult",
    hint: "Remember: if log₂(x) = 5, then 2⁵ = x"
  },
  {
    id: 10,
    question: "What is the sum of the first 20 natural numbers?",
    options: ["190", "200", "210", "220"],
    correctAnswer: 2,
    difficulty: "difficult",
    hint: "Use the formula: n(n+1)/2 where n = 20"
  }
];

export const getDifficultyCoins = (difficulty: Difficulty): number => {
  const coinMap = {
    easy: 3,
    moderate: 5,
    difficult: 8
  };
  return coinMap[difficulty];
};

export const getHintCost = (difficulty: Difficulty): number => {
  const costMap = {
    easy: 2,
    moderate: 3,
    difficult: 5
  };
  return costMap[difficulty];
};
