import { useState, useCallback, useReducer } from 'react';

// Generic History Hook
export function useHistory<T>(initialState: T) {
  const [history, setHistory] = useState<{
    past: T[];
    present: T;
    future: T[];
  }>({
    past: [],
    present: initialState,
    future: [],
  });

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  const undo = useCallback(() => {
    setHistory((curr) => {
      if (curr.past.length === 0) return curr;

      const previous = curr.past[curr.past.length - 1];
      const newPast = curr.past.slice(0, curr.past.length - 1);

      return {
        past: newPast,
        present: previous,
        future: [curr.present, ...curr.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((curr) => {
      if (curr.future.length === 0) return curr;

      const next = curr.future[0];
      const newFuture = curr.future.slice(1);

      return {
        past: [...curr.past, curr.present],
        present: next,
        future: newFuture,
      };
    });
  }, []);

  const setState = useCallback((newState: T) => {
    setHistory((curr) => {
      if (curr.present === newState) return curr;
      return {
        past: [...curr.past, curr.present],
        present: newState,
        future: [],
      };
    });
  }, []);

  // Set state without adding to history (for initial load)
  const setInitialState = useCallback((state: T) => {
      setHistory({
          past: [],
          present: state,
          future: []
      });
  }, []);

  return {
    state: history.present,
    setState,
    setInitialState,
    undo,
    redo,
    canUndo,
    canRedo,
    history
  };
}
