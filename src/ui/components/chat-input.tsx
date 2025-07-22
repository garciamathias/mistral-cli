import React from "react";
import { Box, Text } from "ink";

interface ChatInputProps {
  input: string;
  isProcessing: boolean;
  isStreaming: boolean;
  modelName?: string;
  contextPercentageLeft?: number;
}

function getContextColor(percentage: number): string {
  if (percentage > 50) return 'green';
  if (percentage > 20) return 'yellow';
  return 'red';
}

export function ChatInput({ 
  input, 
  isProcessing, 
  isStreaming,
  modelName,
  contextPercentageLeft 
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
      {modelName && contextPercentageLeft !== undefined && (
        <Box justifyContent="flex-end" paddingRight={2}>
          <Text 
            color={getContextColor(contextPercentageLeft)} 
            dimColor
          >
            {modelName} ({contextPercentageLeft}% context left)
          </Text>
        </Box>
      )}
    </Box>
  );
}