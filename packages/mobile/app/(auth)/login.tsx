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
import { useTheme } from '../../src/theme-context';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const { colors } = useTheme();

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

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 24,
      backgroundColor: colors.background,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 0,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 10,
      padding: 14,
      fontSize: 16,
      marginBottom: 14,
      backgroundColor: colors.inputBg,
      color: colors.text,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 6,
    },
    buttonText: {
      color: colors.primaryText,
      fontSize: 16,
      fontWeight: '600',
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    dividerText: {
      marginHorizontal: 12,
      color: colors.textMuted,
      fontSize: 14,
    },
    googleButton: {
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingVertical: 16,
      alignItems: 'center',
    },
    googleButtonTextDisabled: {
      color: colors.textMuted,
      fontSize: 16,
      fontWeight: '600',
    },
    googleNote: {
      color: colors.textMuted,
      fontSize: 12,
      textAlign: 'center',
      marginTop: 6,
    },
    link: {
      color: colors.accent,
      textAlign: 'center',
      marginTop: 20,
      fontSize: 15,
      fontWeight: '600',
    },
  });

  return (
    <View style={dynamicStyles.container}>
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
        <Text style={dynamicStyles.subtitle}>
          Sign in to your account
        </Text>
      </View>

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
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={dynamicStyles.buttonText}>
          {loading ? 'Signing in...' : 'Sign In'}
        </Text>
      </TouchableOpacity>

      <View style={styles.divider}>
        <View style={dynamicStyles.dividerLine} />
        <Text style={dynamicStyles.dividerText}>or</Text>
        <View style={dynamicStyles.dividerLine} />
      </View>

      <TouchableOpacity
        style={dynamicStyles.googleButton}
        onPress={() =>
          Alert.alert(
            'Coming Soon',
            'Google Sign-In will be available in a future update.'
          )
        }
        disabled
      >
        <Text style={dynamicStyles.googleButtonTextDisabled}>
          Continue with Google
        </Text>
      </TouchableOpacity>

      <Text style={dynamicStyles.googleNote}>
        Coming soon — requires development build
      </Text>

      <Link href="/(auth)/register" asChild>
        <TouchableOpacity>
          <Text style={dynamicStyles.link}>
            Don't have an account? Sign Up
          </Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  brandBlock: {
    alignItems: 'center',
    marginBottom: 28,
  },

  icon: {
    width: 80,
    height: 80,
    marginBottom: -60,
  },

  logo: {
    width: 500,
    height: 180,
    marginBottom: -60,
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 22,
  },
});