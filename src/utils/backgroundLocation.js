import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { locationsApi } from '../api/client';
import { getUserUuid } from './tokenStorage';

export const TASK_UBICACION      = 'deone-ubicacion-conductor';
export const KEY_TIPO_SERVICIO   = 'conductor_tipo_servicio';

// Corre también con la app en segundo plano (servicio en primer plano de
// Android con notificación persistente). Solo está iniciada mientras el
// conductor tenga el toggle en DISPONIBLE.
TaskManager.defineTask(TASK_UBICACION, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  const loc = data.locations[data.locations.length - 1];
  try {
    const [uuid, tipo] = await Promise.all([
      getUserUuid(),
      AsyncStorage.getItem(KEY_TIPO_SERVICIO),
    ]);
    if (!uuid) return;
    await locationsApi.actualizar({
      conductor_id:      uuid,
      lat:               loc.coords.latitude,
      lng:               loc.coords.longitude,
      disponible:        true,
      servicios_activos: tipo ? [tipo] : [],
    });
  } catch {}
});

/**
 * Inicia el envío de ubicación en segundo plano. Pide el permiso
 * "Permitir todo el tiempo" si aún no está concedido (en Android 11+
 * el sistema lleva al usuario a Ajustes). Devuelve true si quedó activo;
 * si el permiso se niega, el heartbeat en primer plano sigue funcionando.
 */
export async function iniciarUbicacionSegundoPlano() {
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== 'granted') return false;

    let bg = await Location.getBackgroundPermissionsAsync();
    if (bg.status !== 'granted') {
      if (!bg.canAskAgain) return false;
      bg = await Location.requestBackgroundPermissionsAsync();
      if (bg.status !== 'granted') return false;
    }

    if (await Location.hasStartedLocationUpdatesAsync(TASK_UBICACION)) return true;

    await Location.startLocationUpdatesAsync(TASK_UBICACION, {
      accuracy:         Location.Accuracy.Balanced,
      timeInterval:     20000,
      distanceInterval: 0,
      // iOS
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically:       false,
      // Android: la notificación persistente mantiene vivo el servicio
      foregroundService: {
        notificationTitle: 'Estás disponible en Deone',
        notificationBody:  'Compartiendo tu ubicación para recibir solicitudes.',
        notificationColor: '#FFC400',
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function detenerUbicacionSegundoPlano() {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TASK_UBICACION)) {
      await Location.stopLocationUpdatesAsync(TASK_UBICACION);
    }
  } catch {}
}
