import axios from 'axios';
import auth from '@react-native-firebase/auth';
import { API_URL } from '../constants/config';
import { getBackendToken, storeBackendToken, clearBackendToken, getPhone } from '../utils/tokenStorage';

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const token = await getBackendToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let _refreshing = false;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && !_refreshing) {
      original._retry = true;
      _refreshing = true;
      try {
        const user = auth().currentUser;
        const phone = await getPhone();
        if (user && phone) {
          const idToken = await user.getIdToken(true);
          const { data } = await axios.post(
            `${API_URL}/auth/verificar-otp`,
            { telefono: phone, token: idToken, tipo: 'conductor' },
            { headers: { 'Content-Type': 'application/json' } },
          );
          await storeBackendToken(data.token);
          original.headers.Authorization = `Bearer ${data.token}`;
          return api(original);
        }
      } catch {
        await clearBackendToken();
      } finally {
        _refreshing = false;
      }
    }
    if (error.response?.status === 429) {
      error.friendlyMessage = 'Demasiadas solicitudes. Espera un momento e intenta de nuevo.';
    }
    if (error.response?.status === 422) {
      const detail = error.response?.data?.detail;
      error.friendlyMessage =
        typeof detail === 'object' && detail?.mensaje
          ? detail.mensaje
          : 'Datos inválidos. Revisa la información e intenta de nuevo.';
    }
    _refreshing = false;
    return Promise.reject(error);
  },
);

export const conductorApi = {
  pendientes:       (tipo, params)        => api.get(`/services/pendientes/${tipo}`, { params }),
  historial:        (conductorId)         => api.get(`/conductor/${conductorId}/historial`),
  estadoViaje:      (serviceId, estado, extra = {}) => api.patch(`/services/${serviceId}/estado`, { estado, ...extra }),
  perfil:           (conductorId)         => api.get(`/conductor/${conductorId}/perfil`),
  actualizarPerfil: (conductorId, data)   => api.patch(`/conductor/${conductorId}/perfil`, data),
  estado:           (conductorId)         => api.get(`/conductor/${conductorId}/estado`),
};

export const fcmApi = {
  registrar: (conductorId, fcm_token) =>
    api.patch(`/conductor/${conductorId}/fcm-token`, { fcm_token }),
};

export const offersApi = {
  crear:     (data)       => api.post('/offers/crear', data),
  responder: (id, accion) => api.patch(`/offers/${id}/responder`, { accion }),
};

export const locationsApi = {
  actualizar: (data) => api.post('/locations/conductor/actualizar', data),
};

export const penaltiesApi = {
  registrarCancelacion: (conductorId, solicitudId) =>
    api.post('/penalties/cancelacion', { conductor_id: conductorId, solicitud_id: solicitudId }),
};

export const billingApi = {
  saldo:             (conductorId) => api.get(`/billing/saldo/${conductorId}`),
  descontarComision: (data)        => api.post('/billing/descontar-comision', data),
  penalizaciones:    (conductorId) => api.get(`/billing/penalizaciones/${conductorId}`),
  solicitarRecarga:  (monto) =>
    api.post('/billing/solicitar-recarga', { monto }),
};

export const authApi = {
  verificarOtp:    (data) => api.post('/auth/verificar-otp', data),
  aceptarTerminos: (uid)  => api.patch(`/auth/perfil/${uid}/terminos`),
  eliminarCuenta:  (uid)  => api.delete(`/auth/cuenta/${uid}`),
};

export const servicesApi = {
  obtener:  (serviceId)    => api.get(`/services/${serviceId}`),
  conductor: (conductorId) => api.get(`/services/conductor/${conductorId}`),
};

export const documentosApi = {
  subir: (formData) =>
    api.post('/conductores/documentos/subir', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    }),
  obtener: (conductorId) => api.get(`/conductores/documentos/${conductorId}`),
};

export const vehiculoApi = {
  registrar: (data)        => api.post('/conductores/vehiculo/registrar', data),
  obtener:   (conductorId) => api.get(`/conductores/vehiculo/${conductorId}`),
};

