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

function getWeatherMood(condition: string): WeatherMood {
  const c = condition.toLowerCase();
  if (c.includes('despejado') || c.includes('clear')) return 'clear';
  if (c.includes('lluvia') || c.includes('rain') || c.includes('llovizna') || c.includes('drizzle')) return 'rain';
  if (c.includes('tormenta') || c.includes('thunder') || c.includes('chubasco') || c.includes('shower')) return 'storm';
  return 'cloudy';
}

function getWeatherGradient(mood: WeatherMood, surfaceColor: string): [string, string] {
  switch (mood) {
    case 'clear':
      return ['rgba(245, 166, 35, 0.22)', surfaceColor];
    case 'rain':
      return ['rgba(24, 95, 165, 0.28)', surfaceColor];
    case 'storm':
      return ['rgba(93, 74, 122, 0.24)', surfaceColor];
    case 'cloudy':
    default:
      return ['rgba(96, 130, 168, 0.18)', surfaceColor];
  }
}

function getWeatherIcon(condition: string): keyof typeof Ionicons.glyphMap {
  const c = condition.toLowerCase();
  if (c.includes('despejado') || c.includes('clear')) return 'sunny';
  if (c.includes('nublado') || c.includes('cloud')) return 'cloudy';
  if (c.includes('neblina') || c.includes('fog')) return 'cloud';
  if (c.includes('lluvia') || c.includes('rain')) return 'rainy';
  if (c.includes('llovizna') || c.includes('drizzle')) return 'cloudy-night';
  if (c.includes('nieve') || c.includes('snow')) return 'snow';
  if (c.includes('chubasco') || c.includes('shower')) return 'thunderstorm';
  if (c.includes('tormenta') || c.includes('thunder')) return 'thunderstorm';
  return 'cloudy';
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

  const icon = getWeatherIcon(weatherCondition);
  const mood = getWeatherMood(weatherCondition);
  const [gradientStart, gradientEnd] = getWeatherGradient(mood, colors.surface);

  const hasRain = rainProbability != null && rainProbability > 0;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <LinearGradient
        colors={[gradientStart, gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, { borderColor: colors.border }]}
      >
        <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
          <Ionicons name={icon} size={28} color={colors.primary} />
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