// src/fileLister.js
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

// Recursively traverse a directory (expanded view).
// If a folder is ignored, it will not be expanded and its metrics remain null.
async function traverseDirectory(currentDir, topDir, ig, inputModel, outputModel, recursive, indent) {
  let rows = [];
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
    const indentStr = '  '.repeat(indent);
    
    if (entry.isDirectory()) {
      const folderName = entry.name + '/';
      displayName = isIgnored ? chalk.bold.blue.dim(folderName) : chalk.bold.blue(folderName);
      displayName = indentStr + displayName;
      
      // Always push the directory row with no metrics.
      rows.push({
        name: entry.name,
        displayName,
        size: null,
        tokens: null,
        inputCost: null,
        outputCost: null,
        isIgnored,
        isDirectory: true,
        indent,
        rowType: 'normal'
      });
      
      if (!isIgnored && recursive) {
        // Only traverse non-ignored directories.
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
        if (stat.mode & 0o111) {
          baseName = chalk.underline(baseName);
        }
      } catch(e) {}
      displayName = indentStr + (isIgnored ? chalk.gray(baseName) : baseName);
      
      let size = null;
      let tokens = null;
      let inputCost = null;
      let outputCost = null;
      
      try {
        const stat = await fs.stat(entryPath);
        size = stat.size;
        if (!isIgnored) {
          let content;
          try {
            content = await fs.readFile(entryPath, 'utf8');
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

// Recursively collapse a directory: aggregate metrics without expanding children.
// If a subdirectory is ignored, its metrics are skipped.
async function traverseDirectoryCollapse(currentDir, topDir, ig, inputModel, outputModel, indent) {
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
    if (entry.isDirectory()) {
      // Skip ignored directories.
      if (ig.ignores(relPath)) continue;
      const subResult = await traverseDirectoryCollapse(entryPath, topDir, ig, inputModel, outputModel, indent + 1);
      cumulative.size += subResult.cumulative.size;
      cumulative.tokens += subResult.cumulative.tokens;
      cumulative.inputCost += subResult.cumulative.inputCost;
      cumulative.outputCost += subResult.cumulative.outputCost;
    } else {
      const isIgnored = ig.ignores(relPath);
      let size = 0, tokens = 0, inputCost = 0, outputCost = 0;
      try {
        const stat = await fs.stat(entryPath);
        size = stat.size;
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
      } catch (e) {}
      cumulative.size += size;
      cumulative.tokens += tokens;
      cumulative.inputCost += inputCost;
      cumulative.outputCost += outputCost;
    }
  }
  return { cumulative };
}

// List files and directories in the given directory and compute metrics.
// Supports recursive expansion or recursive collapse (if options.recursiveCollapse is true).
export async function listFilesWithMetrics(dir, inputModel, outputModel, options = {}) {
  const recursiveCollapse = options.recursiveCollapse || false;
  const recursive = options.recursive || false;
  const ig = await loadIgnorePatterns(dir);
  
  if (recursiveCollapse) {
    return await listFilesWithMetricsCollapse(dir, inputModel, outputModel, ig);
  } else if (recursive) {
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

// List files with collapse: for directories, compute aggregated metrics without expanding children.
// If a directory is ignored, its metrics remain null.
async function listFilesWithMetricsCollapse(dir, inputModel, outputModel, ig) {
  let results = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (e) {
    throw new Error(`Failed to read directory: ${dir}`);
  }
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    const relativePath = entry.name; // Top-level entries.
    if (entry.isDirectory()) {
      const isIgnored = ig.ignores(relativePath);
      const folderName = entry.name + '/';
      const displayName = isIgnored ? chalk.bold.blue.dim(folderName) : chalk.bold.blue(folderName);
      if (isIgnored) {
        results.push({
          name: entry.name,
          displayName,
          size: null,
          tokens: null,
          inputCost: null,
          outputCost: null,
          isIgnored,
          isDirectory: true,
          indent: 0,
          rowType: 'collapsed'
        });
      } else {
        const collapseResult = await traverseDirectoryCollapse(entryPath, dir, ig, inputModel, outputModel, 1);
        results.push({
          name: entry.name,
          displayName,
          size: collapseResult.cumulative.size,
          tokens: collapseResult.cumulative.tokens,
          inputCost: collapseResult.cumulative.inputCost,
          outputCost: collapseResult.cumulative.outputCost,
          isIgnored,
          isDirectory: true,
          indent: 0,
          rowType: 'collapsed'
        });
      }
    } else {
      const isIgnored = ig.ignores(relativePath);
      let baseName = entry.name;
      try {
        const stat = await fs.stat(entryPath);
        if (stat.mode & 0o111) {
          baseName = chalk.underline(baseName);
        }
      } catch(e) {}
      const displayName = isIgnored ? chalk.gray(baseName) : baseName;
      let size = null, tokens = null, inputCost = null, outputCost = null;
      try {
        const stat = await fs.stat(entryPath);
        size = stat.size;
        if (!isIgnored) {
          let content;
          try {
            content = await fs.readFile(entryPath, 'utf8');
            if (content && isBinaryContent(content)) {
              content = null;
            }
          } catch(e) {
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
        name: entry.name,
        displayName,
        size,
        tokens,
        inputCost,
        outputCost,
        isIgnored,
        isDirectory: false,
        indent: 0,
        rowType: 'normal'
      });
    }
  }
  return results;
}

