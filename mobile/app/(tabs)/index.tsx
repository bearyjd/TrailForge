import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, Alert } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { router } from 'expo-router';
import { SearchBar } from '@/components/SearchBar';
import { TrailMap } from '@/components/TrailMap';
import { TrailBottomSheet } from '@/components/TrailBottomSheet';
import { OfflineBanner } from '@/components/OfflineBanner';
import { RecordingFAB } from '@/components/RecordingFAB';
import { useMapStore } from '@/stores/mapStore';
import { useRecordingStore } from '@/stores/recordingStore';
import { useSavedRoutesStore } from '@/stores/savedRoutesStore';
import { searchTrails, geocodePlace } from '@/api/trailApi';
import { useDebounce } from '@/hooks/useDebounce';
import { MAX_BBOX_AREA_DEG2 } from '@/constants';
import { LOCATION_TASK, startLocationUpdates, stopLocationUpdates } from '@/tasks/locationTask';
import type { Trail, BBox } from '@/types/trail';
import type { SavedRoute } from '@/types/route';

export default function ExploreScreen() {
  const { setBbox, setLoading, setSelectedTrailId } = useMapStore();
  const { isRecording, startTime, startRecording, stopRecording, getStats, clearRoute } = useRecordingStore();
  const { saveRoute } = useSavedRoutesStore();
  const [trails, setTrails] = useState<Trail[]>([]);
  const [selectedTrail, setSelectedTrail] = useState<Trail | null>(null);
  const [tooBig, setTooBig] = useState(false);
  const [saveDialogVisible, setSaveDialogVisible] = useState(false);
  const [routeName, setRouteName] = useState('');

  // Crash recovery: if store says recording but task is not registered
  useEffect(() => {
    if (!isRecording) return;
    TaskManager.isTaskRegisteredAsync(LOCATION_TASK).then((registered: boolean) => {
      if (registered) return;
      Alert.alert(
        'Unfinished route found',
        'A route was being recorded when the app closed.',
        [
          {
            text: 'Resume recording',
            onPress: () => startLocationUpdates(),
          },
          {
            text: 'Save & stop',
            onPress: () => { stopRecording(); setSaveDialogVisible(true); },
          },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => { stopRecording(); clearRoute(); },
          },
        ]
      );
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleStartRecording = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Location required', 'Enable location access to record routes.');
      return;
    }
    startRecording();
    await startLocationUpdates();
  }, [startRecording]);

  const handleStopRecording = useCallback(async () => {
    await stopLocationUpdates();
    stopRecording();
    setSaveDialogVisible(true);
    setRouteName('');
  }, [stopRecording]);

  const handleSaveRoute = useCallback(() => {
    const stats = getStats();
    const route: SavedRoute = {
      id: `route-${Date.now()}`,
      name: routeName.trim() || 'My Route',
      points: useRecordingStore.getState().currentRoute,
      ...stats,
      created_at: Date.now(),
    };
    saveRoute(route);
    clearRoute();
    setSaveDialogVisible(false);
    router.push(`/route/${route.id}`);
  }, [routeName, getStats, saveRoute, clearRoute]);

  const handleDiscardRoute = useCallback(() => {
    clearRoute();
    setSaveDialogVisible(false);
  }, [clearRoute]);

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
      <RecordingFAB
        isRecording={isRecording}
        startTime={startTime}
        onStart={handleStartRecording}
        onStop={handleStopRecording}
      />
      <TrailBottomSheet
        trail={selectedTrail}
        onDismiss={() => { setSelectedTrail(null); setSelectedTrailId(null); }}
      />

      <Modal visible={saveDialogVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Save Route</Text>
            <TextInput
              style={styles.input}
              placeholder="Route name"
              value={routeName}
              onChangeText={setRouteName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.discardBtn} onPress={handleDiscardRoute}>
                <Text style={styles.discardText}>Discard</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveRoute}>
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tooBig: { position: 'absolute', top: 100, alignSelf: 'center', zIndex: 10, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  tooBigText: { color: '#fff', fontWeight: '600' },
  nearMe: { position: 'absolute', bottom: 32, right: 16, backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  nearMeText: { fontWeight: '600', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 16 },
  modalButtons: { flexDirection: 'row', gap: 12 },
  discardBtn: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1.5, borderColor: '#999', alignItems: 'center' },
  discardText: { color: '#666', fontWeight: '600' },
  saveBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#2979c0', alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '600' },
});
