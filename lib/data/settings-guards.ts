export function parseSettingsVersion(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid settings version. Refresh and try again.");
  }
  return parsed;
}

export function isExpectedVersionMatch(currentUpdatedAt: Date, expectedUpdatedAt: Date | null) {
  if (!expectedUpdatedAt) return true;
  return currentUpdatedAt.getTime() === expectedUpdatedAt.getTime();
}
