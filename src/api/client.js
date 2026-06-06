import axios from 'axios';
import auth from '@react-native-firebase/auth';
import { API_URL } from '../constants/config';
import { getBackendToken, storeBackendToken, clearBackendToken, getPhone } from '../utils/tokenStorage';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
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
            { telefono: phone, token: idToken, tipo: 'conductor', nombre: 'conductor' },
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
    _refreshing = false;
    return Promise.reject(error);
  },
);

export const conductorApi = {
  pendientes:       (tipo, params)        => api.get(`/services/pendientes/${tipo}`, { params }),
  historial:        (conductorId)         => api.get(`/conductor/${conductorId}/historial`),
  estadoViaje:      (serviceId, estado)   => api.patch(`/services/${serviceId}/estado`, { estado }),
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

export const billingApi = {
  saldo:             (conductorId) => api.get(`/billing/saldo/${conductorId}`),
  descontarComision: (data)        => api.post('/billing/descontar-comision', data),
  penalizaciones:    (conductorId) => api.get(`/billing/penalizaciones/${conductorId}`),
  solicitarRecarga:  (conductorId, monto) =>
    api.post('/billing/solicitar-recarga', { conductor_id: conductorId, monto }),
};

export const authApi = {
  verificarOtp: (data) => api.post('/auth/verificar-otp', data),
};

export const servicesApi = {
  obtener: (serviceId) => api.get(`/services/${serviceId}`),
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

export const adminApi = {
  conductoresPendientes: ()        => api.get('/admin/conductores/pendientes'),
  conductoresActivos:    ()        => api.get('/admin/conductores/activos'),
  aprobarConductor:      (id)      => api.patch(`/admin/conductor/${id}/aprobar`),
  rechazarConductor:     (id, mot) => api.patch(`/admin/conductor/${id}/rechazar`, { motivo: mot }),
  aprobarDocumento:      (id)      => api.patch(`/admin/documento/${id}/aprobar`),
  rechazarDocumento:     (id, mot) => api.patch(`/admin/documento/${id}/rechazar`, { motivo: mot }),
  recargasPendientes:    ()        => api.get('/admin/recargas/pendientes'),
  aprobarRecarga:        (id)      => api.post(`/billing/aprobar/${id}`),
  alertas:               ()        => api.get('/admin/alertas'),
  estadisticas:          ()        => api.get('/admin/estadisticas'),
};

export default api;
