interface TruncatedOutput {
  displayText: string;
  isTruncated: boolean;
  totalLines: number;
  displayedLines: number;
}

export function truncateOutput(
  content: string,
  maxLines: number = 10
): TruncatedOutput {
  const lines = content.split('\n');
  const totalLines = lines.length;
  
  if (totalLines <= maxLines) {
    return {
      displayText: content,
      isTruncated: false,
      totalLines,
      displayedLines: totalLines
    };
  }
  
  const truncatedLines = lines.slice(0, maxLines);
  const remainingLines = totalLines - maxLines;
  
  return {
    displayText: truncatedLines.join('\n'),
    isTruncated: true,
    totalLines,
    displayedLines: maxLines
  };
}

export function formatTruncatedMessage(
  displayedLines: number,
  totalLines: number
): string {
  const hiddenLines = totalLines - displayedLines;
  return `[output truncated: showing ${displayedLines} of ${totalLines} lines, ${hiddenLines} lines hidden]`;
}