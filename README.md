# Quest Coin Rise 🪙

An interactive quiz game where knowledge meets rewards! Test your skills, collect coins, and embark on a treasure-hunting adventure.

## 🎮 Features

- **Interactive Quiz System**: Multiple-choice questions with varying difficulty levels
- **Coin Reward System**: Earn coins based on question difficulty
  - Easy: +3 coins 🟢
  - Moderate: +5 coins 🟡  
  - Difficult: +8 coins 🔴
- **Lives System**: 5 hearts to keep you in the game
- **Progress Tracking**: Visual monkey progress indicator
- **Hint System**: Use coins to get hints when stuck
- **Beautiful UI**: Modern design with smooth animations
- **Treasure Chest**: Unlock rewards as you progress

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd quest-coin-rise
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

## 🛠️ Tech Stack

- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: React hooks
- **Animations**: CSS transitions and custom animations
- **Icons**: Lucide React
- **Routing**: React Router DOM

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── QuizGame.tsx    # Main game component
│   ├── QuestionCard.tsx # Question display component
│   ├── GameHeader.tsx  # Header with stats
│   └── ...
├── data/               # Game data and questions
├── pages/              # Route components
├── hooks/              # Custom React hooks
└── lib/                # Utility functions
```

## 🎯 How to Play

1. **Start the Game**: Click to begin your quiz adventure
2. **Answer Questions**: Select from multiple choice answers
3. **Earn Coins**: Correct answers reward you with coins based on difficulty
4. **Use Hints**: Spend coins to reveal helpful hints
5. **Track Progress**: Watch your monkey climb towards the treasure
6. **Unlock Treasure**: Complete all questions to unlock the treasure chest!

## 🔧 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Adding Questions

Questions are stored in `src/data/questions.ts`. Add new questions following the existing format:

```typescript
{
  id: number,
  question: string,
  options: string[],
  correctAnswer: number,
  difficulty: 'easy' | 'moderate' | 'difficult',
  hint?: string
}
```

## 📱 Responsive Design

The game is fully responsive and works great on:
- Desktop computers
- Tablets  
- Mobile devices

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with modern React and TypeScript
- UI components powered by shadcn/ui
- Icons from Lucide React
