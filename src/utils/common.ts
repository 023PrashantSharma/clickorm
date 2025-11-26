/**
 * Normalize a value into an array
 * Ensures hooks work with both single instance and bulk arrays
 */
export function normalizeArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}
