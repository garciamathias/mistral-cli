import { MistralMessage } from '../mistral/client';
import { MistralTokenCounter } from './mistral-token-counter';

export class ContextManager {
  private static readonly MAX_CONTEXT_TOKENS = 128000; // 128k tokens for devstral-medium
  private tokenCounter: MistralTokenCounter;
  private messages: MistralMessage[] = [];
  
  constructor(tokenCounter: MistralTokenCounter) {
    this.tokenCounter = tokenCounter;
  }
  
  addMessage(message: MistralMessage): void {
    this.messages.push(message);
  }
  
  getMessages(): MistralMessage[] {
    return [...this.messages];
  }
  
  getTotalTokens(): number {
    return this.tokenCounter.countMessageTokens(this.messages as any);
  }
  
  getContextUsage(): number {
    const totalTokens = this.getTotalTokens();
    return Math.round((totalTokens / ContextManager.MAX_CONTEXT_TOKENS) * 100);
  }
  
  getContextPercentageLeft(): number {
    return Math.max(0, 100 - this.getContextUsage());
  }
  
  isNearLimit(threshold: number = 90): boolean {
    return this.getContextUsage() >= threshold;
  }
  
  clear(): void {
    // Keep system message if present
    const systemMessage = this.messages.find(msg => msg.role === 'system');
    this.messages = systemMessage ? [systemMessage] : [];
  }
  
  // Get optimized messages for API calls
  getOptimizedMessages(): MistralMessage[] {
    // For now, return all messages
    // In the future, this can implement compression strategies
    return this.getMessages();
  }
}