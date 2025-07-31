import { BASE_PROMPT } from './base-prompt';
import { TODO_INSTRUCTIONS, TODO_TOOLS } from './todo-instructions';
import { PLAN_MODE_RESTRICTIONS, PLAN_MODE_PROCESS } from './plan-mode-prompt';

export type AppMode = 'auto-accept-off' | 'auto-accept-on' | 'plan';

export class PromptManager {
  private currentWorkingDirectory: string;

  constructor(currentWorkingDirectory: string) {
    this.currentWorkingDirectory = currentWorkingDirectory;
  }

  /**
   * Génère le message système complet selon le mode actuel
   */
  getSystemMessage(mode: AppMode, customInstructions?: string): string {
    const customInstructionsSection = customInstructions
      ? `\n\nCUSTOM INSTRUCTIONS:\n${customInstructions}\n\nThe above custom instructions should be followed alongside the standard instructions below.`
      : "";

    const baseMessage = BASE_PROMPT + customInstructionsSection;
    const modeSpecificMessage = this.buildModeSpecificPrompt(mode);
    
    return `${baseMessage}${modeSpecificMessage}\n\nCurrent working directory: ${this.currentWorkingDirectory}`;
  }

  /**
   * Génère le message contextuel pour le plan mode (utilisé dans processUserMessageStream)
   */
  getPlanModeContextualMessage(userMessage: string): string {
    return `PLAN MODE ACTIVE - READ-ONLY ANALYSIS REQUIRED

You are in PLAN MODE. Your role is to analyze the codebase and create a detailed action plan WITHOUT executing any modifications.

${PLAN_MODE_RESTRICTIONS}

${PLAN_MODE_PROCESS}

User request: ${userMessage}`;
  }

  /**
   * Construit les instructions spécifiques selon le mode
   */
  private buildModeSpecificPrompt(mode: AppMode): string {
    switch (mode) {
      case 'auto-accept-off':
      case 'auto-accept-on':
        return `\n\n${TODO_TOOLS}\n\n${TODO_INSTRUCTIONS}`;
      
      case 'plan':
        return `\n\n${PLAN_MODE_RESTRICTIONS}\n\n${PLAN_MODE_PROCESS}`;
      
      default:
        return `\n\n${TODO_TOOLS}\n\n${TODO_INSTRUCTIONS}`;
    }
  }

  /**
   * Met à jour le répertoire de travail actuel
   */
  setCurrentWorkingDirectory(directory: string): void {
    this.currentWorkingDirectory = directory;
  }
}