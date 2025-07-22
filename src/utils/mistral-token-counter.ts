import mistralTokenizer from 'mistral-tokenizer-js';

export class MistralTokenCounter {
  /**
   * Count tokens in a string using Mistral tokenizer
   */
  countTokens(text: string): number {
    if (!text) return 0;
    return mistralTokenizer.encode(text).length;
  }

  /**
   * Count tokens in messages array (for chat completions)
   */
  countMessageTokens(messages: Array<{ role: string; content: string | null; [key: string]: any }>): number {
    let totalTokens = 0;
    
    for (const message of messages) {
      // Count role tokens
      if (message.role) {
        totalTokens += this.countTokens(message.role);
      }
      
      // Count content tokens
      if (message.content && typeof message.content === 'string') {
        totalTokens += this.countTokens(message.content);
      }
      
      // Add extra tokens for tool calls if present
      if (message.tool_calls) {
        totalTokens += this.countTokens(JSON.stringify(message.tool_calls));
      }
      
      // Add tokens for message structure (estimated)
      totalTokens += 4; // Mistral uses special tokens for message boundaries
    }
    
    // Add tokens for response priming
    totalTokens += 3;
    
    return totalTokens;
  }

  /**
   * Estimate tokens for streaming content
   * This is an approximation since we don't have the full response yet
   */
  estimateStreamingTokens(accumulatedContent: string): number {
    return this.countTokens(accumulatedContent);
  }

  /**
   * Clean up resources (not needed for mistral-tokenizer-js)
   */
  dispose(): void {
    // No cleanup needed
  }
}

/**
 * Create a Mistral token counter instance
 */
export function createMistralTokenCounter(): MistralTokenCounter {
  return new MistralTokenCounter();
}