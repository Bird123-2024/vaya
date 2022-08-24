export interface ProgressOptions {
  width?: number;
  complete?: string;
  incomplete?: string;
}

/**
 * Returns a raw progress bar string.
 */
export function progress(
  current: number,
  total: number,
  opts: ProgressOptions = {}
): string | null {
  const width = opts?.width ?? 20;
  const complete = opts?.complete ?? '=';
  const incomplete = opts?.incomplete ?? '_';
  const unit = total / width;
  let pos = unit === 0 ? width : Math.floor(current / unit);

  // Let the caller decide how to handle out-of-range values
  if (current > total) {
    return null;
  }

  return `${complete.repeat(pos)}${incomplete.repeat(width - pos)}`;
}
