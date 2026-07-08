import { api } from '../api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ACTIVE_MOTO_KEY = '@active_moto';

export interface ActiveMoto {
  id: string;
  motorcycleId: string;
  activatedAt: Date;
  activationLat?: number;
  activationLon?: number;
}

// Activate a motorcycle
export async function activateMoto(
  motorcycleId: string,
  activationLat?: number,
  activationLon?: number
): Promise<ActiveMoto> {
  const result = await api<ActiveMoto>('/api/active-motos', {
    method: 'POST',
    body: { motorcycleId, activationLat, activationLon },
  });

  // Save to AsyncStorage
  const activeMoto: ActiveMoto = {
    ...result,
    activatedAt: new Date(result.activatedAt),
  };
  await AsyncStorage.setItem(ACTIVE_MOTO_KEY, JSON.stringify(activeMoto));

  return activeMoto;
}

// Deactivate current motorcycle
export async function deactivateMoto(): Promise<void> {
  await api('/api/active-motos', { method: 'DELETE' });
  await AsyncStorage.removeItem(ACTIVE_MOTO_KEY);
}

// Get user's active motorcycle (from server, fallback to AsyncStorage)
export async function getActiveMoto(): Promise<ActiveMoto | null> {
  try {
    const result = await api<ActiveMoto | null>('/api/active-motos');
    
    if (result) {
      const activeMoto: ActiveMoto = {
        ...result,
        activatedAt: new Date(result.activatedAt),
      };
      // Update AsyncStorage cache
      await AsyncStorage.setItem(ACTIVE_MOTO_KEY, JSON.stringify(activeMoto));
      return activeMoto;
    }
    
    // No active moto on server, clear local
    await AsyncStorage.removeItem(ACTIVE_MOTO_KEY);
    return null;
  } catch (error) {
    // Network error, try AsyncStorage
    console.log('[ACTIVE_MOTO] Network error, trying cache');
    const cached = await AsyncStorage.getItem(ACTIVE_MOTO_KEY);
    if (cached) {
      const activeMoto = JSON.parse(cached);
      activeMoto.activatedAt = new Date(activeMoto.activatedAt);
      return activeMoto;
    }
    return null;
  }
}

// Format time since activation
export function formatActivationTime(activatedAt: Date): string {
  const now = new Date();
  const diff = now.getTime() - activatedAt.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (minutes < 1) return 'ahora mismo';
  if (minutes < 60) return `hace ${minutes} min`;
  if (hours < 24) return `hace ${hours}h`;
  return `hace ${days}d`;
}
