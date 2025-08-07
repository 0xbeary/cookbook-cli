#!/usr/bin/env node

// src/index.ts
import { Command as Command4 } from "commander";

// src/commands/add.ts
import { Command } from "commander";

// src/utils/add-template.ts
import fs from "fs-extra";
import path from "path";
import chalk from "chalk";
import { fileURLToPath } from "url";
function findPackageRoot() {
  const currentFile = fileURLToPath(import.meta.url);
  let dir = path.dirname(currentFile);
  while (dir !== path.dirname(dir)) {
    const packageJsonPath = path.join(dir, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkg = fs.readJsonSync(packageJsonPath);
        if (pkg.name === "cookbook-cli") {
          return dir;
        }
      } catch {
      }
    }
    dir = path.dirname(dir);
  }
  return path.join(path.dirname(currentFile), "..");
}
async function addTemplate(templateName, templateType) {
  try {
    const cwd = process.cwd();
    const packageJsonPath = path.join(cwd, "package.json");
    if (!fs.existsSync(packageJsonPath)) {
      console.log(chalk.red("Error: Not in a valid project directory"));
      console.log(chalk.gray("Run: cookbook-cli init"));
      return;
    }
    let foundType = null;
    let templateDir;
    const packageRoot = findPackageRoot();
    if (templateType) {
      templateDir = path.join(packageRoot, "templates", templateType === "pipe" ? "pipes" : "modules", templateName);
      if (fs.existsSync(templateDir)) {
        foundType = templateType;
      }
    } else {
      const pipeDir = path.join(packageRoot, "templates", "pipes", templateName);
      const moduleDir = path.join(packageRoot, "templates", "modules", templateName);
      if (fs.existsSync(pipeDir)) {
        foundType = "pipe";
        templateDir = pipeDir;
      } else if (fs.existsSync(moduleDir)) {
        foundType = "module";
        templateDir = moduleDir;
      }
    }
    if (!foundType || !templateDir) {
      console.log(chalk.red(`Error: Template "${templateName}" not found`));
      await showAvailableTemplates(packageRoot);
      return;
    }
    let destDir;
    if (foundType === "pipe") {
      destDir = path.join(cwd, "src/pipes", templateName);
    } else {
      if (templateName === "hono") {
        destDir = path.join(cwd, "src/api");
      } else {
        destDir = path.join(cwd, "src/modules", templateName);
      }
    }
    await fs.copy(templateDir, destDir);
    console.log(chalk.green(`\u2713 Added ${foundType} "${templateName}"`));
    console.log(chalk.gray(`  ${destDir}`));
    await updateDependencies(templateName, foundType, cwd);
    showUsageInstructions(templateName, foundType);
  } catch (error) {
    console.log(chalk.red("Error adding template:"), error);
  }
}
async function showAvailableTemplates(packageRoot) {
  const templatesRoot = path.join(packageRoot, "templates");
  try {
    const registryPath = path.join(templatesRoot, "registry.json");
    if (fs.existsSync(registryPath)) {
      const registry = await fs.readJson(registryPath);
      console.log(chalk.gray("Available templates:"));
      console.log("");
      if (registry.pipes && Object.keys(registry.pipes).length > 0) {
        console.log(chalk.blue("Pipes:"));
        for (const [name, info] of Object.entries(registry.pipes)) {
          console.log(chalk.green(`  ${name}`) + chalk.gray(` - ${info.description}`));
        }
        console.log("");
      }
      if (registry.modules && Object.keys(registry.modules).length > 0) {
        console.log(chalk.blue("Modules:"));
        for (const [name, info] of Object.entries(registry.modules)) {
          console.log(chalk.green(`  ${name}`) + chalk.gray(` - ${info.description}`));
        }
        console.log("");
      }
    } else {
      const pipesDir = path.join(templatesRoot, "pipes");
      const modulesDir = path.join(templatesRoot, "modules");
      if (fs.existsSync(pipesDir)) {
        const pipes = fs.readdirSync(pipesDir).filter(
          (item) => fs.statSync(path.join(pipesDir, item)).isDirectory()
        );
        if (pipes.length > 0) {
          console.log(chalk.blue("Available pipes:"));
          pipes.forEach((pipe) => console.log(chalk.green(`  ${pipe}`)));
          console.log("");
        }
      }
      if (fs.existsSync(modulesDir)) {
        const modules = fs.readdirSync(modulesDir).filter(
          (item) => fs.statSync(path.join(modulesDir, item)).isDirectory()
        );
        if (modules.length > 0) {
          console.log(chalk.blue("Available modules:"));
          modules.forEach((module) => console.log(chalk.green(`  ${module}`)));
          console.log("");
        }
      }
    }
  } catch (error) {
    console.log(chalk.gray("Could not load template registry"));
  }
  console.log(chalk.gray("Usage: cookbook-cli add <template-name>"));
  console.log(chalk.gray("       cookbook-cli list"));
}
async function updateDependencies(templateName, templateType, projectDir) {
  const packageRoot = findPackageRoot();
  const templateDir = templateType === "pipe" ? "pipes" : "modules";
  const depsPath = path.join(packageRoot, "templates", templateDir, templateName, "dependencies.json");
  if (!fs.existsSync(depsPath)) return;
  const deps = await fs.readJson(depsPath);
  const packageJsonPath = path.join(projectDir, "package.json");
  const packageJson = await fs.readJson(packageJsonPath);
  packageJson.dependencies = { ...packageJson.dependencies, ...deps.dependencies };
  if (deps.devDependencies) {
    packageJson.devDependencies = { ...packageJson.devDependencies, ...deps.devDependencies };
  }
  await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
  console.log(chalk.blue("\u2713 Updated package.json with new dependencies"));
  try {
    const { execa } = await import("execa");
    console.log(chalk.gray("Installing dependencies..."));
    const hasYarnLock = fs.existsSync(path.join(projectDir, "yarn.lock"));
    const hasPnpmLock = fs.existsSync(path.join(projectDir, "pnpm-lock.yaml"));
    let installCmd = "npm install";
    if (hasPnpmLock) installCmd = "pnpm install";
    else if (hasYarnLock) installCmd = "yarn install";
    await execa(installCmd.split(" ")[0], installCmd.split(" ").slice(1), {
      cwd: projectDir,
      stdio: "inherit"
    });
    console.log(chalk.green("\u2713 Dependencies installed successfully"));
  } catch (error) {
    console.log(chalk.yellow("\u26A0 Auto-install failed. Please run manually:"));
    console.log(chalk.gray("npm install"));
  }
}
function showUsageInstructions(templateName, templateType) {
  console.log("");
  console.log(chalk.blue("Usage:"));
  if (templateType === "pipe") {
    switch (templateName) {
      case "solana-swaps":
        console.log(chalk.gray('  import { SolanaSwapsPipe } from "./pipes/solana-swaps/index.js";'));
        console.log(chalk.gray("  const pipe = new SolanaSwapsPipe(clickhouse, config);"));
        console.log(chalk.gray("  await pipe.start();"));
        break;
      case "pumpfun-tokens":
        console.log(chalk.gray('  import { PumpfunTokensPipe } from "./pipes/pumpfun-tokens/index.js";'));
        console.log(chalk.gray("  const pipe = new PumpfunTokensPipe(clickhouse, config);"));
        console.log(chalk.gray("  await pipe.start();"));
        break;
      case "pumpfun-swaps":
        console.log(chalk.gray('  import { PumpfunSwapsPipe } from "./pipes/pumpfun-swaps/index.js";'));
        console.log(chalk.gray("  const pipe = new PumpfunSwapsPipe(clickhouse, config);"));
        console.log(chalk.gray("  await pipe.start();"));
        break;
      case "metaplex-tokens":
        console.log(chalk.gray('  import { MetaplexTokensPipe } from "./pipes/metaplex-tokens/index.js";'));
        console.log(chalk.gray("  const pipe = new MetaplexTokensPipe(clickhouse, config);"));
        console.log(chalk.gray("  await pipe.start();"));
        break;
      default:
        console.log(chalk.gray(`  import { ${templateName} } from "./pipes/${templateName}/index.js";`));
        console.log(chalk.gray(`  // Follow the pipe's documentation for usage`));
    }
  } else {
    switch (templateName) {
      case "hono":
        console.log(chalk.gray("  // Start the API server:"));
        console.log(chalk.gray("  cd src/api"));
        console.log(chalk.gray("  npm start"));
        break;
      default:
        console.log(chalk.gray(`  // Check src/modules/${templateName}/README.md for usage instructions`));
    }
  }
}

