/*
WARNING: WATCH OUT IF YOU'RE MODIFYING THIS FILE!
The types here must be kept in sync (or at least backwards-compatible)
with "@next/request-context" in the Next.js codebase.

This module helps define `globalThis[Symbol.for("@next/request-context")]`
which Next.js uses to access `waitUntil`.
It is expected that the platform provides this.
*/

export type WaitUntil = (promise: Promise<any>) => void;

export type NextRequestContextValue = {
  waitUntil?: WaitUntil;
};

export type NextRequestContext = {
  get(): NextRequestContextValue | undefined;
};

const name = '@next/request-context';
const NEXT_REQUEST_CONTEXT_SYMBOL = Symbol.for(name);

/** Next.js will read this context off of `globalThis[Symbol.for("@next-request-context")]`,
 * So it's important that it's only ever created (and installed) once, regardless of any
 * bundling shenanigans
 */
export function getOrCreateContextSingleton<
  TContext extends NextRequestContext,
>(create: () => TContext): TContext {
  const _globalThis = globalThis as typeof globalThis & {
    [NEXT_REQUEST_CONTEXT_SYMBOL]?: TContext;
  };

  if (!_globalThis[NEXT_REQUEST_CONTEXT_SYMBOL]) {
    _globalThis[NEXT_REQUEST_CONTEXT_SYMBOL] = create();
  }

  return _globalThis[NEXT_REQUEST_CONTEXT_SYMBOL];
}
