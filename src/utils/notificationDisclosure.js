import { Alert } from 'react-native';
import * as Notifications from 'expo-notifications';

// Aviso previo al permiso de notificaciones. Las capturas del rechazo de
// Google Play (IN_APP_EXPERIENCE-2668) incluyen el diálogo del sistema de
// notificaciones apareciendo tras el OTP sin divulgación previa, así que se
// cubre igual que la ubicación (locationDisclosure.js).
let avisoRechazadoEnSesion = false;
let solicitudEnCurso = null;

function mostrarAvisoNotificaciones() {
  return new Promise((resolve) => {
    Alert.alert(
      'Notificaciones de solicitudes',
      'Deone Conductor te envía notificaciones para avisarte de nuevas ' +
        'solicitudes de servicio, mensajes de clientes y novedades de tu ' +
        'cuenta. Sin este permiso podrías perder solicitudes.',
      [
        { text: 'Ahora no',  style: 'cancel', onPress: () => resolve(false) },
        { text: 'Continuar', onPress: () => resolve(true) },
      ],
      { cancelable: false },
    );
  });
}

/**
 * Pide el permiso de notificaciones mostrando antes el aviso dentro de la
 * app. Si ya está concedido (o el sistema no permite volver a pedirlo) no
 * muestra nada, y si el usuario rechaza el aviso no se insiste en la sesión.
 * Llamadas simultáneas comparten una sola solicitud.
 */
export function solicitarNotificacionesConAviso() {
  if (!solicitudEnCurso) {
    solicitudEnCurso = (async () => {
      const actual = await Notifications.getPermissionsAsync();
      if (actual.granted || !actual.canAskAgain || avisoRechazadoEnSesion) {
        return actual;
      }
      const acepto = await mostrarAvisoNotificaciones();
      if (!acepto) {
        avisoRechazadoEnSesion = true;
        return actual;
      }
      return Notifications.requestPermissionsAsync();
    })().finally(() => { solicitudEnCurso = null; });
  }
  return solicitudEnCurso;
}
