import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import { SearchBar } from '@/components/SearchBar';
import { TrailMap } from '@/components/TrailMap';
import { TrailBottomSheet } from '@/components/TrailBottomSheet';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useMapStore } from '@/stores/mapStore';
import { searchTrails, geocodePlace } from '@/api/trailApi';
import { useDebounce } from '@/hooks/useDebounce';
import { MAX_BBOX_AREA_DEG2 } from '@/constants';
import type { Trail, BBox } from '@/types/trail';

export default function ExploreScreen() {
  const { setBbox, setLoading, setSelectedTrailId } = useMapStore();
  const [trails, setTrails] = useState<Trail[]>([]);
  const [selectedTrail, setSelectedTrail] = useState<Trail | null>(null);
  const [tooBig, setTooBig] = useState(false);

  const loadTrails = useCallback(async (bbox: BBox) => {
    const area = Math.abs(bbox.north - bbox.south) * Math.abs(bbox.east - bbox.west);
    if (area > MAX_BBOX_AREA_DEG2) { setTooBig(true); return; }
    setTooBig(false);
    setLoading(true);
    setBbox(bbox);
    try {
      const response = await searchTrails(bbox);
      setTrails(response.features);
    } catch {
      // keep existing trails visible on error
    } finally {
      setLoading(false);
    }
  }, [setBbox, setLoading]);

  const debouncedLoad = useDebounce(loadTrails, 500);

  const handleSearch = useCallback(async (query: string) => {
    try {
      const results = await geocodePlace(query);
      if (results.length === 0) return;
      const { lat, lon } = results[0];
      const delta = 0.1;
      const bbox: BBox = { south: +lat - delta, west: +lon - delta, north: +lat + delta, east: +lon + delta };
      loadTrails(bbox);
    } catch { /* ignore */ }
  }, [loadTrails]);

  const handleNearMe = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const loc = await Location.getCurrentPositionAsync({});
    const delta = 0.05;
    const bbox: BBox = {
      south: loc.coords.latitude - delta,
      west: loc.coords.longitude - delta,
      north: loc.coords.latitude + delta,
      east: loc.coords.longitude + delta,
    };
    loadTrails(bbox);
  }, [loadTrails]);

  return (
    <View style={styles.container}>
      <OfflineBanner />
      <SearchBar onSearch={handleSearch} />
      {tooBig && (
        <View style={styles.tooBig}>
          <Text style={styles.tooBigText}>Zoom in to see trails</Text>
        </View>
      )}
      <TrailMap
        trails={trails}
        onViewportChange={debouncedLoad}
        onTrailTap={(t) => { setSelectedTrail(t); setSelectedTrailId(t.id); }}
      />
      <TouchableOpacity style={styles.nearMe} onPress={handleNearMe}>
        <Text style={styles.nearMeText}>📍 Near Me</Text>
      </TouchableOpacity>
      <TrailBottomSheet
        trail={selectedTrail}
        onDismiss={() => { setSelectedTrail(null); setSelectedTrailId(null); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tooBig: { position: 'absolute', top: 100, alignSelf: 'center', zIndex: 10, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  tooBigText: { color: '#fff', fontWeight: '600' },
  nearMe: { position: 'absolute', bottom: 32, right: 16, backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  nearMeText: { fontWeight: '600', fontSize: 14 },
});
