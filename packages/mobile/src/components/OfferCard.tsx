import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme-context';

interface OfferCardProps {
  brandLogo?: string;
  brandName: string;
  location: string;
  distance: string;
  price93?: number;
  onPress?: () => void;
}

export function OfferCard({
  brandLogo,
  brandName,
  location,
  distance,
  price93,
  onPress,
}: OfferCardProps) {
  const { colors } = useTheme();

  // Chilean national average for 93
  const avgPrice93 = 1604;
  const savings = price93 ? avgPrice93 - price93 : 0;

  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={onPress}>
      {/* Brand logo or fallback icon */}
      {brandLogo ? (
        <Image source={{ uri: brandLogo }} style={styles.brandLogo} resizeMode="contain" />
      ) : (
        <View style={[styles.logoFallback, { backgroundColor: colors.amberBg }]}>
          <Ionicons name="flame" size={22} color={colors.amber} />
        </View>
      )}

      {/* Location */}
      {location ? (
        <Text style={[styles.location, { color: colors.inkFaint }]} numberOfLines={1}>{location}</Text>
      ) : null}

      {/* Distance */}
      <Text style={[styles.distance, { color: colors.inkFaint }]}>{distance}</Text>

      {/* Price per liter */}
      {price93 ? (
        <Text style={[styles.price, { color: colors.ink }]}>${price93}/L</Text>
      ) : null}

      {/* Savings badge */}
      {savings > 0 ? (
        <View style={[styles.savingsBadge, { backgroundColor: '#1F9D6315' }]}>
          <Text style={styles.savingsText}>-${savings} vs promedio</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { width: 170, borderRadius: 14, borderWidth: 1, padding: 14, marginRight: 10 },
  brandLogo: { width: 48, height: 48, borderRadius: 8, marginBottom: 10 },
  logoFallback: { width: 48, height: 48, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  brandName: { fontSize: 14, fontWeight: '600' },
  location: { fontSize: 12, marginTop: 2 },
  distance: { fontSize: 12, marginTop: 4 },
  price: { fontSize: 20, fontWeight: '700', fontFamily: 'monospace', marginTop: 8 },
  savingsBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginTop: 6 },
  savingsText: { fontSize: 11, fontWeight: '600', color: '#1F9D63' },
});