// src/commands/add.ts
var addCommand = new Command().name("add").description("Add a pipe or module to your project").argument("<template>", "template to add (e.g. pumpfun-tokens, hono)").option("-t, --type <type>", "specify template type (pipe or module)").action(async (template, options) => {
  await addTemplate(template, options.type);
});

// src/commands/init.ts
import { Command as Command2 } from "commander";
import prompts from "prompts";
import path3 from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
import chalk2 from "chalk";

// src/utils/template-processor.ts
import fs2 from "fs-extra";
import path2 from "path";
async function processTemplate(templatePath, outputPath, variables) {
  let content = await fs2.readFile(templatePath, "utf8");
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    content = content.replace(regex, value);
  }
  await fs2.writeFile(outputPath, content);
}
async function copyTemplateDirectory(templateDir, targetDir, variables) {
  await fs2.ensureDir(targetDir);
  const entries = await fs2.readdir(templateDir);
  for (const entry of entries) {
    const templatePath = path2.join(templateDir, entry);
    const stat = await fs2.stat(templatePath);
    if (stat.isDirectory()) {
      const targetSubDir = path2.join(targetDir, entry);
      await fs2.ensureDir(targetSubDir);
      await copyTemplateDirectory(templatePath, targetSubDir, variables);
    } else {
      let targetPath = path2.join(targetDir, entry);
      if (entry.endsWith(".template")) {
        targetPath = path2.join(targetDir, entry.replace(".template", ""));
      }
      if (entry.endsWith(".template") || entry.includes("{{")) {
        await processTemplate(templatePath, targetPath, variables);
      } else {
        await fs2.copy(templatePath, targetPath);
      }
    }
  }
}

