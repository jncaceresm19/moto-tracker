import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme-context';

interface WeatherCardProps {
  currentTemp: number | null;
  weatherCondition: string;
  zoneName?: string;
  rainProbability?: number | null;
  minutesUntilRain?: number | null;
  onPress?: () => void;
}

type WeatherMood = 'clear' | 'cloudy' | 'rain' | 'storm';
type Season = 'verano' | 'otono' | 'invierno' | 'primavera';

interface WeatherInfo {
  mood: WeatherMood;
  icon: keyof typeof Ionicons.glyphMap;
}

// Una sola fuente de verdad: mood e ícono se determinan juntos,
// así nunca quedan desincronizados (ej: llovizna ya no puede mostrar ícono de "solo nublado").
function getWeatherInfo(condition: string): WeatherInfo {
  const c = condition.toLowerCase();

  if (c.includes('despejado') || c.includes('clear')) {
    return { mood: 'clear', icon: 'sunny' };
  }
  if (c.includes('tormenta') || c.includes('thunder')) {
    return { mood: 'storm', icon: 'thunderstorm' };
  }
  if (c.includes('chubasco') || c.includes('shower')) {
    return { mood: 'storm', icon: 'thunderstorm' };
  }
  if (c.includes('llovizna') || c.includes('drizzle')) {
    return { mood: 'rain', icon: 'rainy' };
  }
  if (c.includes('lluvia') || c.includes('rain')) {
    return { mood: 'rain', icon: 'rainy' };
  }
  if (c.includes('nieve') || c.includes('snow')) {
    return { mood: 'cloudy', icon: 'snow' };
  }
  if (c.includes('neblina') || c.includes('fog')) {
    return { mood: 'cloudy', icon: 'cloud' };
  }
  if (c.includes('nublado') || c.includes('cloud')) {
    return { mood: 'cloudy', icon: 'cloudy' };
  }

  return { mood: 'cloudy', icon: 'cloudy' };
}

// Hemisferio sur (Chile): verano dic-feb, otoño mar-may, invierno jun-ago, primavera sep-nov
function getCurrentSeason(): Season {
  const month = new Date().getMonth() + 1; // 1-12
  if (month === 12 || month <= 2) return 'verano';
  if (month >= 3 && month <= 5) return 'otono';
  if (month >= 6 && month <= 8) return 'invierno';
  return 'primavera';
}

// Color base del sol según estación (para ícono y degradado)
function getSunColor(season: Season): string {
  switch (season) {
    case 'verano':
      return '#F5A623'; // sol fuerte, cálido
    case 'otono':
      return '#D98A3D'; // dorado más apagado
    case 'invierno':
      return '#E8C05A'; // amarillo pálido, luz débil
    case 'primavera':
    default:
      return '#F2C94C'; // amarillo fresco
  }
}

// Convierte un hex (#RRGGBB) a "r, g, b" para armar rgba() en el degradado
function hexToRgbString(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

// Aclara un color hex mezclándolo con blanco. amount 0-1 (0 = igual, 1 = blanco puro)
function lightenColor(hex: string, amount: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  const lr = Math.round(r + (255 - r) * amount);
  const lg = Math.round(g + (255 - g) * amount);
  const lb = Math.round(b + (255 - b) * amount);
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(lr)}${toHex(lg)}${toHex(lb)}`;
}

function getWeatherIconColor(mood: WeatherMood, primary: string, secondary: string): string {
  switch (mood) {
    case 'clear':
      return getSunColor(getCurrentSeason());
    case 'cloudy':
      return secondary; // gris
    case 'rain':
      return lightenColor(primary, 0.45); // primary más suave
    case 'storm':
    default:
      return primary; // sin cambios por ahora
  }
}

function getWeatherGradient(mood: WeatherMood, surfaceColor: string): [string, string] {
  switch (mood) {
    case 'clear': {
      const rgb = hexToRgbString(getSunColor(getCurrentSeason()));
      return [`rgba(${rgb}, 0.22)`, surfaceColor];
    }
    case 'rain':
      return ['rgba(24, 95, 165, 0.28)', surfaceColor];
    case 'storm':
      return ['rgba(93, 74, 122, 0.24)', surfaceColor];
    case 'cloudy':
    default:
      return ['rgba(96, 130, 168, 0.18)', surfaceColor];
  }
}

export function WeatherCard({
  currentTemp,
  weatherCondition,
  zoneName,
  rainProbability,
  minutesUntilRain,
  onPress,
}: WeatherCardProps) {
  const { colors } = useTheme();

  const { mood, icon } = getWeatherInfo(weatherCondition);
  const [gradientStart, gradientEnd] = getWeatherGradient(mood, colors.surface);
  const iconColor = getWeatherIconColor(mood, colors.primary, colors.textSecondary);

  const hasRain = rainProbability != null && rainProbability > 0;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <LinearGradient
        colors={[gradientStart, gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, { borderColor: colors.border }]}
      >
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: iconColor + '2A', borderColor: iconColor },
          ]}
        >
          <Ionicons name={icon} size={28} color={iconColor} />
        </View>

        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.ink }]}>
            {currentTemp != null ? `${Math.round(currentTemp)}°C` : '--°C'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.headerBg }]}>
            {weatherCondition}{zoneName ? ` · ${zoneName}` : ''}
          </Text>
          {hasRain && (
            <Text style={[styles.rainInfo, { color: colors.textSecondary }]}>
              Lluvia {minutesUntilRain != null ? `en ~${minutesUntilRain} min · ` : ''}{rainProbability}%
            </Text>
          )}
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  rainInfo: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
});