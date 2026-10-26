export function selectPendingMigrations(available: string[], applied: string[]): string[] {
  const appliedSet = new Set(applied);

  return [...available].sort().filter((file) => !appliedSet.has(file));
}
