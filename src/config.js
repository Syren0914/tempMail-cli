import Conf from 'conf';
import open from 'open';
import chalk from 'chalk';
import inquirer from 'inquirer';
import dotenv from 'dotenv';

dotenv.config();

const schema = {
  rapidapiKey: {
    type: 'string',
    default: process.env.RAPIDAPI_KEY || ''
  },
  tempmailToken: {
    type: 'string',
    default: process.env.TEMPMAIL_TOKEN || ''
  }
};

const config = new Conf({ projectName: 'tempmail-cli-nodejs', schema });

export async function ensureConfig(force = false) {
  let rk = config.get('rapidapiKey') || process.env.RAPIDAPI_KEY;
  let tk = config.get('tempmailToken') || process.env.TEMPMAIL_TOKEN;

  if (!rk || !tk || force) {
    if (force) {
        console.log(chalk.red('\n🚫 Authentication failed with current tokens.'));
    } else {
        console.log(chalk.yellow('\n⚠️  API configuration missing.'));
    }
    console.log(chalk.cyan('You need a RapidAPI Key and a TempMail.so Token to use this CLI.'));
    
    const { setup } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'setup',
        message: 'Would you like to open tempmail.so to get your tokens?',
        default: true
      }
    ]);

    if (setup) {
      await open('https://tempmail.so/mailboxes');
      console.log(chalk.green('\nOpening browser... Login and go to Account -> Account Information to find your token.'));
    }

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'rk',
        message: 'Enter your RAPIDAPI_KEY:',
        validate: input => input.length > 0 || 'Key is required'
      },
      {
        type: 'input',
        name: 'tk',
        message: 'Enter your TEMPMAIL_TOKEN:',
        validate: input => input.length > 0 || 'Token is required'
      }
    ]);

    config.set('rapidapiKey', answers.rk);
    config.set('tempmailToken', answers.tk);
    
    // Update current process env as well
    process.env.RAPIDAPI_KEY = answers.rk;
    process.env.TEMPMAIL_TOKEN = answers.tk;
    
    rk = answers.rk;
    tk = answers.tk;
    console.log(chalk.green('✅ Configuration saved!\n'));
  }

  return { rk, tk };
}

export function getConfig() {
  return {
    rk: config.get('rapidapiKey') || process.env.RAPIDAPI_KEY,
    tk: config.get('tempmailToken') || process.env.TEMPMAIL_TOKEN
  };
}

export function clearConfig() {
    config.clear();
    console.log(chalk.red('Configuration cleared.'));
}
