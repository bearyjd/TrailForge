import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Share, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { DifficultyBadge } from '@/components/DifficultyBadge';
import { useSavedStore } from '@/stores/savedStore';
import { fetchTrail, exportTrailToGarmin, pollJobStatus } from '@/api/trailApi';
import type { Trail } from '@/types/trail';

type ExportState = 'idle' | 'loading' | 'done' | 'error';

export default function TrailDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isSaved, saveTrail, removeTrail } = useSavedStore();

  const [trail, setTrail] = useState<Trail | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [exportState, setExportState] = useState<ExportState>('idle');
  const [exportProgress, setExportProgress] = useState('');

  useEffect(() => {
    fetchTrail(id)
      .then(setTrail)
      .catch(() => setLoadError(true));
  }, [id]);

  const handleExport = useCallback(async () => {
    if (!trail) return;
    setExportState('loading');
    setExportProgress('Starting export…');
    try {
      const { job_id } = await exportTrailToGarmin(trail.id);
      let status = 'queued';
      while (status !== 'completed' && status !== 'failed') {
        await new Promise((r) => setTimeout(r, 3000));
        const jobStatus = await pollJobStatus(job_id);
        status = jobStatus.status;
        if (jobStatus.progress) setExportProgress(jobStatus.progress);
      }
      if (status === 'completed') {
        setExportState('done');
        const downloadUrl = `${process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api'}/download/${job_id}/gmapsupp.img`;
        await Share.share({ url: downloadUrl, message: `TrailForge: ${trail.name} — Garmin map ready` });
      } else {
        setExportState('error');
        Alert.alert('Export failed', 'The Garmin export did not complete. Please try again.');
      }
    } catch {
      setExportState('error');
      Alert.alert('Export failed', 'Could not start the export. Check your connection.');
    }
  }, [trail]);

  if (loadError) {
    return <View style={styles.center}><Text>Trail not found.</Text></View>;
  }
  if (!trail) {
    return <View style={styles.center}><ActivityIndicator /></View>;
  }

  const saved = isSaved(trail.id);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>{trail.name}</Text>
        <DifficultyBadge difficulty={trail.difficulty} />
      </View>

      <View style={styles.stats}>
        <Stat label="Distance" value={`${(trail.distance_m / 1000).toFixed(1)} km`} />
        <Stat label="Elevation" value={trail.elevation_gain_m ? `${trail.elevation_gain_m} m` : '—'} />
        <Stat label="Type" value={trail.trail_type} />
      </View>

      {trail.description ? (
        <Text style={styles.description}>{trail.description}</Text>
      ) : null}

      <TouchableOpacity
        style={[styles.btn, saved ? styles.btnOutline : styles.btnPrimary]}
        onPress={() => saved ? removeTrail(trail.id) : saveTrail(trail)}
      >
        <Text style={[styles.btnText, saved && styles.btnTextOutline]}>
          {saved ? '🔖 Saved' : 'Save Trail'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, styles.btnGarmin, exportState === 'loading' && styles.btnDisabled]}
        onPress={handleExport}
        disabled={exportState === 'loading'}
      >
        {exportState === 'loading' ? (
          <View style={styles.exportLoading}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={[styles.btnText, { marginLeft: 8 }]}>{exportProgress}</Text>
          </View>
        ) : (
          <Text style={styles.btnText}>
            {exportState === 'done' ? '✓ Export complete — share again' : 'Export to Garmin'}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, styles.btnOutline]}
        onPress={() => Alert.alert('Coming soon', 'Trail sharing arrives in sub-project 3.')}
      >
        <Text style={styles.btnTextOutline}>Share Trail</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingBottom: 8 },
  name: { fontSize: 22, fontWeight: '700', flex: 1, marginRight: 8 },
  stats: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  stat: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 16, fontWeight: '600', marginTop: 4 },
  description: { padding: 16, color: '#444', lineHeight: 22 },
  btn: { marginHorizontal: 16, marginTop: 12, padding: 14, borderRadius: 10, alignItems: 'center' },
  btnPrimary: { backgroundColor: '#2979c0' },
  btnGarmin: { backgroundColor: '#1a6e34' },
  btnOutline: { borderWidth: 1.5, borderColor: '#2979c0' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  btnTextOutline: { color: '#2979c0', fontWeight: '600', fontSize: 15 },
  exportLoading: { flexDirection: 'row', alignItems: 'center' },
});
