import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Modal,
  StyleSheet, StatusBar, ActivityIndicator, Alert, TextInput,
  Switch, KeyboardAvoidingView, Platform, Image, Linking,
} from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { conductorApi, vehiculoApi, offersApi, locationsApi, servicesApi, billingApi } from '../api/client';
import { SERVICES } from '../constants/services';
import { getUserUuid } from '../utils/tokenStorage';
import { C, SHADOW } from '../constants/theme';

// Etiquetas legibles para el contexto de grúa / acarreo
const LBL = {
  motocarro: 'Motocarro', camioneta: 'Camioneta', camabaja: 'Camabaja',
  turbo: 'Turbo', nh: 'NH', urbana: 'Urbana', intermunicipal: 'Intermunicipal',
};
const lbl = (v) => LBL[v] || v;

// Bloque de detalles específicos de grúa / acarreo que ve el conductor
function DetalleServicio({ solicitud }) {
  if (!solicitud) return null;
  const esGrua = solicitud.tipo_servicio === 'grua';
  const esAcarreo = solicitud.tipo_servicio === 'acarreo';
  if (!esGrua && !esAcarreo) return null;

  const filas = [];
  if (esGrua) {
    if (solicitud.grua_tipo) filas.push(['Tipo de grúa', lbl(solicitud.grua_tipo)]);
    if (solicitud.grua_zona) filas.push(['Zona', lbl(solicitud.grua_zona)]);
    if (solicitud.tipo_vehiculo_varado) filas.push(['Vehículo', solicitud.tipo_vehiculo_varado]);
  }
  if (esAcarreo) {
    if (solicitud.acarreo_tipo) filas.push(['Vehículo', lbl(solicitud.acarreo_tipo)]);
    if (solicitud.peso_estimado_kg) filas.push(['Peso aprox.', `${solicitud.peso_estimado_kg} kg`]);
    filas.push(['Ayudante', solicitud.necesita_ayudante ? 'Sí' : 'No']);
  }

  return (
    <View style={ds.box}>
      {filas.map(([k, v]) => (
        <View key={k} style={ds.row}>
          <Text style={ds.k}>{k}</Text>
          <Text style={ds.v}>{v}</Text>
        </View>
      ))}
      {esGrua && solicitud.tarjeta_propiedad_url && (
        <TouchableOpacity
          style={ds.docBtn}
          onPress={() => Linking.openURL(solicitud.tarjeta_propiedad_url)}
          activeOpacity={0.8}
        >
          <Text style={ds.docBtnTxt}>📄  Ver tarjeta de propiedad</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const ds = StyleSheet.create({
  box: { backgroundColor: '#FFF8DC', borderRadius: 14, padding: 14, marginBottom: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  k: { color: '#888888', fontSize: 13, fontWeight: '600' },
  v: { color: '#111111', fontSize: 14, fontWeight: '700' },
  docBtn: { marginTop: 10, backgroundColor: '#FFFFFF', borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#EEEEEE' },
  docBtnTxt: { color: '#111111', fontSize: 14, fontWeight: '700' },
});

const POLL_INTERVAL = 8000;

// FastAPI puede devolver detail como array (errores 422); Alert no renderiza
// objetos, así que solo usamos detail cuando es texto.
function mensajeDeError(e, fallback) {
  const detalle = e?.response?.data?.detail;
  if (typeof detalle === 'string' && detalle) return detalle;
  return e?.friendlyMessage || e?.message || fallback;
}

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
  const [locationError,  setLocationError]  = useState(false);
  const [selected,       setSelected]       = useState(null);
  const [showContra,     setShowContra]     = useState(false);
  const [precioContra,   setPrecioContra]   = useState('');
  const [loadingAceptar, setLoadingAceptar] = useState(false);
  const [loadingContra,  setLoadingContra]  = useState(false);
  const [pendingOfferId, setPendingOfferId] = useState(null);
  const [esperando,      setEsperando]      = useState(false);
  const [cuentaInactiva, setCuentaInactiva] = useState(false);
  const [saldoBajo,      setSaldoBajo]      = useState(false);
  const uuidRef     = useRef('');
  const locationRef = useRef(null);
  const watchSubRef = useRef(null);
  const modalMapRef = useRef(null);

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
        const { data } = await billingApi.saldo(uuid);
        setCuentaInactiva(data?.estado_cuenta === 'inactivo');
        setSaldoBajo(!!data?.alerta_saldo_bajo);
      } catch {}

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          watchSubRef.current = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.Balanced, timeInterval: 4000, distanceInterval: 15 },
            (loc) => {
              setLocation(loc.coords);
              locationRef.current = loc.coords;
            },
          );
        } else {
          setLocationError(true);
        }
      } catch {
        setLocationError(true);
      }

      setLoading(false);
    })();

    return () => { watchSubRef.current?.remove?.(); };
  }, []);

  useEffect(() => {
    if (!tipoServicio) return;
    doPoll();
    const iv = setInterval(doPoll, POLL_INTERVAL);
    return () => clearInterval(iv);
  }, [tipoServicio]);

  // Vigila la solicitud mientras el cliente decide sobre nuestra contraoferta,
  // por si la notificación push no llega (token FCM desactualizado, etc).
  useEffect(() => {
    if (!pendingOfferId) return;
    const startedAt = Date.now();
    const checkOffer = async () => {
      if (Date.now() - startedAt > 3 * 60 * 1000) {
        setPendingOfferId(null);
        setEsperando(false);
        setSelected(null);
        Alert.alert('Oferta vencida', 'El cliente no respondió a tiempo a tu contraoferta.');
        return;
      }
      try {
        const { data } = await servicesApi.obtener(pendingOfferId);
        if (data?.estado === 'confirmado' && data?.conductor_id === uuidRef.current) {
          setPendingOfferId(null);
          setEsperando(false);
          setSelected(null);
          navigate('EnServicio', { solicitud: data, precioAceptado: data.precio_final || 0 });
        } else if (data?.estado && data.estado !== 'negociando') {
          setPendingOfferId(null);
          setEsperando(false);
          setSelected(null);
          Alert.alert('Oferta no aceptada', 'El cliente no aceptó tu contraoferta.');
        }
      } catch (e) {
        // Errores de red transitorios se reintentan en el próximo poll; si el
        // backend niega el acceso o la solicitud ya no existe, avisamos.
        const status = e?.response?.status;
        if (status === 403 || status === 404) {
          setPendingOfferId(null);
          setEsperando(false);
          setSelected(null);
          Alert.alert(
            'Contraoferta',
            mensajeDeError(e, 'No se pudo consultar el estado de tu contraoferta.'),
          );
        }
      }
    };
    checkOffer();
    const iv = setInterval(checkOffer, 5000);
    return () => clearInterval(iv);
  }, [pendingOfferId]);

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
    const loc = locationRef.current;
    if (val && !loc) {
      Alert.alert('GPS requerido', 'Activa el GPS para conectarte y recibir solicitudes.');
      return;
    }
    onDisponibleChange(val);
    try {
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
    setEsperando(false);
    setPrecioContra('');
  };

  const cerrarModal = () => {
    setSelected(null);
    setShowContra(false);
    setEsperando(false);
    setPrecioContra('');
  };

  // El conductor decide seguir viendo otras carreras mientras el cliente
  // responde a la contraoferta; la oferta sigue activa (pendingOfferId).
  const seguirViendoCarreras = () => {
    setSelected(null);
    setEsperando(false);
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
      const captured = selected;
      cerrarModal();
      navigate('EnServicio', { solicitud: captured, precioAceptado: captured.precio_propuesto });
    } catch (e) {
      const detalle = mensajeDeError(e, 'No se pudo aceptar el viaje.');
      if (e?.response?.status === 403 && detalle.includes('saldo')) setCuentaInactiva(true);
      Alert.alert('No disponible', detalle);
    }
    setLoadingAceptar(false);
  };

  const enviarContraoferta = async () => {
    if (!selected || loadingContra) return;
    const precio = Number(precioContra);
    if (!precio || precio < 1000) {
      Alert.alert('Precio inválido', 'La contraoferta mínima es de $1.000 COP.');
      return;
    }
    setLoadingContra(true);
    try {
      await offersApi.crear({
        request_id:      selected.id,
        conductor_id:    uuidRef.current,
        precio_ofrecido: precio,
        tipo:            'contraoferta',
      });
      setPendingOfferId(selected.id);
      setShowContra(false);
      setEsperando(true);
    } catch (e) {
      const detalle = mensajeDeError(e, 'No se pudo enviar la contraoferta.');
      if (detalle.includes('Ya tienes una oferta activa')) {
        // Nuestra contraoferta anterior sigue vigente: mostrar la espera
        // en lugar de un error.
        setPendingOfferId(selected.id);
        setShowContra(false);
        setEsperando(true);
      } else {
        if (e?.response?.status === 403 && detalle.includes('saldo')) setCuentaInactiva(true);
        Alert.alert('No disponible', detalle);
      }
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

  const fitModalMap = () => {
    if (!modalMapRef.current || !selected || !location) return;
    modalMapRef.current.fitToCoordinates(
      [
        { latitude: location.latitude, longitude: location.longitude },
        { latitude: selected.origen_lat || 5.0703, longitude: selected.origen_lng || -75.5138 },
      ],
      { edgePadding: { top: 50, right: 50, bottom: 50, left: 50 }, animated: true },
    );
  };

  useEffect(() => { fitModalMap(); }, [selected, location]);

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

      {cuentaInactiva && (
        <View style={s.saldoWarn}>
          <Text style={s.saldoWarnTxt}>⚠️ Cuenta pausada por saldo insuficiente. Recarga para aceptar carreras.</Text>
        </View>
      )}
      {!cuentaInactiva && saldoBajo && (
        <View style={s.saldoAlert}>
          <Text style={s.saldoAlertTxt}>💰 Saldo bajo. Recarga pronto para no perder acceso.</Text>
        </View>
      )}

      {locationError && (
        <View style={s.gpsWarn}>
          <Text style={s.gpsWarnTxt}>📍 Activa el GPS para ver la distancia a las solicitudes</Text>
        </View>
      )}

      {pendingOfferId && (
        <View style={s.offerWaitBanner}>
          <ActivityIndicator size="small" color={C.black} />
          <Text style={s.offerWaitTxt}>Esperando respuesta del cliente a tu contraoferta…</Text>
        </View>
      )}

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
        <KeyboardAvoidingView
          style={s.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <View style={s.overlay}>
          {esperando ? (
            <View style={s.modalCard}>
              <View style={s.modalTop}>
                <View style={s.badge}>
                  <Text style={s.badgeTxt}>💰  CONTRAOFERTA ENVIADA</Text>
                </View>
              </View>

              <View style={s.esperandoBox}>
                <ActivityIndicator size="large" color={C.yellow} />
                <Text style={s.esperandoTitle}>Esperando respuesta del cliente</Text>
                <Text style={s.esperandoSub}>
                  Le propusiste ${Number(precioContra).toLocaleString('es-CO')} COP por este viaje.
                </Text>
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

              <TouchableOpacity style={s.btnSecundario} onPress={seguirViendoCarreras} activeOpacity={0.8}>
                <Text style={s.btnSecundarioTxt}>SEGUIR VIENDO CARRERAS</Text>
              </TouchableOpacity>
            </View>
          ) : showContra ? (
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
              {Number(precioContra) < 1000 && (
                <Text style={s.precioErr}>Mínimo $1.000</Text>
              )}

              <View style={s.btnRow}>
                <TouchableOpacity style={s.btnSecundario} onPress={cerrarModal} activeOpacity={0.8}>
                  <Text style={s.btnSecundarioTxt}>CANCELAR</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={Number(precioContra) >= 1000 && !loadingContra ? s.btnPrimario : s.btnDis}
                  onPress={enviarContraoferta}
                  disabled={Number(precioContra) < 1000 || loadingContra}
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

              {location ? (
                <View style={s.mapBox}>
                  <MapView
                    ref={modalMapRef}
                    provider={PROVIDER_GOOGLE}
                    style={s.mapView}
                    onMapReady={fitModalMap}
                    showsMyLocationButton={false}
                    showsCompass={false}
                    toolbarEnabled={false}
                    rotateEnabled={false}
                    pitchEnabled={false}
                    liteMode={false}
                  >
                    <Marker coordinate={{ latitude: location.latitude, longitude: location.longitude }} anchor={{ x: 0.5, y: 0.5 }}>
                      <View style={s.pinDriver}><Text style={s.pinDriverEmoji}>🏍️</Text></View>
                    </Marker>
                    <Marker
                      coordinate={{
                        latitude: selected?.origen_lat || 5.0703,
                        longitude: selected?.origen_lng || -75.5138,
                      }}
                      anchor={{ x: 0.5, y: 1 }}
                    >
                      <View style={s.pinYellow}><Text style={s.pinEmoji}>📍</Text></View>
                    </Marker>
                  </MapView>
                  <View style={s.mapDistBadge}>
                    <Text style={s.mapDistTxt}>{selDist} km de ti</Text>
                  </View>
                </View>
              ) : (
                <View style={s.mapBoxEmpty}>
                  <Text style={s.mapBoxEmptyTxt}>
                    {locationError
                      ? 'Activa el GPS para ver el mapa y la distancia'
                      : 'Obteniendo tu ubicación…'}
                  </Text>
                </View>
              )}

              <ClienteInfo info={selected?.cliente_info} />

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

              <DetalleServicio solicitud={selected} />

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
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

/* Perfil de confianza del cliente: el conductor lo ve antes de aceptar
   para poder distinguir "cliente nuevo sin historial" de "cliente con
   viajes encima" (anti-fraude, especialmente en domicilios). */
function ClienteInfo({ info }) {
  if (!info) return null;
  const viajes  = info.viajes_completados || 0;
  const esNuevo = viajes === 0;
  const antiguedad =
    info.antiguedad_dias == null ? null
    : info.antiguedad_dias < 30  ? `${info.antiguedad_dias} día${info.antiguedad_dias === 1 ? '' : 's'} en Deone`
    : `${Math.floor(info.antiguedad_dias / 30)} mes${Math.floor(info.antiguedad_dias / 30) === 1 ? '' : 'es'} en Deone`;

  return (
    <View style={ci.row}>
      {info.foto_url ? (
        <Image source={{ uri: info.foto_url }} style={ci.foto} />
      ) : (
        <View style={ci.fotoPlaceholder}>
          <Text style={ci.fotoInicial}>{(info.nombre || 'C')[0].toUpperCase()}</Text>
        </View>
      )}
      <View style={ci.textos}>
        <Text style={ci.nombre} numberOfLines={1}>{info.nombre || 'Cliente'}</Text>
        <Text style={ci.detalle}>
          {viajes} viaje{viajes === 1 ? '' : 's'}{antiguedad ? ` · ${antiguedad}` : ''}
        </Text>
      </View>
      {info.identidad_verificada ? (
        <View style={ci.badgeVerificado}>
          <Text style={ci.badgeVerificadoTxt}>✓ Verificado</Text>
        </View>
      ) : esNuevo ? (
        <View style={ci.badgeNuevo}>
          <Text style={ci.badgeNuevoTxt}>Cliente nuevo</Text>
        </View>
      ) : null}
    </View>
  );
}

const ci = StyleSheet.create({
  row: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: C.bg,
    borderRadius:    14,
    padding:         10,
    marginBottom:    12,
  },
  foto:            { width: 42, height: 42, borderRadius: 21, backgroundColor: C.border },
  fotoPlaceholder: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: C.yellow, alignItems: 'center', justifyContent: 'center',
  },
  fotoInicial: { fontSize: 18, fontWeight: '800', color: C.black },
  textos:      { flex: 1, marginLeft: 10 },
  nombre:      { fontSize: 14, fontWeight: '700', color: C.black },
  detalle:     { fontSize: 12, color: C.gray, marginTop: 2 },
  badgeVerificado: {
    backgroundColor: '#E8F8EE', borderRadius: 8, borderWidth: 1,
    borderColor: '#22C55E', paddingHorizontal: 8, paddingVertical: 4,
  },
  badgeVerificadoTxt: { fontSize: 11, fontWeight: '700', color: '#15803D' },
  badgeNuevo: {
    backgroundColor: '#FFF4D6', borderRadius: 8, borderWidth: 1,
    borderColor: '#F5A623', paddingHorizontal: 8, paddingVertical: 4,
  },
  badgeNuevoTxt: { fontSize: 11, fontWeight: '700', color: '#8B6000' },
});

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
        {solicitud.cliente_info && (
          <Text style={rc.cliente} numberOfLines={1}>
            👤 {solicitud.cliente_info.nombre || 'Cliente'} · {solicitud.cliente_info.viajes_completados || 0} viaje{(solicitud.cliente_info.viajes_completados || 0) === 1 ? '' : 's'}
            {solicitud.cliente_info.identidad_verificada ? ' · ✓' : ''}
          </Text>
        )}
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

  /* Avisos de saldo */
  saldoWarn: {
    marginHorizontal:  16,
    marginBottom:      10,
    backgroundColor:   '#FFE5E5',
    borderRadius:      12,
    paddingHorizontal: 12,
    paddingVertical:   10,
    borderWidth:       1,
    borderColor:       '#FF4444',
  },
  saldoWarnTxt: { color: '#CC0000', fontSize: 13, fontWeight: '700' },
  saldoAlert: {
    marginHorizontal:  16,
    marginBottom:      10,
    backgroundColor:   '#FFF4D6',
    borderRadius:      12,
    paddingHorizontal: 12,
    paddingVertical:   8,
    borderWidth:       1,
    borderColor:       '#F5A623',
  },
  saldoAlertTxt: { color: '#8B6000', fontSize: 12, fontWeight: '600' },

  /* Aviso GPS */
  gpsWarn: {
    marginHorizontal: 16,
    marginBottom:     10,
    backgroundColor:  '#FFF4D6',
    borderRadius:     12,
    paddingHorizontal: 12,
    paddingVertical:   8,
  },
  gpsWarnTxt: { color: C.black, fontSize: 12, fontWeight: '600' },

  offerWaitBanner: {
    flexDirection:     'row',
    alignItems:        'center',
    marginHorizontal:  16,
    marginBottom:      10,
    backgroundColor:   C.bg,
    borderRadius:      12,
    paddingHorizontal: 12,
    paddingVertical:   10,
    borderWidth:        1,
    borderColor:        C.border,
  },
  offerWaitTxt: { color: C.black, fontSize: 12, fontWeight: '600', marginLeft: 8, flex: 1 },

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
  kav: { flex: 1 },
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

  /* Mapa modal */
  mapBox: {
    height:       170,
    borderRadius: 16,
    overflow:     'hidden',
    marginBottom: 16,
    position:     'relative',
  },
  mapView: { ...StyleSheet.absoluteFillObject },
  mapBoxEmpty: {
    height:          170,
    borderRadius:    16,
    backgroundColor: C.bg,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    16,
    paddingHorizontal: 20,
  },
  mapBoxEmptyTxt: { color: C.gray, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  mapDistBadge: {
    position:         'absolute',
    bottom:           10,
    alignSelf:        'center',
    backgroundColor:  C.white,
    borderRadius:     14,
    paddingHorizontal: 12,
    paddingVertical:   6,
    ...SHADOW,
  },
  mapDistTxt: { color: C.black, fontSize: 12, fontWeight: '700' },
  pinDriver: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.black,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: C.white,
    ...SHADOW,
  },
  pinDriverEmoji: { fontSize: 18 },
  pinYellow: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.yellow,
    alignItems: 'center', justifyContent: 'center',
    ...SHADOW,
  },
  pinEmoji: { fontSize: 20 },

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

  /* Esperando respuesta */
  esperandoBox:   { alignItems: 'center', paddingVertical: 20 },
  esperandoTitle: { color: C.black, fontSize: 16, fontWeight: '800', marginTop: 14, textAlign: 'center' },
  esperandoSub:   { color: C.gray,  fontSize: 13, marginTop: 6, textAlign: 'center', paddingHorizontal: 10 },

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
  cliente: { color: C.black, fontSize: 12, fontWeight: '600', marginBottom: 6 },
  route:   { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  dotA:    { width: 6, height: 6, borderRadius: 3, backgroundColor: C.yellow, marginRight: 6, flexShrink: 0 },
  dotB:    { width: 6, height: 6, borderRadius: 3, backgroundColor: C.black,  marginRight: 6, flexShrink: 0 },
  addr:    { flex: 1, color: C.black, fontSize: 12, fontWeight: '500' },
  dist:    { color: C.gray, fontSize: 11, marginTop: 2 },
  right:   { alignItems: 'flex-end' },
  precio:  { color: C.black, fontSize: 16, fontWeight: '800' },
  verTxt:  { color: C.yellow, fontSize: 12, fontWeight: '700', marginTop: 4 },
});
