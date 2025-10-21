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
    question: "Riya buys sweets worth ₹86 and then buys more worth ₹19. How much did she spend in total?",
    options: ["₹106", "₹107", "₹105", "₹102"],
    correctAnswer: 2,
    difficulty: "easy",
    hint: "Add the two amounts together."
  },
  {
    id: 2,
    question: "Riya buys sweets worth ₹91 and then buys more worth ₹99. How much did she spend in total?",
    options: ["₹180", "₹188", "₹190", "₹205"],
    correctAnswer: 2,
    difficulty: "easy",
    hint: "Add the two amounts together."
  },
  {
    id: 3,
    question: "Riya buys sweets worth ₹16 and then buys more worth ₹32. How much did she spend in total?",
    options: ["₹49", "₹63", "₹38", "₹48"],
    correctAnswer: 3,
    difficulty: "easy",
    hint: "Add the two amounts together."
  },
  {
    id: 4,
    question: "Riya buys sweets worth ₹96 and then buys more worth ₹88. How much did she spend in total?",
    options: ["₹184", "₹174", "₹189", "₹185"],
    correctAnswer: 0,
    difficulty: "easy",
    hint: "Add the two amounts together."
  },
  {
    id: 5,
    question: "Riya buys sweets worth ₹108 and then buys more worth ₹116. How much did she spend in total?",
    options: ["₹229", "₹224", "₹221", "₹223"],
    correctAnswer: 1,
    difficulty: "easy",
    hint: "Add the two amounts together."
  },
  {
    id: 6,
    question: "Riya buys sweets worth ₹32 and then buys more worth ₹102. How much did she spend in total?",
    options: ["₹139", "₹132", "₹137", "₹134"],
    correctAnswer: 3,
    difficulty: "easy",
    hint: "Add the two amounts together."
  },
  {
    id: 7,
    question: "Riya buys sweets worth ₹82 and then buys more worth ₹38. How much did she spend in total?",
    options: ["₹130", "₹110", "₹117", "₹120"],
    correctAnswer: 3,
    difficulty: "easy",
    hint: "Add the two amounts together."
  },
  {
    id: 8,
    question: "Riya buys sweets worth ₹75 and then buys more worth ₹42. How much did she spend in total?",
    options: ["₹120", "₹117", "₹132", "₹102"],
    correctAnswer: 1,
    difficulty: "easy",
    hint: "Add the two amounts together."
  },
  {
    id: 9,
    question: "Riya buys sweets worth ₹10 and then buys more worth ₹89. How much did she spend in total?",
    options: ["₹101", "₹97", "₹99", "₹100"],
    correctAnswer: 2,
    difficulty: "easy",
    hint: "Add the two amounts together."
  },
  {
    id: 10,
    question: "Riya buys sweets worth ₹40 and then buys more worth ₹63. How much did she spend in total?",
    options: ["₹102", "₹103", "₹88", "₹106"],
    correctAnswer: 1,
    difficulty: "easy",
    hint: "Add the two amounts together."
  },
  {
    id: 11,
    question: "Riya buys sweets worth ₹90 and then buys more worth ₹39. How much did she spend in total?",
    options: ["₹144", "₹129", "₹127", "₹114"],
    correctAnswer: 1,
    difficulty: "easy",
    hint: "Add the two amounts together."
  },
  {
    id: 12,
    question: "Riya buys sweets worth ₹25 and then buys more worth ₹64. How much did she spend in total?",
    options: ["₹89", "₹74", "₹91", "₹94"],
    correctAnswer: 0,
    difficulty: "easy",
    hint: "Add the two amounts together."
  },
  {
    id: 13,
    question: "A shop sold ₹551 worth of shirts, ₹78 worth of jeans and ₹68 worth of accessories in a day. What is the total sales for the day?",
    options: ["₹694", "₹702", "₹697", "₹700"],
    correctAnswer: 2,
    difficulty: "moderate",
    hint: "Sum all three sales amounts."
  },
  {
    id: 14,
    question: "A shop sold ₹587 worth of shirts, ₹340 worth of jeans and ₹193 worth of accessories in a day. What is the total sales for the day?",
    options: ["₹1120", "₹1121", "₹1123", "₹1105"],
    correctAnswer: 0,
    difficulty: "moderate",
    hint: "Sum all three sales amounts."
  },
  {
    id: 15,
    question: "A shop sold ₹193 worth of shirts, ₹185 worth of jeans and ₹45 worth of accessories in a day. What is the total sales for the day?",
    options: ["₹423", "₹424", "₹413", "₹425"],
    correctAnswer: 0,
    difficulty: "moderate",
    hint: "Sum all three sales amounts."
  },
  {
    id: 16,
    question: "A shop sold ₹305 worth of shirts, ₹162 worth of jeans and ₹45 worth of accessories in a day. What is the total sales for the day?",
    options: ["₹502", "₹522", "₹510", "₹512"],
    correctAnswer: 3,
    difficulty: "moderate",
    hint: "Sum all three sales amounts."
  },
  {
    id: 17,
    question: "A shop sold ₹441 worth of shirts, ₹131 worth of jeans and ₹184 worth of accessories in a day. What is the total sales for the day?",
    options: ["₹756", "₹771", "₹761", "₹754"],
    correctAnswer: 0,
    difficulty: "moderate",
    hint: "Sum all three sales amounts."
  },
  {
    id: 18,
    question: "A shop sold ₹390 worth of shirts, ₹178 worth of jeans and ₹151 worth of accessories in a day. What is the total sales for the day?",
    options: ["₹719", "₹716", "₹717", "₹704"],
    correctAnswer: 0,
    difficulty: "moderate",
    hint: "Sum all three sales amounts."
  },
  {
    id: 19,
    question: "A bookstore earned ₹314 in online sales, ₹400 in-store, ₹272 from bulk orders and ₹50 from returns reversed. What is the net earning?",
    options: ["₹1038", "₹1036", "₹1033", "₹1046"],
    correctAnswer: 1,
    difficulty: "difficult",
    hint: "Add all the figures together; returns reversed are still income here."
  },
  {
    id: 20,
    question: "A bookstore earned ₹840 in online sales, ₹405 in-store, ₹377 from bulk orders and ₹139 from returns reversed. What is the net earning?",
    options: ["₹1776", "₹1760", "₹1761", "₹1762"],
    correctAnswer: 2,
    difficulty: "difficult",
    hint: "Add all the figures together; returns reversed are still income here."
  },
  {
    id: 21,
    question: "A box had 185 chocolates. 32 were given away. How many chocolates remain in the box?",
    options: ["150", "156", "153", "151"],
    correctAnswer: 2,
    difficulty: "easy",
    hint: "Subtract the number given away from the starting count."
  },
  {
    id: 22,
    question: "A box had 143 chocolates. 37 were given away. How many chocolates remain in the box?",
    options: ["116", "96", "106", "104"],
    correctAnswer: 2,
    difficulty: "easy",
    hint: "Subtract the number given away from the starting count."
  },
  {
    id: 23,
    question: "A box had 104 chocolates. 17 were given away. How many chocolates remain in the box?",
    options: ["92", "87", "102", "77"],
    correctAnswer: 1,
    difficulty: "easy",
    hint: "Subtract the number given away from the starting count."
  },
  {
    id: 24,
    question: "A box had 179 chocolates. 26 were given away. How many chocolates remain in the box?",
    options: ["138", "156", "153", "163"],
    correctAnswer: 2,
    difficulty: "easy",
    hint: "Subtract the number given away from the starting count."
  },
  {
    id: 25,
    question: "A box had 135 chocolates. 5 were given away. How many chocolates remain in the box?",
    options: ["145", "130", "127", "133"],
    correctAnswer: 1,
    difficulty: "easy",
    hint: "Subtract the number given away from the starting count."
  },
  {
    id: 26,
    question: "A box had 23 chocolates. 5 were given away. How many chocolates remain in the box?",
    options: ["15", "3", "19", "18"],
    correctAnswer: 3,
    difficulty: "easy",
    hint: "Subtract the number given away from the starting count."
  },
  {
    id: 27,
    question: "A box had 56 chocolates. 33 were given away. How many chocolates remain in the box?",
    options: ["24", "25", "23", "8"],
    correctAnswer: 2,
    difficulty: "easy",
    hint: "Subtract the number given away from the starting count."
  },
  {
    id: 28,
    question: "A box had 262 chocolates. 16 were given away. How many chocolates remain in the box?",
    options: ["251", "256", "247", "246"],
    correctAnswer: 3,
    difficulty: "easy",
    hint: "Subtract the number given away from the starting count."
  },
  {
    id: 29,
    question: "A box had 201 chocolates. 28 were given away. How many chocolates remain in the box?",
    options: ["183", "178", "170", "173"],
    correctAnswer: 3,
    difficulty: "easy",
    hint: "Subtract the number given away from the starting count."
  },
  {
    id: 30,
    question: "A box had 193 chocolates. 7 were given away. How many chocolates remain in the box?",
    options: ["176", "186", "196", "187"],
    correctAnswer: 1,
    difficulty: "easy",
    hint: "Subtract the number given away from the starting count."
  },
  {
    id: 31,
    question: "A box had 162 chocolates. 30 were given away. How many chocolates remain in the box?",
    options: ["133", "130", "142", "132"],
    correctAnswer: 3,
    difficulty: "easy",
    hint: "Subtract the number given away from the starting count."
  },
  {
    id: 32,
    question: "A box had 67 chocolates. 49 were given away. How many chocolates remain in the box?",
    options: ["17", "18", "19", "23"],
    correctAnswer: 1,
    difficulty: "easy",
    hint: "Subtract the number given away from the starting count."
  },
  {
    id: 33,
    question: "A warehouse started with 610 units of a product and shipped out 80 units this week. How many units are left?",
    options: ["530", "535", "529", "527"],
    correctAnswer: 0,
    difficulty: "moderate",
    hint: "Compute the remaining units by subtraction."
  },
  {
    id: 34,
    question: "A warehouse started with 492 units of a product and shipped out 266 units this week. How many units are left?",
    options: ["211", "236", "226", "216"],
    correctAnswer: 2,
    difficulty: "moderate",
    hint: "Compute the remaining units by subtraction."
  },
  {
    id: 35,
    question: "A warehouse started with 422 units of a product and shipped out 79 units this week. How many units are left?",
    options: ["358", "340", "343", "333"],
    correctAnswer: 2,
    difficulty: "moderate",
    hint: "Compute the remaining units by subtraction."
  },
  {
    id: 36,
    question: "A warehouse started with 798 units of a product and shipped out 294 units this week. How many units are left?",
    options: ["494", "503", "501", "504"],
    correctAnswer: 3,
    difficulty: "moderate",
    hint: "Compute the remaining units by subtraction."
  },
  {
    id: 37,
    question: "A warehouse started with 809 units of a product and shipped out 84 units this week. How many units are left?",
    options: ["710", "730", "726", "725"],
    correctAnswer: 3,
    difficulty: "moderate",
    hint: "Compute the remaining units by subtraction."
  },
  {
    id: 38,
    question: "A warehouse started with 792 units of a product and shipped out 354 units this week. How many units are left?",
    options: ["438", "435", "453", "436"],
    correctAnswer: 0,
    difficulty: "moderate",
    hint: "Compute the remaining units by subtraction."
  },
  {
    id: 39,
    question: "A train had 1034 passengers. 309 passengers got down at midway, and 392 passengers boarded at the next station. How many passengers are now on the train?",
    options: ["1118", "1120", "1117", "1119"],
    correctAnswer: 2,
    difficulty: "difficult",
    hint: "Subtract those who got down, then add those who boarded."
  },
  {
    id: 40,
    question: "A train had 1436 passengers. 423 passengers got down at midway, and 87 passengers boarded at the next station. How many passengers are now on the train?",
    options: ["1097", "1110", "1115", "1100"],
    correctAnswer: 3,
    difficulty: "difficult",
    hint: "Subtract those who got down, then add those who boarded."
  },
  {
    id: 41,
    question: "Each packet contains 10 biscuits. If there are 6 packets, how many biscuits are there in total?",
    options: ["60", "63", "58", "59"],
    correctAnswer: 0,
    difficulty: "easy",
    hint: "Multiply number per packet by number of packets."
  },
  {
    id: 42,
    question: "Each packet contains 4 biscuits. If there are 9 packets, how many biscuits are there in total?",
    options: ["51", "26", "38", "36"],
    correctAnswer: 3,
    difficulty: "easy",
    hint: "Multiply number per packet by number of packets."
  },
  {
    id: 43,
    question: "Each packet contains 12 biscuits. If there are 3 packets, how many biscuits are there in total?",
    options: ["35", "34", "38", "36"],
    correctAnswer: 3,
    difficulty: "easy",
    hint: "Multiply number per packet by number of packets."
  },
  {
    id: 44,
    question: "Each packet contains 6 biscuits. If there are 6 packets, how many biscuits are there in total?",
    options: ["36", "39", "37", "51"],
    correctAnswer: 0,
    difficulty: "easy",
    hint: "Multiply number per packet by number of packets."
  },
  {
    id: 45,
    question: "Each packet contains 10 biscuits. If there are 9 packets, how many biscuits are there in total?",
    options: ["87", "90", "92", "88"],
    correctAnswer: 1,
    difficulty: "easy",
    hint: "Multiply number per packet by number of packets."
  },
  {
    id: 46,
    question: "Each packet contains 2 biscuits. If there are 7 packets, how many biscuits are there in total?",
    options: ["13", "14", "16", "24"],
    correctAnswer: 1,
    difficulty: "easy",
    hint: "Multiply number per packet by number of packets."
  },
  {
    id: 47,
    question: "Each packet contains 3 biscuits. If there are 3 packets, how many biscuits are there in total?",
    options: ["6", "9", "12", "8"],
    correctAnswer: 1,
    difficulty: "easy",
    hint: "Multiply number per packet by number of packets."
  },
  {
    id: 48,
    question: "Each packet contains 2 biscuits. If there are 6 packets, how many biscuits are there in total?",
    options: ["13", "12", "9", "15"],
    correctAnswer: 1,
    difficulty: "easy",
    hint: "Multiply number per packet by number of packets."
  },
  {
    id: 49,
    question: "Each packet contains 7 biscuits. If there are 10 packets, how many biscuits are there in total?",
    options: ["69", "85", "70", "75"],
    correctAnswer: 2,
    difficulty: "easy",
    hint: "Multiply number per packet by number of packets."
  },
  {
    id: 50,
    question: "Each packet contains 8 biscuits. If there are 2 packets, how many biscuits are there in total?",
    options: ["19", "16", "21", "15"],
    correctAnswer: 1,
    difficulty: "easy",
    hint: "Multiply number per packet by number of packets."
  },
  {
    id: 51,
    question: "Each packet contains 3 biscuits. If there are 8 packets, how many biscuits are there in total?",
    options: ["24", "34", "25", "21"],
    correctAnswer: 0,
    difficulty: "easy",
    hint: "Multiply number per packet by number of packets."
  },
  {
    id: 52,
    question: "Each packet contains 6 biscuits. If there are 5 packets, how many biscuits are there in total?",
    options: ["30", "27", "15", "31"],
    correctAnswer: 0,
    difficulty: "easy",
    hint: "Multiply number per packet by number of packets."
  },
  {
    id: 53,
    question: "A factory produces 27 toys per hour. How many toys will it produce in 3 hours?",
    options: ["81", "83", "84", "66"],
    correctAnswer: 0,
    difficulty: "moderate",
    hint: "Multiply the hourly rate by hours."
  },
  {
    id: 54,
    question: "A factory produces 11 toys per hour. How many toys will it produce in 3 hours?",
    options: ["35", "48", "33", "32"],
    correctAnswer: 2,
    difficulty: "moderate",
    hint: "Multiply the hourly rate by hours."
  },
  {
    id: 55,
    question: "A factory produces 48 toys per hour. How many toys will it produce in 8 hours?",
    options: ["389", "399", "387", "384"],
    correctAnswer: 3,
    difficulty: "moderate",
    hint: "Multiply the hourly rate by hours."
  },
  {
    id: 56,
    question: "A factory produces 26 toys per hour. How many toys will it produce in 2 hours?",
    options: ["52", "49", "42", "57"],
    correctAnswer: 0,
    difficulty: "moderate",
    hint: "Multiply the hourly rate by hours."
  },
  {
    id: 57,
    question: "A factory produces 14 toys per hour. How many toys will it produce in 12 hours?",
    options: ["153", "171", "183", "168"],
    correctAnswer: 3,
    difficulty: "moderate",
    hint: "Multiply the hourly rate by hours."
  },
  {
    id: 58,
    question: "A factory produces 42 toys per hour. How many toys will it produce in 6 hours?",
    options: ["252", "237", "257", "255"],
    correctAnswer: 0,
    difficulty: "moderate",
    hint: "Multiply the hourly rate by hours."
  },
  {
    id: 59,
    question: "A machine makes 50 parts every hour. How many parts will it make in 10 hours for 3 days?",
    options: ["1499", "1500", "1505", "1485"],
    correctAnswer: 1,
    difficulty: "difficult",
    hint: "Multiply parts/hour × hours × days."
  },
  {
    id: 60,
    question: "A machine makes 34 parts every hour. How many parts will it make in 15 hours for 3 days?",
    options: ["1530", "1515", "1535", "1545"],
    correctAnswer: 0,
    difficulty: "difficult",
    hint: "Multiply parts/hour × hours × days."
  },
  {
    id: 61,
    question: "₹910 worth of gifts are shared equally among 5 friends. How much does each friend receive?",
    options: ["₹192", "₹182", "₹172", "₹183"],
    correctAnswer: 1,
    difficulty: "easy",
    hint: "Divide the total by the number of friends."
  },
  {
    id: 62,
    question: "₹564 worth of gifts are shared equally among 4 friends. How much does each friend receive?",
    options: ["₹156", "₹126", "₹144", "₹141"],
    correctAnswer: 3,
    difficulty: "easy",
    hint: "Divide the total by the number of friends."
  },
  {
    id: 63,
    question: "₹180 worth of gifts are shared equally among 3 friends. How much does each friend receive?",
    options: ["₹59", "₹60", "₹57", "₹61"],
    correctAnswer: 1,
    difficulty: "easy",
    hint: "Divide the total by the number of friends."
  },
  {
    id: 64,
    question: "₹580 worth of gifts are shared equally among 5 friends. How much does each friend receive?",
    options: ["₹116", "₹131", "₹101", "₹117"],
    correctAnswer: 0,
    difficulty: "easy",
    hint: "Divide the total by the number of friends."
  },
  {
    id: 65,
    question: "₹141 worth of gifts are shared equally among 3 friends. How much does each friend receive?",
    options: ["₹32", "₹44", "₹47", "₹45"],
    correctAnswer: 2,
    difficulty: "easy",
    hint: "Divide the total by the number of friends."
  },
  {
    id: 66,
    question: "₹1880 worth of gifts are shared equally among 10 friends. How much does each friend receive?",
    options: ["₹198", "₹185", "₹188", "₹178"],
    correctAnswer: 2,
    difficulty: "easy",
    hint: "Divide the total by the number of friends."
  },
  {
    id: 67,
    question: "₹384 worth of gifts are shared equally among 3 friends. How much does each friend receive?",
    options: ["₹128", "₹143", "₹113", "₹118"],
    correctAnswer: 0,
    difficulty: "easy",
    hint: "Divide the total by the number of friends."
  },
  {
    id: 68,
    question: "₹1500 worth of gifts are shared equally among 10 friends. How much does each friend receive?",
    options: ["₹150", "₹152", "₹149", "₹160"],
    correctAnswer: 0,
    difficulty: "easy",
    hint: "Divide the total by the number of friends."
  },
  {
    id: 69,
    question: "₹1430 worth of gifts are shared equally among 10 friends. How much does each friend receive?",
    options: ["₹144", "₹143", "₹153", "₹128"],
    correctAnswer: 1,
    difficulty: "easy",
    hint: "Divide the total by the number of friends."
  },
  {
    id: 70,
    question: "₹664 worth of gifts are shared equally among 8 friends. How much does each friend receive?",
    options: ["₹84", "₹83", "₹86", "₹85"],
    correctAnswer: 1,
    difficulty: "easy",
    hint: "Divide the total by the number of friends."
  },
  {
    id: 71,
    question: "₹144 worth of gifts are shared equally among 3 friends. How much does each friend receive?",
    options: ["₹53", "₹47", "₹48", "₹49"],
    correctAnswer: 2,
    difficulty: "easy",
    hint: "Divide the total by the number of friends."
  },
  {
    id: 72,
    question: "₹470 worth of gifts are shared equally among 5 friends. How much does each friend receive?",
    options: ["₹104", "₹84", "₹99", "₹94"],
    correctAnswer: 3,
    difficulty: "easy",
    hint: "Divide the total by the number of friends."
  },
  {
    id: 73,
    question: "A total of ₹150 is split equally between 6 teams for purchases. How much does each team get?",
    options: ["₹35", "₹30", "₹40", "₹25"],
    correctAnswer: 3,
    difficulty: "moderate",
    hint: "Divide total amount by the number of teams."
  },
  {
    id: 74,
    question: "A total of ₹762 is split equally between 6 teams for purchases. How much does each team get?",
    options: ["₹142", "₹117", "₹127", "₹128"],
    correctAnswer: 2,
    difficulty: "moderate",
    hint: "Divide total amount by the number of teams."
  },
  {
    id: 75,
    question: "A total of ₹864 is split equally between 6 teams for purchases. How much does each team get?",
    options: ["₹141", "₹144", "₹149", "₹147"],
    correctAnswer: 1,
    difficulty: "moderate",
    hint: "Divide total amount by the number of teams."
  },
  {
    id: 76,
    question: "A total of ₹312 is split equally between 6 teams for purchases. How much does each team get?",
    options: ["₹67", "₹52", "₹42", "₹49"],
    correctAnswer: 1,
    difficulty: "moderate",
    hint: "Divide total amount by the number of teams."
  },
  {
    id: 77,
    question: "A total of ₹387 is split equally between 3 teams for purchases. How much does each team get?",
    options: ["₹129", "₹126", "₹128", "₹139"],
    correctAnswer: 0,
    difficulty: "moderate",
    hint: "Divide total amount by the number of teams."
  },
  {
    id: 78,
    question: "A total of ₹544 is split equally between 4 teams for purchases. How much does each team get?",
    options: ["₹141", "₹136", "₹139", "₹138"],
    correctAnswer: 1,
    difficulty: "moderate",
    hint: "Divide total amount by the number of teams."
  },
  {
    id: 79,
    question: "₹1584 apples are packed into boxes of 8 apples each. How many boxes are needed in total?",
    options: ["195", "199", "201", "198"],
    correctAnswer: 3,
    difficulty: "difficult",
    hint: "Divide total apples by apples per box to find number of boxes."
  },
  {
    id: 80,
    question: "₹660 apples are packed into boxes of 4 apples each. How many boxes are needed in total?",
    options: ["180", "164", "165", "162"],
    correctAnswer: 2,
    difficulty: "difficult",
    hint: "Divide total apples by apples per box to find number of boxes."
  },
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
