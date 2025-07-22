import React, { useState } from "react";
import { Box, Text, useInput, useApp } from "ink";
import { MistralAgent } from "../../agent/mistral-agent";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

interface ApiKeyInputProps {
  onApiKeySet: (agent: MistralAgent) => void;
}

interface UserSettings {
  apiKey?: string;
  linkupApiKey?: string;
}

type InputStep = "mistral" | "linkup";

export default function ApiKeyInput({ onApiKeySet }: ApiKeyInputProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<InputStep>("mistral");
  const [mistralApiKey, setMistralApiKey] = useState("");
  const { exit } = useApp();

  useInput((inputChar, key) => {
    if (isSubmitting) return;

    if (key.ctrl && inputChar === "c") {
      exit();
      return;
    }

    if (key.return) {
      handleSubmit();
      return;
    }


    if (key.backspace || key.delete) {
      setInput((prev) => prev.slice(0, -1));
      setError("");
      return;
    }

    if (inputChar && !key.ctrl && !key.meta) {
      setInput((prev) => prev + inputChar);
      setError("");
    }
  });


  const handleSubmit = async () => {
    if (currentStep === "mistral") {
      // Handle Mistral API key
      if (!input.trim()) {
        setError("Mistral API key cannot be empty");
        return;
      }

      setIsSubmitting(true);
      try {
        const apiKey = input.trim();
        setMistralApiKey(apiKey);
        
        // Set environment variable for current process
        process.env.MISTRAL_API_KEY = apiKey;
        
        // Move to LinkUp step
        setIsSubmitting(false);
        setInput("");
        setError("");
        setCurrentStep("linkup");
      } catch (error: any) {
        setError("Invalid API key format");
        setIsSubmitting(false);
      }
    } else {
      // Handle LinkUp API key (optional)
      setIsSubmitting(true);
      try {
        const linkupApiKey = input.trim();
        
        // Set LinkUp environment variable if provided
        if (linkupApiKey) {
          process.env.LINKUP_API_KEY = linkupApiKey;
        }
        
        // Save both keys to .mistral/user-settings.json
        try {
          const homeDir = os.homedir();
          const mistralDir = path.join(homeDir, '.mistral');
          const settingsFile = path.join(mistralDir, 'user-settings.json');
          
          // Create .mistral directory if it doesn't exist
          if (!fs.existsSync(mistralDir)) {
            fs.mkdirSync(mistralDir, { mode: 0o700 });
          }
          
          // Load existing settings or create new
          let settings: UserSettings = {};
          if (fs.existsSync(settingsFile)) {
            try {
              settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
            } catch {
              settings = {};
            }
          }
          
          // Update API keys
          settings.apiKey = mistralApiKey;
          if (linkupApiKey) {
            settings.linkupApiKey = linkupApiKey;
          }
          
          // Save settings
          fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2), { mode: 0o600 });
          
          console.log(`\n✅ API keys saved to ~/.mistral/user-settings.json`);
          if (linkupApiKey) {
            console.log('🔍 Web search enabled with LinkUp API');
          } else {
            console.log('ℹ️  Web search disabled (no LinkUp API key provided)');
          }
        } catch (error) {
          console.log('\n⚠️ Could not save API keys to settings file');
          console.log('API keys set for current session only');
        }
        
        // Create agent with Mistral API key
        const agent = new MistralAgent(mistralApiKey);
        onApiKeySet(agent);
      } catch (error: any) {
        setError("Invalid API key format");
        setIsSubmitting(false);
      }
    }
  };

  const displayText = input.length > 0 ? 
    (isSubmitting ? "*".repeat(input.length) : "*".repeat(input.length) + "█") : 
    (isSubmitting ? " " : "█");

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      {currentStep === "mistral" ? (
        <>
          <Text color="yellow">🔑 Mistral API Key Required</Text>
          <Box marginBottom={1}>
            <Text color="gray">Please enter your Mistral API key to continue:</Text>
          </Box>
        </>
      ) : (
        <>
          <Text color="cyan">🔍 LinkUp API Key (Optional)</Text>
          <Box marginBottom={1}>
            <Text color="gray">Enter your LinkUp API key for web search capabilities:</Text>
            <Text color="gray" dimColor>Press Enter to skip and continue without web search</Text>
          </Box>
        </>
      )}
      
      <Box borderStyle="round" borderColor={currentStep === "mistral" ? "blue" : "cyan"} paddingX={1} marginBottom={1}>
        <Text color="gray">❯ </Text>
        <Text>{displayText}</Text>
      </Box>

      {error ? (
        <Box marginBottom={1}>
          <Text color="red">❌ {error}</Text>
        </Box>
      ) : null}

      <Box flexDirection="column" marginTop={1}>
        <Text color="gray" dimColor>• Press Enter to {currentStep === "linkup" && !input ? "skip" : "submit"}</Text>
        <Text color="gray" dimColor>• Press Ctrl+C to exit</Text>
        {currentStep === "mistral" && (
          <Text color="gray" dimColor>Note: API keys will be saved to ~/.mistral/user-settings.json</Text>
        )}
        {currentStep === "linkup" && (
          <>
            <Text color="gray" dimColor>Get your free LinkUp API key at https://linkup.so</Text>
            <Text color="gray" dimColor>Web search allows the AI to access current information from the internet</Text>
          </>
        )}
      </Box>

      {isSubmitting ? (
        <Box marginTop={1}>
          <Text color="yellow">🔄 {currentStep === "mistral" ? "Validating Mistral API key..." : "Setting up API keys..."}</Text>
        </Box>
      ) : null}
    </Box>
  );
}