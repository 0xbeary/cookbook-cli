import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

// Find the package root directory (where package.json and templates/ are located)
function findPackageRoot(): string {
  const currentFile = fileURLToPath(import.meta.url);
  let dir = path.dirname(currentFile);
  
  // In a published package, the structure is:
  // package-root/
  // ├── dist/index.js (our built file)
  // └── templates/
  // So from dist/index.js, we need to go up one level
  
  // Keep going up until we find package.json with our package name
  while (dir !== path.dirname(dir)) {
    const packageJsonPath = path.join(dir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkg = fs.readJsonSync(packageJsonPath);
        // Make sure it's our package
        if (pkg.name === 'pipes-sdk-cli') {
          return dir;
        }
      } catch {
        // Continue searching
      }
    }
    dir = path.dirname(dir);
  }
  
  // Fallback: assume we're in dist/ and go up one level
  return path.join(path.dirname(currentFile), '..');
}

export async function addTemplate(templateName: string, templateType?: 'pipe' | 'module') {
  try {
    // Check if we're in a valid project
    const cwd = process.cwd();
    const packageJsonPath = path.join(cwd, 'package.json');
    
    if (!fs.existsSync(packageJsonPath)) {
      console.log(chalk.red('Error: Not in a valid project directory'));
      console.log(chalk.gray('Run: pipes-sdk-cli init'));
      return;
    }

    // If no type specified, try to find the template in both categories
    let foundType: 'pipe' | 'module' | null = null;
    let templateDir: string;
    
    const packageRoot = findPackageRoot();
    
    if (templateType) {
      // Check specific type
      templateDir = path.join(packageRoot, 'templates', templateType === 'pipe' ? 'pipes' : 'modules', templateName);
      if (fs.existsSync(templateDir)) {
        foundType = templateType;
      }
    } else {
      // Search in both pipes and modules
      const pipeDir = path.join(packageRoot, 'templates', 'pipes', templateName);
      const moduleDir = path.join(packageRoot, 'templates', 'modules', templateName);
      
      if (fs.existsSync(pipeDir)) {
        foundType = 'pipe';
        templateDir = pipeDir;
      } else if (fs.existsSync(moduleDir)) {
        foundType = 'module';
        templateDir = moduleDir;
      }
    }
    
    if (!foundType || !templateDir!) {
      console.log(chalk.red(`Error: Template "${templateName}" not found`));
      await showAvailableTemplates(packageRoot);
      return;
    }

    // Destination paths - different for pipes vs modules
    let destDir: string;
    if (foundType === 'pipe') {
      destDir = path.join(cwd, 'src/pipes', templateName);
    } else {
      // Special case for hono - install as src/api/
      if (templateName === 'hono') {
        destDir = path.join(cwd, 'src/api');
      } else {
        destDir = path.join(cwd, 'src/modules', templateName);
      }
    }
    
    // Copy template files
    await fs.copy(templateDir, destDir);
    
    console.log(chalk.green(`✓ Added ${foundType} "${templateName}"`));
    console.log(chalk.gray(`  ${destDir}`));
    
    // Update dependencies if needed
    await updateDependencies(templateName, foundType, cwd);
    
    // Show usage instructions
    showUsageInstructions(templateName, foundType);
    
  } catch (error) {
    console.log(chalk.red('Error adding template:'), error);
  }
}

async function showAvailableTemplates(packageRoot: string) {
  const templatesRoot = path.join(packageRoot, 'templates');
  
  try {
    // Load registry.json to get organized list
    const registryPath = path.join(templatesRoot, 'registry.json');
    if (fs.existsSync(registryPath)) {
      const registry = await fs.readJson(registryPath);
      
      console.log(chalk.gray('Available templates:'));
      console.log('');
      
      if (registry.pipes && Object.keys(registry.pipes).length > 0) {
        console.log(chalk.blue('Pipes:'));
        for (const [name, info] of Object.entries(registry.pipes)) {
          console.log(chalk.green(`  ${name}`) + chalk.gray(` - ${(info as any).description}`));
        }
        console.log('');
      }
      
      if (registry.modules && Object.keys(registry.modules).length > 0) {
        console.log(chalk.blue('Modules:'));
        for (const [name, info] of Object.entries(registry.modules)) {
          console.log(chalk.green(`  ${name}`) + chalk.gray(` - ${(info as any).description}`));
        }
        console.log('');
      }
    } else {
      // Fallback: list directories
      const pipesDir = path.join(templatesRoot, 'pipes');
      const modulesDir = path.join(templatesRoot, 'modules');
      
      if (fs.existsSync(pipesDir)) {
        const pipes = fs.readdirSync(pipesDir).filter(item => 
          fs.statSync(path.join(pipesDir, item)).isDirectory()
        );
        if (pipes.length > 0) {
          console.log(chalk.blue('Available pipes:'));
          pipes.forEach(pipe => console.log(chalk.green(`  ${pipe}`)));
          console.log('');
        }
      }
      
      if (fs.existsSync(modulesDir)) {
        const modules = fs.readdirSync(modulesDir).filter(item => 
          fs.statSync(path.join(modulesDir, item)).isDirectory()
        );
        if (modules.length > 0) {
          console.log(chalk.blue('Available modules:'));
          modules.forEach(module => console.log(chalk.green(`  ${module}`)));
          console.log('');
        }
      }
    }
  } catch (error) {
    console.log(chalk.gray('Could not load template registry'));
  }
  
  console.log(chalk.gray('Usage: pipes-sdk-cli add <template-name>'));
  console.log(chalk.gray('       pipes-sdk-cli list'));
}

