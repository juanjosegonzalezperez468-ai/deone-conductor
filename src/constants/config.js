export const API_URL = process.env.EXPO_PUBLIC_API_URL;

// Números de contacto. Son DOS y hacen cosas distintas: confundirlos retrasa
// las recargas, porque el dinero llega a una cuenta y el comprobante a otra.
//   · NEQUI_RECARGAS   → a dónde se envía el dinero.
//   · WHATSAPP_SOPORTE → a dónde se envía el comprobante y se pide ayuda.
export const NEQUI_RECARGAS   = '321 701 1145';
export const WHATSAPP_SOPORTE = '323 942 0671';
export const WHATSAPP_URL     = 'https://wa.me/573239420671';
export const TEL_SOPORTE      = 'tel:3239420671';
