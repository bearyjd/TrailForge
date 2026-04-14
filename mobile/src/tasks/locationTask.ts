import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { useLocationStore } from '@/stores/locationStore';
import { useRecordingStore } from '@/stores/recordingStore';
import type { RoutePoint } from '@/types/route';

export const LOCATION_TASK = 'TRAILFORGE_LOCATION';

TaskManager.defineTask(LOCATION_TASK, ({ data, error }: TaskManager.TaskManagerTaskBody<{ locations: Location.LocationObject[] }>) => {
  if (error) {
    console.warn('Location task error:', error.message);
    return;
  }
  if (!data?.locations?.length) return;

  const location = data.locations[data.locations.length - 1];
  const { coords } = location;

  useLocationStore.getState().setCoords({
    latitude: coords.latitude,
    longitude: coords.longitude,
    altitude: coords.altitude,
    accuracy: coords.accuracy,
    heading: coords.heading ?? null,
  });

  if (useRecordingStore.getState().isRecording) {
    const point: RoutePoint = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      altitude: coords.altitude,
      timestamp: location.timestamp,
    };
    useRecordingStore.getState().addPoint(point);
  }
});

export async function startLocationUpdates(): Promise<void> {
  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    distanceInterval: 10,
    timeInterval: 5000,
    foregroundService: {
      notificationTitle: 'TrailForge',
      notificationBody: 'Recording your route…',
    },
  });
  useLocationStore.getState().setWatching(true);
}

export async function stopLocationUpdates(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK);
  if (isRegistered) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
  useLocationStore.getState().setWatching(false);
}
