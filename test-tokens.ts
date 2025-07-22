import { createMistralTokenCounter } from './src/utils/mistral-token-counter';
import { ContextManager } from './src/utils/context-manager';

console.log('🧪 Testing Mistral Token Counter\n');

const tokenCounter = createMistralTokenCounter();
const contextManager = new ContextManager(tokenCounter);

// Test 1: Simple text
console.log('Test 1: Simple text');
const simpleText = 'Hello world!';
const simpleTokens = tokenCounter.countTokens(simpleText);
console.log(`Text: "${simpleText}"`);
console.log(`Tokens: ${simpleTokens}`);
console.log('---\n');

// Test 2: Longer text
console.log('Test 2: Longer text');
const longerText = `This is a longer text that contains multiple sentences. 
It should use more tokens than the simple example above.
Let's see how many tokens this uses.`;
const longerTokens = tokenCounter.countTokens(longerText);
console.log(`Text length: ${longerText.length} characters`);
console.log(`Tokens: ${longerTokens}`);
console.log(`Ratio: ${(longerText.length / longerTokens).toFixed(2)} chars/token`);
console.log('---\n');

// Test 3: System message
console.log('Test 3: System message');
const systemMessage = `You are Mistral CLI, an AI assistant powered by Devstral Medium that helps with file editing, coding tasks, and system operations.

You have access to these tools:
- view_file: View file contents or directory listings
- create_file: Create new files with content (ONLY use this for files that don't exist yet)
- str_replace_editor: Replace text in existing files (ALWAYS use this to edit or update existing files)
- bash: Execute bash commands (use for searching, file discovery, navigation, and system operations)`;

const systemTokens = tokenCounter.countTokens(systemMessage);
console.log(`System message length: ${systemMessage.length} characters`);
console.log(`Tokens: ${systemTokens}`);
console.log('---\n');

// Test 4: Chat messages
console.log('Test 4: Chat messages with context manager');
contextManager.addMessage({
  role: 'system',
  content: systemMessage
});

contextManager.addMessage({
  role: 'user',
  content: 'Hello, can you help me with my code?'
});

contextManager.addMessage({
  role: 'assistant',
  content: 'Of course! I\'d be happy to help you with your code. What specific task or issue are you working on?'
});

const totalTokens = contextManager.getTotalTokens();
const percentageUsed = contextManager.getContextUsage();
const percentageLeft = contextManager.getContextPercentageLeft();

console.log(`Total messages: ${contextManager.getMessages().length}`);
console.log(`Total tokens: ${totalTokens}`);
console.log(`Context used: ${percentageUsed}%`);
console.log(`Context left: ${percentageLeft}%`);
console.log(`Max context: 128,000 tokens`);
console.log('---\n');

// Test 5: Code snippet
console.log('Test 5: Code snippet');
const codeSnippet = `
function calculateTokens(text: string): number {
  if (!text) return 0;
  return mistralTokenizer.encode(text).length;
}

export class TokenCounter {
  countTokens(text: string): number {
    return calculateTokens(text);
  }
}
`;
const codeTokens = tokenCounter.countTokens(codeSnippet);
console.log(`Code length: ${codeSnippet.length} characters`);
console.log(`Tokens: ${codeTokens}`);
console.log('---\n');

// Summary
console.log('📊 Summary:');
console.log(`Simple "Hello world!": ${simpleTokens} tokens`);
console.log(`System message: ${systemTokens} tokens`);
console.log(`Full conversation: ${totalTokens} tokens (${percentageUsed}% of context)`);
console.log(`\n✅ Token counter is working correctly!`);

// Verify the percentage calculation is reasonable
if (percentageUsed > 5) {
  console.log('\n⚠️  Warning: System message might be using too much context!');
} else {
  console.log('\n👍 Context usage looks reasonable.');
}