async function updateDependencies(templateName: string, templateType: 'pipe' | 'module', projectDir: string) {
  const packageRoot = findPackageRoot();
  const templateDir = templateType === 'pipe' ? 'pipes' : 'modules';
  const depsPath = path.join(packageRoot, 'templates', templateDir, templateName, 'dependencies.json');
  
  if (!fs.existsSync(depsPath)) return;
  
  const deps = await fs.readJson(depsPath);
  const packageJsonPath = path.join(projectDir, 'package.json');
  const packageJson = await fs.readJson(packageJsonPath);
  
  // Merge dependencies
  packageJson.dependencies = { ...packageJson.dependencies, ...deps.dependencies };
  if (deps.devDependencies) {
    packageJson.devDependencies = { ...packageJson.devDependencies, ...deps.devDependencies };
  }
  
  await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
  
  console.log(chalk.blue('✓ Updated package.json with new dependencies'));
  
  // Auto-install dependencies
  try {
    const { execa } = await import('execa');
    console.log(chalk.gray('Installing dependencies...'));
    
    // Detect package manager
    const hasYarnLock = fs.existsSync(path.join(projectDir, 'yarn.lock'));
    const hasPnpmLock = fs.existsSync(path.join(projectDir, 'pnpm-lock.yaml'));
    
    let installCmd = 'npm install';
    if (hasPnpmLock) installCmd = 'pnpm install';
    else if (hasYarnLock) installCmd = 'yarn install';
    
    await execa(installCmd.split(' ')[0], installCmd.split(' ').slice(1), { 
      cwd: projectDir,
      stdio: 'inherit'
    });
    
    console.log(chalk.green('✓ Dependencies installed successfully'));
  } catch (error) {
    console.log(chalk.yellow('⚠ Auto-install failed. Please run manually:'));
    console.log(chalk.gray('npm install'));
  }
}

function showUsageInstructions(templateName: string, templateType: 'pipe' | 'module') {
  console.log('');
  console.log(chalk.blue('Usage:'));
  
  if (templateType === 'pipe') {
    switch (templateName) {
      case 'solana-swaps':
        console.log(chalk.gray('  import { SolanaSwapsPipe } from "./pipes/solana-swaps/index.js";'));
        console.log(chalk.gray('  const pipe = new SolanaSwapsPipe(clickhouse, config);'));
        console.log(chalk.gray('  await pipe.start();'));
        break;
      case 'pumpfun-tokens':
        console.log(chalk.gray('  import { PumpfunTokensPipe } from "./pipes/pumpfun-tokens/index.js";'));
        console.log(chalk.gray('  const pipe = new PumpfunTokensPipe(clickhouse, config);'));
        console.log(chalk.gray('  await pipe.start();'));
        break;
      case 'pumpfun-swaps':
        console.log(chalk.gray('  import { PumpfunSwapsPipe } from "./pipes/pumpfun-swaps/index.js";'));
        console.log(chalk.gray('  const pipe = new PumpfunSwapsPipe(clickhouse, config);'));
        console.log(chalk.gray('  await pipe.start();'));
        break;
      case 'metaplex-tokens':
        console.log(chalk.gray('  import { MetaplexTokensPipe } from "./pipes/metaplex-tokens/index.js";'));
        console.log(chalk.gray('  const pipe = new MetaplexTokensPipe(clickhouse, config);'));
        console.log(chalk.gray('  await pipe.start();'));
        break;
      default:
        console.log(chalk.gray(`  import { ${templateName} } from "./pipes/${templateName}/index.js";`));
        console.log(chalk.gray(`  // Follow the pipe's documentation for usage`));
    }
  } else {
    // Module usage instructions
    switch (templateName) {
      case 'hono':
        console.log(chalk.gray('  // Start the API server:'));
        console.log(chalk.gray('  cd src/api'));
        console.log(chalk.gray('  npm start'));
        break;
      default:
        console.log(chalk.gray(`  // Check src/modules/${templateName}/README.md for usage instructions`));
    }
  }
}
