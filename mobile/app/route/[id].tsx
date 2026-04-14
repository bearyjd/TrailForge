import React, { useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useSavedRoutesStore } from '@/stores/savedRoutesStore';
import { generateGpx } from '@/utils/gpx';

export default function RouteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getRoute, deleteRoute } = useSavedRoutesStore();
  const route = getRoute(id);

  const handleExportGpx = useCallback(async () => {
    if (!route) return;
    try {
      const gpxString = generateGpx(route);
      const path = `${FileSystem.cacheDirectory}${route.name.replace(/[^a-z0-9]/gi, '_')}.gpx`;
      await FileSystem.writeAsStringAsync(path, gpxString, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(path, { mimeType: 'application/gpx+xml', dialogTitle: 'Export GPX' });
    } catch (err) {
      Alert.alert('Export failed', 'Could not generate the GPX file.');
    }
  }, [route]);

  const handleDelete = useCallback(() => {
    Alert.alert('Delete route', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => { deleteRoute(id); router.back(); },
      },
    ]);
  }, [id, deleteRoute]);

  if (!route) {
    return <View style={styles.center}><Text>Route not found.</Text></View>;
  }

  const distKm = (route.distance_m / 1000).toFixed(2);
  const mins = Math.floor(route.duration_s / 60);
  const secs = String(route.duration_s % 60).padStart(2, '0');

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.name}>{route.name}</Text>

      <View style={styles.stats}>
        <Stat label="Distance" value={`${distKm} km`} />
        <Stat label="Duration" value={`${mins}:${secs}`} />
        <Stat label="Elevation gain" value={`${route.elevation_gain_m} m`} />
      </View>

      <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={handleExportGpx}>
        <Text style={styles.btnText}>Export GPX</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={handleDelete}>
        <Text style={styles.btnText}>Delete Route</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 22, fontWeight: '700', padding: 16 },
  stats: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  stat: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 16, fontWeight: '600', marginTop: 4 },
  btn: { marginHorizontal: 16, marginTop: 12, padding: 14, borderRadius: 10, alignItems: 'center' },
  btnPrimary: { backgroundColor: '#2979c0' },
  btnDanger: { backgroundColor: '#c0392b' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
