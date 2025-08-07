import { Command } from 'commander';
import { addTemplate } from '../utils/add-template.js';

export const addCommand = new Command()
  .name('add')
  .description('Add a pipe or module to your project')
  .argument('<template>', 'template to add (e.g. pumpfun-tokens, hono-api)')
  .option('-t, --type <type>', 'specify template type (pipe or module)')
  .action(async (template: string, options: { type?: 'pipe' | 'module' }) => {
    await addTemplate(template, options.type);
  });