// src/commands/init.ts
var __filename = fileURLToPath2(import.meta.url);
var __dirname = path3.dirname(__filename);
var initCommand = new Command2().name("init").description("Initialize a new indexer project").action(async () => {
  const response = await prompts([
    {
      type: "text",
      name: "projectName",
      message: "Project name:",
      initial: "pipes-indexer"
    }
  ]);
  if (!response.projectName) {
    console.log(chalk2.red("Project creation cancelled"));
    return;
  }
  const projectDir = path3.join(process.cwd(), response.projectName);
  const templateDir = path3.join(__dirname, "../templates/base-project");
  await copyTemplateDirectory(templateDir, projectDir, {
    projectName: response.projectName
  });
  console.log(chalk2.green(`\u2713 Created project ${response.projectName}`));
  console.log("");
  try {
    const { execa } = await import("execa");
    console.log(chalk2.gray("Installing dependencies..."));
    await execa("npm", ["install"], {
      cwd: projectDir,
      stdio: "inherit"
    });
    console.log(chalk2.green("\u2713 Dependencies installed successfully"));
  } catch (error) {
    console.log(chalk2.yellow("\u26A0 Auto-install failed. Please run manually:"));
    console.log(chalk2.gray(`  cd ${response.projectName}`));
    console.log(chalk2.gray("  npm install"));
  }
  console.log("");
  console.log(chalk2.blue("Next steps:"));
  console.log(chalk2.gray(`  cd ${response.projectName}`));
  console.log(chalk2.gray("  docker-compose up -d # Start ClickHouse"));
  console.log(chalk2.gray("  npm start"));
});

