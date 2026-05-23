import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, StatusBar, Animated, Alert, ActivityIndicator, Image,
} from 'react-native';
import { offersApi } from '../api/client';
import { SERVICES } from '../constants/services';
import { CONDUCTOR_ID } from '../constants/config';

const C = {
  white:      '#FFFFFF',
  black:      '#111111',
  yellow:     '#F4C400',
  yellowLight:'#FFF8DC',
  grayLight:  '#888888',
  grayBorder: '#EEEEEE',
  grayBg:     '#F5F5F5',
  green:      '#22C55E',
  greenBg:    '#F0FDF4',
  red:        '#EF4444',
};

const SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 3,
};

const TIMER_SECS = 30;

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function SolicitudScreen({ params, navigate, goBack }) {
  const { solicitud = {}, tipoServicio } = params;
  const {
    id:               serviceId       = '',
    tipo_servicio:    tipo            = tipoServicio || 'moto_pasajero',
    precio_propuesto: precio          = 0,
    origen_direccion: origenDir       = 'Origen desconocido',
    destino_direccion:destinoDir      = 'Destino desconocido',
    origen_lat:       origenLat       = 5.0703,
    origen_lng:       origenLng       = -75.5138,
    cliente_id:       clienteId       = '',
  } = solicitud;

  const [timer, setTimer]     = useState(TIMER_SECS);
  const [loading, setLoading] = useState(false);
  const service = SERVICES.find((s) => s.id === tipo);

  const timerAnim = useRef(new Animated.Value(1)).current;
  const timerRef  = useRef(null);

  useEffect(() => {
    Animated.timing(timerAnim, {
      toValue: 0,
      duration: TIMER_SECS * 1000,
      useNativeDriver: false,
    }).start();

    timerRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          goBack();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, []);

  const handleAceptar = async () => {
    if (loading) return;
    setLoading(true);
    clearInterval(timerRef.current);
    try {
      await offersApi.crear({
        conductor_id:   CONDUCTOR_ID,
        service_id:     serviceId,
        precio_oferta:  precio,
      });
      navigate('EnServicio', { solicitud, precioAceptado: precio });
    } catch (err) {
      const msg = err.response?.data?.detail || 'Error al aceptar. Intenta de nuevo.';
      Alert.alert('Error', msg);
      setLoading(false);
      timerRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) { clearInterval(timerRef.current); goBack(); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
  };

  const handleContraofertar = () => {
    clearInterval(timerRef.current);
    navigate('Contraofertar', { solicitud, precioOriginal: precio });
  };

  const handleIgnorar = () => {
    clearInterval(timerRef.current);
    goBack();
  };

  const distanciaKm = haversineKm(5.0703, -75.5138, origenLat, origenLng).toFixed(1);

  const timerColor = timerAnim.interpolate({
    inputRange: [0, 0.33, 1],
    outputRange: [C.red, C.yellow, C.green],
  });

  return (
    <View style={s.root}>
      <StatusBar backgroundColor={C.white} barStyle="dark-content" />

      {/* Header */}
      <View style={s.header}>
        <Image source={require('../../assets/logo.png')} style={s.logo} resizeMode="contain" />
        <View style={s.alertBadge}>
          <Text style={s.alertBadgeTxt}>NUEVA SOLICITUD</Text>
        </View>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Timer circular */}
        <View style={s.timerSection}>
          <View style={s.timerWrap}>
            <View style={s.timerRingBg} />
            <Animated.View style={[s.timerRingFill, { backgroundColor: timerColor }]} />
            <View style={s.timerInner}>
              <Text style={s.timerNumber}>{timer}</Text>
              <Text style={s.timerSub}>seg</Text>
            </View>
          </View>
          <Text style={s.timerHint}>Responde antes de que expire el tiempo</Text>
        </View>

        {/* Tipo de servicio */}
        <View style={s.serviceCard}>
          <View style={s.serviceIconWrap}>
            <Text style={s.serviceEmoji}>{service ? service.icon : '🚗'}</Text>
          </View>
          <View style={s.serviceInfo}>
            <Text style={s.serviceLabel}>{service ? service.label : tipo}</Text>
            <Text style={s.serviceDesc}>{service ? service.description : ''}</Text>
          </View>
          <View style={s.newBadge}>
            <Text style={s.newBadgeTxt}>NUEVA</Text>
          </View>
        </View>

        {/* Ruta */}
        <Text style={s.sectionLabel}>RUTA DEL CLIENTE</Text>
        <View style={s.routeCard}>
          <View style={s.routeRow}>
            <View style={s.dotYellow} />
            <View style={s.routeTexts}>
              <Text style={s.routeSmallLabel}>Origen (recogida)</Text>
              <Text style={s.routeValue} numberOfLines={2}>{origenDir}</Text>
            </View>
          </View>
          <View style={s.routeDivider} />
          <View style={s.routeRow}>
            <View style={s.dotBlack} />
            <View style={s.routeTexts}>
              <Text style={s.routeSmallLabel}>Destino</Text>
              <Text style={s.routeValue} numberOfLines={2}>{destinoDir}</Text>
            </View>
          </View>
        </View>

        {/* Precio y distancia */}
        <View style={s.metaRow}>
          <View style={s.metaCard}>
            <Text style={s.metaIcon}>💵</Text>
            <Text style={s.metaValue}>${Number(precio).toLocaleString('es-CO')}</Text>
            <Text style={s.metaLabel}>Precio propuesto</Text>
          </View>
          <View style={s.metaCard}>
            <Text style={s.metaIcon}>📍</Text>
            <Text style={s.metaValue}>{distanciaKm} km</Text>
            <Text style={s.metaLabel}>Distancia a ti</Text>
          </View>
        </View>

        {/* Botones de acción */}
        <TouchableOpacity
          style={loading ? s.btnAceptarLoading : s.btnAceptar}
          onPress={handleAceptar}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={C.black} size="small" />
            : <Text style={s.btnAceptarTxt}>✓  ACEPTAR</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={s.btnContraofertar} onPress={handleContraofertar} activeOpacity={0.85}>
          <Text style={s.btnContraofertarTxt}>↕  CONTRAOFERTAR</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.btnIgnorar} onPress={handleIgnorar} activeOpacity={0.85}>
          <Text style={s.btnIgnorarTxt}>✕  IGNORAR</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.white },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 8 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 12,
    backgroundColor: C.white,
  },
  logo:          { height: 32, width: 120 },
  alertBadge:    { backgroundColor: C.yellow, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5 },
  alertBadgeTxt: { color: C.black, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },

  /* Timer */
  timerSection: { alignItems: 'center', paddingVertical: 24 },
  timerWrap: {
    width: 110,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  timerRingBg: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 6,
    borderColor: C.grayBorder,
  },
  timerRingFill: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 6,
    borderColor: 'transparent',
  },
  timerInner:  { alignItems: 'center' },
  timerNumber: { color: C.black, fontSize: 40, fontWeight: '800', lineHeight: 44 },
  timerSub:    { color: C.grayLight, fontSize: 12, fontWeight: '500' },
  timerHint:   { color: C.grayLight, fontSize: 13, textAlign: 'center' },

  /* Servicio */
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: C.yellow,
    ...SHADOW,
  },
  serviceIconWrap: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.yellow, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  serviceEmoji:    { fontSize: 26 },
  serviceInfo:     { flex: 1 },
  serviceLabel:    { color: C.black, fontSize: 18, fontWeight: '700' },
  serviceDesc:     { color: C.grayLight, fontSize: 12, marginTop: 2 },
  newBadge:        { backgroundColor: C.black, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  newBadgeTxt:     { color: C.yellow, fontSize: 10, fontWeight: '700', letterSpacing: 1 },

  sectionLabel: { color: C.grayLight, fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 12 },

  /* Ruta */
  routeCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.grayBorder,
    ...SHADOW,
  },
  routeRow:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  dotYellow:        { width: 10, height: 10, borderRadius: 5, backgroundColor: C.yellow, marginRight: 14 },
  dotBlack:         { width: 10, height: 10, borderRadius: 5, backgroundColor: C.black, marginRight: 14 },
  routeTexts:       { flex: 1 },
  routeSmallLabel:  { color: C.grayLight, fontSize: 11, marginBottom: 2 },
  routeValue:       { color: C.black, fontSize: 14, fontWeight: '500' },
  routeDivider:     { height: 1, backgroundColor: C.grayBorder, marginLeft: 24 },

  /* Meta */
  metaRow:  { flexDirection: 'row', gap: 12, marginBottom: 24 },
  metaCard: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.grayBorder,
    ...SHADOW,
  },
  metaIcon:  { fontSize: 22, marginBottom: 6 },
  metaValue: { color: C.black, fontSize: 20, fontWeight: '800', marginBottom: 2 },
  metaLabel: { color: C.grayLight, fontSize: 11 },

  /* Botones */
  btnAceptar: {
    backgroundColor: C.green,
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  btnAceptarLoading: {
    backgroundColor: C.grayBg,
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  btnAceptarTxt:      { color: C.white, fontSize: 17, fontWeight: '700', letterSpacing: 1 },
  btnContraofertar:   { backgroundColor: C.yellow, borderRadius: 18, paddingVertical: 18, alignItems: 'center', marginBottom: 12 },
  btnContraofertarTxt:{ color: C.black, fontSize: 17, fontWeight: '700', letterSpacing: 1 },
  btnIgnorar:         { backgroundColor: C.grayBg, borderRadius: 18, paddingVertical: 18, alignItems: 'center' },
  btnIgnorarTxt:      { color: C.grayLight, fontSize: 17, fontWeight: '600', letterSpacing: 1 },
});
