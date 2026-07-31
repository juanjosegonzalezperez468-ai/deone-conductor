import { Alert } from 'react-native';
import * as Location from 'expo-location';

// Aviso destacado ("prominent disclosure") exigido por la política de datos
// de usuario de Google Play: TODA petición del permiso de ubicación debe ir
// inmediatamente precedida, dentro de la app, de una explicación de qué dato
// se recoge y para qué se usa. El aviso de segundo plano vive en
// backgroundLocation.js; este cubre el permiso de primer plano.
let avisoRechazadoEnSesion = false;
let solicitudEnCurso = null;

function mostrarAvisoUbicacion() {
  return new Promise((resolve) => {
    Alert.alert(
      'Uso de tu ubicación',
      'Deone Conductor recopila datos de tu ubicación para mostrar tu ' +
        'posición a los clientes cercanos, asignarte solicitudes de servicio ' +
        'y hacer seguimiento de los viajes mientras usas la app.',
      [
        { text: 'Ahora no',  style: 'cancel', onPress: () => resolve(false) },
        { text: 'Continuar', onPress: () => resolve(true) },
      ],
      { cancelable: false },
    );
  });
}

/**
 * Pide el permiso de ubicación en primer plano mostrando antes el aviso
 * destacado. Si el permiso ya está concedido (o el sistema ya no permite
 * volver a pedirlo) no muestra nada. Si el usuario rechaza el aviso, las
 * llamadas automáticas (montaje de pantallas) no insisten en la sesión;
 * pasar { reintentar: true } en acciones explícitas del usuario (p. ej. el
 * toggle de disponibilidad) para preguntar de nuevo. Varias llamadas
 * simultáneas comparten una sola solicitud para no duplicar el aviso.
 */
export function solicitarUbicacionConAviso({ reintentar = false } = {}) {
  if (reintentar) avisoRechazadoEnSesion = false;
  if (!solicitudEnCurso) {
    solicitudEnCurso = (async () => {
      const actual = await Location.getForegroundPermissionsAsync();
      if (actual.granted || !actual.canAskAgain || avisoRechazadoEnSesion) {
        return actual;
      }
      const acepto = await mostrarAvisoUbicacion();
      if (!acepto) {
        avisoRechazadoEnSesion = true;
        return actual;
      }
      return Location.requestForegroundPermissionsAsync();
    })().finally(() => { solicitudEnCurso = null; });
  }
  return solicitudEnCurso;
}
