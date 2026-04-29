import mongoose from 'mongoose';

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://dafttrivia:dafttrivia@dafttrivia.l1qsquq.mongodb.net/daft-trivia?retryWrites=true&w=majority');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
  }
}

// User Stats Schema
const userStatsSchema = new mongoose.Schema({
  userId: { type: String, unique: true, required: true },
  username: { type: String, default: 'Unknown' },
  totalQuizzes: { type: Number, default: 0 },
  totalCorrect: { type: Number, default: 0 },
  totalAnswered: { type: Number, default: 0 },
  bestScore: { type: Number, default: 0 },
  totalPoints: { type: Number, default: 0 },
  quizzes: [{
    date: Date,
    score: Number,
    correct: Number,
    total: Number,
    percentage: Number
  }],
  badges: [String],
  lastDailyQuiz: Date,
  createdAt: { type: Date, default: Date.now }
});

const UserStats = mongoose.model('UserStats', userStatsSchema);

// Initialize DB connection
connectDB();

// Get or create user stats
export async function getUserStats(userId) {
  try {
    let userStats = await UserStats.findOne({ userId });
    if (!userStats) {
      userStats = new UserStats({
        userId,
        username: 'Unknown',
        totalQuizzes: 0,
        totalCorrect: 0,
        totalAnswered: 0,
        bestScore: 0,
        totalPoints: 0,
        quizzes: [],
        badges: [],
        lastDailyQuiz: null,
      });
      await userStats.save();
    }
    return userStats.toObject();
  } catch (error) {
    console.error('Error getting user stats:', error);
    return null;
  }
}

// Update user stats after quiz completion
export async function updateUserStats(userId, username, results) {
  try {
    let userStats = await UserStats.findOne({ userId });
    
    if (!userStats) {
      userStats = new UserStats({ userId, username });
    }

    userStats.username = username;
    userStats.totalQuizzes += 1;
    userStats.totalCorrect += results.correctAnswers;
    userStats.totalAnswered += results.totalQuestions;
    userStats.totalPoints += results.score;

    if (results.score > userStats.bestScore) {
      userStats.bestScore = results.score;
    }

    // Add to quiz history (keep last 10)
    userStats.quizzes.unshift({
      date: new Date(),
      score: results.score,
      correct: results.correctAnswers,
      total: results.totalQuestions,
      percentage: results.percentage,
    });
    if (userStats.quizzes.length > 10) {
      userStats.quizzes.pop();
    }

    // Update badges
    updateBadges(userStats);

    await userStats.save();
    return userStats.toObject();
  } catch (error) {
    console.error('Error updating user stats:', error);
    return null;
  }
}

// Update badges based on achievements
function updateBadges(userStats) {
  const badges = [];

  // Perfect score badge
  if (userStats.quizzes.some(q => q.percentage === 100)) {
    badges.push('🏆 Perfect');
  }

  // Quiz master badge (10+ quizzes)
  if (userStats.totalQuizzes >= 10) {
    badges.push('🎓 Quiz Master');
  }

  // Accuracy badge (>80% average)
  const avgAccuracy = (userStats.totalCorrect / userStats.totalAnswered) * 100;
  if (avgAccuracy >= 80) {
    badges.push('🎯 Accuracy Expert');
  }

  // Points badge (500+ points)
  if (userStats.totalPoints >= 500) {
    badges.push('⭐ Star Player');
  }

  // Daily player badge
  if (userStats.lastDailyQuiz) {
    const lastDaily = new Date(userStats.lastDailyQuiz);
    const today = new Date();
    if (lastDaily.toDateString() === today.toDateString()) {
      badges.push('📅 Daily Player');
    }
  }

  userStats.badges = [...new Set(badges)];
}

// Get leaderboard (top 10)
export async function getLeaderboard() {
  try {
    const users = await UserStats.find()
      .sort({ totalPoints: -1 })
      .limit(10)
      .lean();
    return users;
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    return [];
  }
}

// Get user rank
export async function getUserRank(userId) {
  try {
    const rank = await UserStats.countDocuments({
      totalPoints: { $gt: (await UserStats.findOne({ userId }))?.totalPoints || 0 }
    });
    return rank + 1;
  } catch (error) {
    console.error('Error getting user rank:', error);
    return null;
  }
}

// Set daily quiz completion
export async function setDailyQuizCompleted(userId) {
  try {
    await UserStats.findOneAndUpdate(
      { userId },
      { lastDailyQuiz: new Date() },
      { new: true }
    );
  } catch (error) {
    console.error('Error setting daily quiz:', error);
  }
}

// Check if user already completed daily quiz today
export async function hasCompletedDailyToday(userId) {
  try {
    const userStats = await UserStats.findOne({ userId });
    if (!userStats || !userStats.lastDailyQuiz) return false;

    const lastDaily = new Date(userStats.lastDailyQuiz);
    const today = new Date();
    return lastDaily.toDateString() === today.toDateString();
  } catch (error) {
    console.error('Error checking daily quiz:', error);
    return false;
  }
}
