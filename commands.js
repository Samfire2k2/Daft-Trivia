import 'dotenv/config';
import { getRPSChoices } from './game.js';
import { capitalize, InstallGlobalCommands } from './utils.js';

// Get the game choices from game.js
function createCommandChoices() {
  const choices = getRPSChoices();
  const commandChoices = [];

  for (let choice of choices) {
    commandChoices.push({
      name: capitalize(choice),
      value: choice.toLowerCase(),
    });
  }

  return commandChoices;
}

// Simple test command
const TEST_COMMAND = {
  name: 'test',
  description: 'Basic command',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

// Command containing options
const CHALLENGE_COMMAND = {
  name: 'challenge',
  description: 'Challenge to a match of rock paper scissors',
  options: [
    {
      type: 3,
      name: 'object',
      description: 'Pick your object',
      required: true,
      choices: createCommandChoices(),
    },
  ],
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 2],
};

// Daft Punk Quiz Command with language option
const QUIZ_COMMAND = {
  name: 'quiz',
  description: 'Start a Daft Punk trivia quiz / Lancez un quiz Daft Punk',
  options: [
    {
      type: 3,
      name: 'difficulte',
      description: 'Number of questions / Nombre de questions',
      required: false,
      choices: [
        { name: '10 questions', value: '10' },
        { name: '25 questions', value: '25' },
        { name: '50 questions', value: '50' },
      ],
    },
    {
      type: 3,
      name: 'langue',
      description: 'Language / Langue',
      required: false,
      choices: [
        { name: 'Français', value: 'fr' },
        { name: 'English', value: 'en' },
      ],
    },
  ],
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 2],
};

// Profile command
const PROFILE_COMMAND = {
  name: 'profile',
  description: 'View your Daft Punk quiz stats / Voir vos statistiques',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 2],
};

// Leaderboard command
const LEADERBOARD_COMMAND = {
  name: 'leaderboard',
  description: 'View top 10 players / Voir les top 10',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 2],
};

// Daily quiz command
const DAILY_COMMAND = {
  name: 'daily',
  description: 'Play the daily Daft Punk quiz / Quiz quotidien',
  options: [
    {
      type: 3,
      name: 'langue',
      description: 'Language / Langue',
      required: false,
      choices: [
        { name: 'Français', value: 'fr' },
        { name: 'English', value: 'en' },
      ],
    },
  ],
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 2],
};

const ALL_COMMANDS = [TEST_COMMAND, CHALLENGE_COMMAND, QUIZ_COMMAND, PROFILE_COMMAND, LEADERBOARD_COMMAND, DAILY_COMMAND];

InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);
