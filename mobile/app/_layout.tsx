import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StyleSheet } from 'react-native';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { useCommunityStore } from '@/stores/communityStore';

export default function RootLayout() {
  const setSession = useCommunityStore((s) => s.setSession);

  useEffect(() => {
    // Hydrate session from storage on start
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Keep store in sync whenever auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [setSession]);

  useEffect(() => {
    // Handle magic link deep link: trailforge://#access_token=...&refresh_token=...
    const handleUrl = (url: string) => {
      const fragment = url.split('#')[1];
      if (!fragment) return;
      const params = Object.fromEntries(new URLSearchParams(fragment));
      if (params.access_token && params.refresh_token) {
        supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
      }
    };

    Linking.getInitialURL().then((url: string | null) => { if (url) handleUrl(url); });
    const sub = Linking.addEventListener('url', ({ url }: { url: string }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={styles.flex}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="trail/[id]" options={{ title: 'Trail Details' }} />
        <Stack.Screen name="route/[id]" options={{ title: 'Route' }} />
        <Stack.Screen name="offline" options={{ title: 'Offline Maps' }} />
        <Stack.Screen name="auth" options={{ title: 'Sign In', presentation: 'modal' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
