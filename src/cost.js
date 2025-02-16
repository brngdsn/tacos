// Define the pricing and context window for each supported model.
const MODELS = [
  { key: 'gpt-4-32k', inputCost: 60.00, outputCost: 120.00, context: 32000 },
  { key: 'o1', inputCost: 15.00, outputCost: 60.00, context: 200000 },
  { key: 'gpt-4', inputCost: 30.00, outputCost: 60.00, context: 8000 },
  { key: 'gpt-4 turbo', inputCost: 10.00, outputCost: 30.00, context: 128000 },
  { key: 'gpt-4o', inputCost: 2.50, outputCost: 10.00, context: 128000 },
  { key: 'o3', inputCost: 6.00, outputCost: 12.00, context: 200000 },
  { key: 'o3-mini', inputCost: 0.15, outputCost: 0.60, context: 128000 },
  { key: 'o1 mini', inputCost: 0.60, outputCost: 2.40, context: 128000 },
  { key: 'gpt-3.5 turbo', inputCost: 0.50, outputCost: 1.50, context: 16000 },
  { key: 'gpt-4o mini', inputCost: 0.15, outputCost: 0.60, context: 128000 },
  { key: 'text-embedding-3-small', inputCost: 0.02, outputCost: null, context: null },
  { key: 'text-embedding-3-large', inputCost: 0.13, outputCost: null, context: null },
  { key: 'ada v2', inputCost: 0.10, outputCost: null, context: null }
];

// Retrieve model information by name (case-insensitive).
export function getModelInfo(modelName) {
  const lowerName = modelName.toLowerCase();
  return MODELS.find(model => model.key.toLowerCase() === lowerName) || null;
}

// Estimate cost based on token count and the given cost rate (per 1M tokens).
export function estimateCost(tokenCount, costPerMillion) {
  return (tokenCount / 1_000_000) * costPerMillion;
}

// Return the entire cost table as an array of objects.
export function getCostTable() {
  return MODELS.map(model => ({
    model: model.key,
    inputCost: model.inputCost,
    outputCost: model.outputCost,
    context: model.context
  }));
}