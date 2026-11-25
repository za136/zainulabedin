import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@factory/sdk';
import { useTranslations } from 'use-intl';

/** Minimal data-fetching hook: { data, error, loading, reload }. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data: T | null; error: Error | null; loading: boolean }>({ data: null, error: null, loading: true });
  const seq = useRef(0);
  const run = useCallback(() => {
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn().then(
      (data) => id === seq.current && setState({ data, error: null, loading: false }),
      (error: Error) => id === seq.current && setState({ data: null, error, loading: false }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    run();
  }, [run]);
  return { ...state, reload: run, setData: (data: T) => setState({ data, error: null, loading: false }) };
}

/** Translate an API error code with the shared catalogue (errors.*). */
export function useErrorText() {
  const t = useTranslations();
  return (e: unknown) => {
    const code = e instanceof ApiError ? e.code : 'network_error';
    return t.has(`errors.${code}`) ? t(`errors.${code}`) : e instanceof ApiError ? e.message : t('errors.network_error');
  };
}
