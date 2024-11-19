import {
  getOrCreateContextSingleton,
  NextRequestContext as NextRequestContextType,
  NextRequestContextValue,
} from './common';

const INTERNAL_VALUE = Symbol.for('internal.value');

export type NextRequestContextEdge = NextRequestContextType & {
  [INTERNAL_VALUE]: NextRequestContextValue | undefined;
};

const NextRequestContext = getOrCreateContextSingleton<NextRequestContextEdge>(
  () => {
    const Context: NextRequestContextEdge = {
      get: () => Context[INTERNAL_VALUE],
      [INTERNAL_VALUE]: undefined,
    };
    return Context;
  }
);

export function withNextRequestContext<T>(
  value: NextRequestContextValue,
  callback: () => T
): T {
  // on edge functions we don't have AsyncLocalStorage,
  // but there's no concurrency, so we can just use one global context value instead.
  NextRequestContext[INTERNAL_VALUE] = value;
  return callback();
}
