import axios from 'axios';
import { API_URL } from '../constants/config';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

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
