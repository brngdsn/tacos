// Format a byte size into a human‐readable string.
export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)}KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)}MB`;
}

// Format a token count: if >= 1000, use "k" notation.
export function formatTokenCount(tokens) {
  if (tokens < 1000) return `${tokens}`;
  return `${(tokens / 1000).toFixed(1)}k`;
}

// Format a cost as a dollar value with four decimals.
export function formatCost(cost) {
  return `$${cost.toFixed(4)}`;
}

// Determine whether a string's content appears to be binary.
// Here we simply check for the presence of a null character.
export function isBinaryContent(content) {
  return content.includes('\0');
}