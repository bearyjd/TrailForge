import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: 'trailforge://' },
    });
    setLoading(false);
    if (error) {
      Alert.alert('Error', "Couldn't send link — check your email address");
    } else {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>
          We sent a sign-in link to {email.trim()}.{'\n'}Tap it to sign in.
        </Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Sign in to TrailForge</Text>
      <Text style={styles.subtitle}>Enter your email — we'll send a magic link.</Text>
      <TextInput
        style={styles.input}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TouchableOpacity
        style={[styles.btn, loading && styles.btnDisabled]}
        onPress={handleSend}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>Send link</Text>
        )}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: '#666', marginBottom: 24, lineHeight: 22 },
  input: {
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  btn: { backgroundColor: '#2979c0', padding: 14, borderRadius: 8, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  backBtn: { marginTop: 24 },
  backText: { color: '#2979c0', fontSize: 15 },
});
