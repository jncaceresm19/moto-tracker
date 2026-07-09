import { Platform } from 'react-native';
import { TheftAlert } from './theftAlertService';

function formatTime(date: Date): string {
  return date.toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function generateShareText(alert: TheftAlert): string {
  return `🚨 ALERTA DE ROBO 🚨

${alert.brand} ${alert.model}
Patente: ${alert.licensePlate}
Ultima ubicacion: ${alert.lastLocationName || 'Desconocida'}
Hora: ${formatTime(alert.createdAt)}

Si ves esta moto, contacta al dueño en Moto Tracker.`;
}

function generateShareUrl(alert: TheftAlert): string {
  return `https://mototracker.app/theft-alert/${alert.id}`;
}

export async function shareToWhatsApp(text: string): Promise<void> {
  try {
    const Linking = require('expo-linking');
    const encoded = encodeURIComponent(text);
    await Linking.openURL(`whatsapp://send?text=${encoded}`);
  } catch (e) {
    // Return error for CustomAlert handling
    throw new Error('No se pudo abrir WhatsApp');
  }
}

export async function shareToInstagram(alert: TheftAlert): Promise<void> {
  try {
    const Linking = require('expo-linking');
    const text = generateShareText(alert);
    // Instagram doesn't support direct text sharing via URL on mobile
    // Copy to clipboard and open Instagram
    const Clipboard = require('expo-clipboard');
    await Clipboard.setStringAsync(text);
    // Return success for CustomAlert handling
    throw new Error('INSTAGRAM_COPIED');
  } catch (e: any) {
    if (e.message === 'INSTAGRAM_COPIED') {
      throw e;
    }
    throw new Error('No se pudo compartir');
  }
}

export function getShareAlertData(alert: TheftAlert): { text: string; url: string } {
  return {
    text: generateShareText(alert),
    url: generateShareUrl(alert),
  };
}

export async function shareTheftAlert(alert: TheftAlert): Promise<void> {
  const text = generateShareText(alert);
  const url = generateShareUrl(alert);

  // Try native share first
  if (Platform.OS !== 'web') {
    try {
      const Sharing = require('expo-sharing');
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(url, {
          message: text,
          dialogTitle: 'Compartir alerta de robo',
        });
        return;
      }
    } catch (e) {
      // Sharing not available, try platform-specific
    }
  }

  // Return data for CustomAlert handling
  throw new Error('NATIVE_SHARE_UNAVAILABLE');
}

export async function shareToSpecificPlatform(
  alert: TheftAlert,
  platform: 'whatsapp' | 'instagram'
): Promise<void> {
  switch (platform) {
    case 'whatsapp':
      await shareToWhatsApp(generateShareText(alert));
      break;
    case 'instagram':
      await shareToInstagram(alert);
      break;
  }
}
