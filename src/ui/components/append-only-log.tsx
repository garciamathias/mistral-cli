import React, { useEffect, useRef } from "react";
import { Static } from "ink";

interface AppendOnlyLogProps<T> {
  entries: T[];
  renderItem: (item: T, globalIndex: number) => React.ReactElement;
  getItemKey: (item: T, globalIndex: number) => string;
  resetSignal?: number; // increment this to reset Static (e.g., after clear)
}

export function AppendOnlyLog<T>({
  entries,
  renderItem,
  getItemKey,
  resetSignal = 0,
}: AppendOnlyLogProps<T>) {
  const renderedCountRef = useRef(0);
  const staticKeyRef = useRef(0);
  const prevResetRef = useRef(resetSignal);

  // Handle external reset signal
  if (resetSignal !== prevResetRef.current) {
    prevResetRef.current = resetSignal;
    renderedCountRef.current = 0;
    staticKeyRef.current += 1;
  }

  const startIndex = renderedCountRef.current;
  const newItems = entries.slice(startIndex);

  useEffect(() => {
    // After rendering, mark all up to current length as rendered
    renderedCountRef.current = entries.length;
  }, [entries.length]);

  if (newItems.length === 0) {
    return null;
  }

  return (
    <Static key={`append-only-${staticKeyRef.current}`} items={newItems}>
      {(item, localIndex) => {
        const globalIndex = startIndex + localIndex;
        const key = getItemKey(item as T, globalIndex);
        return React.cloneElement(renderItem(item as T, globalIndex), { key });
      }}
    </Static>
  );
}



