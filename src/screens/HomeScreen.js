import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, Linking,
  StatusBar, ActivityIndicator, Image, Modal, Switch,
} from 'react-native';
import * as Location from 'expo-location';
import { conductorApi, locationsApi, billingApi, offersApi } from '../api/client';
import { SERVICES } from '../constants/services';
import { getUid } from '../constants/config';
import { C, SHADOW } from '../constants/theme';

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

function isHoy(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr).toDateString() === new Date().toDateString();
}

export default function HomeScreen({ navigate }) {
  const [disponible, setDisponible]       = useState(false);
  const [tipoServicio]                    = useState('moto_pasajero');
  const [location, setLocation]           = useState(null);
  const [loadingToggle, setLoadingToggle] = useState(false);
  const [saldo, setSaldo]                 = useState(null);
  const [viajesHoy, setViajesHoy]         = useState(0);
  const [gananciasHoy, setGananciasHoy]   = useState(0);
  const [solicitud, setSolicitud]         = useState(null);
  const [timer, setTimer]                 = useState(TIMER_SECS);
  const [loadingAceptar, setLoadingAceptar] = useState(false);

  const seenIds   = useRef(new Set());
  const pollRef   = useRef(null);
  const timerRef  = useRef(null);
  const locationRef = useRef(null);

  useEffect(() => { locationRef.current = location; }, [location]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setLocation(loc.coords);
      }
    })();
  }, []);

  useEffect(() => {
    fetchSaldo();
    fetchHistorial();
    const iv = setInterval(fetchSaldo, 30000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (saldoInsuficiente && disponible) setDisponible(false);
  }, [saldo]);

  const fetchSaldo = async () => {
    try {
      const { data } = await billingApi.saldo(getUid());
      const val = typeof data === 'object' ? data.saldo : data;
      if (typeof val === 'number') setSaldo(val);
    } catch {}
  };

  const fetchHistorial = async () => {
    try {
      const { data } = await conductorApi.historial(getUid());
      if (Array.isArray(data)) {
        const hoy = data.filter(v => isHoy(v.created_at));
        setViajesHoy(hoy.length);
        setGananciasHoy(hoy.reduce((a, v) => a + (v.precio_final || 0), 0));
      }
    } catch {}
  };

  useEffect(() => {
    if (disponible) {
      poll();
      pollRef.current = setInterval(poll, 8000);
    } else {
      clearInterval(pollRef.current);
    }
    return () => clearInterval(pollRef.current);
  }, [disponible, tipoServicio]);

  useEffect(() => {
    if (!disponible || !location) return;
    locationsApi.actualizar({
      conductor_id: getUid(),
      lat: location.latitude,
      lng: location.longitude,
    }).catch(() => {});
  }, [disponible, location]);

  const poll = async () => {
    const loc = locationRef.current;
    try {
      const params = loc
        ? { lat: loc.latitude, lng: loc.longitude, radio_km: 3 }
        : { radio_km: 3 };
      const { data } = await conductorApi.pendientes(tipoServicio, params);
      if (Array.isArray(data) && data.length > 0) {
        const nueva = data.find(s => s.estado === 'pendiente' && !seenIds.current.has(s.id));
        if (nueva) {
          seenIds.current.add(nueva.id);
          clearInterval(pollRef.current);
          showModal(nueva);
        }
      }
    } catch {}
  };

  const showModal = (sol) => {
    clearInterval(timerRef.current);
    setSolicitud(sol);
    setTimer(TIMER_SECS);
    timerRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          cerrarModal();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const cerrarModal = () => {
    clearInterval(timerRef.current);
    setSolicitud(null);
    if (disponible) pollRef.current = setInterval(poll, 8000);
  };

  const aceptarViaje = async () => {
    if (loadingAceptar || !solicitud) return;
    setLoadingAceptar(true);
    clearInterval(timerRef.current);
    try {
      await offersApi.crear({
        conductor_id:  getUid(),
        service_id:    solicitud.id,
        precio_oferta: solicitud.precio_propuesto,
      });
      const captured = solicitud;
      setSolicitud(null);
      setLoadingAceptar(false);
      navigate('EnServicio', { solicitud: captured, precioAceptado: captured.precio_propuesto });
    } catch {
      setLoadingAceptar(false);
      cerrarModal();
    }
  };

  const handleToggle = async (value) => {
    if (value && saldoInsuficiente) {
      Alert.alert(
        'Saldo insuficiente',
        'Necesitas al menos $1.000 en saldo para activarte y recibir servicios.\n\nContacta soporte para recargar.',
        [{ text: 'Entendido' }]
      );
      return;
    }
    if (value) {
      setLoadingToggle(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { setLoadingToggle(false); return; }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setLocation(loc.coords);
      } catch {
        setLoadingToggle(false);
        return;
      }
      setLoadingToggle(false);
    }
    setDisponible(value);
  };

  const saldoBajo        = saldo !== null && saldo < 2000;
  const saldoInsuficiente = saldo !== null && saldo < 1000;
  const timerPct    = timer / TIMER_SECS;
  const timerColor  = timer > 20 ? C.green : timer > 10 ? C.yellow : C.red;
  const srv         = solicitud ? SERVICES.find(sv => sv.id === (solicitud.tipo_servicio || 'moto_pasajero')) : null;
  const distKm      = location && solicitud
    ? haversineKm(
        location.latitude, location.longitude,
        solicitud.origen_lat || 5.0703,
        solicitud.origen_lng || -75.5138,
      ).toFixed(1)
    : '—';

  const getTimerFillStyle = () => ({
    height:          4,
    borderRadius:    2,
    backgroundColor: timerColor,
    width:           `${Math.round(timerPct * 100)}%`,
  });

  const getTimerNumStyle = () => ({
    fontSize:   36,
    fontWeight: '800',
    color:      timerColor,
  });

  return (
    <View style={s.root}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />

      {/* ───── MODAL SOLICITUD ───── */}
      <Modal visible={!!solicitud} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={s.modalCard}>

            <View style={s.modalTop}>
              <View style={s.nuevaBadge}>
                <Text style={s.nuevaTxt}>🔔  NUEVO VIAJE</Text>
              </View>
              <View style={s.timerBox}>
                <Text style={getTimerNumStyle()}>{timer}</Text>
                <Text style={s.timerSeg}>seg</Text>
              </View>
            </View>

            <View style={s.timerBarBg}>
              <View style={getTimerFillStyle()} />
            </View>

            {srv && (
              <View style={s.srvRow}>
                <View style={s.srvIconWrap}>
                  <Text style={s.srvEmoji}>{srv.icon}</Text>
                </View>
                <Text style={s.srvName}>{srv.label}</Text>
              </View>
            )}

            <View style={s.routeBox}>
              <View style={s.routeItem}>
                <View style={s.dotA} />
                <View style={s.routeTexts}>
                  <Text style={s.routeLabelSm}>📍 Origen</Text>
                  <Text style={s.routeVal} numberOfLines={2}>
                    {solicitud?.origen_direccion || '—'}
                  </Text>
                </View>
              </View>
              <View style={s.routeSep} />
              <View style={s.routeItem}>
                <View style={s.dotB} />
                <View style={s.routeTexts}>
                  <Text style={s.routeLabelSm}>📍 Destino</Text>
                  <Text style={s.routeVal} numberOfLines={2}>
                    {solicitud?.destino_direccion || '—'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={s.metaRow}>
              <View style={s.metaItem}>
                <Text style={s.metaVal}>
                  ${Number(solicitud?.precio_propuesto || 0).toLocaleString('es-CO')}
                </Text>
                <Text style={s.metaLbl}>Precio</Text>
              </View>
              <View style={s.metaDivider} />
              <View style={s.metaItem}>
                <Text style={s.metaVal}>{distKm} km</Text>
                <Text style={s.metaLbl}>Distancia a ti</Text>
              </View>
            </View>

            <View style={s.btnRow}>
              <TouchableOpacity style={s.btnRechazar} onPress={cerrarModal} activeOpacity={0.8}>
                <Text style={s.btnRechazarTxt}>RECHAZAR</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={loadingAceptar ? s.btnAceptarDis : s.btnAceptar}
                onPress={aceptarViaje}
                activeOpacity={0.85}
              >
                {loadingAceptar
                  ? <ActivityIndicator color={C.black} size="small" />
                  : <Text style={s.btnAceptarTxt}>ACEPTAR</Text>
                }
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

      {/* ───── HEADER ───── */}
      <View style={s.header}>
        <Image source={require('../../assets/logo.png')} style={s.logo} resizeMode="contain" />
        <View style={s.headerRight}>
          <Text style={s.hola}>Hola Juan 👋</Text>
          <Text style={s.ciudad}>Manizales 📍</Text>
        </View>
      </View>

      {/* ───── SALDO BAJO BANNER ───── */}
      {saldoBajo && (
        <TouchableOpacity
          style={s.saldoBanner}
          onPress={() => Linking.openURL('https://wa.me/573239420671')}
          activeOpacity={0.85}
        >
          <Text style={s.saldoBannerIcon}>⚠️</Text>
          <View style={s.saldoBannerTexts}>
            <Text style={s.saldoBannerTitle}>Saldo bajo</Text>
            <Text style={s.saldoBannerSub}>Recarga para seguir recibiendo servicios</Text>
          </View>
          <View style={s.saldoBannerBtn}>
            <Text style={s.saldoBannerBtnTxt}>Recargar</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* ───── CARDS ───── */}
      <View style={s.cardsWrap}>

        {/* Toggle */}
        <View style={disponible ? s.toggleOn : s.toggleOff}>
          <View style={s.toggleLeft}>
            <View style={disponible ? s.dotOn : s.dotOff} />
            <View style={s.toggleInfo}>
              <Text style={disponible ? s.toggleTitleOn : s.toggleTitleOff}>
                {disponible ? 'DISPONIBLE' : 'NO DISPONIBLE'}
              </Text>
              <Text style={s.toggleSub}>
                {disponible
                  ? 'Recibiendo solicitudes'
                  : saldoInsuficiente ? 'Saldo insuficiente para activarte' : 'Activa para recibir viajes'}
              </Text>
            </View>
          </View>
          {loadingToggle
            ? <ActivityIndicator size="small" color={C.yellow} />
            : (
              <Switch
                value={disponible}
                onValueChange={handleToggle}
                trackColor={{ false: '#CCCCCC', true: C.green }}
                thumbColor={C.white}
                disabled={saldoInsuficiente}
              />
            )
          }
        </View>

        {/* Ganancias del día */}
        <View style={s.gananciasCard}>
          <Text style={s.gananciasLbl}>Hoy</Text>
          <Text style={s.gananciasAmt}>${gananciasHoy.toLocaleString('es-CO')}</Text>
          <Text style={s.gananciasViajes}>
            {viajesHoy} viaje{viajesHoy !== 1 ? 's' : ''}
          </Text>
        </View>

      </View>

      {/* ───── MAPA ───── */}
      <View style={s.mapArea}>
        {/* Grid lines */}
        <View style={s.mH1} /><View style={s.mH2} /><View style={s.mH3} />
        <View style={s.mV1} /><View style={s.mV2} /><View style={s.mV3} />
        {/* Streets */}
        <View style={s.street1} />
        <View style={s.street2} />
        {/* Driver pin */}
        <View style={s.pinWrap}>
          <View style={disponible ? s.pinBgOn : s.pinBgOff}>
            <Text style={s.pinEmoji}>🏍️</Text>
          </View>
          <View style={s.pinTail} />
          {disponible && <View style={s.pingRing} />}
        </View>
        {/* Coord badge */}
        {location && (
          <View style={s.coordBadge}>
            <Text style={s.coordTxt}>
              {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
            </Text>
          </View>
        )}
        {!location && (
          <View style={s.coordBadge}>
            <Text style={s.coordTxt}>Obteniendo ubicación…</Text>
          </View>
        )}
      </View>

    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  /* Header */
  header: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingHorizontal: 20,
    paddingTop:      52,
    paddingBottom:   14,
    backgroundColor: C.bg,
  },
  logo:        { height: 30, width: 110 },
  headerRight: { alignItems: 'flex-end' },
  hola:        { color: C.black, fontSize: 15, fontWeight: '700' },
  ciudad:      { color: C.gray,  fontSize: 13, marginTop: 2 },

  /* Saldo bajo banner */
  saldoBanner: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   '#FFF3CD',
    marginHorizontal:  16,
    marginBottom:      10,
    borderRadius:      16,
    padding:           14,
    borderWidth:       1,
    borderColor:       '#FFD700',
  },
  saldoBannerIcon:  { fontSize: 20, marginRight: 10 },
  saldoBannerTexts: { flex: 1 },
  saldoBannerTitle: { color: '#7A5C00', fontSize: 13, fontWeight: '700' },
  saldoBannerSub:   { color: '#7A5C00', fontSize: 11 },
  saldoBannerBtn:   { backgroundColor: C.yellow, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginLeft: 8 },
  saldoBannerBtnTxt:{ color: C.black, fontSize: 12, fontWeight: '700' },

  /* Cards wrapper */
  cardsWrap: { paddingHorizontal: 16, gap: 10, marginBottom: 12 },

  /* Toggle OFF */
  toggleOff: {
    backgroundColor: C.white,
    borderRadius:    24,
    padding:         18,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    ...SHADOW,
  },
  /* Toggle ON */
  toggleOn: {
    backgroundColor: C.greenBg,
    borderRadius:    24,
    padding:         18,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    borderWidth:     1.5,
    borderColor:     C.greenBorder,
    ...SHADOW,
  },
  toggleLeft:      { flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 12 },
  dotOff:          { width: 10, height: 10, borderRadius: 5, backgroundColor: '#CCCCCC', marginRight: 12 },
  dotOn:           { width: 10, height: 10, borderRadius: 5, backgroundColor: C.green,  marginRight: 12 },
  toggleInfo:      { flex: 1 },
  toggleTitleOff:  { color: C.gray,    fontSize: 16, fontWeight: '800', letterSpacing: 0.3, marginBottom: 3 },
  toggleTitleOn:   { color: '#15803D', fontSize: 16, fontWeight: '800', letterSpacing: 0.3, marginBottom: 3 },
  toggleSub:       { color: C.gray, fontSize: 12 },

  /* Ganancias card */
  gananciasCard: {
    backgroundColor: C.white,
    borderRadius:    24,
    paddingHorizontal: 20,
    paddingVertical: 14,
    ...SHADOW,
  },
  gananciasLbl:    { color: C.gray,  fontSize: 11, fontWeight: '600', letterSpacing: 1.5, marginBottom: 2 },
  gananciasAmt:    { color: C.black, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  gananciasViajes: { color: C.gray,  fontSize: 12, marginTop: 2 },

  /* Map area */
  mapArea: {
    flex:            1,
    backgroundColor: '#E4EDE4',
    position:        'relative',
    alignItems:      'center',
    justifyContent:  'center',
    marginHorizontal:16,
    marginBottom:    16,
    borderRadius:    24,
    overflow:        'hidden',
    ...SHADOW,
  },
  mH1: { position: 'absolute', left: 0, right: 0, top: '25%', height: 1, backgroundColor: '#D2DDD2' },
  mH2: { position: 'absolute', left: 0, right: 0, top: '50%', height: 1, backgroundColor: '#D2DDD2' },
  mH3: { position: 'absolute', left: 0, right: 0, top: '75%', height: 1, backgroundColor: '#D2DDD2' },
  mV1: { position: 'absolute', top: 0, bottom: 0, left: '25%', width: 1, backgroundColor: '#D2DDD2' },
  mV2: { position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1, backgroundColor: '#D2DDD2' },
  mV3: { position: 'absolute', top: 0, bottom: 0, left: '75%', width: 1, backgroundColor: '#D2DDD2' },
  street1: {
    position:        'absolute',
    top:             '35%',
    left:            0,
    right:           0,
    height:          8,
    backgroundColor: '#C8D5C8',
    opacity:         0.7,
  },
  street2: {
    position:        'absolute',
    top:             0,
    bottom:          0,
    left:            '40%',
    width:           8,
    backgroundColor: '#C8D5C8',
    opacity:         0.7,
  },
  pinWrap:  { alignItems: 'center', justifyContent: 'center' },
  pinBgOff: {
    width:           48,
    height:          48,
    borderRadius:    24,
    backgroundColor: '#CCCCCC',
    alignItems:      'center',
    justifyContent:  'center',
  },
  pinBgOn: {
    width:           52,
    height:          52,
    borderRadius:    26,
    backgroundColor: C.yellow,
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     C.yellow,
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.5,
    shadowRadius:    8,
    elevation:       6,
  },
  pinEmoji: { fontSize: 24 },
  pinTail: {
    width:           4,
    height:          8,
    backgroundColor: C.yellow,
    borderBottomLeftRadius:  2,
    borderBottomRightRadius: 2,
  },
  pingRing: {
    position:        'absolute',
    width:           80,
    height:          80,
    borderRadius:    40,
    borderWidth:     2,
    borderColor:     C.yellow,
    opacity:         0.3,
  },
  coordBadge: {
    position:        'absolute',
    bottom:          12,
    left:            12,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius:    10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  coordTxt: { color: C.black, fontSize: 11, fontWeight: '500' },

  /* ── MODAL ── */
  overlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent:  'flex-end',
    paddingHorizontal: 16,
    paddingBottom:   40,
  },
  modalCard: {
    backgroundColor: C.white,
    borderRadius:    24,
    padding:         20,
    ...SHADOW,
  },
  modalTop: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    marginBottom:    12,
  },
  nuevaBadge: {
    backgroundColor: C.black,
    borderRadius:    12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  nuevaTxt: { color: C.yellow, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  timerBox: { alignItems: 'center' },
  timerSeg: { color: C.gray, fontSize: 11, fontWeight: '500' },
  timerBarBg: {
    height:          4,
    backgroundColor: C.border,
    borderRadius:    2,
    marginBottom:    16,
    overflow:        'hidden',
  },
  srvRow: {
    flexDirection:   'row',
    alignItems:      'center',
    marginBottom:    16,
  },
  srvIconWrap: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: C.yellow,
    alignItems:      'center',
    justifyContent:  'center',
    marginRight:     10,
  },
  srvEmoji: { fontSize: 20 },
  srvName:  { color: C.black, fontSize: 16, fontWeight: '700' },
  routeBox: {
    backgroundColor: C.bg,
    borderRadius:    16,
    paddingHorizontal: 14,
    paddingVertical:   2,
    marginBottom:    16,
  },
  routeItem: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingVertical: 12,
  },
  dotA: {
    width:  10, height: 10, borderRadius: 5,
    backgroundColor: C.yellow, marginRight: 12,
  },
  dotB: {
    width:  10, height: 10, borderRadius: 5,
    backgroundColor: C.black,  marginRight: 12,
  },
  routeTexts:  { flex: 1 },
  routeLabelSm:{ color: C.gray,  fontSize: 11, marginBottom: 2 },
  routeVal:    { color: C.black, fontSize: 14, fontWeight: '500' },
  routeSep:    { height: 1, backgroundColor: C.border, marginLeft: 22 },
  metaRow: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: C.bg,
    borderRadius:    16,
    padding:         14,
    marginBottom:    16,
  },
  metaItem:    { flex: 1, alignItems: 'center' },
  metaVal:     { color: C.black, fontSize: 20, fontWeight: '800', marginBottom: 2 },
  metaLbl:     { color: C.gray, fontSize: 11 },
  metaDivider: { width: 1, height: 36, backgroundColor: C.border },
  btnRow: { flexDirection: 'row', gap: 10 },
  btnRechazar: {
    flex:            1,
    backgroundColor: C.bg,
    borderRadius:    16,
    paddingVertical: 16,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     C.border,
  },
  btnRechazarTxt: { color: C.gray, fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
  btnAceptar: {
    flex:            2,
    backgroundColor: C.yellow,
    borderRadius:    16,
    paddingVertical: 16,
    alignItems:      'center',
  },
  btnAceptarDis: {
    flex:            2,
    backgroundColor: C.border,
    borderRadius:    16,
    paddingVertical: 16,
    alignItems:      'center',
  },
  btnAceptarTxt: { color: C.black, fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
});
