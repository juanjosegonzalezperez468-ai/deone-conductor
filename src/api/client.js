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

export default api;
