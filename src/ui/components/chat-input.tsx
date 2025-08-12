import React from "react";
import { Box, Text } from "ink";

type AppMode = 'auto-accept-off' | 'auto-accept-on' | 'plan';

interface ChatInputProps {
  input: string;
  isProcessing: boolean;
  isStreaming: boolean;
  modelName?: string;
  contextPercentageLeft?: number;
  currentMode: AppMode;
}

function getContextColor(percentage: number): string {
  if (percentage > 50) return 'green';
  if (percentage > 20) return 'yellow';
  return 'red';
}

function getModeText(mode: AppMode): string {
  switch (mode) {
    case 'auto-accept-off':
      return '⏵⏵ auto-accept edits off (shift+tab to cycle)';
    case 'auto-accept-on':
      return '⏵⏵ auto-accept edits on (shift+tab to cycle)';
    case 'plan':
      return '⏸ plan mode on (shift+tab to cycle)';
    default:
      return '⏵⏵ auto-accept edits off (shift+tab to cycle)';
  }
}

function getModeColor(mode: AppMode): 'green' | 'cyan' | 'yellow' {
  switch (mode) {
    case 'plan':
      return 'green';        // Vert clair pour plan mode
    case 'auto-accept-on':
      return 'cyan';         // Cyan pour auto-accept on
    case 'auto-accept-off':
      return 'yellow';       // Orange clair (yellow) pour auto-accept off
    default:
      return 'yellow';
  }
}

export function ChatInput({ 
  input, 
  isProcessing, 
  isStreaming,
  modelName,
  contextPercentageLeft,
  currentMode
}: ChatInputProps) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box borderStyle="round" borderColor="gray" paddingX={1}>
        <Text color="gray">❯ </Text>
        <Text>
          {input}
          {!isProcessing && !isStreaming && <Text color="white">█</Text>}
        </Text>
      </Box>
      <Box justifyContent="space-between" paddingX={2}>
        <Text color={getModeColor(currentMode)}>
          {getModeText(currentMode)}
        </Text>
        {modelName && contextPercentageLeft !== undefined && (
          <Text color="yellow">{modelName} ({contextPercentageLeft}% context left)</Text>
        )}
      </Box>
    </Box>
  );
}