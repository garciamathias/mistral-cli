import { ToolResult } from "../types";
import axios from 'axios';

export interface LinkUpSource {
  name: string;
  url: string;
  snippet: string;
}

export interface LinkUpSearchResult {
  answer: string;
  sources: LinkUpSource[];
}

export class WebSearchTool {
  private linkupApiKey?: string;
  private baseURL = 'https://api.linkup.so/v1';

  constructor(linkupApiKey?: string) {
    this.linkupApiKey = linkupApiKey || process.env.LINKUP_API_KEY;
  }

  async search(query: string, maxResults: number = 5): Promise<ToolResult> {
    try {
      // Check if LinkUp API key is available
      if (!this.linkupApiKey) {
        return {
          success: false,
          error: `LinkUp API key not found. Please set LINKUP_API_KEY environment variable or add it to your .env file.

To get a free LinkUp API key:
1. Visit https://linkup.so
2. Sign up for a free account
3. Get your API key from the dashboard
4. Set LINKUP_API_KEY=your_api_key in your environment`
        };
      }

      // Make the search request to LinkUp API
      const response = await axios.post(
        `${this.baseURL}/search`,
        {
          q: query,
          depth: "standard", // Use standard for faster results
          outputType: "sourcedAnswer",
          includeImages: false
        },
        {
          headers: {
            'Authorization': `Bearer ${this.linkupApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = response.data as LinkUpSearchResult;

      // Format the output
      let output = data.answer;
      
      if (data.sources && data.sources.length > 0) {
        output += "\n\n**Sources:**\n";
        data.sources.slice(0, maxResults).forEach((source, index) => {
          output += `\n${index + 1}. **${source.name}**\n`;
          output += `   ${source.url}\n`;
          if (source.snippet) {
            output += `   _${source.snippet}_\n`;
          }
        });
      }

      return {
        success: true,
        output
      };
    } catch (error: any) {
      // Handle specific error cases
      if (error.response?.status === 401) {
        return {
          success: false,
          error: "Invalid LinkUp API key. Please check your LINKUP_API_KEY."
        };
      }
      
      if (error.response?.status === 402) {
        return {
          success: false,
          error: "LinkUp API credits exhausted. Please add more credits to your account."
        };
      }

      return {
        success: false,
        error: `Web search failed: ${error.message}`
      };
    }
  }

  // Advanced search with more options
  async searchAdvanced(
    query: string, 
    options: {
      depth?: "standard" | "deep";
      includeImages?: boolean;
      fromDate?: string;
      toDate?: string;
      excludeDomains?: string[];
      includeDomains?: string[];
      maxResults?: number;
    } = {}
  ): Promise<ToolResult> {
    try {
      if (!this.linkupApiKey) {
        return {
          success: false,
          error: "LinkUp API key not found"
        };
      }

      const response = await axios.post(
        `${this.baseURL}/search`,
        {
          q: query,
          depth: options.depth || "standard",
          outputType: "sourcedAnswer",
          includeImages: options.includeImages || false,
          fromDate: options.fromDate,
          toDate: options.toDate,
          excludeDomains: options.excludeDomains,
          includeDomains: options.includeDomains
        },
        {
          headers: {
            'Authorization': `Bearer ${this.linkupApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = response.data as LinkUpSearchResult;
      let output = data.answer;
      
      if (data.sources && data.sources.length > 0) {
        output += "\n\n**Sources:**\n";
        data.sources.slice(0, options.maxResults || 5).forEach((source, index) => {
          output += `\n${index + 1}. **${source.name}**\n`;
          output += `   ${source.url}\n`;
          if (source.snippet) {
            output += `   _${source.snippet}_\n`;
          }
        });
      }

      return {
        success: true,
        output
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Advanced search failed: ${error.message}`
      };
    }
  }
}