import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export function OfflineBanner() {
  const isOnline = useNetworkStatus();
  if (isOnline) return null;
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>No connection — trail loading paused</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: '#e53935', paddingVertical: 6, alignItems: 'center' },
  text: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
