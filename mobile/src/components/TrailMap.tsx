import React, { useRef, useCallback } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import type { FeatureCollection } from 'geojson';
import type { Trail, BBox } from '@/types/trail';
import { useMapStore } from '@/stores/mapStore';
import { MAX_BBOX_AREA_DEG2 } from '@/constants';

MapLibreGL.setAccessToken(null); // No token needed for OSM tiles

const TILE_URL = 'https://demotiles.maplibre.org/style.json';

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#2d9a4e',
  moderate: '#2979c0',
  hard: '#1a1a1a',
};

interface Props {
  trails: Trail[];
  onViewportChange: (bbox: BBox) => void;
  onTrailTap: (trail: Trail) => void;
}

export function TrailMap({ trails, onViewportChange, onTrailTap }: Props) {
  const { isLoading } = useMapStore();
  const cameraRef = useRef<MapLibreGL.Camera>(null);

  const handleRegionDidChange = useCallback(
    (feature: any) => {
      const bounds = feature.properties?.visibleBounds;
      if (!bounds) return;
      const [[east, north], [west, south]] = bounds;
      const area = Math.abs(north - south) * Math.abs(east - west);
      if (area <= MAX_BBOX_AREA_DEG2) {
        onViewportChange({ south, west, north, east });
      }
    },
    [onViewportChange]
  );

  const geojson: FeatureCollection = {
    type: 'FeatureCollection',
    features: trails.map((t) => ({
      type: 'Feature',
      id: t.id,
      properties: { id: t.id, difficulty: t.difficulty, name: t.name },
      geometry: t.geometry as any,
    })),
  };

  return (
    <View style={styles.container}>
      <MapLibreGL.MapView
        style={styles.map}
        styleURL={TILE_URL}
        onRegionDidChange={handleRegionDidChange}
      >
        <MapLibreGL.Camera ref={cameraRef} zoomLevel={12} followUserLocation />
        <MapLibreGL.UserLocation visible />
        <MapLibreGL.ShapeSource
          id="trails"
          shape={geojson}
          onPress={(e: any) => {
            const feature = e.features?.[0];
            if (!feature) return;
            const trailId = feature.properties?.id as string;
            const trail = trails.find((t) => t.id === trailId);
            if (trail) onTrailTap(trail);
          }}
        >
          <MapLibreGL.LineLayer
            id="trail-lines"
            style={{
              lineColor: ['match', ['get', 'difficulty'],
                'easy', DIFFICULTY_COLORS.easy,
                'moderate', DIFFICULTY_COLORS.moderate,
                DIFFICULTY_COLORS.hard] as any,
              lineWidth: 3,
              lineCap: 'round',
            }}
          />
        </MapLibreGL.ShapeSource>
      </MapLibreGL.MapView>
      {isLoading && (
        <View style={styles.loader}>
          <ActivityIndicator size="small" color="#2979c0" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  loader: { position: 'absolute', top: 12, right: 12 },
});
