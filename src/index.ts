#!/usr/bin/env node

import React from "react";
import { render } from "ink";
import * as tty from "tty";
import { program } from "commander";
import * as dotenv from "dotenv";
import { MistralAgent } from "./agent/mistral-agent";
import { SafeChatInterface } from "./ui/components/safe-chat-interface";
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
  .action(async (options) => {
    // Enhanced TTY and CI environment detection
    const isTTY = process.stdin.isTTY && process.stdout.isTTY;
    const isCI = process.env.CI === 'true' || 
                  process.env.CONTINUOUS_INTEGRATION === 'true' ||
                  Object.keys(process.env).some(key => key.startsWith('CI_'));
    
    // Log environment information if in debug mode
    if (process.env.DEBUG) {
      console.error('🔍 Environment Detection:');
      console.error(`   TTY: ${isTTY}`);
      console.error(`   CI: ${isCI}`);
      console.error(`   Force Interactive: ${process.env.MISTRAL_FORCE_INTERACTIVE}`);
      console.error(`   Force Non-Interactive: ${process.env.MISTRAL_NON_INTERACTIVE}\n`);
    }
    
    // Warn about non-TTY mode unless explicitly configured
    if (!isTTY && !process.env.MISTRAL_FORCE_INTERACTIVE && !process.env.MISTRAL_NON_INTERACTIVE) {
      if (!process.env.SUPPRESS_TTY_WARNING) {
        console.warn("⚠️  Detected non-interactive environment (no TTY).");
        console.warn("   Set MISTRAL_FORCE_INTERACTIVE=1 to force interactive mode");
        console.warn("   Set MISTRAL_NON_INTERACTIVE=1 to use non-interactive mode");
        console.warn("   Set SUPPRESS_TTY_WARNING=1 to hide this message\n");
      }
    }
    
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
      
      if (agent) {
        await agent.initialize();
      }

      if (linkupApiKey) {
        console.log("🔍 Web search enabled with LinkUp API\n");
      }

      // Use SafeChatInterface which handles both TTY and non-TTY environments
      // Detect CI mode properly - CI mode disables ANSI escapes in Ink
      const isInCI = isCI || !isTTY || process.env.MISTRAL_NON_INTERACTIVE === '1';
      const forceInteractive = process.env.MISTRAL_FORCE_INTERACTIVE === '1';
      
      // If forcing interactive without TTY, still mark as CI to prevent ANSI codes
      const useCI = isInCI || (forceInteractive && !isTTY);
      
      render(React.createElement(SafeChatInterface, { agent }), {
        ci: useCI, // CI mode prevents ANSI escape generation
        exitOnCtrlC: true,
        clearOnExit: false,
        stdin: process.stdin,
        stdout: process.stdout,
      });
    } catch (error: any) {
      console.error("❌ Error initializing Mistral CLI:", error.message);
      process.exit(1);
    }
  });

program.parse();
