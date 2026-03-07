import { useEffect, useCallback, useState } from "react";

export interface KeyboardActions {
  /** Navigate up in table */
  onArrowUp?: () => void;
  /** Navigate down in table */
  onArrowDown?: () => void;
  /** Open detail / confirm selection */
  onEnter?: () => void;
  /** Open edit mode for selected item */
  onEdit?: () => void;
  /** Focus global search */
  onSearch?: () => void;
  /** Close panel / cancel */
  onEscape?: () => void;
  /** Delete selected item */
  onDelete?: () => void;
}

/**
 * Global keyboard shortcuts hook.
 * Attaches to document and filters out events from input/textarea elements.
 */
export function useKeyboardShortcuts(actions: KeyboardActions) {
  const handler = useCallback(
    (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      // Ctrl+F — always intercept for global search
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        actions.onSearch?.();
        return;
      }

      // Don't intercept shortcuts when typing in input fields
      if (isInput) return;

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          actions.onArrowUp?.();
          break;
        case "ArrowDown":
          e.preventDefault();
          actions.onArrowDown?.();
          break;
        case "Enter":
          actions.onEnter?.();
          break;
        case "e":
        case "E":
          actions.onEdit?.();
          break;
        case "Escape":
          actions.onEscape?.();
          break;
        case "Delete":
        case "Backspace":
          // Only if not in input
          if (e.ctrlKey || e.metaKey) {
            actions.onDelete?.();
          }
          break;
      }
    },
    [actions]
  );

  useEffect(() => {
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handler]);
}

/**
 * Hook for table navigation — manages selected index within a list.
 * Returns current index and setter. Wraps around at boundaries.
 */
export function useTableNavigation(itemCount: number) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Clamp index if list shrinks
  useEffect(() => {
    if (selectedIndex >= itemCount && itemCount > 0) {
      setSelectedIndex(itemCount - 1);
    }
  }, [itemCount, selectedIndex]);

  const moveUp = useCallback(() => {
    setSelectedIndex((i) => (i > 0 ? i - 1 : i));
  }, []);

  const moveDown = useCallback(() => {
    setSelectedIndex((i) => (i < itemCount - 1 ? i + 1 : i));
  }, [itemCount]);

  return { selectedIndex, setSelectedIndex, moveUp, moveDown };
}
