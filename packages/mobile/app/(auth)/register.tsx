import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '../../src/auth-context';
import { useTheme } from '../../src/theme-context';

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await signUp(email, password, name);
      router.replace('/(app)');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      padding: 24,
      backgroundColor: colors.background,
    },
    title: {
      fontSize: 32,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 8,
      color: colors.text,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 32,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 8,
      padding: 14,
      fontSize: 16,
      marginBottom: 12,
      backgroundColor: colors.inputBg,
      color: colors.text,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      padding: 16,
      alignItems: 'center',
      marginTop: 8,
    },
    buttonText: {
      color: colors.primaryText,
      fontSize: 16,
      fontWeight: '600',
    },
    link: {
      color: colors.accent,
      textAlign: 'center',
      marginTop: 16,
      fontSize: 14,
      fontWeight: '600',
    },
  });

  return (
    <View style={dynamicStyles.container}>
      <Text style={dynamicStyles.title}>Create Account</Text>
      <Text style={dynamicStyles.subtitle}>Sign up to start tracking</Text>

      <TextInput
        style={dynamicStyles.input}
        placeholder="Name"
        placeholderTextColor={colors.textMuted}
        value={name}
        onChangeText={setName}
      />

      <TextInput
        style={dynamicStyles.input}
        placeholder="Email"
        placeholderTextColor={colors.textMuted}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={dynamicStyles.input}
        placeholder="Password"
        placeholderTextColor={colors.textMuted}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity
        style={dynamicStyles.button}
        onPress={handleRegister}
        disabled={loading}
      >
        <Text style={dynamicStyles.buttonText}>{loading ? 'Creating account...' : 'Sign Up'}</Text>
      </TouchableOpacity>

      <Link href="/(auth)/login" asChild>
        <TouchableOpacity>
          <Text style={dynamicStyles.link}>Already have an account? Sign In</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}