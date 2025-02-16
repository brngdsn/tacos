import { encoding_for_model } from '@dqbd/tiktoken';

let encoder;
try {
  // Use the GPT-4 encoding (cl100k_base) which works well for modern OpenAI models.
  encoder = encoding_for_model('gpt-4');
} catch (e) {
  console.error("Failed to load tiktoken encoder; falling back to a simple whitespace split.");
  encoder = null;
}

// Count tokens in a given text using the OpenAI tokenizer.
// Falls back to a simple split if the encoder is unavailable.
export function countTokens(text) {
  if (encoder) {
    try {
      const tokens = encoder.encode(text);
      return tokens.length;
    } catch (e) {
      console.error("Error during tokenization:", e);
      return 0;
    }
  } else {
    return text.split(/\s+/).filter(Boolean).length;
  }
}