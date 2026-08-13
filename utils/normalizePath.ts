export function normalizePath(value: string): string {
  return value.replaceAll("\\", "/");
}