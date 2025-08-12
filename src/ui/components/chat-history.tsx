import React, { useMemo, useRef } from "react";
import { Box, Text } from "ink";
import { ChatEntry } from "../../agent/mistral-agent";
import { DiffRenderer } from "./diff-renderer";
import { MarkdownRenderer } from "../utils/markdown-renderer";
import { truncateOutput, formatTruncatedMessage } from "../utils/output-truncator";
import { AppendOnlyLog } from "./append-only-log";

interface ChatHistoryProps {
  entries: ChatEntry[];
}

export function ChatHistory({ entries }: ChatHistoryProps) {
  // Reset signal when history is cleared
  const resetRef = useRef(0);
  const prevLen = useRef(entries.length);
  if (prevLen.current > 0 && entries.length === 0) {
    resetRef.current++;
  }
  prevLen.current = entries.length;
  const renderDiff = (diffContent: string, filename?: string) => {
    return (
      <DiffRenderer
        diffContent={diffContent}
        filename={filename}
        terminalWidth={80}
      />
    );
  };

  const renderFileContent = (content: string) => {
    const lines = content.split("\n");

    // Calculate minimum indentation like DiffRenderer does
    let baseIndentation = Infinity;
    for (const line of lines) {
      if (line.trim() === "") continue;
      const firstCharIndex = line.search(/\S/);
      const currentIndent = firstCharIndex === -1 ? 0 : firstCharIndex;
      baseIndentation = Math.min(baseIndentation, currentIndent);
    }
    if (!isFinite(baseIndentation)) {
      baseIndentation = 0;
    }

    // Apply truncation to the content
    const truncated = truncateOutput(content, 10);
    const truncatedLines = truncated.displayText.split("\n");

    return (
      <>
        {truncatedLines.map((line, index) => {
          const displayContent = line.substring(baseIndentation);
          return (
            <Text key={index} color="gray">
              {displayContent}
            </Text>
          );
        })}
        {truncated.isTruncated && (
          <Text color="dim" italic>
            {formatTruncatedMessage(truncated.displayedLines, truncated.totalLines)}
          </Text>
        )}
      </>
    );
  };

  const renderChatEntry = (entry: ChatEntry, index: number) => {
    switch (entry.type) {
      case "user":
        return (
          <Box key={entry.id || index} flexDirection="column" marginTop={1}>
            <Box>
              <Text color="gray">
                {">"} {entry.content}
              </Text>
            </Box>
          </Box>
        );

      case "assistant":
        return (
          <Box key={entry.id || index} flexDirection="column" marginTop={1}>
            <Box flexDirection="row" alignItems="flex-start">
              <Text color="white">⏺ </Text>
              <Box flexDirection="column" flexGrow={1}>
                {entry.toolCalls ? (
                  // If there are tool calls, just show plain text
                  <Text color="white">{entry.content.trim()}</Text>
                ) : (
                  // If no tool calls, render as markdown
                  <MarkdownRenderer content={entry.content.trim()} />
                )}
              </Box>
            </Box>
          </Box>
        );

      case "tool_result":
        const getToolActionName = (toolName: string) => {
          switch (toolName) {
            case "view_file":
              return "Read";
            case "str_replace_editor":
              return "Update";
            case "create_file":
              return "Create";
            case "bash":
              return "Bash";
            case "create_todo_list":
              return "Created Todo";
            case "update_todo_list":
              return "Updated Todo";
            default:
              return "Tool";
          }
        };

        const getToolFilePath = (toolCall: any) => {
          if (toolCall?.function?.arguments) {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              // Handle todo tools specially - they don't have file paths
              if (
                toolCall.function.name === "create_todo_list" ||
                toolCall.function.name === "update_todo_list"
              ) {
                return "";
              }
              return args.path || args.file_path || args.command || "unknown";
            } catch {
              return "unknown";
            }
          }
          return "unknown";
        };

        const toolName = entry.toolCall?.function?.name || "unknown";
        const actionName = getToolActionName(toolName);
        const filePath = getToolFilePath(entry.toolCall);


        const shouldShowDiff =
          toolName === "str_replace_editor" || toolName === "create_file";
        const shouldShowFileContent = toolName === "view_file";
        const isBashCommand = toolName === "bash";

        return (
          <Box key={entry.id || index} flexDirection="column" marginTop={1}>
            <Box>
              <Text color="magenta">⏺</Text>
              <Text color="white">
                {" "}
                {filePath ? `${actionName}(${filePath})` : actionName}
              </Text>
            </Box>
            <Box marginLeft={2} flexDirection="column">
              {shouldShowFileContent ? (
                <Box flexDirection="column">
                  <Text color="gray">⎿ File contents:</Text>
                  <Box marginLeft={2} flexDirection="column">
                    {renderFileContent(entry.content)}
                  </Box>
                </Box>
              ) : shouldShowDiff ? (
                // For diff results, show only the summary line, not the raw content
                <Text color="gray">⎿ {entry.content.split('\n')[0]}</Text>
              ) : isBashCommand ? (
                // For bash commands, truncate long outputs for display
                (() => {
                  const truncated = truncateOutput(entry.content, 10);
                  return (
                    <Box flexDirection="column">
                      <Text color="gray">⎿ {truncated.displayText}</Text>
                      {truncated.isTruncated && (
                        <Text color="dim" italic>
                          ⎿ {formatTruncatedMessage(truncated.displayedLines, truncated.totalLines)}
                        </Text>
                      )}
                    </Box>
                  );
                })()
              ) : (
                <Text color="gray">⎿ {entry.content}</Text>
              )}
            </Box>
            {shouldShowDiff && (
              <Box marginLeft={4} flexDirection="column">
                {renderDiff(entry.content, filePath)}
              </Box>
            )}
          </Box>
        );

      default:
        return null;
    }
  };

  // Append-only rendering; we still keep a safety window to bound memory
  const windowedEntries = useMemo(() => entries.slice(-500), [entries]);
  return (
    <Box flexDirection="column">
      <AppendOnlyLog
        entries={windowedEntries}
        resetSignal={resetRef.current}
        getItemKey={(e) => String((e as ChatEntry).id)}
        renderItem={(e, idx) => (
          <Box flexDirection="column">{renderChatEntry(e as ChatEntry, idx)}</Box>
        )}
      />
    </Box>
  );
}
