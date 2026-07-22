import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BIOMETRIC_ENABLED_PREFIX = '@biometric_enabled_';
const BIOMETRIC_PROMPTED_PREFIX = '@biometric_prompted_';

function biometricEnabledKey(userId: string): string {
  return `${BIOMETRIC_ENABLED_PREFIX}${userId}`;
}

function biometricPromptedKey(userId: string): string {
  return `${BIOMETRIC_PROMPTED_PREFIX}${userId}`;
}

// Check if device has biometric hardware
export async function hasBiometricHardware(): Promise<boolean> {
  try {
    return await LocalAuthentication.hasHardwareAsync();
  } catch {
    return false;
  }
}

// Check if user has enrolled biometrics
export async function isBiometricEnrolled(): Promise<boolean> {
  try {
    return await LocalAuthentication.isEnrolledAsync();
  } catch {
    return false;
  }
}

// Check if device supports biometrics (hardware + enrolled)
export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return compatible && enrolled;
  } catch {
    return false;
  }
}

// Check if user has been prompted for biometrics
export async function hasBeenPrompted(userId: string): Promise<boolean> {
  try {
    const prompted = await AsyncStorage.getItem(biometricPromptedKey(userId));
    return prompted === 'true';
  } catch {
    return false;
  }
}

// Mark as prompted
export async function markAsPrompted(userId: string): Promise<void> {
  await AsyncStorage.setItem(biometricPromptedKey(userId), 'true');
}

// Check if user has answered the biometric prompt (has a stored preference)
export async function hasBiometricPreference(userId: string): Promise<boolean> {
  try {
    const pref = await AsyncStorage.getItem(biometricEnabledKey(userId));
    return pref !== null; // null means never asked
  } catch {
    return false;
  }
}

// Check if user enabled biometrics
export async function isBiometricEnabled(userId: string): Promise<boolean> {
  try {
    const enabled = await AsyncStorage.getItem(biometricEnabledKey(userId));
    return enabled === 'true';
  } catch {
    return false;
  }
}

// Enable biometrics
export async function enableBiometric(userId: string): Promise<void> {
  await AsyncStorage.setItem(biometricEnabledKey(userId), 'true');
}

// Disable biometrics
export async function disableBiometric(userId: string): Promise<void> {
  await AsyncStorage.setItem(biometricEnabledKey(userId), 'false');
}

// Reset biometric preference (for debugging/testing)
export async function resetBiometricPreference(userId: string): Promise<void> {
  await AsyncStorage.removeItem(biometricEnabledKey(userId));
}

// Authenticate with biometrics
export async function authenticateWithBiometrics(): Promise<boolean> {
  try {
    console.log('[BIOMETRIC] Calling authenticateAsync...');
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Autenticar con huella digital',
      cancelLabel: 'Cancelar',
      disableDeviceFallback: false,
    });
    console.log('[BIOMETRIC] authenticateAsync result:', JSON.stringify(result));
    return result.success;
  } catch (error) {
    console.log('[BIOMETRIC] authenticateAsync error:', error);
    return false;
  }
}
