import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme-context';

interface OfferCardProps {
  brandLogo?: string;
  brandName: string;
  location: string;
  distance: string;
  price93?: number;
  price95?: number;
  price97?: number;
}

export function OfferCard({
  brandLogo,
  brandName,
  location,
  distance,
  price93,
  price95,
  price97,
}: OfferCardProps) {
  const { colors } = useTheme();

  const avgPrice93 = 1604;
  const savings = price93 ? avgPrice93 - price93 : 0;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Brand logo or fallback icon */}
      {brandLogo ? (
        <Image source={{ uri: brandLogo }} style={styles.brandLogo} resizeMode="contain" />
      ) : (
        <View style={[styles.logoFallback, { backgroundColor: colors.amberBg }]}>
          <Ionicons name="flame" size={22} color={colors.amber} />
        </View>
      )}

      {/* Location - 2 lines */}
      {location ? (
        <Text style={[styles.location, { color: colors.inkFaint }]} numberOfLines={2}>{location}</Text>
      ) : null}

      {/* Distance */}
      <Text style={[styles.distance, { color: colors.inkFaint }]}>{distance}</Text>

      {/* Fuel prices */}
      <View style={styles.pricesContainer}>
        {price93 ? (
          <View style={styles.priceRow}>
            <Text style={[styles.fuelLabel, { color: colors.inkFaint }]}>93</Text>
            <Text style={[styles.price, { color: colors.ink }]}>${price93}</Text>
          </View>
        ) : null}
        {price95 ? (
          <View style={styles.priceRow}>
            <Text style={[styles.fuelLabel, { color: colors.inkFaint }]}>95</Text>
            <Text style={[styles.price, { color: colors.ink }]}>${price95}</Text>
          </View>
        ) : null}
        {price97 ? (
          <View style={styles.priceRow}>
            <Text style={[styles.fuelLabel, { color: colors.inkFaint }]}>97</Text>
            <Text style={[styles.price, { color: colors.ink }]}>${price97}</Text>
          </View>
        ) : null}
      </View>

      {/* Savings badge */}
      {savings > 0 ? (
        <View style={[styles.savingsBadge, { backgroundColor: '#1F9D6315' }]}>
          <Text style={styles.savingsText}>-${savings} vs promedio</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: 200, borderRadius: 14, borderWidth: 1, padding: 14, marginRight: 10 },
  brandLogo: { width: 48, height: 48, borderRadius: 8, marginBottom: 8 },
  logoFallback: { width: 48, height: 48, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  location: { fontSize: 12, lineHeight: 16 },
  distance: { fontSize: 12, marginTop: 4 },
  pricesContainer: { marginTop: 10, gap: 4 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fuelLabel: { fontSize: 13, fontWeight: '600' },
  price: { fontSize: 15, fontWeight: '700', fontFamily: 'monospace' },
  savingsBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginTop: 8 },
  savingsText: { fontSize: 11, fontWeight: '600', color: '#1F9D63' },
});
