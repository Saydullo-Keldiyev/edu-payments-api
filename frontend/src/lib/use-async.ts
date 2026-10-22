'use client';

import { useCallback, useEffect, useState } from 'react';

interface State<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  /** The loader whose result is stored, so one query's result is never shown for another. */
  source: (() => Promise<T>) | undefined;
}

export interface AsyncResult<T> {
  data: T | undefined;
  error: unknown;
  /** True while a request is in flight, including background reloads that keep `data` visible. */
  loading: boolean;
  reload: () => void;
}

/**
 * Runs `load` on mount and whenever it changes (memoize it with useCallback), ignoring
 * responses that arrive after a newer request started. `reload` re-runs the same query and
 * keeps the current data on screen meanwhile.
 */
export function useAsync<T>(load: () => Promise<T>): AsyncResult<T> {
  const [state, setState] = useState<State<T>>({ data: undefined, error: undefined, loading: true, source: undefined });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setState((prev) => ({ ...prev, error: undefined, loading: true }));
    load().then(
      (data) => {
        if (active) setState({ data, error: undefined, loading: false, source: load });
      },
      (error: unknown) => {
        if (active) setState({ data: undefined, error, loading: false, source: load });
      },
    );
    return () => {
      active = false;
    };
  }, [load, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  // Until the new query settles, a changed `load` exposes no data or error from the previous one.
  // A reload of the same query keeps its data visible while `loading` is true.
  const isCurrent = state.source === load;
  return {
    data: isCurrent ? state.data : undefined,
    error: isCurrent ? state.error : undefined,
    loading: state.loading || !isCurrent,
    reload,
  };
}
