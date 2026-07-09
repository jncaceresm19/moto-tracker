import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BIOMETRIC_ENABLED_KEY = '@biometric_enabled';
const BIOMETRIC_PROMPTED_KEY = '@biometric_prompted';

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
export async function hasBeenPrompted(): Promise<boolean> {
  try {
    const prompted = await AsyncStorage.getItem(BIOMETRIC_PROMPTED_KEY);
    return prompted === 'true';
  } catch {
    return false;
  }
}

// Mark as prompted
export async function markAsPrompted(): Promise<void> {
  await AsyncStorage.setItem(BIOMETRIC_PROMPTED_KEY, 'true');
}

// Check if user enabled biometrics
export async function isBiometricEnabled(): Promise<boolean> {
  try {
    const enabled = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
    return enabled === 'true';
  } catch {
    return false;
  }
}

// Enable biometrics
export async function enableBiometric(): Promise<void> {
  await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
}

// Disable biometrics
export async function disableBiometric(): Promise<void> {
  await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'false');
}

// Reset biometric preference (for debugging/testing)
export async function resetBiometricPreference(): Promise<void> {
  await AsyncStorage.removeItem(BIOMETRIC_ENABLED_KEY);
  // DO NOT remove BIOMETRIC_PROMPTED_KEY - user already answered the modal
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
