import fs from 'node:fs/promises';
import path from 'node:path';
import ignore from 'ignore';
import { countTokens } from './tokenizer.js';
import { estimateCost } from './cost.js';
import { isBinaryContent } from './utils.js';
import chalk from 'chalk';

// Load ignore patterns from .gitignore and .tacosignore (if they exist)
// and add common directories that are typically ignored.
async function loadIgnorePatterns(dir) {
  const ig = ignore();
  for (const ignoreFile of ['.gitignore', '.tacosignore']) {
    try {
      const filePath = path.join(dir, ignoreFile);
      const content = await fs.readFile(filePath, 'utf8');
      ig.add(content.split('\n').filter(Boolean));
    } catch (e) {
      // File not found or unreadable; that's OK.
    }
  }
  ig.add(['node_modules', '.git']);
  return ig;
}

// Recursively traverse a directory to list files with metrics and compute cumulative values.
async function traverseDirectory(currentDir, topDir, ig, inputModel, outputModel, recursive, indent) {
  let rows = [];
  // Initialize cumulative metrics.
  let cumulative = { size: 0, tokens: 0, inputCost: 0, outputCost: 0 };
  let entries;
  try {
    entries = await fs.readdir(currentDir, { withFileTypes: true });
  } catch (e) {
    throw new Error(`Failed to read directory: ${currentDir}`);
  }
  
  for (const entry of entries) {
    const entryPath = path.join(currentDir, entry.name);
    const relPath = path.relative(topDir, entryPath);
    const isIgnored = ig.ignores(relPath);
    let displayName;
    let size = null, tokens = null, inputCost = null, outputCost = null;
    const indentStr = '  '.repeat(indent);
    
    if (entry.isDirectory()) {
      const folderName = entry.name + '/';
      displayName = indentStr + (isIgnored ? chalk.bold.blue.dim(folderName) : chalk.bold.blue(folderName));
      try {
        const stat = await fs.stat(entryPath);
        size = stat.size;
      } catch(e) {
        // ignore stat errors
      }
      // Directory row
      rows.push({
        name: entry.name,
        displayName,
        size,
        tokens: null,
        inputCost: null,
        outputCost: null,
        isIgnored,
        isDirectory: true,
        indent,
        rowType: 'normal'
      });
      
      if (!isIgnored && recursive) {
        // Recursively traverse the directory.
        const { rows: childRows, cumulative: childCumulative } = await traverseDirectory(entryPath, topDir, ig, inputModel, outputModel, recursive, indent + 1);
        rows = rows.concat(childRows);
        // Add a cumulative row for this directory.
        const cumulativeRow = {
          name: '[Cumulative]',
          displayName: '  '.repeat(indent + 1) + '[Cumulative]',
          size: childCumulative.size,
          tokens: childCumulative.tokens,
          inputCost: childCumulative.inputCost,
          outputCost: childCumulative.outputCost,
          isIgnored: false,
          isDirectory: false,
          indent: indent + 1,
          rowType: 'cumulative'
        };
        rows.push(cumulativeRow);
        // Aggregate cumulative metrics.
        cumulative.size += childCumulative.size;
        cumulative.tokens += childCumulative.tokens;
        cumulative.inputCost += childCumulative.inputCost;
        cumulative.outputCost += childCumulative.outputCost;
      }
    } else {
      // Process file.
      let baseName = entry.name;
      try {
        const stat = await fs.stat(entryPath);
        size = stat.size;
        if (stat.mode & 0o111) {
          baseName = chalk.underline(baseName);
        }
      } catch(e) {
        // ignore stat errors
      }
      displayName = indentStr + (isIgnored ? chalk.gray(baseName) : baseName);
      
      if (!isIgnored) {
        let content;
        try {
          content = await fs.readFile(entryPath, 'utf8');
          if (content && isBinaryContent(content)) {
            content = null;
          }
        } catch (e) {
          content = null;
        }
        if (content !== null) {
          tokens = countTokens(content);
          inputCost = estimateCost(tokens, inputModel.inputCost);
          if (outputModel.outputCost !== null) {
            outputCost = estimateCost(tokens, outputModel.outputCost);
          }
        }
      }
      
      rows.push({
        name: entry.name,
        displayName,
        size,
        tokens,
        inputCost,
        outputCost,
        isIgnored,
        isDirectory: false,
        indent,
        rowType: 'normal'
      });
      
      if (!isIgnored && tokens !== null) {
        cumulative.size += size || 0;
        cumulative.tokens += tokens || 0;
        cumulative.inputCost += inputCost || 0;
        cumulative.outputCost += outputCost || 0;
      }
    }
  }
  return { rows, cumulative };
}

// Lists files and directories in the given directory and computes metrics.
// Supports recursive traversal if options.recursive is true.
export async function listFilesWithMetrics(dir, inputModel, outputModel, options = {}) {
  const recursive = options.recursive || false;
  const ig = await loadIgnorePatterns(dir);
  if (recursive) {
    const { rows } = await traverseDirectory(dir, dir, ig, inputModel, outputModel, true, 0);
    return rows;
  } else {
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
      
      if (entry.isDirectory()) {
        const folderName = entryName + '/';
        displayName = isIgnored ? chalk.bold.blue.dim(folderName) : chalk.bold.blue(folderName);
      } else {
        let baseName = entryName;
        try {
          const stat = await fs.stat(path.join(dir, entryName));
          if (stat.mode & 0o111) {
            baseName = chalk.underline(baseName);
          }
        } catch(e) {}
        displayName = isIgnored ? chalk.gray(baseName) : baseName;
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
          let content;
          try {
            content = await fs.readFile(path.join(dir, entryName), 'utf8');
            if (isBinaryContent(content)) {
              content = null;
            }
          } catch (e) {
            content = null;
          }
          if (content !== null) {
            tokens = countTokens(content);
            inputCost = estimateCost(tokens, inputModel.inputCost);
            if (outputModel.outputCost !== null) {
              outputCost = estimateCost(tokens, outputModel.outputCost);
            }
          }
        }
      } catch(e) {}
      
      results.push({
        name: entryName,
        displayName,
        size,
        tokens,
        inputCost,
        outputCost,
        isIgnored,
        isDirectory: entry.isDirectory(),
        indent: 0,
        rowType: 'normal'
      });
    }
    
    return results;
  }
}