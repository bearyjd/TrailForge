import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import * as FileSystem from 'expo-file-system';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { useOfflineStore } from '@/stores/offlineStore';
import { REGIONS } from '@/constants/regions';
import { TILE_STYLE_URL } from '@/constants';

export default function OfflineManagerScreen() {
  const { packs, downloadProgress, addPack, updatePackStatus, updateProgress, deletePack } = useOfflineStore();

  const trailPacks = Object.values(packs).filter((p) => p.type === 'trail-local');
  const regionalPacks = Object.values(packs).filter((p) => p.type === 'regional');

  const handleDeleteTrailPack = useCallback(async (id: string) => {
    Alert.alert('Delete pack', 'Remove this offline area?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try { await MapLibreGL.offlineManager.deletePack(id); } catch { /* ignore */ }
          deletePack(id);
        },
      },
    ]);
  }, [deletePack]);

  const handleDeleteRegionalPack = useCallback(async (id: string, localPath?: string) => {
    Alert.alert('Delete pack', 'Remove this offline region?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (localPath) {
            try { await FileSystem.deleteAsync(localPath, { idempotent: true }); } catch { /* ignore */ }
          }
          deletePack(id);
        },
      },
    ]);
  }, [deletePack]);

  const handleAddRegion = useCallback(() => {
    const available = REGIONS.filter((r) => !packs[`region-${r.key}`]);
    if (available.length === 0) {
      Alert.alert('All regions downloaded', 'You have downloaded all available regions.');
      return;
    }
    const options = available.map((r) => ({
      text: `${r.name} (~${(r.size_bytes_approx / 1e9).toFixed(1)} GB)`,
      onPress: async () => {
        const packId = `region-${r.key}`;
        const localPath = `${FileSystem.documentDirectory}${r.key}.pmtiles`;
        addPack({
          id: packId,
          name: r.name,
          type: 'regional',
          region_key: r.key,
          size_bytes: r.size_bytes_approx,
          downloaded_at: 0,
          status: 'downloading',
        });
        const downloadResumable = FileSystem.createDownloadResumable(
          r.pmtiles_url,
          localPath,
          {},
          (progress: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => {
            const pct = progress.totalBytesExpectedToWrite > 0
              ? progress.totalBytesWritten / progress.totalBytesExpectedToWrite
              : 0;
            updateProgress(packId, pct);
          }
        );
        try {
          const result = await downloadResumable.downloadAsync();
          if (result?.status === 200) {
            updatePackStatus(packId, 'complete', localPath);
          } else {
            updatePackStatus(packId, 'error');
          }
        } catch {
          updatePackStatus(packId, 'error');
        }
      },
    }));
    Alert.alert('Add region', 'Select a region to download:', [
      ...options,
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [packs, addPack, updatePackStatus, updateProgress]);

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '—';
    if (bytes < 1e6) return `${(bytes / 1e3).toFixed(0)} KB`;
    if (bytes < 1e9) return `${(bytes / 1e6).toFixed(1)} MB`;
    return `${(bytes / 1e9).toFixed(1)} GB`;
  }

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trail Packs</Text>
        {trailPacks.length === 0 ? (
          <Text style={styles.empty}>No trail packs downloaded yet.</Text>
        ) : (
          trailPacks.map((p) => (
            <View key={p.id} style={styles.row}>
              <View style={styles.info}>
                <Text style={styles.packName}>{p.name}</Text>
                <Text style={styles.packMeta}>{formatBytes(p.size_bytes)}</Text>
              </View>
              <View style={[styles.badge, p.status === 'complete' ? styles.badgeReady : p.status === 'downloading' ? styles.badgeDownloading : styles.badgeError]}>
                <Text style={styles.badgeText}>{p.status === 'complete' ? 'Ready' : p.status === 'downloading' ? `${Math.round((downloadProgress[p.id] ?? 0) * 100)}%` : 'Error'}</Text>
              </View>
              <TouchableOpacity onPress={() => handleDeleteTrailPack(p.id)} style={styles.deleteBtn}>
                <Text style={styles.deleteText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Regional Packs</Text>
          <TouchableOpacity onPress={handleAddRegion} style={styles.addBtn}>
            <Text style={styles.addText}>+ Add region</Text>
          </TouchableOpacity>
        </View>
        {regionalPacks.length === 0 ? (
          <Text style={styles.empty}>No regional packs downloaded yet.</Text>
        ) : (
          regionalPacks.map((p) => (
            <View key={p.id} style={styles.row}>
              <View style={styles.info}>
                <Text style={styles.packName}>{p.name}</Text>
                <Text style={styles.packMeta}>{formatBytes(p.size_bytes)}</Text>
              </View>
              <View style={[styles.badge, p.status === 'complete' ? styles.badgeReady : p.status === 'downloading' ? styles.badgeDownloading : styles.badgeError]}>
                <Text style={styles.badgeText}>{p.status === 'complete' ? 'Ready' : p.status === 'downloading' ? `${Math.round((downloadProgress[p.id] ?? 0) * 100)}%` : 'Error'}</Text>
              </View>
              <TouchableOpacity onPress={() => handleDeleteRegionalPack(p.id, p.local_path)} style={styles.deleteBtn}>
                <Text style={styles.deleteText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8f8' },
  section: { marginTop: 16, backgroundColor: '#fff', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#eee' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  empty: { paddingHorizontal: 16, paddingBottom: 16, color: '#aaa', fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#eee' },
  info: { flex: 1 },
  packName: { fontSize: 15, fontWeight: '600' },
  packMeta: { fontSize: 12, color: '#888', marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 8 },
  badgeReady: { backgroundColor: '#e6f4ea' },
  badgeDownloading: { backgroundColor: '#fff3e0' },
  badgeError: { backgroundColor: '#fdecea' },
  badgeText: { fontSize: 12, fontWeight: '600' },
  addBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#2979c0', borderRadius: 14 },
  addText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  deleteBtn: { padding: 8 },
  deleteText: { color: '#c0392b', fontSize: 16, fontWeight: '700' },
});
