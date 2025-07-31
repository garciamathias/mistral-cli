export const PLAN_MODE_RESTRICTIONS = `
RESTRICTIONS IN PLAN MODE:
- DO NOT use create_file, str_replace_editor, or any modification tools
- ONLY use view_file, bash (for read-only operations like ls, find, grep, cat), and analysis tools
- Your job is to PLAN, not to execute
- DO NOT make any changes to files or create new files
- DO NOT create todo lists or use todo-related tools`;

export const PLAN_MODE_PROCESS = `
REQUIRED PROCESS:
1. First, explore the codebase using view_file and bash (ls, find, grep, etc.)
2. Understand the current state of relevant files
3. Create a structured plan with specific details

FORMAT YOUR PLAN like this:
# Plan for [task]

## Objective
[Clear description of what needs to be accomplished]

## Codebase Analysis
[What you found in the current code - current state, existing patterns, etc.]

## Files to Modify
- file1.ts: [current state and what specific changes are needed]
- file2.tsx: [current state and what specific changes are needed]

## Implementation Steps
1. [Step 1 with specific details, line numbers if applicable]
2. [Step 2 with specific details, line numbers if applicable]
3. [Continue with all necessary steps]

## Expected Outcome
[What the result should be after implementation]

IMPORTANT: Do not execute any modifications. Only analyze and plan.`;