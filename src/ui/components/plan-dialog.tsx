import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

interface PlanDialogProps {
  planContent: string;
  onProceed: (mode: 'auto-accept' | 'manual-approve') => void;
  onKeepPlanning: () => void;
}

export default function PlanDialog({
  planContent,
  onProceed,
  onKeepPlanning,
}: PlanDialogProps) {
  const [selectedOption, setSelectedOption] = useState(0);

  const options = [
    "Yes, and auto-accept edits",
    "Yes, and manually approve edits", 
    "No, keep planning",
  ];

  useInput((input, key) => {
    if (key.upArrow || (key.shift && key.tab)) {
      setSelectedOption((prev) => (prev > 0 ? prev - 1 : options.length - 1));
      return;
    }

    if (key.downArrow || key.tab) {
      setSelectedOption((prev) => (prev + 1) % options.length);
      return;
    }

    if (key.return) {
      if (selectedOption === 0) {
        onProceed('auto-accept');
      } else if (selectedOption === 1) {
        onProceed('manual-approve');
      } else if (selectedOption === 2) {
        onKeepPlanning();
      }
      return;
    }

    if (key.escape) {
      onKeepPlanning();
      return;
    }
  });

  // Split plan content into lines for better formatting
  const planLines = planContent.split('\n');

  return (
    <Box flexDirection="column" padding={1}>
      {/* Main container with double border effect */}
      <Box
        borderStyle="round"
        borderColor="cyan"
        paddingX={1}
        paddingY={1}
        flexDirection="column"
      >
        <Text color="cyan" bold>
          Ready to code?
        </Text>
        <Text> </Text>
        <Text color="white">
          Here is Mistral's plan:
        </Text>
        
        {/* Inner plan content box */}
        <Box marginTop={1} marginBottom={1}>
          <Box
            borderStyle="round"
            borderColor="gray"
            paddingX={1}
            paddingY={1}
            flexDirection="column"
            width="100%"
          >
            {planLines.map((line, index) => (
              <Text key={index} color="white">
                {line || ' '}
              </Text>
            ))}
          </Box>
        </Box>

        <Text color="white">
          Would you like to proceed?
        </Text>
        <Text> </Text>

        {/* Options list */}
        <Box flexDirection="column">
          {options.map((option, index) => (
            <Box key={index}>
              <Text
                color={selectedOption === index ? "black" : "white"}
                backgroundColor={selectedOption === index ? "cyan" : undefined}
              >
                {selectedOption === index ? "❯ " : "  "}
                {index + 1}. {option}
              </Text>
            </Box>
          ))}
        </Box>

        <Text> </Text>
      </Box>

      {/* Navigation hint */}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          ↑↓ navigate • Enter select • Esc cancel
        </Text>
      </Box>
    </Box>
  );
}