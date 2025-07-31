import { MistralClient, MistralToolCall } from "../mistral/client";
import { MISTRAL_TOOLS } from "../mistral/tools";
import { TextEditorTool, BashTool, TodoTool, ConfirmationTool } from "../tools";
import { WebSearchTool } from "../tools/websearch";
import { ToolResult } from "../types";
import { EventEmitter } from "events";
import { createMistralTokenCounter, MistralTokenCounter } from "../utils/mistral-token-counter";
import { loadCustomInstructions } from "../utils/custom-instructions";
import { ContextManager } from "../utils/context-manager";

export interface ChatEntry {
  type: "user" | "assistant" | "tool_result";
  content: string;
  timestamp: Date;
  toolCalls?: MistralToolCall[];
  toolCall?: MistralToolCall;
  toolResult?: { success: boolean; output?: string; error?: string };
}

export interface StreamingChunk {
  type: "content" | "tool_calls" | "tool_result" | "done" | "token_count" | "plan";
  content?: string;
  toolCalls?: MistralToolCall[];
  toolCall?: MistralToolCall;
  toolResult?: ToolResult;
  tokenCount?: number;
  planContent?: string;
}

export class MistralAgent extends EventEmitter {
  private mistralClient: MistralClient;
  private textEditor: TextEditorTool;
  private bash: BashTool;
  private todoTool: TodoTool;
  private confirmationTool: ConfirmationTool;
  private webSearchTool: WebSearchTool;
  private chatHistory: ChatEntry[] = [];
  private tokenCounter: MistralTokenCounter;
  private contextManager: ContextManager;
  private abortController: AbortController | null = null;

  constructor(apiKey: string) {
    super();
    this.mistralClient = new MistralClient(apiKey);
    this.textEditor = new TextEditorTool();
    this.bash = new BashTool();
    this.todoTool = new TodoTool();
    this.confirmationTool = new ConfirmationTool();
    this.webSearchTool = new WebSearchTool();
    this.tokenCounter = createMistralTokenCounter();
    this.contextManager = new ContextManager(this.tokenCounter);

    // Load custom instructions
    const customInstructions = loadCustomInstructions();
    const customInstructionsSection = customInstructions
      ? `\n\nCUSTOM INSTRUCTIONS:\n${customInstructions}\n\nThe above custom instructions should be followed alongside the standard instructions below.`
      : "";

    // Initialize with system message
    this.contextManager.addMessage({
      role: "system",
      content: `You are Mistral CLI, an AI assistant powered by Devstral Medium that helps with file editing, coding tasks, and system operations.${customInstructionsSection}

You have access to these tools:
- view_file: View file contents or directory listings
- create_file: Create new files with content (ONLY use this for files that don't exist yet)
- str_replace_editor: Replace text in existing files (ALWAYS use this to edit or update existing files)
- bash: Execute bash commands (use for searching, file discovery, navigation, and system operations)
- create_todo_list: Create a visual todo list for planning and tracking tasks
- update_todo_list: Update existing todos in your todo list
- web_search: Search the web for information using a search query

IMPORTANT TOOL USAGE RULES:
- NEVER use create_file on files that already exist - this will overwrite them completely
- ALWAYS use str_replace_editor to modify existing files, even for small changes
- Before editing a file, use view_file to see its current contents
- Use create_file ONLY when creating entirely new files that don't exist

SEARCHING AND EXPLORATION:
- Use bash with commands like 'find', 'grep', 'rg' (ripgrep), 'ls', etc. for searching files and content
- Examples: 'find . -name "*.js"', 'grep -r "function" src/', 'rg "import.*react"'
- Use bash for directory navigation, file discovery, and content searching
- view_file is best for reading specific files you already know exist

When a user asks you to edit, update, modify, or change an existing file:
1. First use view_file to see the current contents
2. Then use str_replace_editor to make the specific changes
3. Never use create_file for existing files

When a user asks you to create a new file that doesn't exist:
1. Use create_file with the full content

TASK PLANNING WITH TODO LISTS:
- For complex requests with multiple steps, ALWAYS create a todo list first to plan your approach
- Use create_todo_list to break down tasks into manageable items with priorities
- Mark tasks as 'in_progress' when you start working on them (only one at a time)
- Mark tasks as 'completed' immediately when finished
- Use update_todo_list to track your progress throughout the task
- Todo lists provide visual feedback with colors: ✅ Green (completed), 🔄 Cyan (in progress), ⏳ Yellow (pending)
- Always create todos with priorities: 'high' (🔴), 'medium' (🟡), 'low' (🟢)

USER CONFIRMATION SYSTEM:
File operations (create_file, str_replace_editor) and bash commands will automatically request user confirmation before execution. The confirmation system will show users the actual content or command before they decide. Users can choose to approve individual operations or approve all operations of that type for the session.

If a user rejects an operation, the tool will return an error and you should not proceed with that specific operation.

Be helpful, direct, and efficient. Always explain what you're doing and show the results.

IMPORTANT RESPONSE GUIDELINES:
- After using tools, do NOT respond with pleasantries like "Thanks for..." or "Great!"
- Only provide necessary explanations or next steps if relevant to the task
- Keep responses concise and focused on the actual work being done
- If a tool execution completes the user's request, you can remain silent or give a brief confirmation

Current working directory: ${process.cwd()}`,
    });
  }

