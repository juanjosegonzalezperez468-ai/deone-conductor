import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { documentosApi } from '../api/client';

const KEY_DOC_PENDIENTE = 'doc_upload_pendiente';

// En Android, el sistema puede matar el proceso de la app mientras la cámara
// (o la galería) está abierta: al volver, la app reinicia desde el Splash y
// la foto "se pierde". Antes de abrir el picker se guarda qué documento se
// estaba subiendo; Expo conserva el resultado del picker aunque el proceso
// muera, y aquí se recupera y se completa la subida.

export const marcarDocPendiente  = (tipo) => AsyncStorage.setItem(KEY_DOC_PENDIENTE, tipo);
export const limpiarDocPendiente = ()     => AsyncStorage.removeItem(KEY_DOC_PENDIENTE);

export async function recuperarDocPendiente(conductorId) {
  if (Platform.OS !== 'android' || !conductorId) return false;
  try {
    const tipo = await AsyncStorage.getItem(KEY_DOC_PENDIENTE);
    if (!tipo) return false;
    await AsyncStorage.removeItem(KEY_DOC_PENDIENTE);

    const pendientes = await ImagePicker.getPendingResultAsync();
    const conFoto = (Array.isArray(pendientes) ? pendientes : [])
      .find((r) => r && !r.canceled && r.assets?.[0]?.uri);
    const uri = conFoto?.assets?.[0]?.uri;
    if (!uri) return false;

    const formData = new FormData();
    formData.append('archivo', { uri, type: 'image/jpeg', name: `${tipo}.jpg` });
    formData.append('tipo_documento', tipo);
    formData.append('conductor_id', conductorId);
    await documentosApi.subir(formData);

    Alert.alert(
      'Documento recuperado',
      'La app se reinició al usar la cámara, pero tu foto sí se subió correctamente. Puedes verla en Cuenta → Mis documentos.',
    );
    return true;
  } catch {
    return false;
  }
}
