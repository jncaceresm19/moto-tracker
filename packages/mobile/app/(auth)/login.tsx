import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '../../src/auth-context';

export default function LoginScreen() {
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);

    try {
      await signIn(email, password);
      router.replace('/(app)');
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Login failed'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.brandBlock}>
        <Image
          source={require('../../assets/logo.jpeg')}
          style={styles.icon}
          resizeMode="contain"
        />
        <Image
          source={require('../../assets/nombre.jpeg')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.subtitle}>
          Sign in to your account
        </Text>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Signing in...' : 'Sign In'}
        </Text>
      </TouchableOpacity>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      <TouchableOpacity
        style={styles.googleButton}
        onPress={() =>
          Alert.alert(
            'Coming Soon',
            'Google Sign-In will be available in a future update.'
          )
        }
        disabled
      >
        <Text style={styles.googleButtonTextDisabled}>
          Continue with Google
        </Text>
      </TouchableOpacity>

      <Text style={styles.googleNote}>
        Coming soon — requires development build
      </Text>

      <Link href="/(auth)/register" asChild>
        <TouchableOpacity>
          <Text style={styles.link}>
            Don't have an account? Sign Up
          </Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#fff',
  },

  brandBlock: {
    alignItems: 'center',
    marginBottom: 28,
  },

  icon: {
    width: 160,
    height: 160,
    marginBottom: -110,
  },

  logo: {
    width: 500,
    height: 180,
    marginBottom: -60,
  },

  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 0,
  },

  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 14,
  },

  button: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 6,
  },

  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 22,
  },

  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },

  dividerText: {
    marginHorizontal: 12,
    color: '#999',
    fontSize: 14,
  },

  googleButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },

  googleButtonTextDisabled: {
    color: '#999',
    fontSize: 16,
    fontWeight: '600',
  },

  googleNote: {
    color: '#bbb',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
  },

  link: {
    color: '#007AFF',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 15,
    fontWeight: '500',
  },
});