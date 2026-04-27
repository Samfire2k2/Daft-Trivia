import 'dotenv/config';
import express from 'express';
import {
  ButtonStyleTypes,
  InteractionResponseFlags,
  InteractionResponseType,
  InteractionType,
  MessageComponentTypes,
  verifyKeyMiddleware,
} from 'discord-interactions';
import { getRandomEmoji, DiscordRequest } from './utils.js';
import { getShuffledOptions, getResult } from './game.js';
import { QuizGame, QUIZ_QUESTIONS } from './quiz.js';
import { getUserStats, updateUserStats, getLeaderboard, getUserRank, setDailyQuizCompleted, hasCompletedDailyToday } from './userStats.js';

// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;
// To keep track of our active games
const activeGames = {};
// To keep track of quiz games
const quizGames = {};

// Use raw buffer for interactions endpoint to preserve signature verification
app.use(express.raw({ type: 'application/json' }));

// Health check endpoint
app.get('/', (req, res) => {
  res.send('🤖 Daft Punk Bot is live! Use /quiz on Discord to start playing.');
});

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 * Parse request body and verifies incoming requests using discord-interactions package
 */
app.post('/interactions', verifyKeyMiddleware(process.env.PUBLIC_KEY), async function (req, res) {
  // Interaction id, type and data
  const { id, type, data, member, channel_id } = req.body;

  /**
   * Handle verification requests
   */
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  /**
   * Handle slash command requests
   * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
   */
  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;

    // "test" command
    if (name === 'test') {
      // Send a message into the channel where command was triggered from
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `hello world ${getRandomEmoji()}`
        },
      });
    }

    // "quiz" command - Start Daft Punk quiz
    if (name === 'quiz') {
      const userId = member.user.id;
      
      // Get the number of questions from the option (default 10)
      const options = data.options || [];
      const difficultyOption = options.find(opt => opt.name === 'difficulte');
      const languageOption = options.find(opt => opt.name === 'langue');
      
      const questionCount = difficultyOption ? parseInt(difficultyOption.value) : 10;
      const language = languageOption ? languageOption.value : 'fr';
      
      // Create a new quiz game for this user with selected difficulty and language
      quizGames[userId] = new QuizGame(userId, questionCount, language);
      const quiz = quizGames[userId];
      const currentQuestion = quiz.getCurrentQuestion();
      const questionNumber = 1;
      
      // Create buttons for the first question
      const components = createQuizButtons(currentQuestion, userId);
      
      const titleText = language === 'en' ? `🎵 Question ${questionNumber}/${quiz.questionCount}` : `🎵 Question ${questionNumber}/${quiz.questionCount}`;
      
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [{
            title: titleText,
            description: currentQuestion.question,
            color: 9109760,
          }],
          components: components,
        },
      });
    }

    // "profile" command - Show user stats
    if (name === 'profile') {
      const userId = member.user.id;
      const username = member.user.username;
      const userStats = getUserStats(userId);
      const rank = getUserRank(userId);
      
      const avgAccuracy = userStats.totalAnswered > 0 
        ? Math.round((userStats.totalCorrect / userStats.totalAnswered) * 100)
        : 0;
      
      let recentQuizzes = 'Aucun quiz complété';
      if (userStats.quizzes.length > 0) {
        recentQuizzes = userStats.quizzes.slice(0, 3).map((q, i) => 
          `${i + 1}. ${q.score}/${q.total * 10} pts (${q.percentage}%)`
        ).join('\n');
      }
      
      const badgesText = userStats.badges.length > 0 
        ? userStats.badges.join(' ')
        : 'Aucun badge';
      
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [{
            title: `📊 Profil de ${username}`,
            fields: [
              { name: 'Rang', value: rank ? `#${rank}` : 'Non classé', inline: true },
              { name: 'Quizzes joués', value: `${userStats.totalQuizzes}`, inline: true },
              { name: 'Points totaux', value: `${userStats.totalPoints}`, inline: true },
              { name: 'Meilleur score', value: `${userStats.bestScore}`, inline: true },
              { name: 'Précision', value: `${avgAccuracy}%`, inline: true },
              { name: 'Bonnes réponses', value: `${userStats.totalCorrect}/${userStats.totalAnswered}`, inline: true },
              { name: 'Badges', value: badgesText },
              { name: 'Derniers quizzes', value: recentQuizzes },
            ],
            color: 9109760,
          }],
        },
      });
    }

    // "leaderboard" command - Show top 10
    if (name === 'leaderboard') {
      const leaderboard = getLeaderboard();
      
      let leaderboardText = '';
      leaderboard.forEach((user, index) => {
        leaderboardText += `${index + 1}. **${user.username}** - ${user.totalPoints} pts (${user.totalQuizzes} quizzes)\n`;
      });
      
      if (!leaderboardText) {
        leaderboardText = 'Aucun joueur trouvé.';
      }
      
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [{
            title: '🏆 Classement Top 10',
            description: leaderboardText,
            color: 9109760,
          }],
        },
      });
    }

    // "daily" command - Daily quiz
    if (name === 'daily') {
      const userId = member.user.id;
      
      if (hasCompletedDailyToday(userId)) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '📅 Vous avez déjà complété le quiz quotidien aujourd\'hui!',
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      }
      
      const options = data.options || [];
      const languageOption = options.find(opt => opt.name === 'langue');
      const language = languageOption ? languageOption.value : 'fr';
      
      // Create a daily quiz (10 questions)
      quizGames[userId] = new QuizGame(userId, 10, language);
      const quiz = quizGames[userId];
      quiz.isDaily = true; // Mark as daily quiz
      
      const currentQuestion = quiz.getCurrentQuestion();
      const components = createQuizButtons(currentQuestion, userId);
      
      const titleText = language === 'en' ? `🎵 Daily Quiz - Question 1/10` : `🎵 Quiz Quotidien - Question 1/10`;
      
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [{
            title: titleText,
            description: currentQuestion.question,
            color: 9109760,
          }],
          components: components,
        },
      });
    }

    console.error(`unknown command: ${name}`);
    return res.status(400).json({ error: 'unknown command' });
  }

  /**
   * Handle button/select menu interactions
   */
  if (type === InteractionType.MESSAGE_COMPONENT) {
    const userId = member.user.id;
    const customId = data.custom_id;

    // Check if this is a quiz answer button
    if (customId.startsWith('quiz_answer_')) {
      const answer = customId.replace('quiz_answer_', '');
      const quiz = quizGames[userId];

      if (!quiz) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ Aucun quiz en cours. Lancez `/quiz` d\'abord!',
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      }

      // Answer the question
      const isCorrect = quiz.answerQuestion(answer);
      const responseText = isCorrect ? '✅ Bonne réponse!' : '❌ Mauvaise réponse!';

      // If quiz is completed, show final results
      if (quiz.completed) {
        const results = quiz.getResults();
        const embed = quiz.getScoreEmbed();
        
        // Update user stats
        updateUserStats(userId, member.user.username, results);
        
        // If it was a daily quiz, mark it as completed
        if (quiz.isDaily) {
          setDailyQuizCompleted(userId);
        }
        
        delete quizGames[userId];

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `${responseText}\n\n**Quiz terminé!**`,
            embeds: [embed],
          },
        });
      }

      // Show next question
      const nextQuestion = quiz.getCurrentQuestion();
      const nextQuestionNumber = quiz.currentQuestion + 1;
      const components = createQuizButtons(nextQuestion, userId);

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: responseText,
          embeds: [{
            title: `🎵 Question ${nextQuestionNumber}/${quiz.questionCount}`,
            description: nextQuestion.question,
            color: 9109760,
          }],
          components: components,
        },
      });
    }
    
    // Check if this is a quit button
    if (customId === 'quiz_quit') {
      const quiz = quizGames[userId];
      
      if (quiz) {
        const results = quiz.getResults();
        
        // Update stats even if quit
        updateUserStats(userId, member.user.username, results);
        
        delete quizGames[userId];
        
        const quitMessage = quiz.language === 'en'
          ? `You quit the quiz! Your score: ${results.score}/${results.totalQuestions * 10} pts (${results.percentage}%)`
          : `Quiz abandonné! Votre score: ${results.score}/${results.totalQuestions * 10} pts (${results.percentage}%)`;
        
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: quitMessage,
          },
        });
      }
    }
  }

  console.error('unknown interaction type', type);
  return res.status(400).json({ error: 'unknown interaction type' });
});

/**
 * Helper function to create quiz answer buttons
 */
function createQuizButtons(question, userId) {
  const buttons = [];
  
  for (let option of question.options) {
    buttons.push({
      type: MessageComponentTypes.BUTTON,
      label: option.label,
      style: ButtonStyleTypes.PRIMARY,
      custom_id: `quiz_answer_${option.value}`,
    });
  }

  // Add quit button
  buttons.push({
    type: MessageComponentTypes.BUTTON,
    label: 'Quitter',
    style: ButtonStyleTypes.DANGER,
    custom_id: 'quiz_quit',
  });

  return [
    {
      type: MessageComponentTypes.ACTION_ROW,
      components: buttons.slice(0, 2),
    },
    {
      type: MessageComponentTypes.ACTION_ROW,
      components: buttons.slice(2, 4),
    },
    {
      type: MessageComponentTypes.ACTION_ROW,
      components: buttons.slice(4, 5),
    },
  ];
}

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
