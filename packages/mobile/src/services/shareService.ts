import { Platform, Alert } from 'react-native';
import { TheftAlert } from './theftAlertService';

function formatTime(date: Date): string {
  return date.toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function generateShareText(alert: TheftAlert): string {
  return `🚨 ALERTA DE ROBO 🚨

${alert.brand} ${alert.model}
Patente: ${alert.licensePlate}
Ubicación: ${alert.lastLocationName || 'Desconocida'}
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
    Alert.alert('Error', 'No se pudo abrir WhatsApp');
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
    Alert.alert(
      'Copiado',
      'Texto copiado. Abrí Instagram y pegalo en tu historia o mensaje.',
      [
        { text: 'Abrir Instagram', onPress: async () => {
          try {
            await Linking.openURL('instagram://');
          } catch {
            await Linking.openURL('https://www.instagram.com');
          }
        }},
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  } catch (e) {
    Alert.alert('Error', 'No se pudo compartir');
  }
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

  // Fallback to platform-specific sharing
  showShareOptions(alert);
}

function showShareOptions(alert: TheftAlert): void {
  Alert.alert(
    'Compartir alerta',
    'Elige cómo compartir:',
    [
      {
        text: 'WhatsApp',
        onPress: () => {
          const text = generateShareText(alert);
          shareToWhatsApp(text);
        },
      },
      {
        text: 'Instagram',
        onPress: () => shareToInstagram(alert),
      },
      {
        text: 'Cancelar',
        style: 'cancel',
      },
    ]
  );
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
