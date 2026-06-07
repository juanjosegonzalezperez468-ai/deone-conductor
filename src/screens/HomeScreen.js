import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, Linking,
  StatusBar, ActivityIndicator, Image, Switch,
} from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { conductorApi, locationsApi, billingApi, vehiculoApi } from '../api/client';
import { getUserUuid } from '../utils/tokenStorage';
import { C, SHADOW } from '../constants/theme';

function isHoy(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr).toDateString() === new Date().toDateString();
}

export default function HomeScreen({ navigate }) {
  const [disponible,    setDisponible]    = useState(false);
  const [tipoServicio,  setTipoServicio]  = useState(null);
  const [location,      setLocation]      = useState(null);
  const [loadingToggle, setLoadingToggle] = useState(false);
  const [saldo,         setSaldo]         = useState(null);
  const [viajesHoy,     setViajesHoy]     = useState(0);
  const [gananciasHoy,  setGananciasHoy]  = useState(0);
  const [nombre,        setNombre]        = useState('');

  const locationRef = useRef(null);
  const mapRef      = useRef(null);
  const uuidRef     = useRef('');

  useEffect(() => { locationRef.current = location; }, [location]);

  useEffect(() => {
    if (!location || !mapRef.current) return;
    mapRef.current.animateToRegion({
      latitude:       location.latitude,
      longitude:      location.longitude,
      latitudeDelta:  0.012,
      longitudeDelta: 0.012,
    }, 800);
  }, [location]);

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
    getUserUuid().then((uuid) => {
      if (uuid) uuidRef.current = uuid;
      fetchSaldo();
      fetchHistorial();
      fetchPerfil();
      fetchVehiculo();
    });
    const iv = setInterval(fetchSaldo, 30000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (saldoInsuficiente && disponible) setDisponible(false);
  }, [saldo]);

  const fetchPerfil = async () => {
    try {
      const { data } = await conductorApi.perfil(uuidRef.current);
      if (data?.nombre) setNombre(data.nombre.split(' ')[0]);
    } catch {}
  };

  const fetchVehiculo = async () => {
    try {
      const { data } = await vehiculoApi.obtener(uuidRef.current);
      if (data?.tipo_servicio) setTipoServicio(data.tipo_servicio);
    } catch {}
  };

  const fetchSaldo = async () => {
    try {
      const { data } = await billingApi.saldo(uuidRef.current);
      const val = typeof data === 'object' ? data.saldo : data;
      if (typeof val === 'number') setSaldo(val);
    } catch {}
  };

  const fetchHistorial = async () => {
    try {
      const { data } = await conductorApi.historial(uuidRef.current);
      if (Array.isArray(data)) {
        const hoy = data.filter(v => isHoy(v.created_at));
        setViajesHoy(hoy.length);
        setGananciasHoy(hoy.reduce((a, v) => a + (v.precio_final || 0), 0));
      }
    } catch {}
  };

  useEffect(() => {
    if (!location) return;
    locationsApi.actualizar({
      conductor_id:      uuidRef.current,
      lat:               location.latitude,
      lng:               location.longitude,
      disponible,
      servicios_activos: disponible && tipoServicio ? [tipoServicio] : [],
    }).catch(() => {});
  }, [disponible, location, tipoServicio]);

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

  const saldoBajo         = saldo !== null && saldo < 2000;
  const saldoInsuficiente = saldo !== null && saldo < 1000;

  return (
    <View style={s.root}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />

      {/* ── HEADER ── */}
      <View style={s.header}>
        <Image source={require('../../assets/logo.png')} style={s.logo} resizeMode="contain" />
        <View style={s.headerRight}>
          <Text style={s.hola}>Hola {nombre || 'Conductor'} 👋</Text>
          <Text style={s.ciudad}>Manizales 📍</Text>
        </View>
      </View>

      {/* ── SALDO BAJO ── */}
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

      {/* ── CARDS ── */}
      <View style={s.cardsWrap}>

        {/* Toggle disponible */}
        <View style={disponible ? s.toggleOn : s.toggleOff}>
          <View style={s.toggleLeft}>
            <View style={disponible ? s.dotOn : s.dotOff} />
            <View style={s.toggleInfo}>
              <Text style={disponible ? s.toggleTitleOn : s.toggleTitleOff}>
                {disponible ? 'DISPONIBLE' : 'NO DISPONIBLE'}
              </Text>
              <Text style={s.toggleSub}>
                {disponible
                  ? 'Tu ubicación está activa'
                  : saldoInsuficiente ? 'Saldo insuficiente' : 'Activa para compartir ubicación'}
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

      {/* ── MAPA ── */}
      <View style={s.mapArea}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={s.map}
          initialRegion={{
            latitude:       location?.latitude  ?? 5.0703,
            longitude:      location?.longitude ?? -75.5138,
            latitudeDelta:  0.012,
            longitudeDelta: 0.012,
          }}
          showsMyLocationButton={false}
          showsCompass={false}
          toolbarEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
        >
          {location && (
            <Marker
              coordinate={{ latitude: location.latitude, longitude: location.longitude }}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={disponible ? s.pinBgOn : s.pinBgOff}>
                <Text style={s.pinEmoji}>🏍️</Text>
              </View>
            </Marker>
          )}
        </MapView>
        <View style={s.coordBadge}>
          <Text style={s.coordTxt}>
            {location
              ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
              : 'Obteniendo ubicación…'}
          </Text>
        </View>
      </View>

    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 20,
    paddingTop:        52,
    paddingBottom:     14,
    backgroundColor:   C.bg,
  },
  logo:        { height: 30, width: 110 },
  headerRight: { alignItems: 'flex-end' },
  hola:        { color: C.black, fontSize: 15, fontWeight: '700' },
  ciudad:      { color: C.gray,  fontSize: 13, marginTop: 2 },

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
  saldoBannerIcon:   { fontSize: 20, marginRight: 10 },
  saldoBannerTexts:  { flex: 1 },
  saldoBannerTitle:  { color: '#7A5C00', fontSize: 13, fontWeight: '700' },
  saldoBannerSub:    { color: '#7A5C00', fontSize: 11 },
  saldoBannerBtn:    {
    backgroundColor:  C.yellow,
    borderRadius:     10,
    paddingHorizontal: 10,
    paddingVertical:  6,
    marginLeft:       8,
  },
  saldoBannerBtnTxt: { color: C.black, fontSize: 12, fontWeight: '700' },

  cardsWrap: { paddingHorizontal: 16, gap: 10, marginBottom: 12 },

  toggleOff: {
    backgroundColor: C.white,
    borderRadius:    24,
    padding:         18,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    ...SHADOW,
  },
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
  dotOn:           { width: 10, height: 10, borderRadius: 5, backgroundColor: C.green,   marginRight: 12 },
  toggleInfo:      { flex: 1 },
  toggleTitleOff:  { color: C.gray,    fontSize: 16, fontWeight: '800', letterSpacing: 0.3, marginBottom: 3 },
  toggleTitleOn:   { color: '#15803D', fontSize: 16, fontWeight: '800', letterSpacing: 0.3, marginBottom: 3 },
  toggleSub:       { color: C.gray, fontSize: 12 },

  gananciasCard: {
    backgroundColor:   C.white,
    borderRadius:      24,
    paddingHorizontal: 20,
    paddingVertical:   14,
    ...SHADOW,
  },
  gananciasLbl:    { color: C.gray,  fontSize: 11, fontWeight: '600', letterSpacing: 1.5, marginBottom: 2 },
  gananciasAmt:    { color: C.black, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  gananciasViajes: { color: C.gray,  fontSize: 12, marginTop: 2 },

  mapArea: {
    flex:             1,
    marginHorizontal: 16,
    marginBottom:     16,
    borderRadius:     24,
    overflow:         'hidden',
    ...SHADOW,
  },
  map: { flex: 1 },
  pinBgOff: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#CCCCCC',
    alignItems: 'center', justifyContent: 'center',
  },
  pinBgOn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: C.yellow,
    alignItems: 'center', justifyContent: 'center',
    shadowColor:   C.yellow,
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius:  8,
    elevation:     6,
  },
  pinEmoji: { fontSize: 24 },
  coordBadge: {
    position:          'absolute',
    bottom:            12,
    left:              12,
    backgroundColor:   'rgba(255,255,255,0.85)',
    borderRadius:      10,
    paddingHorizontal: 10,
    paddingVertical:   4,
  },
  coordTxt: { color: C.black, fontSize: 11, fontWeight: '500' },
});
