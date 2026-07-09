import { Platform } from 'react-native';
import { TheftAlert } from './theftAlertService';

function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('es-CL', {
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

export async function shareToWhatsApp(text: string, ownerPhone?: string, isOwner?: boolean): Promise<void> {
  try {
    const Linking = require('expo-linking');
    const encoded = encodeURIComponent(text);
    
    if (isOwner) {
      // Owner shares the alert (no phone, just share data)
      await Linking.openURL(`whatsapp://send?text=${encoded}`);
    } else if (ownerPhone) {
      // Other user sends message to owner
      const cleanPhone = ownerPhone.replace(/[\s\-\(\)]/g, '');
      const contactMessage = encodeURIComponent(`Hola, vi tu publicación de robo en Moto Tracker. ¿Puedo ayudarte?`);
      await Linking.openURL(`whatsapp://send?phone=${cleanPhone}&text=${contactMessage}`);
    } else {
      // Other user but no phone available
      await Linking.openURL(`whatsapp://send?text=${encoded}`);
    }
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
  platform: 'whatsapp' | 'instagram',
  currentUserId?: string
): Promise<void> {
  const isOwner = currentUserId === alert.userId;
  
  switch (platform) {
    case 'whatsapp':
      await shareToWhatsApp(generateShareText(alert), alert.ownerPhone, isOwner);
      break;
    case 'instagram':
      await shareToInstagram(alert);
      break;
  }
}
