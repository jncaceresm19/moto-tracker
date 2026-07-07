import { Platform, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
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
  showShareOptions(text, url);
}

function showShareOptions(text: string, url: string): void {
  Alert.alert(
    'Compartir alerta',
    'Elige cómo compartir:',
    [
      {
        text: 'WhatsApp',
        onPress: () => shareToWhatsApp(text),
      },
      {
        text: 'Facebook',
        onPress: () => shareToFacebook(url),
      },
      {
        text: 'X (Twitter)',
        onPress: () => shareToX(text),
      },
      {
        text: 'Copiar',
        onPress: () => copyToClipboard(text),
      },
      {
        text: 'Cancelar',
        style: 'cancel',
      },
    ]
  );
}

async function shareToWhatsApp(text: string): Promise<void> {
  try {
    const Linking = require('expo-linking');
    const encoded = encodeURIComponent(text);
    await Linking.openURL(`whatsapp://send?text=${encoded}`);
  } catch (e) {
    Alert.alert('Error', 'No se pudo abrir WhatsApp');
  }
}

async function shareToFacebook(url: string): Promise<void> {
  try {
    const Linking = require('expo-linking');
    await Linking.openURL(`fb://share/?link=${encodeURIComponent(url)}`);
  } catch (e) {
    // Fallback to web
    try {
      const Linking = require('expo-linking');
      await Linking.openURL(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`);
    } catch (e2) {
      Alert.alert('Error', 'No se pudo abrir Facebook');
    }
  }
}

async function shareToX(text: string): Promise<void> {
  try {
    const Linking = require('expo-linking');
    const encoded = encodeURIComponent(text);
    await Linking.openURL(`twitter://post?message=${encoded}`);
  } catch (e) {
    // Fallback to web
    try {
      const Linking = require('expo-linking');
      await Linking.openURL(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`);
    } catch (e2) {
      Alert.alert('Error', 'No se pudo abrir X');
    }
  }
}

async function copyToClipboard(text: string): Promise<void> {
  try {
    await Clipboard.setStringAsync(text);
    Alert.alert('Copiado', 'Alerta copiada al portapapeles');
  } catch (e) {
    Alert.alert('Error', 'No se pudo copiar');
  }
}

export async function shareToSpecificPlatform(
  alert: TheftAlert,
  platform: 'whatsapp' | 'facebook' | 'x' | 'copy'
): Promise<void> {
  const text = generateShareText(alert);
  const url = generateShareUrl(alert);

  switch (platform) {
    case 'whatsapp':
      await shareToWhatsApp(text);
      break;
    case 'facebook':
      await shareToFacebook(url);
      break;
    case 'x':
      await shareToX(text);
      break;
    case 'copy':
      await copyToClipboard(text);
      break;
  }
}
