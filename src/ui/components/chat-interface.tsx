import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Box, Text, useStdout, measureElement, DOMElement } from "ink";
import { MistralAgent, ChatEntry } from "../../agent/mistral-agent";
import { StreamingState } from "../../types";
import { useStateAndRef } from "../../hooks/use-state-and-ref";
import { useInputHandler } from "../../hooks/use-input-handler";
import { useSafeInput } from "../../hooks/use-safe-input";
import { LoadingSpinner } from "./loading-spinner";
import { CommandSuggestions } from "./command-suggestions";
import { ModelSelection } from "./model-selection";
import { HistoryItemDisplay } from "./history-display";
import { ChatInput } from "./chat-input";
import ConfirmationDialog from "./confirmation-dialog";
import PlanDialog from "./plan-dialog";
import { ConfirmationService, ConfirmationOptions } from "../../utils/confirmation-service";
import ApiKeyInput from "./api-key-input";
import AsciiLogo from "./ascii-logo";
import { ShowMoreLines } from "./show-more-lines";

interface ChatInterfaceProps {
  agent?: MistralAgent;
  isTTY?: boolean;
}

// Main chat component that handles input when agent is available
function ChatInterfaceWithAgent({ agent, isTTY = true }: { agent: MistralAgent; isTTY?: boolean }) {
  const { stdout } = useStdout();
  const [chatHistory, setChatHistory] = useState<ChatEntry[]>([]);
  const [pendingMessages, setPendingMessages] = useState<ChatEntry[]>([]);
  const [streamingState, streamingStateRef, setStreamingState] = useStateAndRef(StreamingState.Idle);
  // Use refs for token counts to avoid re-renders during streaming
  const tokenCountRef = useRef(0);
  const outputTokenCountRef = useRef(0);
  const contextTokenCountRef = useRef(0);
  const [displayTokenCount, setDisplayTokenCount] = useState(0);
  const [processingTime, setProcessingTime] = useState(0);
  
  // Use refs for frequently changing values to avoid re-renders
  const processingTimeRef = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const tokenUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [confirmationOptions, setConfirmationOptions] = useState<ConfirmationOptions | null>(null);
  const [planContent, setPlanContent] = useState<string | null>(null); 
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  
  // UI state management
  const [footerHeight, setFooterHeight] = useState<number>(0);
  const processingStartTime = useRef<number>(0);
  const mainControlsRef = useRef<DOMElement>(null);
  const messageIdCounter = useRef(0);

  // Terminal dimensions
  const terminalWidth = stdout?.columns || 80;
  const terminalHeight = stdout?.rows || 24;
  const mainAreaWidth = Math.floor(terminalWidth * 0.9);
  
  // Simple height calculation
  const availableHeight = useMemo(
    () => Math.max(terminalHeight - footerHeight - 3, 10),
    [terminalHeight, footerHeight]
  );

  // Generate unique ID for chat entries
  const getNextMessageId = useCallback(() => {
    messageIdCounter.current += 1;
    return Date.now() + messageIdCounter.current;
  }, []);

  // Measure footer height
  useEffect(() => {
    if (mainControlsRef.current) {
      const fullFooterMeasurement = measureElement(mainControlsRef.current);
      setFooterHeight(fullFooterMeasurement.height);
    }
  }, [terminalHeight, streamingState]);

  // Handle keyboard inputs
  useSafeInput((input, key) => {
    if (key.ctrl && input === 'o') {
      // Toggle error details view (useful for debugging)
      console.log('🔍 Debug: Terminal dimensions:', { terminalWidth, terminalHeight });
      console.log('🔍 Debug: Available height:', availableHeight);
      console.log('🔍 Debug: Footer height:', footerHeight);
      console.log('🔍 Debug: Pending messages:', pendingMessages.length);
      console.log('🔍 Debug: Chat history:', chatHistory.length);
    }
  });

  const confirmationService = ConfirmationService.getInstance();

  const handlePlanGenerated = (planContent: string) => {
    setPlanContent(planContent);
    setShowPlanDialog(true);
    setStreamingState(StreamingState.WaitingForConfirmation);
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
    originalUserMessage,
    processUserMessage,
    processImplementationFromPlan,
  } = useInputHandler({
    agent,
    chatHistory,
    setChatHistory,
    pendingMessages,
    setPendingMessages,
    setStreamingState,
    tokenCountRef,
    outputTokenCountRef,
    contextTokenCountRef,
    setDisplayTokenCount,
    processingTimeRef,
    processingStartTime,
    streamingState,
    streamingStateRef,
    getNextMessageId,
    isConfirmationActive: !!confirmationOptions,
    onPlanGenerated: handlePlanGenerated,
  });

  // Update display token count periodically for smooth animation
  useEffect(() => {
    if (streamingState !== StreamingState.Idle) {
      // Start updating display token count
      if (tokenUpdateIntervalRef.current) {
        clearInterval(tokenUpdateIntervalRef.current);
      }
      
      tokenUpdateIntervalRef.current = setInterval(() => {
        setDisplayTokenCount(outputTokenCountRef.current);
      }, 250); // Update every 250ms for smooth display
    } else {
      // Clear interval when not streaming
      if (tokenUpdateIntervalRef.current) {
        clearInterval(tokenUpdateIntervalRef.current);
        tokenUpdateIntervalRef.current = null;
      }
      setDisplayTokenCount(0);
    }
    
    return () => {
      if (tokenUpdateIntervalRef.current) {
        clearInterval(tokenUpdateIntervalRef.current);
      }
    };
  }, [streamingState]);

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

  // Processing time management with refs (no re-renders)
  useEffect(() => {
    if (streamingState === StreamingState.Idle) {
      processingTimeRef.current = 0;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    if (streamingState === StreamingState.Responding && processingStartTime.current === 0) {
      processingStartTime.current = Date.now();
      
      // Start interval to update processing time
      intervalRef.current = setInterval(() => {
        const newTime = Math.floor((Date.now() - processingStartTime.current) / 1000);
        processingTimeRef.current = newTime;
        setProcessingTime(newTime);
      }, 100);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [streamingState]);

  const handleConfirmation = (dontAskAgain?: boolean) => {
    confirmationService.confirmOperation(true, dontAskAgain);
    setConfirmationOptions(null);
  };

  const handleRejection = (feedback?: string) => {
    confirmationService.rejectOperation(feedback);
    setConfirmationOptions(null);
    
    // Reset processing states when operation is cancelled
    setStreamingState(StreamingState.Idle);
    tokenCountRef.current = 0;
    outputTokenCountRef.current = 0;
    contextTokenCountRef.current = 0;
    setProcessingTime(0);
    processingTimeRef.current = 0;
    processingStartTime.current = 0;
  };

  const handlePlanProceed = async (mode: 'auto-accept' | 'manual-approve') => {
    setShowPlanDialog(false);
    
    // Add the approved plan to chat history before implementation
    if (planContent) {
      const approvedPlanEntry: ChatEntry = {
        id: getNextMessageId(),
        type: "assistant",
        content: `User approved Mistral's plan:\n⎿ ${planContent}`,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, approvedPlanEntry]);
      
      // Stay in Idle state
      setStreamingState(StreamingState.Idle);
      
      // Small delay to let UI update
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    setPlanContent(null);
    
    // Configure confirmation service based on mode
    if (mode === 'auto-accept') {
      // Configure confirmation service to auto-accept all operations
      confirmationService.setAutoAcceptAll(true);
      setMode('auto-accept-on');
      
      // Launch implementation with auto-accept mode
      await processImplementationFromPlan('auto-accept-on');
    } else {
      // Make sure auto-accept is disabled
      confirmationService.resetSession();
      setMode('auto-accept-off');
      
      // Launch implementation with manual approval mode
      await processImplementationFromPlan('auto-accept-off');
    }
  };

  const handleKeepPlanning = () => {
    setShowPlanDialog(false);
    setPlanContent(null);
    
    // Stay in plan mode - user can refine their request
    setMode('plan');
    
    // Reset processing states so user can input new request
    setStreamingState(StreamingState.Idle);
  };

  // Combine all messages for display
  const allMessages = useMemo(() => {
    return [...chatHistory, ...pendingMessages];
  }, [chatHistory, pendingMessages]);

  // Limit messages shown if needed (keep last N messages visible)
  const visibleMessages = useMemo(() => {
    const maxMessages = Math.floor(availableHeight / 3); // Rough estimate
    if (allMessages.length > maxMessages) {
      return allMessages.slice(-maxMessages);
    }
    return allMessages;
  }, [allMessages, availableHeight]);

  return (
    <Box flexDirection="column" padding={1} width="90%">
      {/* Header - always visible */}
      <Box flexDirection="column" marginBottom={1}>
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
      </Box>

      {/* Chat history - simple scrollable list */}
      <Box flexDirection="column" marginBottom={1}>
        {visibleMessages.map((entry, index) => (
          <HistoryItemDisplay
            key={entry.id || `msg-${index}`}
            entry={entry}
            index={index}
            isPending={pendingMessages.includes(entry)}
            availableTerminalHeight={availableHeight}
            terminalWidth={mainAreaWidth}
          />
        ))}
      </Box>

      {/* Main controls area */}
      <Box flexDirection="column" ref={mainControlsRef}>
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
              isActive={streamingState !== StreamingState.Idle}
              processingTime={processingTime}
              tokenCount={displayTokenCount}
            />

            <ChatInput
              input={input}
              isProcessing={streamingState !== StreamingState.Idle}
              isStreaming={streamingState === StreamingState.Responding}
              modelName={agent.getCurrentModel()}
              contextPercentageLeft={100 - Math.round((contextTokenCountRef.current / 128000) * 100)}
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
    </Box>
  );
}

// Main component that handles API key input or chat interface
export default function ChatInterface({ agent, isTTY = true }: ChatInterfaceProps) {
  const [currentAgent, setCurrentAgent] = useState<MistralAgent | null>(agent || null);

  const handleApiKeySet = (newAgent: MistralAgent) => {
    setCurrentAgent(newAgent);
  };

  if (!currentAgent) {
    return <ApiKeyInput onApiKeySet={handleApiKeySet} />;
  }

  return <ChatInterfaceWithAgent agent={currentAgent} isTTY={isTTY} />;
}