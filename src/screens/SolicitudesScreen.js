import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Modal,
  StyleSheet, StatusBar, ActivityIndicator, Alert, TextInput,
  Switch,
} from 'react-native';
import * as Location from 'expo-location';
import { conductorApi, vehiculoApi, offersApi, locationsApi } from '../api/client';
import { SERVICES } from '../constants/services';
import { getUserUuid } from '../utils/tokenStorage';
import { C, SHADOW } from '../constants/theme';

const POLL_INTERVAL = 8000;

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

export default function SolicitudesScreen({ navigate, isAdmin, disponible, onDisponibleChange, onMenuPress }) {
  const [solicitudes,    setSolicitudes]    = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [tipoServicio,   setTipoServicio]   = useState(null);
  const [location,       setLocation]       = useState(null);
  const [selected,       setSelected]       = useState(null);
  const [showContra,     setShowContra]     = useState(false);
  const [precioContra,   setPrecioContra]   = useState('');
  const [loadingAceptar, setLoadingAceptar] = useState(false);
  const [loadingContra,  setLoadingContra]  = useState(false);
  const uuidRef     = useRef('');
  const locationRef = useRef(null);

  useEffect(() => { locationRef.current = location; }, [location]);

  useEffect(() => {
    (async () => {
      const uuid = await getUserUuid();
      if (uuid) uuidRef.current = uuid;

      try {
        const { data } = await vehiculoApi.obtener(uuid);
        if (data?.tipo_servicio) setTipoServicio(data.tipo_servicio);
      } catch {}

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setLocation(loc.coords);
          locationRef.current = loc.coords;
        }
      } catch {}

      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!tipoServicio) return;
    doPoll();
    const iv = setInterval(doPoll, POLL_INTERVAL);
    return () => clearInterval(iv);
  }, [tipoServicio]);

  const doPoll = async () => {
    const loc = locationRef.current;
    try {
      const params = loc
        ? { lat: loc.latitude, lng: loc.longitude, radio_km: 5 }
        : { radio_km: 5 };
      const { data } = await conductorApi.pendientes(tipoServicio, params);
      setSolicitudes((data?.solicitudes || []).filter(s => s.estado === 'pendiente'));
    } catch {}
  };

  const toggleDisponible = async (val) => {
    onDisponibleChange(val);
    try {
      const loc = locationRef.current;
      await locationsApi.actualizar({
        conductor_id:      uuidRef.current,
        lat:               loc?.latitude  || 5.0703,
        lng:               loc?.longitude || -75.5138,
        disponible:        val,
        servicios_activos: tipoServicio ? [tipoServicio] : [],
      });
    } catch {}
  };

  const abrirDetalle = (sol) => {
    setSelected(sol);
    setShowContra(false);
    setPrecioContra('');
  };

  const cerrarModal = () => {
    setSelected(null);
    setShowContra(false);
    setPrecioContra('');
  };

  const aceptarViaje = async () => {
    if (loadingAceptar || !selected) return;
    setLoadingAceptar(true);
    try {
      await offersApi.crear({
        conductor_id:    uuidRef.current,
        request_id:      selected.id,
        precio_ofrecido: selected.precio_propuesto,
        tipo:            'acepta',
      });
      await conductorApi.estadoViaje(selected.id, 'confirmado', { conductor_id: uuidRef.current });
      const captured = selected;
      cerrarModal();
      navigate('EnServicio', { solicitud: captured, precioAceptado: captured.precio_propuesto });
    } catch {
      Alert.alert('Error', 'No se pudo aceptar el viaje. Intenta de nuevo.');
    }
    setLoadingAceptar(false);
  };

  const enviarContraoferta = async () => {
    const precio = Number(precioContra);
    if (precio < 1000 || !selected || loadingContra) return;
    setLoadingContra(true);
    try {
      await offersApi.crear({
        request_id:      selected.id,
        conductor_id:    uuidRef.current,
        precio_ofrecido: precio,
        tipo:            'contraoferta',
      });
      cerrarModal();
    } catch {
      Alert.alert('Error', 'No se pudo enviar la contraoferta.');
    }
    setLoadingContra(false);
  };

  const selSrv  = selected
    ? SERVICES.find(s => s.id === (selected.tipo_servicio || 'moto_pasajero'))
    : null;
  const selDist = location && selected
    ? haversineKm(
        location.latitude, location.longitude,
        selected.origen_lat  || 5.0703,
        selected.origen_lng  || -75.5138,
      ).toFixed(1)
    : '—';

  return (
    <View style={s.root}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />

      {/* ── HEADER ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={onMenuPress} style={s.menuBtn} activeOpacity={0.7}>
          <View style={s.bar} />
          <View style={s.bar} />
          <View style={s.bar} />
        </TouchableOpacity>

        <Text style={s.heading}>Carreras</Text>

        <View style={s.disponibleWrap}>
          <Text style={disponible ? s.activoLbl : s.inactivoLbl}>
            {disponible ? 'ACTIVO' : 'INACTIVO'}
          </Text>
          <Switch
            value={disponible}
            onValueChange={toggleDisponible}
            trackColor={{ false: C.border, true: C.green }}
            thumbColor={C.white}
            ios_backgroundColor={C.border}
          />
        </View>
      </View>

      {/* ── CONTENIDO ── */}
      {loading ? (
        <View style={s.emptyWrap}>
          <ActivityIndicator size="large" color={C.yellow} />
          <Text style={s.emptySub}>Buscando carreras…</Text>
        </View>
      ) : !tipoServicio ? (
        <View style={s.emptyWrap}>
          <Text style={s.emptyIcon}>🏍️</Text>
          <Text style={s.emptyTitle}>Sin vehículo configurado</Text>
          <Text style={s.emptySub}>
            Abre el menú (≡) y ve a Cuenta para registrar tu vehículo.
          </Text>
        </View>
      ) : (
        <FlatList
          data={solicitudes}
          keyExtractor={item => item.id?.toString()}
          contentContainerStyle={solicitudes.length === 0 ? s.listEmpty : s.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            solicitudes.length > 0 && (
              <View style={s.badgeRow}>
                <View style={s.badge}>
                  <Text style={s.badgeTxt}>
                    {solicitudes.length} disponible{solicitudes.length !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
            )
          }
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Text style={s.emptyIcon}>🔍</Text>
              <Text style={s.emptyTitle}>Sin carreras por ahora</Text>
              <Text style={s.emptySub}>La lista se actualiza automáticamente cada 8 segundos.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <RideCard
              solicitud={item}
              location={location}
              onPress={() => abrirDetalle(item)}
            />
          )}
        />
      )}

      {/* ── MODAL DETALLE ── */}
      <Modal visible={!!selected} transparent animationType="slide">
        <View style={s.overlay}>
          {showContra ? (
            <View style={s.modalCard}>
              <View style={s.modalTop}>
                <View style={s.badge}>
                  <Text style={s.badgeTxt}>💰  CONTRAOFERTA</Text>
                </View>
                <Text style={s.contraRef}>
                  Cliente: ${Number(selected?.precio_propuesto || 0).toLocaleString('es-CO')}
                </Text>
              </View>

              <Text style={s.contraLabel}>Tu precio propuesto</Text>

              <View style={s.precioRow}>
                <Text style={s.precioSym}>$</Text>
                <TextInput
                  style={s.precioField}
                  value={precioContra}
                  onChangeText={v => setPrecioContra(v.replace(/\D/g, ''))}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#AAAAAA"
                  maxLength={7}
                  autoFocus
                />
                <Text style={s.precioCOP}>COP</Text>
              </View>

              {Number(precioContra) > 0 && (
                <Text style={s.precioFmt}>
                  ${Number(precioContra).toLocaleString('es-CO')} COP
                </Text>
              )}
              {Number(precioContra) > 0 && Number(precioContra) < 1000 && (
                <Text style={s.precioErr}>Mínimo $1.000</Text>
              )}

              <View style={s.btnRow}>
                <TouchableOpacity style={s.btnSecundario} onPress={cerrarModal} activeOpacity={0.8}>
                  <Text style={s.btnSecundarioTxt}>CANCELAR</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={Number(precioContra) >= 1000 && !loadingContra ? s.btnPrimario : s.btnDis}
                  onPress={enviarContraoferta}
                  activeOpacity={0.85}
                >
                  {loadingContra
                    ? <ActivityIndicator color={C.black} size="small" />
                    : <Text style={s.btnPrimarioTxt}>ENVIAR</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={s.modalCard}>
              <View style={s.modalTop}>
                {selSrv && (
                  <View style={s.srvRow}>
                    <View style={s.srvIconWrap}>
                      <Text style={s.srvEmoji}>{selSrv.icon}</Text>
                    </View>
                    <Text style={s.srvName}>{selSrv.label}</Text>
                  </View>
                )}
                <TouchableOpacity onPress={cerrarModal} style={s.closeBtn}>
                  <Text style={s.closeTxt}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={s.routeBox}>
                <View style={s.routeItem}>
                  <View style={s.dotA} />
                  <View style={s.routeTexts}>
                    <Text style={s.routeLabel}>Origen</Text>
                    <Text style={s.routeVal} numberOfLines={2}>
                      {selected?.origen_direccion || '—'}
                    </Text>
                  </View>
                </View>
                <View style={s.routeSep} />
                <View style={s.routeItem}>
                  <View style={s.dotB} />
                  <View style={s.routeTexts}>
                    <Text style={s.routeLabel}>Destino</Text>
                    <Text style={s.routeVal} numberOfLines={2}>
                      {selected?.destino_direccion || '—'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={s.metaRow}>
                <View style={s.metaItem}>
                  <Text style={s.metaVal}>
                    ${Number(selected?.precio_propuesto || 0).toLocaleString('es-CO')}
                  </Text>
                  <Text style={s.metaLbl}>Precio cliente</Text>
                </View>
                <View style={s.metaDivider} />
                <View style={s.metaItem}>
                  <Text style={s.metaVal}>{selDist} km</Text>
                  <Text style={s.metaLbl}>Distancia a ti</Text>
                </View>
              </View>

              <View style={s.btnRow}>
                <TouchableOpacity
                  style={s.btnSecundario}
                  onPress={() => setShowContra(true)}
                  activeOpacity={0.8}
                >
                  <Text style={s.btnSecundarioTxt}>CONTRAOFERTAR</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={loadingAceptar ? s.btnDis : s.btnPrimario}
                  onPress={aceptarViaje}
                  activeOpacity={0.85}
                >
                  {loadingAceptar
                    ? <ActivityIndicator color={C.black} size="small" />
                    : <Text style={s.btnPrimarioTxt}>ACEPTAR</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>

    </View>
  );
}

function RideCard({ solicitud, location, onPress }) {
  const srv  = SERVICES.find(s => s.id === (solicitud.tipo_servicio || 'moto_pasajero'));
  const dist = location
    ? haversineKm(
        location.latitude, location.longitude,
        solicitud.origen_lat || 5.0703,
        solicitud.origen_lng || -75.5138,
      ).toFixed(1)
    : null;

  return (
    <TouchableOpacity style={rc.card} onPress={onPress} activeOpacity={0.85}>
      <View style={rc.left}>
        <View style={rc.iconWrap}>
          <Text style={rc.icon}>{srv?.icon || '🚗'}</Text>
        </View>
      </View>

      <View style={rc.info}>
        <Text style={rc.srvName}>{srv?.label || 'Servicio'}</Text>
        <View style={rc.route}>
          <View style={rc.dotA} />
          <Text style={rc.addr} numberOfLines={1}>{solicitud.origen_direccion || 'Origen'}</Text>
        </View>
        <View style={rc.route}>
          <View style={rc.dotB} />
          <Text style={rc.addr} numberOfLines={1}>{solicitud.destino_direccion || 'Destino'}</Text>
        </View>
        {dist && <Text style={rc.dist}>{dist} km de ti</Text>}
      </View>

      <View style={rc.right}>
        <Text style={rc.precio}>
          ${Number(solicitud.precio_propuesto || 0).toLocaleString('es-CO')}
        </Text>
        <Text style={rc.verTxt}>Ver →</Text>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  /* Header */
  header: {
    paddingHorizontal: 12,
    paddingTop:        52,
    paddingBottom:     14,
    backgroundColor:   C.bg,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
  },
  menuBtn:  { padding: 10, justifyContent: 'center' },
  bar:      { width: 22, height: 2.5, backgroundColor: C.black, borderRadius: 2, marginVertical: 2.5 },
  heading:  { color: C.black, fontSize: 24, fontWeight: '800', letterSpacing: -0.5, flex: 1, textAlign: 'center' },
  disponibleWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  activoLbl:   { color: C.green, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  inactivoLbl: { color: C.gray,  fontSize: 10, fontWeight: '600', letterSpacing: 0.8 },

  /* Badge */
  badgeRow:  { paddingHorizontal: 4, paddingBottom: 10 },
  badge: {
    backgroundColor:  C.yellow,
    borderRadius:     12,
    paddingHorizontal: 10,
    paddingVertical:   4,
    alignSelf:         'flex-start',
  },
  badgeTxt:  { color: C.black, fontSize: 12, fontWeight: '700' },

  listContent: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 4 },
  listEmpty:   { flex: 1 },

  emptyWrap:  { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyIcon:  { fontSize: 52, marginBottom: 16 },
  emptyTitle: { color: C.black, fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  emptySub:   { color: C.gray,  fontSize: 13, textAlign: 'center', lineHeight: 20 },

  /* Modal */
  overlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.55)',
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
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   16,
  },
  srvRow:    { flexDirection: 'row', alignItems: 'center' },
  srvIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.yellow,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  srvEmoji: { fontSize: 20 },
  srvName:  { color: C.black, fontSize: 16, fontWeight: '700' },
  closeBtn: { padding: 8 },
  closeTxt: { color: C.gray, fontSize: 18, fontWeight: '700' },

  routeBox: {
    backgroundColor:   C.bg,
    borderRadius:      16,
    paddingHorizontal: 14,
    paddingVertical:   2,
    marginBottom:      16,
  },
  routeItem:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  dotA:       { width: 10, height: 10, borderRadius: 5, backgroundColor: C.yellow, marginRight: 12, flexShrink: 0 },
  dotB:       { width: 10, height: 10, borderRadius: 5, backgroundColor: C.black,  marginRight: 12, flexShrink: 0 },
  routeTexts: { flex: 1 },
  routeLabel: { color: C.gray,  fontSize: 11, marginBottom: 2 },
  routeVal:   { color: C.black, fontSize: 14, fontWeight: '500' },
  routeSep:   { height: 1, backgroundColor: C.border, marginLeft: 22 },

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
  metaLbl:     { color: C.gray,  fontSize: 11 },
  metaDivider: { width: 1, height: 36, backgroundColor: C.border },

  btnRow:         { flexDirection: 'row', gap: 10 },
  btnSecundario:  {
    flex: 1, backgroundColor: C.bg, borderRadius: 16,
    paddingVertical: 16, alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  btnSecundarioTxt: { color: C.gray,  fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  btnPrimario:    {
    flex: 1, backgroundColor: C.yellow, borderRadius: 16,
    paddingVertical: 16, alignItems: 'center',
  },
  btnDis:         {
    flex: 1, backgroundColor: C.border, borderRadius: 16,
    paddingVertical: 16, alignItems: 'center',
  },
  btnPrimarioTxt: { color: C.black, fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },

  /* Contraoferta */
  contraRef:   { color: C.gray, fontSize: 13 },
  contraLabel: { color: C.gray, fontSize: 12, fontWeight: '600', letterSpacing: 1, marginTop: 14, marginBottom: 8 },
  precioRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.bg, borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 4,
    marginBottom: 8, borderWidth: 2, borderColor: C.yellow,
  },
  precioSym:   { color: C.black, fontSize: 24, fontWeight: '800', marginRight: 4 },
  precioField: { flex: 1, color: C.black, fontSize: 28, fontWeight: '800', paddingVertical: 10 },
  precioCOP:   { color: C.gray, fontSize: 14, fontWeight: '600', marginLeft: 4 },
  precioFmt:   { color: C.gray, fontSize: 13, textAlign: 'center', marginBottom: 4 },
  precioErr:   { color: C.red,  fontSize: 12, textAlign: 'center', marginBottom: 8 },

});

const rc = StyleSheet.create({
  card: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: C.white,
    borderRadius:    20,
    padding:         14,
    marginBottom:    10,
    ...SHADOW,
  },
  left:    { marginRight: 12 },
  iconWrap: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#FFF8DC',
    alignItems: 'center', justifyContent: 'center',
  },
  icon:    { fontSize: 24 },
  info:    { flex: 1, marginRight: 10 },
  srvName: { color: C.gray,  fontSize: 11, fontWeight: '600', marginBottom: 6, letterSpacing: 0.5 },
  route:   { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  dotA:    { width: 6, height: 6, borderRadius: 3, backgroundColor: C.yellow, marginRight: 6, flexShrink: 0 },
  dotB:    { width: 6, height: 6, borderRadius: 3, backgroundColor: C.black,  marginRight: 6, flexShrink: 0 },
  addr:    { flex: 1, color: C.black, fontSize: 12, fontWeight: '500' },
  dist:    { color: C.gray, fontSize: 11, marginTop: 2 },
  right:   { alignItems: 'flex-end' },
  precio:  { color: C.black, fontSize: 16, fontWeight: '800' },
  verTxt:  { color: C.yellow, fontSize: 12, fontWeight: '700', marginTop: 4 },
});