  async processUserMessage(message: string): Promise<ChatEntry[]> {
    // Add user message to conversation
    const userEntry: ChatEntry = {
      type: "user",
      content: message,
      timestamp: new Date(),
    };
    this.chatHistory.push(userEntry);
    this.contextManager.addMessage({ role: "user", content: message });

    const newEntries: ChatEntry[] = [userEntry];
    const maxToolRounds = 10; // Prevent infinite loops
    let toolRounds = 0;

    try {
      let currentResponse = await this.mistralClient.chat(
        this.contextManager.getOptimizedMessages(),
        MISTRAL_TOOLS
      );

      // Agent loop - continue until no more tool calls or max rounds reached
      while (toolRounds < maxToolRounds) {
        const assistantMessage = currentResponse.choices[0]?.message;

        if (!assistantMessage) {
          throw new Error("No response from Mistral");
        }

        // Handle tool calls
        if (
          assistantMessage.tool_calls &&
          assistantMessage.tool_calls.length > 0
        ) {
          toolRounds++;

          // Add assistant message with tool calls
          const assistantEntry: ChatEntry = {
            type: "assistant",
            content: assistantMessage.content || "Using tools to help you...",
            timestamp: new Date(),
            toolCalls: assistantMessage.tool_calls,
          };
          this.chatHistory.push(assistantEntry);
          newEntries.push(assistantEntry);

          // Add assistant message to conversation
          this.contextManager.addMessage({
            role: "assistant",
            content: assistantMessage.content || "",
            tool_calls: assistantMessage.tool_calls,
          } as any);

          // Execute tool calls
          for (const toolCall of assistantMessage.tool_calls) {
            const result = await this.executeTool(toolCall);

            const toolResultEntry: ChatEntry = {
              type: "tool_result",
              content: result.success
                ? result.output || "Success"
                : result.error || "Error occurred",
              timestamp: new Date(),
              toolCall: toolCall,
              toolResult: result,
            };
            this.chatHistory.push(toolResultEntry);
            newEntries.push(toolResultEntry);

            // Add tool result to messages with proper format (needed for AI context)
            this.contextManager.addMessage({
              role: "tool",
              content: result.success
                ? result.output || "Success"
                : result.error || "Error",
              tool_call_id: toolCall.id,
            });
          }

          // Get next response - this might contain more tool calls
          currentResponse = await this.mistralClient.chat(
            this.contextManager.getOptimizedMessages(),
            MISTRAL_TOOLS
          );
        } else {
          // No more tool calls, add final response
          const finalEntry: ChatEntry = {
            type: "assistant",
            content:
              assistantMessage.content ||
              "I understand, but I don't have a specific response.",
            timestamp: new Date(),
          };
          this.chatHistory.push(finalEntry);
          this.contextManager.addMessage({
            role: "assistant",
            content: assistantMessage.content || "",
          });
          newEntries.push(finalEntry);
          break; // Exit the loop
        }
      }

      if (toolRounds >= maxToolRounds) {
        const warningEntry: ChatEntry = {
          type: "assistant",
          content:
            "Maximum tool execution rounds reached. Stopping to prevent infinite loops.",
          timestamp: new Date(),
        };
        this.chatHistory.push(warningEntry);
        newEntries.push(warningEntry);
      }

      return newEntries;
    } catch (error: any) {
      const errorEntry: ChatEntry = {
        type: "assistant",
        content: `Sorry, I encountered an error: ${error.message}`,
        timestamp: new Date(),
      };
      this.chatHistory.push(errorEntry);
      return [userEntry, errorEntry];
    }
  }


