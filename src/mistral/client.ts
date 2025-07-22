import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat';

export type MistralMessage = ChatCompletionMessageParam;

export interface MistralTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required: string[];
    };
  };
}

export interface MistralToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface MistralResponse {
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: MistralToolCall[];
    };
    finish_reason: string;
  }>;
}

export class MistralClient {
  private client: OpenAI;
  private currentModel: string = 'devstral-medium-2507';

  constructor(apiKey: string, model?: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://api.mistral.ai/v1',
      timeout: 360000,
    });
    if (model) {
      this.currentModel = model;
    }
  }

  setModel(model: string): void {
    this.currentModel = model;
  }

  getCurrentModel(): string {
    return this.currentModel;
  }

  async chat(
    messages: MistralMessage[],
    tools?: MistralTool[],
    model?: string
  ): Promise<MistralResponse> {
    try {
      const response = await this.client.chat.completions.create({
        model: model || this.currentModel,
        messages,
        tools: tools || [],
        tool_choice: tools ? 'auto' : undefined,
        temperature: 0.7,
        max_tokens: 4000,
      });

      return response as MistralResponse;
    } catch (error: any) {
      throw new Error(`Mistral API error: ${error.message}`);
    }
  }

  async *chatStream(
    messages: MistralMessage[],
    tools?: MistralTool[],
    model?: string
  ): AsyncGenerator<any, void, unknown> {
    try {
      const stream = await this.client.chat.completions.create({
        model: model || this.currentModel,
        messages,
        tools: tools || [],
        tool_choice: tools ? 'auto' : undefined,
        temperature: 0.7,
        max_tokens: 4000,
        stream: true,
      });

      for await (const chunk of stream) {
        yield chunk;
      }
    } catch (error: any) {
      throw new Error(`Mistral API error: ${error.message}`);
    }
  }
}