import fs from 'fs';
import path from 'path';

const STATS_FILE = './userStats.json';

// Initialize stats file if it doesn't exist
function initStatsFile() {
  if (!fs.existsSync(STATS_FILE)) {
    fs.writeFileSync(STATS_FILE, JSON.stringify({}, null, 2));
  }
}

// Load all user stats
function loadStats() {
  initStatsFile();
  const data = fs.readFileSync(STATS_FILE, 'utf8');
  return JSON.parse(data);
}

// Save stats
function saveStats(stats) {
  fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
}

// Get or create user stats
export function getUserStats(userId) {
  const stats = loadStats();
  if (!stats[userId]) {
    stats[userId] = {
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
    };
    saveStats(stats);
  }
  return stats[userId];
}

// Update user stats after quiz completion
export function updateUserStats(userId, username, results) {
  const stats = loadStats();
  const userStats = stats[userId] || getUserStats(userId);
  
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
    date: new Date().toISOString(),
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
  
  stats[userId] = userStats;
  saveStats(stats);
  
  return userStats;
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
export function getLeaderboard() {
  const stats = loadStats();
  const users = Object.values(stats)
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .slice(0, 10);
  return users;
}

// Get user rank
export function getUserRank(userId) {
  const leaderboard = getLeaderboard();
  return leaderboard.findIndex(u => u.userId === userId) + 1 || null;
}

// Set daily quiz completion
export function setDailyQuizCompleted(userId) {
  const stats = loadStats();
  const userStats = stats[userId] || getUserStats(userId);
  userStats.lastDailyQuiz = new Date().toISOString();
  stats[userId] = userStats;
  saveStats(stats);
}

// Check if user already completed daily quiz today
export function hasCompletedDailyToday(userId) {
  const userStats = getUserStats(userId);
  if (!userStats.lastDailyQuiz) return false;
  
  const lastDaily = new Date(userStats.lastDailyQuiz);
  const today = new Date();
  return lastDaily.toDateString() === today.toDateString();
}
