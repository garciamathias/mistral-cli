import React, { useEffect, useState, useMemo } from 'react';
import { useStdin } from 'ink';
import { MistralAgent } from '../../agent/mistral-agent';
import ChatInterface from './chat-interface';
import { NonInteractiveInterface } from './non-interactive-interface';

interface SafeChatInterfaceProps {
  agent?: MistralAgent;
}

/**
 * Wrapper component that detects TTY support and renders appropriate interface
 * - ChatInterface for interactive terminals
 * - NonInteractiveInterface for non-TTY environments
 */
export function SafeChatInterface({ agent }: SafeChatInterfaceProps) {
  const { isRawModeSupported } = useStdin();
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Memoize environment checks to prevent re-renders
  const environmentConfig = useMemo(() => {
    const shouldForceInteractive = process.env.MISTRAL_FORCE_INTERACTIVE === '1';
    const shouldForceNonInteractive = process.env.MISTRAL_NON_INTERACTIVE === '1';
    const isDebug = process.env.DEBUG === '1';
    
    return {
      shouldForceInteractive,
      shouldForceNonInteractive,
      isDebug,
      shouldUseInteractive: (isRawModeSupported || shouldForceInteractive) && !shouldForceNonInteractive
    };
  }, [isRawModeSupported]);
  
  useEffect(() => {
    // Only run once on mount
    if (isInitialized) return;
    
    const { isDebug } = environmentConfig;
    
    // Log environment info in debug mode
    if (isDebug) {
      console.error('🔍 TTY Detection:');
      console.error(`   stdin.isTTY: ${process.stdin.isTTY}`);
      console.error(`   stdout.isTTY: ${process.stdout.isTTY}`);
      console.error(`   isRawModeSupported: ${isRawModeSupported}`);
      console.error(`   CI environment: ${process.env.CI || 'not detected'}`);
      console.error(`   Force interactive: ${environmentConfig.shouldForceInteractive}`);
      console.error(`   Force non-interactive: ${environmentConfig.shouldForceNonInteractive}\n`);
    }
    
    setIsInitialized(true);
  }, [isInitialized, isRawModeSupported, environmentConfig]);
  
  // Use memoized decision to prevent re-renders
  // Always use non-interactive interface for non-TTY environments
  // unless explicitly forcing interactive with actual TTY support
  if (environmentConfig.shouldUseInteractive && isRawModeSupported) {
    return <ChatInterface agent={agent} isTTY={true} />;
  } else if (environmentConfig.shouldForceInteractive && !isRawModeSupported) {
    // Forced interactive without TTY - show warning and fallback
    return <NonInteractiveInterface agent={agent} />;
  }
  
  return <NonInteractiveInterface agent={agent} />;
}