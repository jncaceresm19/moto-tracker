import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '../../src/auth-context';

export default function HomeScreen() {
  const { user, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🏍️ Moto Tracker</Text>
      <Text style={styles.subtitle}>Welcome, {user?.email || 'User'}</Text>
      <Text style={styles.placeholder}>Motorcycle list coming in PR #2</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  placeholder: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
});