// src/commands/list.ts
import { Command as Command3 } from "commander";
import chalk3 from "chalk";
import fs3 from "fs-extra";
import path4 from "path";
import { fileURLToPath as fileURLToPath3 } from "url";
function findPackageRoot2() {
  const currentFile = fileURLToPath3(import.meta.url);
  let dir = path4.dirname(currentFile);
  while (dir !== path4.dirname(dir)) {
    const packageJsonPath = path4.join(dir, "package.json");
    if (fs3.existsSync(packageJsonPath)) {
      try {
        const pkg = fs3.readJsonSync(packageJsonPath);
        if (pkg.name === "cookbook-cli") {
          return dir;
        }
      } catch {
      }
    }
    dir = path4.dirname(dir);
  }
  return path4.join(path4.dirname(currentFile), "..");
}
var listCommand = new Command3().name("list").description("List available templates (pipes and modules)").action(async () => {
  try {
    const packageRoot = findPackageRoot2();
    const registryPath = path4.join(packageRoot, "templates", "registry.json");
    if (fs3.existsSync(registryPath)) {
      const registry = await fs3.readJson(registryPath);
      console.log(chalk3.blue("Available Templates:"));
      console.log("");
      if (registry.pipes && Object.keys(registry.pipes).length > 0) {
        console.log(chalk3.green("Pipes:"));
        for (const [name, info] of Object.entries(registry.pipes)) {
          const description = info.description || "No description";
          const tags = info.tags ? ` [${info.tags.join(", ")}]` : "";
          console.log(chalk3.yellow(`  ${name}`) + chalk3.gray(` - ${description}${tags}`));
        }
        console.log("");
      }
      if (registry.modules && Object.keys(registry.modules).length > 0) {
        console.log(chalk3.green("Modules:"));
        for (const [name, info] of Object.entries(registry.modules)) {
          const description = info.description || "No description";
          const tags = info.tags ? ` [${info.tags.join(", ")}]` : "";
          console.log(chalk3.yellow(`  ${name}`) + chalk3.gray(` - ${description}${tags}`));
        }
        console.log("");
      }
    } else {
      console.log(chalk3.red("Registry not found. Available templates:"));
      const pipesDir = path4.join(packageRoot, "templates", "pipes");
      const modulesDir = path4.join(packageRoot, "templates", "modules");
      if (fs3.existsSync(pipesDir)) {
        const pipes = fs3.readdirSync(pipesDir).filter(
          (item) => fs3.statSync(path4.join(pipesDir, item)).isDirectory()
        );
        if (pipes.length > 0) {
          console.log(chalk3.green("Pipes:"));
          pipes.forEach((pipe) => console.log(chalk3.yellow(`  ${pipe}`)));
          console.log("");
        }
      }
      if (fs3.existsSync(modulesDir)) {
        const modules = fs3.readdirSync(modulesDir).filter(
          (item) => fs3.statSync(path4.join(modulesDir, item)).isDirectory()
        );
        if (modules.length > 0) {
          console.log(chalk3.green("Modules:"));
          modules.forEach((module) => console.log(chalk3.yellow(`  ${module}`)));
          console.log("");
        }
      }
    }
    console.log(chalk3.gray("Usage:"));
    console.log(chalk3.gray("  cookbook-cli add <template-name>"));
    console.log(chalk3.gray("  cookbook-cli add <template-name> --type pipe"));
    console.log(chalk3.gray("  cookbook-cli add <template-name> --type module"));
  } catch (error) {
    console.log(chalk3.red("Error loading templates:"), error);
  }
});

// src/index.ts
var program = new Command4();
program.name("cookbook-cli").description("CLI for adding Solana data pipes to your indexer").version("0.1.6");
program.addCommand(addCommand);
program.addCommand(initCommand);
program.addCommand(listCommand);
program.parse();
