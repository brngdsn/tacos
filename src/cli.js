import process from 'node:process';
import { listFilesWithMetrics } from './fileLister.js';
import { getCostTable, getModelInfo } from './cost.js';
import { formatFileSize, formatTokenCount, formatCost, padAnsi } from './utils.js';
import chalk from 'chalk';

// Default model names – if not provided, use these.
// Per our design, the default input model is "o3-mini"
// and the default output model is "3-small" (an alias for "gpt-4o mini").
const DEFAULT_INPUT_MODEL = 'o3-mini';
const DEFAULT_OUTPUT_MODEL = '3-small';

// Allow a few model aliases
const MODEL_ALIASES = {
  'gpt-4-turbo': 'gpt-4 turbo',
  '3-large': 'gpt-3.5 turbo',
  '3-small': 'gpt-4o mini'
};

function resolveModelName(name) {
  if (!name) return null;
  const lower = name.toLowerCase();
  return MODEL_ALIASES[lower] || lower;
}

export async function runCLI() {
  const args = process.argv.slice(2);
  
  // If the --cost-table flag is provided, display the pricing table.
  if (args.includes('--cost-table') || args.includes('-c')) {
    displayCostTable();
    return;
  }
  
  // Determine models from positional args.
  // Usage example: `tacos gpt-4-turbo 3-large`
  let inputModelArg = args[0] || DEFAULT_INPUT_MODEL;
  let outputModelArg = args[1] || DEFAULT_OUTPUT_MODEL;
  
  const inputModelName = resolveModelName(inputModelArg);
  const outputModelName = resolveModelName(outputModelArg);
  
  const inputModel = getModelInfo(inputModelName);
  const outputModel = getModelInfo(outputModelName);
  
  if (!inputModel) {
    console.error(chalk.red(`Unknown input model: ${inputModelArg}`));
    process.exit(1);
  }
  if (!outputModel) {
    console.error(chalk.red(`Unknown output model: ${outputModelArg}`));
    process.exit(1);
  }
  
  // List files in the current directory.
  const dir = process.cwd();
  const files = await listFilesWithMetrics(dir, inputModel, outputModel);
  
  // Print header
  console.log(
    chalk.bold.white(
      `${padAnsi('Size', 10)} ${padAnsi('Name', 25)} ${padAnsi('Tokens', 10)} ${padAnsi('Input Cost', 12)} ${padAnsi('Output Cost', 12)}`
    )
  );
  
  // For each file/directory, show:
  // - Human-friendly file size (white)
  // - File/folder name (colored; dimmed if ignored, blue+slash if directory,
  //   underlined if executable)
  // - Token count (yellow) or '-' if not applicable
  // - Estimated input cost (green) and output cost (green) if available.
  for (const file of files) {
    const sizeStr = file.size !== null ? padAnsi(formatFileSize(file.size), 10) : padAnsi('-', 10);
    const nameStr = padAnsi(file.displayName, 25);
    const tokensStr = file.tokens !== null ? padAnsi(formatTokenCount(file.tokens), 10) : padAnsi('-', 10);
    const inputCostStr = file.inputCost !== null ? padAnsi(formatCost(file.inputCost), 12) : padAnsi('-', 12);
    const outputCostStr = file.outputCost !== null ? padAnsi(formatCost(file.outputCost), 12) : padAnsi('-', 12);
    console.log(
      `${sizeStr} ${nameStr} ${chalk.yellow(tokensStr)} ${chalk.green(inputCostStr)} ${chalk.green(outputCostStr)}`
    );
  }
}

function displayCostTable() {
  const tableData = getCostTable();
  
  // Define headers and column widths.
  const headers = ['Model', 'Input Cost (/1M)', 'Output Cost (/1M)', 'Context Window'];
  const colWidths = [20, 20, 22, 15];
  
  const headerStr = headers
    .map((h, i) => chalk.bold.white(padAnsi(h, colWidths[i])))
    .join(' ');
  console.log(headerStr);
  
  for (const row of tableData) {
    const model = padAnsi(row.model, colWidths[0]);
    const inputCost = padAnsi((row.inputCost !== null ? `$${row.inputCost.toFixed(2)}` : 'N/A'), colWidths[1]);
    const outputCost = padAnsi((row.outputCost !== null ? `$${row.outputCost.toFixed(2)}` : 'N/A'), colWidths[2]);
    const context = row.context ? padAnsi(`${row.context.toLocaleString()} tokens`, colWidths[3]) : padAnsi('N/A', colWidths[3]);
    console.log(
      `${chalk.white(model)} ${chalk.green(inputCost)} ${chalk.green(outputCost)} ${chalk.cyan(context)}`
    );
  }
}