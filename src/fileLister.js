import fs from 'node:fs/promises';
import path from 'node:path';
import ignore from 'ignore';
import { countTokens } from './tokenizer.js';
import { estimateCost } from './cost.js';
import { isBinaryContent } from './utils.js';
import chalk from 'chalk';

// Load ignore patterns from .gitignore (if it exists)
// and add common directories that are typically ignored.
async function loadIgnorePatterns(dir) {
  const ig = ignore();
  try {
    const gitignorePath = path.join(dir, '.gitignore');
    const content = await fs.readFile(gitignorePath, 'utf8');
    ig.add(content.split('\n').filter(Boolean));
  } catch (e) {
    // .gitignore not found; that’s OK.
  }
  ig.add(['node_modules', '.git']);
  return ig;
}

// Lists files and directories in the given directory and computes metrics.
// For files that are not ignored and are text, count tokens and estimate costs.
export async function listFilesWithMetrics(dir, inputModel, outputModel) {
  const ig = await loadIgnorePatterns(dir);
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (e) {
    throw new Error(`Failed to read directory: ${dir}`);
  }
  
  const results = [];
  for (const entry of entries) {
    const entryName = entry.name;
    const relativePath = entryName; // Top-level entries.
    const isIgnored = ig.ignores(relativePath);
    let displayName = entryName;
    
    // If a directory, append a trailing slash and color it blue.
    if (entry.isDirectory()) {
      displayName = chalk.blue(displayName + '/');
    } else {
      // For files, check if they are executable.
      try {
        const stat = await fs.stat(path.join(dir, entryName));
        if (stat.mode & 0o111) {
          displayName = chalk.underline(displayName);
        }
      } catch(e) {
        // If stat fails, continue without marking as executable.
      }
    }
    
    // If the entry is ignored, dim the text.
    if (isIgnored) {
      displayName = chalk.gray(displayName);
    }
    
    let size = null;
    let tokens = null;
    let inputCost = null;
    let outputCost = null;
    
    try {
      const stat = await fs.stat(path.join(dir, entryName));
      size = stat.size;
      if (entry.isDirectory()) {
        // Directories: no token count or cost estimation.
      } else if (!isIgnored) {
        // Read the file as UTF-8 text.
        let content;
        try {
          content = await fs.readFile(path.join(dir, entryName), 'utf8');
          // If the content looks binary, skip token counting.
          if (isBinaryContent(content)) {
            content = null;
          }
        } catch (e) {
          content = null;
        }
        if (content !== null) {
          tokens = countTokens(content);
          inputCost = estimateCost(tokens, inputModel.inputCost);
          // Only estimate output cost if the model provides an output cost.
          if (outputModel.outputCost !== null) {
            outputCost = estimateCost(tokens, outputModel.outputCost);
          }
        }
      }
    } catch(e) {
      // If any error occurs, leave the metrics as null.
    }
    
    results.push({
      name: entryName,
      displayName,
      size,
      tokens,
      inputCost,
      outputCost,
      isIgnored,
      isDirectory: entry.isDirectory()
    });
  }
  
  return results;
}