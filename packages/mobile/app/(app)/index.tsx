import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { listMotorcycles, deleteMotorcycle, Motorcycle } from '../../src/api';
import { useAuth } from '../../src/auth-context';

export default function MotorcycleListScreen() {
  const { signOut } = useAuth();
  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMotorcycles = async () => {
    try {
      const data = await listMotorcycles();
      setMotorcycles(data);
    } catch (err) {
      Alert.alert('Error', 'Failed to load motorcycles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMotorcycles();
  }, []);

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete', `Delete ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMotorcycle(id);
            setMotorcycles((prev) => prev.filter((m) => m.id !== id));
          } catch {
            Alert.alert('Error', 'Failed to delete');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Motorcycles</Text>
        <TouchableOpacity onPress={signOut}>
          <Text style={styles.logout}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {motorcycles.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.empty}>No motorcycles yet</Text>
          <Text style={styles.emptySub}>Tap + to add one</Text>
        </View>
      ) : (
        <FlatList
          data={motorcycles}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/(app)/motorcycle/${item.id}`)}
              onLongPress={() => handleDelete(item.id, `${item.brand} ${item.model}`)}
            >
              <Text style={styles.cardTitle}>{item.brand} {item.model}</Text>
              <Text style={styles.cardSub}>{item.year} · {item.licensePlate}</Text>
              <Text style={styles.cardKm}>{item.currentKilometers.toLocaleString()} km</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: { fontSize: 22, fontWeight: 'bold' },
  logout: { color: '#FF3B30', fontSize: 14 },
  empty: { fontSize: 18, color: '#999', marginBottom: 4 },
  emptySub: { fontSize: 14, color: '#ccc' },
  card: {
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 10,
  },
  cardTitle: { fontSize: 18, fontWeight: '600' },
  cardSub: { fontSize: 14, color: '#666', marginTop: 4 },
  cardKm: { fontSize: 14, color: '#007AFF', marginTop: 4 },
});
