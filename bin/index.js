#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { ensureConfig, clearConfig } from '../src/config.js';
import { createInbox } from '../src/api.js';
import { InboxUI } from '../src/tui.js';

const program = new Command();

program
  .name('tempmail')
  .description('A tiny CLI to spin up a temporary email inbox')
  .version('1.0.0');

program
  .command('create')
  .description('Create inbox and open live view')
  .option('-m, --minutes <number>', 'lifespan in minutes', parseFloat, 10)
  .option('-p, --prefix <string>', 'local-part (random if omitted)')
  .option('-d, --domain <string>', 'domain (first available if omitted)')
  .action(async (options) => {
    try {
      await ensureConfig();
      const inbox = await createInbox(options.prefix, options.domain, options.minutes);
      
      console.log(chalk.green(`\nCreated inbox: ${chalk.bold(inbox.email)}`));
      console.log(chalk.gray(`Opening live view... (q to quit, d to delete, c to copy address)\n`));
      
      const ui = new InboxUI(inbox);
      ui.run();
    } catch (error) {
      if (error.message.includes('401')) {
          await ensureConfig(true);
          // Retry once
          try {
              const inbox = await createInbox(options.prefix, options.domain, options.minutes);
              console.log(chalk.green(`\nCreated inbox: ${chalk.bold(inbox.email)}`));
              const ui = new InboxUI(inbox);
              ui.run();
          } catch (retryError) {
              console.error(chalk.red('\nRetry failed:'), retryError.message);
              process.exit(1);
          }
      } else {
          console.error(chalk.red('\nError:'), error.message);
          process.exit(1);
      }
    }
  });

program
  .command('config')
  .description('Manage configuration')
  .option('--clear', 'Clear saved tokens')
  .action(async (options) => {
      if (options.clear) {
          clearConfig();
      } else {
          const cfg = await ensureConfig();
          console.log(chalk.cyan('Current Configuration:'));
          console.log(`RAPIDAPI_KEY: ${cfg.rk ? chalk.green('SET') : chalk.red('NOT SET')}`);
          console.log(`TEMPMAIL_TOKEN: ${cfg.tk ? chalk.green('SET') : chalk.red('NOT SET')}`);
      }
  });

program.parse();
