import AsyncStorage from '@react-native-async-storage/async-storage';

const DISMISS_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

function getDismissKey(userId: string): string {
  return `rain_alert_dismissed_${userId}`;
}

export async function isRainAlertDismissed(userId: string): Promise<boolean> {
  const key = getDismissKey(userId);
  const dismissedAt = await AsyncStorage.getItem(key);
  if (!dismissedAt) return false;

  const elapsed = Date.now() - parseInt(dismissedAt, 10);
  return elapsed < DISMISS_COOLDOWN_MS;
}

export async function dismissRainAlert(userId: string): Promise<void> {
  const key = getDismissKey(userId);
  await AsyncStorage.setItem(key, Date.now().toString());
}

export async function shouldShowRainAlert(
  userId: string,
  currentProbability: number,
  previousProbability: number
): Promise<boolean> {
  const dismissed = await isRainAlertDismissed(userId);
  if (!dismissed) return true;

  // Re-appear if probability increased significantly (e.g., from 65% to 85%)
  if (currentProbability > previousProbability + 15) return true;

  return false;
}
