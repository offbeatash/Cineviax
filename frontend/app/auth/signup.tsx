import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const banner = require('../../../media/Cineviax_banner.png');

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signup, guestLogin } = useAuth();
  const router = useRouter();

  const showAlert = (title: string, message: string, buttons?: any) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`${title}\n\n${message}`);
      if (buttons && buttons[0] && typeof buttons[0].onPress === 'function') {
        buttons[0].onPress();
      }
    } else {
      Alert.alert(title, message, buttons);
    }
  };

  const handleSignup = async () => {
    setError(null);
    if (!name.trim() || !email || !password || !confirmPassword) {
      const msg = 'Please fill in all fields';
      showAlert('Error', msg);
      setError(msg);
      return;
    }

    if (password !== confirmPassword) {
      const msg = 'Passwords do not match';
      showAlert('Error', msg);
      setError(msg);
      return;
    }

    if (password.length < 6) {
      const msg = 'Password must be at least 6 characters';
      showAlert('Error', msg);
      setError(msg);
      return;
    }

    setLoading(true);
    try {
      await signup(name.trim(), email.trim(), phone.trim(), password);
      showAlert('Account created', 'Welcome to Cineviax!', [
        { text: 'Continue', onPress: () => router.replace('/main/home') },
      ]);
    } catch (error: any) {
      const message = error.message || 'Signup failed';
      setError(message);
      showAlert('Signup Failed', message);
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await guestLogin();
      router.replace('/main/watchlist');
    } catch (error: any) {
      const message = error.message || 'Guest login failed';
      setError(message);
      showAlert('Guest Login Failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <View style={styles.header}>
            <Image source={banner} style={styles.banner} resizeMode="contain" />
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join Cineviax Today</Text>
          </View>

          <TouchableOpacity
            style={[styles.guestButton, styles.topGuestButton, loading && styles.buttonDisabled]}
            onPress={handleGuestLogin}
            disabled={loading}
          >
            <Ionicons name="person-circle-outline" size={22} color="#FFF" />
            <Text style={styles.guestButtonText}>Continue as Guest</Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR CREATE AN ACCOUNT</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#666" style={styles.icon} />
              <TextInput
                style={styles.input}
                id="signup-name"
                name="name"
                placeholder="Full name"
                placeholderTextColor="#666"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="#666" style={styles.icon} />
              <TextInput
                style={styles.input}
                id="signup-email"
                name="email"
                placeholder="Email"
                placeholderTextColor="#666"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="call-outline" size={20} color="#666" style={styles.icon} />
              <TextInput
                style={styles.input}
                id="signup-phone"
                name="phone"
                placeholder="Phone number (optional)"
                placeholderTextColor="#666"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.icon} />
              <TextInput
                style={styles.input}
                id="signup-password"
                name="password"
                placeholder="Password"
                placeholderTextColor="#666"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.icon} />
              <TextInput
                style={styles.input}
                id="signup-confirm-password"
                name="confirmPassword"
                placeholder="Confirm Password"
                placeholderTextColor="#666"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSignup}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Creating Account...' : 'Sign Up'}
              </Text>
            </TouchableOpacity>
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.sideButton, styles.loginSideButton]}
              onPress={() => router.replace('/auth/login')}
              disabled={loading}
            >
              <Text style={styles.sideButtonText}>Login</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sideButton, styles.createAccountSideButton]}
              onPress={handleSignup}
              disabled={loading}
            >
              <Text style={styles.sideButtonText}>Create Account</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.replace('/auth/login')}>
              <Text style={styles.loginLink}>Login</Text>
            </TouchableOpacity>
          </View>
        </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#141414',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'flex-start',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  banner: {
    width: '100%',
    height: 260,
    marginBottom: 24,
    borderRadius: 20,
    overflow: 'hidden',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#E50914',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#999',
    marginTop: 8,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  icon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 56,
    color: '#FFF',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#E50914',
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  loginText: {
    color: '#999',
    fontSize: 16,
  },
  loginLink: {
    color: '#E50914',
    fontSize: 16,
    fontWeight: 'bold',
  },
  error: {
    color: '#FF6B6B',
    marginTop: 12,
    textAlign: 'center',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 22,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#333',
  },
  dividerText: {
    color: '#777',
    fontSize: 12,
    fontWeight: 'bold',
    marginHorizontal: 12,
  },
  guestButton: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#555',
    backgroundColor: '#242424',
  },
  guestButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  topGuestButton: {
    width: '100%',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 18,
  },
  sideButton: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createAccountSideButton: {
    backgroundColor: '#E50914',
  },
  loginSideButton: {
    backgroundColor: '#333',
  },
  sideButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
