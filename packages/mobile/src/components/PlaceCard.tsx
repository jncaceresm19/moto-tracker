import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme-context';
import { NearbyPlace, getCategoryIcon, getCategoryColor, getCategoryLabel, openInGoogleMaps } from '../services/nearbyPlaces';

interface PlaceCardProps {
  place: NearbyPlace;
}

export function PlaceCard({ place }: PlaceCardProps) {
  const { colors } = useTheme();
  const categoryColor = getCategoryColor(place.category);
  const categoryIcon = getCategoryIcon(place.category);

  const handleVerRuta = () => {
    const url = openInGoogleMaps(place);
    Linking.openURL(url);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Category badge + distance */}
      <View style={styles.topRow}>
        <View style={[styles.categoryBadge, { backgroundColor: categoryColor + '20' }]}>
          <Ionicons name={categoryIcon as any} size={14} color={categoryColor} />
          <Text style={[styles.categoryText, { color: categoryColor }]}>{getCategoryLabel(place.category)}</Text>
        </View>
        <Text style={[styles.distance, { color: colors.inkFaint }]}>{place.distance.toFixed(1)} km</Text>
      </View>

      {/* Name */}
      <Text style={[styles.name, { color: colors.ink }]} numberOfLines={1}>{place.name}</Text>

      {/* Address */}
      {place.address ? (
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={12} color={colors.inkFaint} />
          <Text style={[styles.infoText, { color: colors.inkFaint }]} numberOfLines={2}>{place.address}</Text>
        </View>
      ) : null}

      {/* Ver ruta button */}
      <TouchableOpacity
        style={[styles.viewBtn, { backgroundColor: colors.primary }]}
        onPress={handleVerRuta}
      >
        <Ionicons name="navigate" size={14} color="#fff" />
        <Text style={styles.viewBtnText}>Ver ruta</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: 180, borderRadius: 14, borderWidth: 1, padding: 12, marginRight: 10 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  categoryBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  categoryText: { fontSize: 10, fontWeight: '700' },
  distance: { fontSize: 11, fontWeight: '600' },
  name: { fontSize: 13, fontWeight: '700', marginTop: 6 },
  metaRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 11 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  infoText: { fontSize: 11, flex: 1 },
  viewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 8, paddingVertical: 7, borderRadius: 8 },
  viewBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
