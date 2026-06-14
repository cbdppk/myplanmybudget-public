export function getAppTourStorageKeys(userEmail: string | null | undefined) {
  const userKey = userEmail?.toLowerCase().trim() || "anonymous";
  return {
    userKey,
    completedKey: `mpb:tour:completed:${userKey}`,
    activeKey: `mpb:tour:active:${userKey}`,
    stepKey: `mpb:tour:step:${userKey}`,
    nudgeDismissedKey: `mpb:tour:nudge-dismissed:${userKey}`,
  };
}
