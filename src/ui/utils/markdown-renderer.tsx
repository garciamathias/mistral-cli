import React from 'react';
import { Text, Box } from 'ink';
import chalk from 'chalk';

function sanitizeMarkdown(content: string): string {
  // Remove excessive line breaks
  let sanitized = content.replace(/\n{3,}/g, '\n\n');
  
  // Clean up bold/italic markers for better terminal display
  sanitized = sanitized.replace(/\*{3,}/g, '**');
  
  // Remove excessive asterisks in general
  sanitized = sanitized.replace(/\*{4,}/g, '**');
  
  // Clean up line breaks around code blocks
  sanitized = sanitized.replace(/\n\n```/g, '\n```');
  sanitized = sanitized.replace(/```\n\n/g, '```\n');
  
  // Limit line length for terminal display
  const terminalWidth = process.stdout.columns || 80;
  const maxWidth = Math.min(terminalWidth - 8, 100); // Leave margin for UI elements
  
  // Word wrap long lines (but preserve code blocks)
  const lines = sanitized.split('\n');
  const wrappedLines = lines.map(line => {
    // Don't wrap code blocks or already short lines
    if (line.startsWith('    ') || line.startsWith('\t') || 
        line.startsWith('```') || line.length <= maxWidth) {
      return line;
    }
    
    // Simple word wrapping for regular text
    if (line.length > maxWidth) {
      const words = line.split(' ');
      let wrappedLine = '';
      let currentLength = 0;
      
      for (const word of words) {
        if (currentLength + word.length + 1 > maxWidth && wrappedLine) {
          wrappedLine += '\n' + word;
          currentLength = word.length;
        } else {
          wrappedLine += (wrappedLine ? ' ' : '') + word;
          currentLength += word.length + (wrappedLine === word ? 0 : 1);
        }
      }
      return wrappedLine;
    }
    
    return line;
  });
  
  return wrappedLines.join('\n');
}

function parseMarkdownToElements(content: string): React.ReactElement[] {
  const lines = content.split('\n');
  const elements: React.ReactElement[] = [];
  let lineIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    lineIndex++;

    // Headers
    if (line.match(/^#{1,6}\s+/)) {
      const level = line.match(/^#+/)?.[0].length || 1;
      const text = line.replace(/^#+\s*/, '');
      const color = level === 1 ? 'cyan' : level === 2 ? 'blue' : 'magenta';
      elements.push(
        <Text key={lineIndex} color={color} bold>
          {text}
        </Text>
      );
      continue;
    }

    // Code blocks
    if (line.startsWith('```')) {
      const language = line.replace('```', '');
      const codeLines: string[] = [];
      i++; // Skip opening ```
      
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      
      elements.push(
        <Box key={lineIndex} flexDirection="column" marginY={1}>
          <Text color="gray" dimColor>
            {language && `${language}:`}
          </Text>
          <Text color="white" backgroundColor="gray">
            {codeLines.join('\n')}
          </Text>
        </Box>
      );
      continue;
    }

    // Blockquotes  
    if (line.startsWith('> ')) {
      const text = line.replace(/^>\s*/, '');
      elements.push(
        <Text key={lineIndex} color="gray" italic>
          {`  ${text}`}
        </Text>
      );
      continue;
    }

    // Lists
    if (line.match(/^[-*+]\s+/)) {
      const text = line.replace(/^[-*+]\s+/, '');
      elements.push(
        <Text key={lineIndex}>
          {'  • '}{parseInlineMarkdown(text)}
        </Text>
      );
      continue;
    }

    // Empty lines
    if (line.trim() === '') {
      elements.push(<Text key={lineIndex}> </Text>);
      continue;
    }

    // Regular paragraphs
    elements.push(
      <Text key={lineIndex}>
        {parseInlineMarkdown(line)}
      </Text>
    );
  }

  return elements;
}

function parseInlineMarkdown(text: string): React.ReactNode {
  // Handle simple cases first
  if (!text.includes('**') && !text.includes('*') && !text.includes('`')) {
    return text;
  }

  const elements: React.ReactNode[] = [];
  let remaining = text;
  let keyCounter = 0;

  // Process text sequentially
  while (remaining) {
    // Find the first markdown token
    const boldMatch = remaining.match(/\*\*((?:(?!\*\*).)+)\*\*/);
    const italicMatch = remaining.match(/\*((?:(?!\*).)+)\*/);
    const codeMatch = remaining.match(/`([^`]+)`/);

    const matches = [
      { match: boldMatch, type: 'bold' as const, start: boldMatch?.index ?? Infinity },
      { match: italicMatch, type: 'italic' as const, start: italicMatch?.index ?? Infinity },
      { match: codeMatch, type: 'code' as const, start: codeMatch?.index ?? Infinity }
    ].filter(m => m.match && m.start !== Infinity)
     .sort((a, b) => a.start - b.start);

    if (matches.length === 0) {
      // No more markdown, add remaining text
      elements.push(remaining);
      break;
    }

    const first = matches[0];
    const match = first.match!;
    
    // Add text before the match
    if (first.start > 0) {
      elements.push(remaining.substring(0, first.start));
    }

    // Add the formatted element
    const content = match[1];
    switch (first.type) {
      case 'bold':
        elements.push(<Text key={keyCounter++} bold>{content}</Text>);
        break;
      case 'italic':
        elements.push(<Text key={keyCounter++} italic>{content}</Text>);
        break;
      case 'code':
        elements.push(<Text key={keyCounter++} color="yellow">{content}</Text>);
        break;
    }

    // Continue with the rest
    remaining = remaining.substring(first.start + match[0].length);
  }

  return elements.length === 1 && typeof elements[0] === 'string' 
    ? elements[0] 
    : elements;
}

export function MarkdownRenderer({ content }: { content: string }) {
  try {
    // Sanitize the content first
    const sanitizedContent = sanitizeMarkdown(content);
    
    // Parse markdown to React elements
    const elements = parseMarkdownToElements(sanitizedContent);
    
    return (
      <Box flexDirection="column">
        {elements}
      </Box>
    );
  } catch (error) {
    // Fallback to plain text if markdown rendering fails
    return <Text>{content}</Text>;
  }
}