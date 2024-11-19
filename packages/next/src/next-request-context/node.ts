import { AsyncLocalStorage } from 'async_hooks';
import {
  NextRequestContextValue,
  NextRequestContext as NextRequestContextType,
  getOrCreateContextSingleton,
} from './common';

const INTERNAL_STORAGE = Symbol.for('internal.storage');

export type NextRequestContextNode = NextRequestContextType & {
  [INTERNAL_STORAGE]: AsyncLocalStorage<NextRequestContextValue>;
};

const NextRequestContext = getOrCreateContextSingleton<NextRequestContextNode>(
  () => {
    const storage = new AsyncLocalStorage<NextRequestContextValue>();
    const Context: NextRequestContextNode = {
      get: () => storage.getStore(),
      [INTERNAL_STORAGE]: storage,
    };
    return Context;
  }
);

export function withNextRequestContext<T>(
  value: NextRequestContextValue,
  callback: () => T
): T {
  const storage = NextRequestContext[INTERNAL_STORAGE];
  return storage.run(value, callback);
}