export const chatApi = {
  getMensajes:   (serviceId, readerId) =>
    api.get(`/chat/${serviceId}/mensajes`, { params: { reader_id: readerId } }),
  enviarMensaje: (serviceId, senderId, mensaje) =>
    api.post(`/chat/${serviceId}/mensaje`, {
      sender_id:   senderId,
      sender_tipo: 'conductor',
      mensaje,
    }),
};

// Rutas urbanas de reparto: el conductor trabaja por horas entregando
// múltiples pedidos de un comercio en un solo recorrido.
export const rutasApi = {
  disponibles:     ()   => api.get('/rutas/disponibles'),
  misRutas:        ()   => api.get('/rutas/mis-rutas', { params: { rol: 'conductor' } }),
  obtener:         (id) => api.get(`/rutas/${id}`),
  aceptar:         (id) => api.post(`/rutas/${id}/aceptar`),
  iniciarRecogida: (id) => api.post(`/rutas/${id}/iniciar-recogida`),
  iniciarReparto:  (id) => api.post(`/rutas/${id}/iniciar-reparto`),
  espera: (id, paradaId, accion, motivo) =>
    api.post(`/rutas/${id}/paradas/${paradaId}/espera`, { accion, motivo }),
  subirFoto: (id, paradaId, formData) =>
    api.post(`/rutas/${id}/paradas/${paradaId}/foto`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    }),
  entregar: (id, paradaId, fotoPath) =>
    api.post(`/rutas/${id}/paradas/${paradaId}/entregar`, { foto_path: fotoPath }),
  fallida: (id, paradaId, fotoPath, motivo) =>
    api.post(`/rutas/${id}/paradas/${paradaId}/fallida`, { foto_path: fotoPath, motivo }),
  finalizar: (id)         => api.post(`/rutas/${id}/finalizar`),
  cancelar:  (id, motivo) => api.post(`/rutas/${id}/cancelar`, { motivo }),
  calificarCliente: (rutaId, calificacion, comentario) =>
    api.post('/ratings', { ruta_id: rutaId, calificacion, comentario }),
};

export const adminApi = {
  conductoresPendientes: ()        => api.get('/admin/conductores/pendientes'),
  conductoresActivos:    ()        => api.get('/admin/conductores/activos'),
  conductoresTodos:      ()        => api.get('/admin/conductores/todos'),
  conductorResumen:      (id)      => api.get(`/admin/conductor/${id}/resumen`),
  suspenderConductor:    (id, motivo, dias) =>
    api.patch(`/admin/conductor/${id}/suspender`, { motivo, dias }),
  documentosPendientes:  ()        => api.get('/admin/documentos/pendientes'),
  aprobarConductor:      (id)      => api.patch(`/admin/conductor/${id}/aprobar`),
  rechazarConductor:     (id, mot) => api.patch(`/admin/conductor/${id}/rechazar`, { motivo: mot }),
  reactivarConductor:    (id, mot) => api.patch(`/admin/conductor/${id}/reactivar`, { motivo: mot }),
  aprobarDocumento:      (id)      => api.patch(`/admin/documento/${id}/aprobar`),
  rechazarDocumento:     (id, mot) => api.patch(`/admin/documento/${id}/rechazar`, { motivo: mot }),
  recargasPendientes:    ()        => api.get('/admin/recargas/pendientes'),
  aprobarRecarga:        (id)      => api.post(`/billing/aprobar/${id}`),
  rechazarRecarga:       (id)      => api.post(`/billing/rechazar/${id}`),
  alertas:               ()        => api.get('/admin/alertas'),
  estadisticas:          ()        => api.get('/admin/estadisticas'),
  mapaConductores:       ()        => api.get('/admin/mapa-conductores'),
  rutas:                 (estado)  => api.get('/admin/rutas', { params: estado ? { estado } : {} }),
  rutaDetalle:           (id)      => api.get(`/admin/rutas/${id}`),
};

export default api;