  async *processUserMessageStream(
    message: string,
    currentMode?: 'auto-accept-off' | 'auto-accept-on' | 'plan'
  ): AsyncGenerator<StreamingChunk, void, unknown> {
    // Create new abort controller for this request
    this.abortController = new AbortController();
    
    // Add user message to conversation
    const userEntry: ChatEntry = {
      type: "user",
      content: message,
      timestamp: new Date(),
    };
    this.chatHistory.push(userEntry);
    
    // Add mode-specific instructions if in plan mode
    let contextualMessage = message;
    if (currentMode === 'plan') {
      contextualMessage = `PLAN MODE ACTIVE - READ-ONLY ANALYSIS REQUIRED

You are in PLAN MODE. Your role is to analyze the codebase and create a detailed action plan WITHOUT executing any modifications.

RESTRICTIONS IN PLAN MODE:
- DO NOT use create_file, str_replace_editor, or any modification tools
- ONLY use view_file, bash (for read-only operations like ls, find, grep, cat), and analysis tools
- Your job is to PLAN, not to execute
- DO NOT make any changes to files or create new files

REQUIRED PROCESS:
1. First, explore the codebase using view_file and bash (ls, find, grep, etc.)
2. Understand the current state of relevant files
3. Create a structured plan with specific details

FORMAT YOUR PLAN like this:
# Plan for [task]

## Objective
[Clear description of what needs to be accomplished]

## Codebase Analysis
[What you found in the current code - current state, existing patterns, etc.]

## Files to Modify
- file1.ts: [current state and what specific changes are needed]
- file2.tsx: [current state and what specific changes are needed]

## Implementation Steps
1. [Step 1 with specific details, line numbers if applicable]
2. [Step 2 with specific details, line numbers if applicable]
3. [Continue with all necessary steps]

## Expected Outcome
[What the result should be after implementation]

IMPORTANT: Do not execute any modifications. Only analyze and plan.

User request: ${message}`;
    }
    
    this.contextManager.addMessage({ role: "user", content: contextualMessage });

    // Calculate input tokens
    const inputTokens = this.tokenCounter.countMessageTokens(
      this.contextManager.getMessages() as any
    );
    yield {
      type: "token_count",
      tokenCount: inputTokens,
    };

    const maxToolRounds = 30; // Prevent infinite loops
    let toolRounds = 0;

    try {
      // Agent loop - continue until no more tool calls or max rounds reached
      while (toolRounds < maxToolRounds) {
        // Check if operation was cancelled
        if (this.abortController?.signal.aborted) {
          yield {
            type: "content",
            content: "\n\n[Operation cancelled by user]",
          };
          yield { type: "done" };
          return;
        }

        // Use direct chat API instead of streaming
        const response = await this.mistralClient.chat(
          this.contextManager.getOptimizedMessages(), 
          MISTRAL_TOOLS
        );

        const assistantMessage = response.choices[0]?.message;

        if (!assistantMessage) {
          throw new Error("No response from Mistral");
        }

        // Calculate total tokens after response
        const outputTokens = this.tokenCounter.countMessageTokens([assistantMessage] as any);
        yield {
          type: "token_count",
          tokenCount: inputTokens + outputTokens,
        };

        // Handle tool calls
        if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
          toolRounds++;

          // Yield tool calls immediately
          yield {
            type: "tool_calls",
            toolCalls: assistantMessage.tool_calls,
          };

          // Add assistant entry to history
          const assistantEntry: ChatEntry = {
            type: "assistant",
            content: assistantMessage.content || "Using tools to help you...",
            timestamp: new Date(),
            toolCalls: assistantMessage.tool_calls,
          };
          this.chatHistory.push(assistantEntry);

          // Add assistant message to conversation
          this.contextManager.addMessage({
            role: "assistant",
            content: assistantMessage.content || "",
            tool_calls: assistantMessage.tool_calls,
          } as any);

          // Execute tools
          for (const toolCall of assistantMessage.tool_calls) {
            // Check for cancellation before executing each tool
            if (this.abortController?.signal.aborted) {
              yield {
                type: "content",
                content: "\n\n[Operation cancelled by user]",
              };
              yield { type: "done" };
              return;
            }

            const result = await this.executeTool(toolCall);

            const toolResultEntry: ChatEntry = {
              type: "tool_result",
              content: result.success
                ? result.output || "Success"
                : result.error || "Error occurred",
              timestamp: new Date(),
              toolCall: toolCall,
              toolResult: result,
            };
            this.chatHistory.push(toolResultEntry);

            yield {
              type: "tool_result",
              toolCall,
              toolResult: result,
            };

            // Add tool result with proper format (needed for AI context)
            this.contextManager.addMessage({
              role: "tool",
              content: result.success
                ? result.output || "Success"
                : result.error || "Error",
              tool_call_id: toolCall.id,
            });
          }

          // Continue the loop to get the next response (which might have more tool calls)
        } else {
          // No tool calls, yield final content and we're done
          if (assistantMessage.content) {
            // Check if we're in plan mode and this looks like a plan
            if (currentMode === 'plan' && this.isPlanContent(assistantMessage.content)) {
              yield {
                type: "plan",
                planContent: assistantMessage.content,
              };
            } else {
              yield {
                type: "content",
                content: assistantMessage.content,
              };
            }
          }

          // Add final assistant entry to history
          const finalEntry: ChatEntry = {
            type: "assistant",
            content: assistantMessage.content || "I understand, but I don't have a specific response.",
            timestamp: new Date(),
          };
          this.chatHistory.push(finalEntry);
          this.contextManager.addMessage({
            role: "assistant",
            content: assistantMessage.content || "",
          });
          break; // Exit the loop
        }
      }

      if (toolRounds >= maxToolRounds) {
        yield {
          type: "content",
          content:
            "\n\nMaximum tool execution rounds reached. Stopping to prevent infinite loops.",
        };
      }

      yield { type: "done" };
    } catch (error: any) {
      // Check if this was a cancellation
      if (this.abortController?.signal.aborted) {
        yield {
          type: "content",
          content: "\n\n[Operation cancelled by user]",
        };
        yield { type: "done" };
        return;
      }

      const errorEntry: ChatEntry = {
        type: "assistant",
        content: `Sorry, I encountered an error: ${error.message}`,
        timestamp: new Date(),
      };
      this.chatHistory.push(errorEntry);
      yield {
        type: "content",
        content: errorEntry.content,
      };
      yield { type: "done" };
    } finally {
      // Clean up abort controller
      this.abortController = null;
    }
  }

  private isPlanContent(content: string): boolean {
    // Check for the specific plan format we requested
    const hasPlanTitle = /^#\s*Plan\s+for/mi.test(content);
    const hasObjectiveSection = /^##\s*Objective/mi.test(content);
    const hasAnalysisSection = /^##\s*Codebase\s*Analysis/mi.test(content);
    const hasFilesSection = /^##\s*Files\s+to\s+Modify/mi.test(content);
    const hasStepsSection = /^##\s*Implementation\s+Steps/mi.test(content);
    const hasOutcomeSection = /^##\s*Expected\s+Outcome/mi.test(content);
    
    // Must have at least the main plan structure sections
    const hasMainStructure = hasPlanTitle && hasObjectiveSection && (hasFilesSection || hasStepsSection);
    
    // Check for plan-specific keywords
    const planKeywords = [
      'plan', 'objective', 'analysis', 'modify', 'implement', 
      'steps', 'files to modify', 'expected outcome', 'codebase'
    ];
    
    const lowerContent = content.toLowerCase();
    const keywordCount = planKeywords.filter(keyword => lowerContent.includes(keyword)).length;
    
    // Check for structured list format (numbered steps, bullet points)
    const hasListStructure = /^\d+\.\s|^[-*+]\s/m.test(content);
    
    // Must have structured format AND multiple plan keywords OR explicit plan sections
    return hasMainStructure || (keywordCount >= 3 && hasListStructure);
  }

  private async executeTool(toolCall: MistralToolCall): Promise<ToolResult> {
    try {
      const args = JSON.parse(toolCall.function.arguments);

      switch (toolCall.function.name) {
        case "view_file":
          const range: [number, number] | undefined =
            args.start_line && args.end_line
              ? [args.start_line, args.end_line]
              : undefined;
          return await this.textEditor.view(args.path, range);

        case "create_file":
          return await this.textEditor.create(args.path, args.content);

        case "str_replace_editor":
          return await this.textEditor.strReplace(
            args.path,
            args.old_str,
            args.new_str
          );

        case "bash":
          return await this.bash.execute(args.command);

        case "create_todo_list":
          return await this.todoTool.createTodoList(args.todos);

        case "update_todo_list":
          return await this.todoTool.updateTodoList(args.updates);

        case "web_search":
          return await this.webSearchTool.search(args.query, args.max_results);

        default:
          return {
            success: false,
            error: `Unknown tool: ${toolCall.function.name}`,
          };
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Tool execution error: ${error.message}`,
      };
    }
  }

  getChatHistory(): ChatEntry[] {
    return [...this.chatHistory];
  }

  getCurrentDirectory(): string {
    return this.bash.getCurrentDirectory();
  }

  async executeBashCommand(command: string): Promise<ToolResult> {
    return await this.bash.execute(command);
  }

  getCurrentModel(): string {
    return this.mistralClient.getCurrentModel();
  }

  setModel(model: string): void {
    this.mistralClient.setModel(model);
    // Update token counter for new model
    this.tokenCounter.dispose();
    this.tokenCounter = createMistralTokenCounter();
  }

  abortCurrentOperation(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  getContextPercentageLeft(): number {
    return this.contextManager.getContextPercentageLeft();
  }
}