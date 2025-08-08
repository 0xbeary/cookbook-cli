import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

// Find the package root directory
function findPackageRoot(): string {
  const currentFile = fileURLToPath(import.meta.url);
  let dir = path.dirname(currentFile);
  
  while (dir !== path.dirname(dir)) {
    const packageJsonPath = path.join(dir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkg = fs.readJsonSync(packageJsonPath);
        if (pkg.name === 'cookbook-cli') {
          return dir;
        }
      } catch {
        // Continue searching
      }
    }
    dir = path.dirname(dir);
  }
  
  return path.join(path.dirname(currentFile), '..');
}

export const listCommand = new Command()
  .name('list')
  .description('List available templates (pipes and modules)')
  .action(async () => {
    try {
      const packageRoot = findPackageRoot();
      const registryPath = path.join(packageRoot, 'templates', 'registry.json');
      
      if (fs.existsSync(registryPath)) {
        const registry = await fs.readJson(registryPath);
        
        console.log(chalk.blue('Available Templates:'));
        console.log('');
        
        if (registry.pipes && Object.keys(registry.pipes).length > 0) {
          console.log(chalk.green('Pipes:'));
          for (const [name, info] of Object.entries(registry.pipes)) {
            const description = (info as any).description || 'No description';
            const tags = (info as any).tags ? ` [${(info as any).tags.join(', ')}]` : '';
            console.log(chalk.yellow(`  ${name}`) + chalk.gray(` - ${description}${tags}`));
          }
          console.log('');
        }
        
        if (registry.modules && Object.keys(registry.modules).length > 0) {
          console.log(chalk.green('Modules:'));
          for (const [name, info] of Object.entries(registry.modules)) {
            const description = (info as any).description || 'No description';
            const tags = (info as any).tags ? ` [${(info as any).tags.join(', ')}]` : '';
            console.log(chalk.yellow(`  ${name}`) + chalk.gray(` - ${description}${tags}`));
          }
          console.log('');
        }
      } else {
        console.log(chalk.red('Registry not found. Available templates:'));
        
        // Fallback to listing directories
        const pipesDir = path.join(packageRoot, 'templates', 'pipes');
        const modulesDir = path.join(packageRoot, 'templates', 'modules');
        
        if (fs.existsSync(pipesDir)) {
          const pipes = fs.readdirSync(pipesDir).filter(item => 
            fs.statSync(path.join(pipesDir, item)).isDirectory()
          );
          if (pipes.length > 0) {
            console.log(chalk.green('Pipes:'));
            pipes.forEach(pipe => console.log(chalk.yellow(`  ${pipe}`)));
            console.log('');
          }
        }
        
        if (fs.existsSync(modulesDir)) {
          const modules = fs.readdirSync(modulesDir).filter(item => 
            fs.statSync(path.join(modulesDir, item)).isDirectory()
          );
          if (modules.length > 0) {
            console.log(chalk.green('Modules:'));
            modules.forEach(module => console.log(chalk.yellow(`  ${module}`)));
            console.log('');
          }
        }
      }
      
      console.log(chalk.gray('Usage:'));
      console.log(chalk.gray('  cookbook-cli add <template-name>'));
      console.log(chalk.gray('  cookbook-cli add <template-name> --type pipe'));
      console.log(chalk.gray('  cookbook-cli add <template-name> --type module'));
      
    } catch (error) {
      console.log(chalk.red('Error loading templates:'), error);
    }
  });
