import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { getMotorcycle, Motorcycle } from '../../../src/api';

export default function MotorcycleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [motorcycle, setMotorcycle] = useState<Motorcycle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const data = await getMotorcycle(id);
        setMotorcycle(data);
      } catch {
        Alert.alert('Error', 'Failed to load motorcycle');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!motorcycle) {
    return (
      <View style={styles.center}>
        <Text>Motorcycle not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.brand}>{motorcycle.brand}</Text>
        <Text style={styles.model}>{motorcycle.model}</Text>
        <Text style={styles.year}>{motorcycle.year}</Text>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.label}>License Plate</Text>
        <Text style={styles.value}>{motorcycle.licensePlate}</Text>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.label}>Current Kilometers</Text>
        <Text style={styles.value}>{motorcycle.currentKilometers.toLocaleString()} km</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <Text style={styles.placeholder}>Maintenance · Documents · Kilometer History — PR #3</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 20, backgroundColor: '#f8f8f8', borderBottomWidth: 1, borderBottomColor: '#eee' },
  brand: { fontSize: 28, fontWeight: 'bold' },
  model: { fontSize: 20, color: '#333', marginTop: 4 },
  year: { fontSize: 16, color: '#666', marginTop: 2 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  label: { fontSize: 16, color: '#666' },
  value: { fontSize: 16, fontWeight: '500' },
  section: { padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  placeholder: { fontSize: 14, color: '#999', fontStyle: 'italic' },
});
