import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, ActivityIndicator, Linking, Image,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { conductorApi, billingApi, servicesApi } from '../api/client';
import { getUid } from '../constants/config';
import { C, SHADOW } from '../constants/theme';

// Phases: 0 = EN_CAMINO, 1 = EN_VIAJE, 2 = COMPLETADO
const PHASES = [
  { key: 'en_camino', api: 'en_viaje' },
  { key: 'en_viaje',  api: 'completado' },
  { key: 'completado', api: null },
];

export default function EnServicioScreen({ params, goHome }) {
  const { solicitud = {}, precioAceptado = 0 } = params;
  const {
    id:                serviceId   = '',
    origen_direccion:  origenDir   = 'Punto de recogida',
    destino_direccion: destinoDir  = 'Destino',
    cliente_id:        clienteId   = '',
    origen_lat:        origenLat   = 5.0703,
    origen_lng:        origenLng   = -75.5138,
    destino_lat:       destinoLat  = 5.0650,
    destino_lng:       destinoLng  = -75.5100,
  } = solicitud;

  const [clienteNombre,   setClienteNombre]   = useState('');
  const [clienteRating,   setClienteRating]   = useState('');
  const [clienteTelefono, setClienteTelefono] = useState('');
  const inicial = (clienteNombre || 'C').charAt(0);

  const [phase, setPhase]     = useState(0);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const timerRef = useRef(null);
  const mapRef   = useRef(null);

  const fitMap = () => {
    if (!mapRef.current) return;
    mapRef.current.fitToCoordinates(
      [
        { latitude: origenLat,  longitude: origenLng },
        { latitude: destinoLat, longitude: destinoLng },
      ],
      { edgePadding: { top: 90, right: 60, bottom: 60, left: 60 }, animated: false }
    );
  };

  useEffect(() => {
    if (!serviceId) return;
    servicesApi.obtener(serviceId)
      .then(({ data }) => {
        if (data?.cliente_nombre)   setClienteNombre(data.cliente_nombre);
        if (data?.cliente_rating)   setClienteRating(String(data.cliente_rating));
        if (data?.cliente_telefono) setClienteTelefono(data.cliente_telefono);
      })
      .catch(() => {});
  }, [serviceId]);

  useEffect(() => {
    if (phase === 1) {
      timerRef.current = setInterval(() => {
        setElapsed(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [phase]);

  const formatElapsed = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const handleAccion = async () => {
    if (phase === 2) { goHome(); return; }
    if (loading) return;
    setLoading(true);

    const nextPhase = PHASES[phase];
    await conductorApi.estadoViaje(serviceId, nextPhase.api).catch(() => {});

    if (phase === 1) {
      await billingApi.descontarComision({
        conductor_id: getUid(),
        service_id:   serviceId,
        monto:        precioAceptado,
      }).catch(() => {});
    }

    setLoading(false);
    setPhase(prev => prev + 1);
  };

  const handleLlamar = () => {
    Linking.openURL(`tel:${clienteTelefono}`).catch(() => {});
  };

  const handleNavegar = (lat, lng) => {
    const gmaps = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    Linking.openURL(gmaps).catch(() => Linking.openURL(`geo:${lat},${lng}`));
  };

  const comision     = Math.round(precioAceptado * 0.095);
  const totalNeto    = precioAceptado - comision;

  /* ── PHASE 0: EN CAMINO ── */
  if (phase === 0) {
    return (
      <View style={s.root}>
        <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />

        {/* Mapa */}
        <View style={s.mapFull}>
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={s.absoluteMap}
            onMapReady={fitMap}
            showsMyLocationButton={false}
            showsCompass={false}
            toolbarEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
          >
            <Marker coordinate={{ latitude: origenLat, longitude: origenLng }} anchor={{ x: 0.5, y: 1 }}>
              <View style={s.pinYellow}><Text style={s.pinEmoji}>📍</Text></View>
            </Marker>
            <Marker coordinate={{ latitude: destinoLat, longitude: destinoLng }} anchor={{ x: 0.5, y: 1 }}>
              <View style={s.pinBlack}><Text style={s.pinDestEmoji}>🏁</Text></View>
            </Marker>
            <Polyline
              coordinates={[
                { latitude: origenLat,  longitude: origenLng },
                { latitude: destinoLat, longitude: destinoLng },
              ]}
              strokeColor={C.yellow}
              strokeWidth={3}
            />
          </MapView>
          <View style={s.statusBadge}>
            <View style={s.pulseDot} />
            <Text style={s.statusTxt}>EN CAMINO AL CLIENTE</Text>
          </View>
        </View>

        {/* Card cliente */}
        <View style={s.bottomSheet}>
          <View style={s.clienteCard}>
            <View style={s.clienteAvatar}>
              <Text style={s.clienteAvatarTxt}>{inicial}</Text>
            </View>
            <View style={s.clienteInfo}>
              <Text style={s.clienteNombre}>{clienteNombre}</Text>
              <View style={s.ratingRow}>
                <Text style={s.star}>★</Text>
                <Text style={s.ratingTxt}>{clienteRating}</Text>
              </View>
              <Text style={s.origenTxt} numberOfLines={1}>{origenDir}</Text>
            </View>
            <View style={s.clienteActions}>
              <TouchableOpacity style={s.callBtn} onPress={handleLlamar} activeOpacity={0.7}>
                <Text style={s.callIcon}>📞</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.chatBtn} activeOpacity={0.7}>
                <Text style={s.chatIcon}>💬</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={loading ? s.btnMainDis : s.btnMain}
            onPress={handleAccion}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={C.black} size="small" />
              : <Text style={s.btnMainTxt}>HE LLEGADO AL CLIENTE</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity
            style={s.btnNavegar}
            onPress={() => handleNavegar(origenLat, origenLng)}
            activeOpacity={0.85}
          >
            <Text style={s.btnNavegarTxt}>🗺️  NAVEGAR AL CLIENTE</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  /* ── PHASE 1: EN VIAJE ── */
  if (phase === 1) {
    return (
      <View style={s.root}>
        <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

        {/* Barra superior */}
        <View style={s.topBar}>
          <View style={s.topBarInner}>
            <Text style={s.topBarLbl}>EN VIAJE</Text>
            <Text style={s.topBarTimer}>{formatElapsed(elapsed)}</Text>
          </View>
        </View>

        {/* Mapa */}
        <View style={s.mapFull}>
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={s.absoluteMap}
            onMapReady={fitMap}
            showsMyLocationButton={false}
            showsCompass={false}
            toolbarEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
          >
            <Marker coordinate={{ latitude: origenLat, longitude: origenLng }} anchor={{ x: 0.5, y: 1 }}>
              <View style={s.pinYellow}><Text style={s.pinEmoji}>📍</Text></View>
            </Marker>
            <Marker coordinate={{ latitude: destinoLat, longitude: destinoLng }} anchor={{ x: 0.5, y: 1 }}>
              <View style={s.pinBlack}><Text style={s.pinDestEmoji}>🏁</Text></View>
            </Marker>
            <Polyline
              coordinates={[
                { latitude: origenLat,  longitude: origenLng },
                { latitude: destinoLat, longitude: destinoLng },
              ]}
              strokeColor={C.yellow}
              strokeWidth={3}
            />
          </MapView>
        </View>

        {/* Card info viaje */}
        <View style={s.bottomSheet}>
          <View style={s.viajeCard}>
            <View style={s.routeItem}>
              <View style={s.dotA} />
              <View style={s.routeTexts}>
                <Text style={s.routeLbl}>Destino</Text>
                <Text style={s.routeVal} numberOfLines={2}>{destinoDir}</Text>
              </View>
            </View>
            <View style={s.routeSep} />
            <View style={s.viajeMetaRow}>
              <View style={s.viajeMetaItem}>
                <Text style={s.viajeMetaVal}>${Number(precioAceptado).toLocaleString('es-CO')}</Text>
                <Text style={s.viajeMetaLbl}>Total</Text>
              </View>
              <View style={s.viajeMetaDivider} />
              <View style={s.viajeMetaItem}>
                <Text style={s.viajeMetaVal}>{clienteNombre.split(' ')[0]}</Text>
                <Text style={s.viajeMetaLbl}>Cliente</Text>
              </View>
              <View style={s.viajeMetaDivider} />
              <View style={s.viajeMetaItem}>
                <Text style={s.viajeMetaVal}>★ {clienteRating}</Text>
                <Text style={s.viajeMetaLbl}>Rating</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={loading ? s.btnMainDis : s.btnMain}
            onPress={handleAccion}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={C.black} size="small" />
              : <Text style={s.btnMainTxt}>FINALIZAR VIAJE</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity
            style={s.btnNavegar}
            onPress={() => handleNavegar(destinoLat, destinoLng)}
            activeOpacity={0.85}
          >
            <Text style={s.btnNavegarTxt}>🗺️  NAVEGAR AL DESTINO</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  /* ── PHASE 2: COMPLETADO ── */
  return (
    <View style={s.completadoRoot}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />

      <Image
        source={require('../../assets/logo.png')}
        style={s.completadoLogo}
        resizeMode="contain"
      />

      <View style={s.checkWrap}>
        <Text style={s.checkMark}>✓</Text>
      </View>

      <Text style={s.completadoTitle}>¡Viaje completado!</Text>
      <Text style={s.completadoSub}>Excelente servicio, Juan</Text>

      <View style={s.totalesCard}>
        <View style={s.totalesRow}>
          <Text style={s.totalesLbl}>Precio del viaje</Text>
          <Text style={s.totalesVal}>${Number(precioAceptado).toLocaleString('es-CO')}</Text>
        </View>
        <View style={s.totalesSep} />
        <View style={s.totalesRow}>
          <Text style={s.totalesLblRed}>Comisión Deone (9.5%)</Text>
          <Text style={s.totalesValRed}>-${comision.toLocaleString('es-CO')}</Text>
        </View>
        <View style={s.totalesSep} />
        <View style={s.totalesRow}>
          <Text style={s.totalesLblBig}>Total ganado</Text>
          <Text style={s.totalesValBig}>${totalNeto.toLocaleString('es-CO')}</Text>
        </View>
      </View>

      <View style={s.ratingCardComp}>
        <Text style={s.starsRow}>★★★★★</Text>
        <Text style={s.ratingCompLbl}>Calificación del cliente</Text>
      </View>

      <TouchableOpacity style={s.btnVolver} onPress={goHome} activeOpacity={0.85}>
        <Text style={s.btnVolverTxt}>VOLVER AL INICIO</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  /* ── MAPA ── */
  mapFull:    { flex: 1, position: 'relative' },
  absoluteMap:{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },

  /* Pins */
  pinYellow: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: C.yellow,
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     C.yellow,
    shadowOffset:    { width: 0, height: 3 },
    shadowOpacity:   0.5,
    shadowRadius:    6,
    elevation:       5,
  },
  pinBlack: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: C.black,
    alignItems:      'center',
    justifyContent:  'center',
  },
  pinEmoji:     { fontSize: 22 },
  pinDestEmoji: { fontSize: 18 },

  /* Status badge */
  statusBadge: {
    position:        'absolute',
    top:             60,
    left:            16,
    right:           16,
    backgroundColor: C.white,
    borderRadius:    14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection:   'row',
    alignItems:      'center',
    ...SHADOW,
  },
  pulseDot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: C.green,
    marginRight:     8,
  },
  statusTxt: { color: C.black, fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },

  /* Top bar (En viaje) */
  topBar: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    zIndex:          10,
    paddingTop:      52,
    paddingBottom:   12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(17,17,17,0.85)',
  },
  topBarInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topBarLbl:   { color: C.white,  fontSize: 13, fontWeight: '700', letterSpacing: 1.5 },
  topBarTimer: { color: C.yellow, fontSize: 22, fontWeight: '800' },

  /* Bottom sheet */
  bottomSheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius:  28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    paddingTop:        16,
    paddingBottom:     36,
  },

  /* Cliente card */
  clienteCard: {
    backgroundColor: C.white,
    borderRadius:    20,
    padding:         14,
    flexDirection:   'row',
    alignItems:      'center',
    marginBottom:    12,
    ...SHADOW,
  },
  clienteAvatar: {
    width:           48,
    height:          48,
    borderRadius:    24,
    backgroundColor: C.yellow,
    alignItems:      'center',
    justifyContent:  'center',
    marginRight:     12,
  },
  clienteAvatarTxt: { color: C.black, fontSize: 22, fontWeight: '800' },
  clienteInfo:      { flex: 1 },
  clienteNombre:    { color: C.black, fontSize: 16, fontWeight: '700', marginBottom: 2 },
  ratingRow:        { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  star:             { color: C.yellow, fontSize: 13, marginRight: 3 },
  ratingTxt:        { color: C.black, fontSize: 13, fontWeight: '600' },
  origenTxt:        { color: C.gray, fontSize: 11, marginTop: 2 },
  clienteActions:   { flexDirection: 'row', gap: 8 },
  callBtn: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: C.greenBg,
    alignItems:      'center',
    justifyContent:  'center',
  },
  chatBtn: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: C.bg,
    alignItems:      'center',
    justifyContent:  'center',
  },
  callIcon: { fontSize: 18 },
  chatIcon: { fontSize: 18 },

  /* Viaje card */
  viajeCard: {
    backgroundColor: C.white,
    borderRadius:    20,
    padding:         14,
    marginBottom:    12,
    ...SHADOW,
  },
  routeItem:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  dotA:         { width: 10, height: 10, borderRadius: 5, backgroundColor: C.black, marginRight: 12 },
  routeTexts:   { flex: 1 },
  routeLbl:     { color: C.gray, fontSize: 11, marginBottom: 2 },
  routeVal:     { color: C.black, fontSize: 14, fontWeight: '500' },
  routeSep:     { height: 1, backgroundColor: C.border, marginLeft: 22, marginBottom: 8 },
  viajeMetaRow: { flexDirection: 'row', alignItems: 'center' },
  viajeMetaItem:{ flex: 1, alignItems: 'center', paddingVertical: 6 },
  viajeMetaVal: { color: C.black, fontSize: 16, fontWeight: '800', marginBottom: 2 },
  viajeMetaLbl: { color: C.gray, fontSize: 10 },
  viajeMetaDivider: { width: 1, height: 32, backgroundColor: C.border },

  /* Main action button */
  btnMain: {
    backgroundColor: C.yellow,
    borderRadius:    20,
    paddingVertical: 18,
    alignItems:      'center',
  },
  btnMainDis: {
    backgroundColor: C.border,
    borderRadius:    20,
    paddingVertical: 18,
    alignItems:      'center',
  },
  btnMainTxt: { color: C.black, fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  btnNavegar: {
    backgroundColor: C.white,
    borderRadius:    20,
    paddingVertical: 14,
    alignItems:      'center',
    marginTop:       10,
    borderWidth:     2,
    borderColor:     C.yellow,
  },
  btnNavegarTxt: { color: C.black, fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },

  /* ── COMPLETADO ── */
  completadoRoot: {
    flex:            1,
    backgroundColor: C.bg,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 24,
  },
  completadoLogo: {
    height:         28,
    width:          100,
    position:       'absolute',
    top:            52,
    left:           20,
  },
  checkWrap: {
    width:           96,
    height:          96,
    borderRadius:    48,
    backgroundColor: C.yellow,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    20,
    shadowColor:     C.yellow,
    shadowOffset:    { width: 0, height: 6 },
    shadowOpacity:   0.4,
    shadowRadius:    12,
    elevation:       8,
  },
  checkMark:       { color: C.black, fontSize: 48, fontWeight: '900', lineHeight: 52 },
  completadoTitle: { color: C.black, fontSize: 28, fontWeight: '800', marginBottom: 6, letterSpacing: -0.5 },
  completadoSub:   { color: C.gray,  fontSize: 15, marginBottom: 28 },
  totalesCard: {
    backgroundColor: C.white,
    borderRadius:    24,
    padding:         20,
    width:           '100%',
    marginBottom:    16,
    ...SHADOW,
  },
  totalesRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  totalesSep:      { height: 1, backgroundColor: C.border },
  totalesLbl:      { color: C.gray,  fontSize: 14 },
  totalesVal:      { color: C.black, fontSize: 15, fontWeight: '600' },
  totalesLblRed:   { color: C.red,   fontSize: 14 },
  totalesValRed:   { color: C.red,   fontSize: 15, fontWeight: '600' },
  totalesLblBig:   { color: C.black, fontSize: 16, fontWeight: '700' },
  totalesValBig:   { color: C.black, fontSize: 22, fontWeight: '800' },
  ratingCardComp: {
    backgroundColor: C.white,
    borderRadius:    20,
    paddingHorizontal: 24,
    paddingVertical: 14,
    alignItems:      'center',
    width:           '100%',
    marginBottom:    28,
    ...SHADOW,
  },
  starsRow:      { fontSize: 26, color: C.yellow, marginBottom: 4 },
  ratingCompLbl: { color: C.gray, fontSize: 12 },
  btnVolver: {
    backgroundColor: C.yellow,
    borderRadius:    20,
    paddingVertical: 18,
    paddingHorizontal: 48,
    alignItems:      'center',
    width:           '100%',
  },
  btnVolverTxt: { color: C.black, fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
});
