import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, TextInput, Alert, ActivityIndicator, Image, ScrollView,
} from 'react-native';
import { offersApi } from '../api/client';
import { SERVICES } from '../constants/services';
import { CONDUCTOR_ID } from '../constants/config';

const C = {
  white:      '#FFFFFF',
  black:      '#111111',
  yellow:     '#F4C400',
  grayLight:  '#888888',
  grayBorder: '#EEEEEE',
  grayBg:     '#F5F5F5',
};

const SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 3,
};

export default function ContraofertarScreen({ params, navigate, goBack }) {
  const { solicitud = {}, precioOriginal = 0 } = params;
  const {
    id:               serviceId = '',
    tipo_servicio:    tipo      = '',
    origen_direccion: origen    = '',
    destino_direccion:destino   = '',
  } = solicitud;

  const [precio, setPrecio]   = useState('');
  const [loading, setLoading] = useState(false);

  const service = SERVICES.find((s) => s.id === tipo);
  const ready   = precio.length > 0 && parseInt(precio, 10) > 0;

  const handleEnviar = async () => {
    if (!ready || loading) return;
    setLoading(true);
    try {
      await offersApi.crear({
        conductor_id:  CONDUCTOR_ID,
        service_id:    serviceId,
        precio_oferta: parseInt(precio, 10),
        tipo:          'contraoferta',
      });
      navigate('EnServicio', { solicitud, precioAceptado: parseInt(precio, 10) });
    } catch (err) {
      const msg = err.response?.data?.detail || 'Error al enviar la contraoferta.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar backgroundColor={C.white} barStyle="dark-content" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={goBack} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Image source={require('../../assets/logo.png')} style={s.logo} resizeMode="contain" />
        <View style={s.backBtn} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

        <Text style={s.heading}>Contraofertar</Text>
        <Text style={s.sub}>Propón el precio que consideres justo para este viaje</Text>

        {/* Servicio */}
        {service && (
          <View style={s.serviceRow}>
            <Text style={s.serviceEmoji}>{service.icon}</Text>
            <Text style={s.serviceLabel}>{service.label}</Text>
          </View>
        )}

        {/* Ruta resumida */}
        <View style={s.routeCard}>
          <View style={s.routeRow}>
            <View style={s.dotYellow} />
            <Text style={s.routeTxt} numberOfLines={1}>{origen}</Text>
          </View>
          <View style={s.routeDivider} />
          <View style={s.routeRow}>
            <View style={s.dotBlack} />
            <Text style={s.routeTxt} numberOfLines={1}>{destino}</Text>
          </View>
        </View>

        {/* Precio original */}
        <View style={s.originalCard}>
          <Text style={s.originalLabel}>PRECIO DEL CLIENTE</Text>
          <Text style={s.originalValue}>${Number(precioOriginal).toLocaleString('es-CO')} COP</Text>
        </View>

        {/* Input nuevo precio */}
        <Text style={s.sectionLabel}>TU PRECIO</Text>
        <View style={s.priceCard}>
          <Text style={s.currency}>$</Text>
          <TextInput
            style={s.priceInput}
            placeholder="0"
            placeholderTextColor={C.grayBorder}
            value={precio}
            onChangeText={(v) => setPrecio(v.replace(/[^0-9]/g, ''))}
            keyboardType="numeric"
            maxLength={7}
            autoFocus
          />
          <Text style={s.cop}>COP</Text>
        </View>

        {precio.length > 0 && parseInt(precio, 10) > 0 && (
          <Text style={s.diffHint}>
            {parseInt(precio, 10) > precioOriginal
              ? `+$${(parseInt(precio, 10) - precioOriginal).toLocaleString('es-CO')} más que el cliente`
              : parseInt(precio, 10) < precioOriginal
                ? `-$${(precioOriginal - parseInt(precio, 10)).toLocaleString('es-CO')} menos que el cliente`
                : 'Mismo precio que el cliente'
            }
          </Text>
        )}

        {/* Botón */}
        <TouchableOpacity
          style={ready && !loading ? s.btnOn : s.btnOff}
          onPress={handleEnviar}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={C.black} size="small" />
            : <Text style={ready ? s.btnTxtOn : s.btnTxtOff}>ENVIAR CONTRAOFERTA</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={s.btnCancel} onPress={goBack} activeOpacity={0.8}>
          <Text style={s.btnCancelTxt}>CANCELAR</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.white },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 48, paddingTop: 8 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 12,
    backgroundColor: C.white,
  },
  backBtn:   { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backArrow: { color: C.black, fontSize: 24, fontWeight: '700' },
  logo:      { height: 32, width: 120 },

  heading: { color: C.black, fontSize: 28, fontWeight: '800', marginBottom: 6, letterSpacing: -0.5 },
  sub:     { color: C.grayLight, fontSize: 13, marginBottom: 24, lineHeight: 18 },

  serviceRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  serviceEmoji: { fontSize: 24, marginRight: 10 },
  serviceLabel: { color: C.black, fontSize: 17, fontWeight: '700' },

  routeCard: {
    backgroundColor: C.white,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: C.grayBorder,
    ...SHADOW,
  },
  routeRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  dotYellow:    { width: 10, height: 10, borderRadius: 5, backgroundColor: C.yellow, marginRight: 12 },
  dotBlack:     { width: 10, height: 10, borderRadius: 5, backgroundColor: C.black, marginRight: 12 },
  routeTxt:     { flex: 1, color: C.black, fontSize: 13, fontWeight: '500' },
  routeDivider: { height: 1, backgroundColor: C.grayBorder, marginLeft: 22 },

  originalCard: {
    backgroundColor: C.grayBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  originalLabel: { color: C.grayLight, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  originalValue: { color: C.black, fontSize: 18, fontWeight: '800' },

  sectionLabel: { color: C.grayLight, fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 12 },

  priceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: C.grayBorder,
    ...SHADOW,
  },
  currency:   { color: C.yellow, fontSize: 28, fontWeight: '700', marginRight: 8 },
  priceInput: { flex: 1, color: C.black, fontSize: 36, fontWeight: '700' },
  cop:        { color: C.grayLight, fontSize: 14, fontWeight: '600', alignSelf: 'flex-end', marginBottom: 4 },

  diffHint: { color: C.grayLight, fontSize: 12, marginBottom: 28, lineHeight: 18, textAlign: 'center' },

  btnOn:  { backgroundColor: C.yellow, borderRadius: 18, paddingVertical: 18, alignItems: 'center', marginBottom: 12 },
  btnOff: { backgroundColor: C.grayBg, borderRadius: 18, paddingVertical: 18, alignItems: 'center', marginBottom: 12 },
  btnTxtOn:  { color: C.black,     fontSize: 17, fontWeight: '700', letterSpacing: 1 },
  btnTxtOff: { color: C.grayLight, fontSize: 17, fontWeight: '700', letterSpacing: 1 },

  btnCancel:    { paddingVertical: 14, alignItems: 'center' },
  btnCancelTxt: { color: C.grayLight, fontSize: 15, fontWeight: '600' },
});
