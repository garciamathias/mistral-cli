import React, { useState, useEffect, useRef } from "react";
import { Box, Text } from "ink";
import { MistralAgent, ChatEntry } from "../../agent/mistral-agent";
import { useInputHandler } from "../../hooks/use-input-handler";
import { LoadingSpinner } from "./loading-spinner";
import { CommandSuggestions } from "./command-suggestions";
import { ModelSelection } from "./model-selection";
import { ChatHistory } from "./chat-history";
import { ChatInput } from "./chat-input";
import ConfirmationDialog from "./confirmation-dialog";
import PlanDialog from "./plan-dialog";
import { ConfirmationService, ConfirmationOptions } from "../../utils/confirmation-service";
import ApiKeyInput from "./api-key-input";
import AsciiLogo from "./ascii-logo";

interface ChatInterfaceProps {
  agent?: MistralAgent;
}

// Main chat component that handles input when agent is available
function ChatInterfaceWithAgent({ agent }: { agent: MistralAgent }) {
  const [chatHistory, setChatHistory] = useState<ChatEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingTime, setProcessingTime] = useState(0);
  const [tokenCount, setTokenCount] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [confirmationOptions, setConfirmationOptions] = useState<ConfirmationOptions | null>(null);
  const [planContent, setPlanContent] = useState<string | null>(null); 
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const scrollRef = useRef<any>();
  const processingStartTime = useRef<number>(0);
  
  const confirmationService = ConfirmationService.getInstance();

  const handlePlanGenerated = (planContent: string) => {
    setPlanContent(planContent);
    setShowPlanDialog(true);
    setIsProcessing(false);
    setIsStreaming(false);
  };

  const {
    input,
    showCommandSuggestions,
    selectedCommandIndex,
    showModelSelection,
    selectedModelIndex,
    commandSuggestions,
    availableModels,
    currentMode,
    setMode,
    lastUserMessage,
    processUserMessage,
  } = useInputHandler({
    agent,
    chatHistory,
    setChatHistory,
    setIsProcessing,
    setIsStreaming,
    setTokenCount,
    setProcessingTime,
    processingStartTime,
    isProcessing,
    isStreaming,
    isConfirmationActive: !!confirmationOptions,
    onPlanGenerated: handlePlanGenerated,
  });

  useEffect(() => {
    setChatHistory([]);
  }, []);

  useEffect(() => {
    const handleConfirmationRequest = (options: ConfirmationOptions) => {
      setConfirmationOptions(options);
    };

    confirmationService.on('confirmation-requested', handleConfirmationRequest);

    return () => {
      confirmationService.off('confirmation-requested', handleConfirmationRequest);
    };
  }, [confirmationService]);

  useEffect(() => {
    if (!isProcessing && !isStreaming) {
      setProcessingTime(0);
      return;
    }

    if (processingStartTime.current === 0) {
      processingStartTime.current = Date.now();
    }

    const interval = setInterval(() => {
      setProcessingTime(
        Math.floor((Date.now() - processingStartTime.current) / 1000)
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [isProcessing, isStreaming]);

  const handleConfirmation = (dontAskAgain?: boolean) => {
    confirmationService.confirmOperation(true, dontAskAgain);
    setConfirmationOptions(null);
  };

  const handleRejection = (feedback?: string) => {
    confirmationService.rejectOperation(feedback);
    setConfirmationOptions(null);
    
    // Reset processing states when operation is cancelled
    setIsProcessing(false);
    setIsStreaming(false);
    setTokenCount(0);
    setProcessingTime(0);
    processingStartTime.current = 0;
  };

  const handlePlanProceed = async (mode: 'auto-accept' | 'manual-approve') => {
    setShowPlanDialog(false);
    setPlanContent(null);
    
    // Switch to the selected mode
    if (mode === 'auto-accept') {
      setMode('auto-accept-on');
      // Configure confirmation service to auto-accept all operations
      confirmationService.setAutoAcceptAll(true);
    } else {
      setMode('auto-accept-off');
      // Make sure auto-accept is disabled
      confirmationService.resetSession();
    }
    
    // Re-execute the plan by processing the last user message with the new mode
    if (lastUserMessage) {
      await processUserMessage(lastUserMessage);
    }
  };

  const handleKeepPlanning = () => {
    setShowPlanDialog(false);
    setPlanContent(null);
    
    // Stay in plan mode - user can refine their request
    setMode('plan');
    
    // Reset processing states so user can input new request
    setIsProcessing(false);
    setIsStreaming(false);
  };

  return (
    <Box flexDirection="column" padding={1}>
      <AsciiLogo />
      
      <Box flexDirection="column" marginBottom={1}>
        <Text dimColor>Tips for getting started:</Text>
        <Text dimColor>1. Ask questions, edit files, or run commands.</Text>
        <Text dimColor>2. Be specific for the best results.</Text>
        <Text dimColor>3. Create MISTRAL.md files to customize your interactions with Mistral.</Text>
        <Text dimColor>4. /help for more information.</Text>
        <Text> </Text>
        <Text dimColor>
          Type your request in natural language. Type 'exit' or Ctrl+C to quit.
        </Text>
      </Box>

      <Box flexDirection="column" ref={scrollRef}>
        <ChatHistory entries={chatHistory} />
      </Box>

      {/* Show confirmation dialog if one is pending */}
      {confirmationOptions && (
        <ConfirmationDialog
          operation={confirmationOptions.operation}
          filename={confirmationOptions.filename}
          showVSCodeOpen={confirmationOptions.showVSCodeOpen}
          content={confirmationOptions.content}
          onConfirm={handleConfirmation}
          onReject={handleRejection}
        />
      )}

      {/* Show plan dialog if a plan was generated */}
      {showPlanDialog && planContent && (
        <PlanDialog
          planContent={planContent}
          onProceed={handlePlanProceed}
          onKeepPlanning={handleKeepPlanning}
        />
      )}


      {!confirmationOptions && !showPlanDialog && (
        <>
          <LoadingSpinner
            isActive={isProcessing || isStreaming}
            processingTime={processingTime}
            tokenCount={tokenCount}
          />

          <ChatInput
            input={input}
            isProcessing={isProcessing}
            isStreaming={isStreaming}
            modelName={agent.getCurrentModel()}
            contextPercentageLeft={agent.getContextPercentageLeft()}
            currentMode={currentMode}
          />

          <CommandSuggestions
            suggestions={commandSuggestions}
            input={input}
            selectedIndex={selectedCommandIndex}
            isVisible={showCommandSuggestions}
          />

          <ModelSelection
            models={availableModels}
            selectedIndex={selectedModelIndex}
            isVisible={showModelSelection}
            currentModel={agent.getCurrentModel()}
          />
        </>
      )}
    </Box>
  );
}

// Main component that handles API key input or chat interface
export default function ChatInterface({ agent }: ChatInterfaceProps) {
  const [currentAgent, setCurrentAgent] = useState<MistralAgent | null>(agent || null);

  const handleApiKeySet = (newAgent: MistralAgent) => {
    setCurrentAgent(newAgent);
  };

  if (!currentAgent) {
    return <ApiKeyInput onApiKeySet={handleApiKeySet} />;
  }

  return <ChatInterfaceWithAgent agent={currentAgent} />;
}
