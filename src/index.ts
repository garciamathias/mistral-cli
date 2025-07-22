#!/usr/bin/env node

import React from "react";
import { render } from "ink";
import { program } from "commander";
import * as dotenv from "dotenv";
import { MistralAgent } from "./agent/mistral-agent";
import ChatInterface from "./ui/components/chat-interface";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// Load environment variables
dotenv.config();

// Load API keys from user settings if not in environment
function loadApiKeys(): { mistralApiKey?: string; linkupApiKey?: string } {
  // First check environment variables
  let mistralApiKey = process.env.MISTRAL_API_KEY;
  let linkupApiKey = process.env.LINKUP_API_KEY;
  
  // Try to load from user settings file if not in environment
  try {
    const homeDir = os.homedir();
    const settingsFile = path.join(homeDir, '.mistral', 'user-settings.json');
    
    if (fs.existsSync(settingsFile)) {
      const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
      
      if (!mistralApiKey && settings.apiKey) {
        mistralApiKey = settings.apiKey;
      }
      
      if (!linkupApiKey && settings.linkupApiKey) {
        linkupApiKey = settings.linkupApiKey;
        // Set in environment for WebSearchTool
        process.env.LINKUP_API_KEY = linkupApiKey;
      }
    }
  } catch (error) {
    // Ignore errors, keys will remain undefined
  }
  
  return { mistralApiKey, linkupApiKey };
}

program
  .name("mistral")
  .description(
    "A conversational AI CLI tool powered by Mistral AI's Devstral Medium with text editor capabilities"
  )
  .version("1.0.0")
  .option("-d, --directory <dir>", "set working directory", process.cwd())
  .option("-k, --api-key <key>", "Mistral API key (or set MISTRAL_API_KEY env var)")
  .action((options) => {
    if (options.directory) {
      try {
        process.chdir(options.directory);
      } catch (error: any) {
        console.error(
          `Error changing directory to ${options.directory}:`,
          error.message
        );
        process.exit(1);
      }
    }

    try {
      // Get API keys from options, environment, or user settings
      const { mistralApiKey, linkupApiKey } = loadApiKeys();
      const apiKey = options.apiKey || mistralApiKey;
      const agent = apiKey ? new MistralAgent(apiKey) : undefined;

      console.log("🤖 Starting Mistral CLI Conversational Assistant...\n");
      
      if (linkupApiKey) {
        console.log("🔍 Web search enabled with LinkUp API\n");
      }

      render(React.createElement(ChatInterface, { agent }));
    } catch (error: any) {
      console.error("❌ Error initializing Mistral CLI:", error.message);
      process.exit(1);
    }
  });

program.parse();
