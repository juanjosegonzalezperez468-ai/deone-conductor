import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, StatusBar, ActivityIndicator, Alert, Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { rutasApi } from '../api/client';
import { C, SHADOW } from '../constants/theme';

const MIN_ESPERA_FALLIDA = 5; // minutos de espera antes de poder marcar fallida

const MOTIVOS_ESPERA = [
  { id: 'pedido_no_listo',  label: 'El pedido no está listo' },
  { id: 'no_contesta',      label: 'El destinatario no contesta' },
  { id: 'direccion_errada', label: 'La dirección está errada' },
];

const fmtCOP = (n) => Number(n || 0).toLocaleString('es-CO');

const navegarA = (lat, lng, direccion) => {
  const dest = direccion ? encodeURIComponent(direccion) : `${lat},${lng}`;
  const gmaps = `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
  Linking.openURL(gmaps).catch(() => Linking.openURL(`geo:${lat},${lng}`));
};

const minutosDesde = (iso) => {
  if (!iso) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
};

export default function RutaActivaScreen({ params, navigate, goHome }) {
  const { rutaId } = params;
  const [ruta, setRuta]           = useState(null);
  const [procesando, setProcesando] = useState(null); // id de acción en curso
  const [resumen, setResumen]     = useState(null);   // respuesta de finalizar
  const [estrellas, setEstrellas] = useState(0);
  const [comentario, setComentario] = useState('');
  const [calificada, setCalificada] = useState(false);
  const [tick, setTick]           = useState(0);      // refresca contadores de espera
  const pollRef = useRef(null);

  const cargar = async () => {
    try {
      const { data } = await rutasApi.obtener(rutaId);
      setRuta(data);
      if (data?.estado === 'cancelada_cliente') {
        clearInterval(pollRef.current);
        Alert.alert(
          'Ruta cancelada por el cliente',
          'No se te aplica ninguna penalización.',
          [{ text: 'Entendido', onPress: goHome }],
        );
      }
    } catch {}
  };

  useEffect(() => {
    cargar();
    pollRef.current = setInterval(cargar, 10000);
    const tickIv = setInterval(() => setTick((t) => t + 1), 30000);
    return () => { clearInterval(pollRef.current); clearInterval(tickIv); };
  }, [rutaId]);

  const errorDe = (e, fallback) => {
    const d = e?.response?.data?.detail;
    return typeof d === 'string' && d ? d : (e?.friendlyMessage || fallback);
  };

  /* ── Transiciones de fase ── */

  const iniciarRecogida = async () => {
    if (procesando) return;
    setProcesando('fase');
    try {
      await rutasApi.iniciarRecogida(rutaId);
      await cargar();
    } catch (e) {
      Alert.alert('Error', errorDe(e, 'No se pudo iniciar la recogida.'));
    }
    setProcesando(null);
  };

  const iniciarReparto = async () => {
    if (procesando) return;
    setProcesando('fase');
    try {
      await rutasApi.iniciarReparto(rutaId);
      await cargar();
    } catch (e) {
      Alert.alert('Error', errorDe(e, 'No se pudo iniciar el reparto.'));
    }
    setProcesando(null);
  };

  /* ── Espera causada por el cliente ── */

  const iniciarEspera = (parada) => {
    Alert.alert(
      'Iniciar contador de espera',
      'Solo el tiempo causado por el cliente se cobra como excedente. ¿Cuál es el motivo?',
      [
        ...MOTIVOS_ESPERA.map((m) => ({
          text: m.label,
          onPress: async () => {
            try {
              await rutasApi.espera(rutaId, parada.id, 'iniciar', m.id);
              await cargar();
            } catch (e) {
              Alert.alert('Error', errorDe(e, 'No se pudo iniciar la espera.'));
            }
          },
        })),
        { text: 'Cancelar', style: 'cancel' },
      ],
    );
  };

  const detenerEspera = async (parada) => {
    try {
      await rutasApi.espera(rutaId, parada.id, 'detener');
      await cargar();
    } catch (e) {
      Alert.alert('Error', errorDe(e, 'No se pudo detener la espera.'));
    }
  };

  /* ── Foto + entregar / fallida ── */

  const tomarYSubirFoto = async (parada) => {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (permiso.status !== 'granted') {
      Alert.alert('Cámara requerida', 'Activa el permiso de cámara para registrar la entrega.');
      return null;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
    });
    if (result.canceled || !result.assets?.length) return null;

    const formData = new FormData();
    formData.append('archivo', {
      uri:  result.assets[0].uri,
      type: 'image/jpeg',
      name: 'entrega.jpg',
    });
    const { data } = await rutasApi.subirFoto(rutaId, parada.id, formData);
    return data.path;
  };

  const entregarParada = async (parada) => {
    if (procesando) return;
    setProcesando(parada.id);
    try {
      const fotoPath = await tomarYSubirFoto(parada);
      if (!fotoPath) { setProcesando(null); return; }
      await rutasApi.entregar(rutaId, parada.id, fotoPath);
      await cargar();
    } catch (e) {
      Alert.alert('Error', errorDe(e, 'No se pudo registrar la entrega.'));
    }
    setProcesando(null);
  };

  const fallarParada = (parada) => {
    if (procesando) return;
    const esperados = (parada.espera_cliente_min || 0) + minutosDesde(parada.espera_inicio);
    if (esperados < MIN_ESPERA_FALLIDA) {
      Alert.alert(
        'Espera requerida',
        `Antes de marcar la entrega como fallida debes esperar ${MIN_ESPERA_FALLIDA} minutos con el contador activo ` +
        `(llevas ${esperados} min). Inicia la espera con el botón ⏱.`,
      );
      return;
    }
    Alert.alert(
      'Entrega fallida',
      'Toma una foto de evidencia en el lugar. El pedido se devuelve al punto de recogida al final. ¿Motivo?',
      [
        ...MOTIVOS_ESPERA.map((m) => ({
          text: m.label,
          onPress: async () => {
            setProcesando(parada.id);
            try {
              const fotoPath = await tomarYSubirFoto(parada);
              if (!fotoPath) { setProcesando(null); return; }
              await rutasApi.fallida(rutaId, parada.id, fotoPath, m.label);
              await cargar();
            } catch (e) {
              Alert.alert('Error', errorDe(e, 'No se pudo registrar el fallo.'));
            }
            setProcesando(null);
          },
        })),
        { text: 'Cancelar', style: 'cancel' },
      ],
    );
  };

  /* ── Finalizar / cancelar ── */

  const finalizar = async () => {
    if (procesando) return;
    setProcesando('finalizar');
    try {
      const { data } = await rutasApi.finalizar(rutaId);
      clearInterval(pollRef.current);
      setResumen(data);
    } catch (e) {
      Alert.alert('Error', errorDe(e, 'No se pudo finalizar la ruta.'));
    }
    setProcesando(null);
  };

  const confirmarFinalizar = (fallidasPend) => {
    if (fallidasPend > 0) {
      Alert.alert(
        'Devolución de pedidos',
        `Tienes ${fallidasPend} pedido(s) fallido(s). Devuélvelos al punto de recogida y luego finaliza ` +
        '(la devolución se cobra al cliente como una parada adicional).',
        [
          { text: 'Aún no', style: 'cancel' },
          { text: 'Ya los devolví — finalizar', onPress: finalizar },
        ],
      );
    } else {
      Alert.alert(
        'Finalizar ruta',
        'Se calculará el valor final (con el tiempo extra si lo hubo) y se descontará la comisión de tu saldo. Cobra en efectivo al comercio.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Finalizar', onPress: finalizar },
        ],
      );
    }
  };

  const cancelarRuta = () => {
    Alert.alert(
      'Cancelar ruta',
      'Cancelar una ruta aceptada descuenta $5.000 de tu saldo. Si es tu 2ª cancelación del mes se suma 1 día de suspensión, y desde la 3ª son 3 días. ¿Seguro?',
      [
        { text: 'No, continuar', style: 'cancel' },
        {
          text: 'Sí, cancelar la ruta',
          style: 'destructive',
          onPress: async () => {
            setProcesando('cancelar');
            try {
              await rutasApi.cancelar(rutaId, 'Cancelada por el conductor');
              goHome();
            } catch (e) {
              Alert.alert('Error', errorDe(e, 'No se pudo cancelar.'));
            }
            setProcesando(null);
          },
        },
      ],
    );
  };

  const calificarCliente = async () => {
    if (!estrellas || procesando) return;
    setProcesando('calificar');
    try {
      await rutasApi.calificarCliente(rutaId, estrellas, comentario.trim() || null);
      setCalificada(true);
    } catch (e) {
      const msg = errorDe(e, 'No se pudo calificar.');
      if (msg.includes('Ya calificaste')) setCalificada(true);
      else Alert.alert('Error', msg);
    }
    setProcesando(null);
  };

  /* ── Render ── */

  if (!ruta) {
    return (
      <View style={s.loadingWrap}>
        <ActivityIndicator size="large" color={C.yellow} />
      </View>
    );
  }

  /* Resumen final tras finalizar */
  if (resumen || ruta.estado === 'finalizada') {
    const r = resumen || {};
    const gananciaNeta = r.ganancia_neta ?? ((ruta.valor_final || ruta.precio_total) - (ruta.comision || 0));
    return (
      <View style={s.root}>
        <StatusBar backgroundColor={C.bg} barStyle="dark-content" />
        <ScrollView contentContainerStyle={s.finalContent} showsVerticalScrollIndicator={false}>
          <View style={s.finalCircle}><Text style={s.finalIcon}>🏁</Text></View>
          <Text style={s.finalTitle}>Ruta finalizada</Text>

          <View style={s.finalCard}>
            <View style={s.finalRow}>
              <Text style={s.finalLbl}>Cobra al comercio (efectivo)</Text>
              <Text style={s.finalVal}>${fmtCOP(r.valor_final || ruta.valor_final || ruta.precio_total)}</Text>
            </View>
            {(r.valor_excedente || ruta.valor_excedente) > 0 && (
              <View style={s.finalRow}>
                <Text style={s.finalLbl}>Incluye tiempo extra</Text>
                <Text style={s.finalVal}>+${fmtCOP(r.valor_excedente || ruta.valor_excedente)}</Text>
              </View>
            )}
            <View style={s.finalRow}>
              <Text style={s.finalLbl}>Comisión Deone (descontada del saldo)</Text>
              <Text style={s.finalValRojo}>−${fmtCOP(r.comision || ruta.comision)}</Text>
            </View>
            <View style={s.finalTotalRow}>
              <Text style={s.finalTotalLbl}>Tu ganancia neta</Text>
              <Text style={s.finalTotalVal}>${fmtCOP(gananciaNeta)}</Text>
            </View>
          </View>

          <View style={s.finalCard}>
            {calificada ? (
              <Text style={s.graciasTxt}>⭐ ¡Gracias por calificar al cliente!</Text>
            ) : (
              <>
                <Text style={s.finalCardTitle}>CALIFICA AL CLIENTE</Text>
                <View style={s.starsRow}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <TouchableOpacity key={n} onPress={() => setEstrellas(n)} activeOpacity={0.7}>
                      <Text style={n <= estrellas ? s.starOn : s.starOff}>★</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={s.comentarioInput}
                  placeholder="Comentario (opcional)"
                  placeholderTextColor="#AAAAAA"
                  value={comentario}
                  onChangeText={setComentario}
                  multiline
                />
                <TouchableOpacity
                  style={estrellas && procesando !== 'calificar' ? s.btnPrimario : s.btnDis}
                  onPress={calificarCliente}
                  disabled={!estrellas || procesando === 'calificar'}
                  activeOpacity={0.85}
                >
                  {procesando === 'calificar'
                    ? <ActivityIndicator color={C.black} size="small" />
                    : <Text style={s.btnPrimarioTxt}>ENVIAR CALIFICACIÓN</Text>
                  }
                </TouchableOpacity>
              </>
            )}
          </View>

          <TouchableOpacity style={s.btnVolver} onPress={goHome} activeOpacity={0.8}>
            <Text style={s.btnVolverTxt}>VOLVER A RUTAS</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  const paradas    = ruta.paradas || [];
  const pendientes = paradas.filter((p) => p.estado === 'pendiente');
  const entregadas = paradas.filter((p) => p.estado === 'entregada').length;
  const fallidas   = paradas.filter((p) => p.estado === 'fallida').length;
  const actual     = pendientes[0] || null;
  const enRecogida = ruta.estado === 'aceptada' || ruta.estado === 'en_recogida';

  return (
    <View style={s.root}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={goHome} activeOpacity={0.7}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>
            {enRecogida ? 'Recogida de pedidos' : 'Reparto en curso'}
          </Text>
          <Text style={s.headerSub}>
            {entregadas + fallidas}/{paradas.length} completadas
          </Text>
        </View>
        <TouchableOpacity
          style={s.chatBtn}
          onPress={() => navigate('Chat', { serviceId: rutaId })}
          activeOpacity={0.8}
        >
          <Text style={s.chatBtnTxt}>💬</Text>
        </TouchableOpacity>
      </View>

      {/* Barra de progreso */}
      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: `${paradas.length ? ((entregadas + fallidas) / paradas.length) * 100 : 0}%` }]} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Info del cliente y cobro */}
        <View style={s.clienteCard}>
          <View style={s.clienteRow}>
            <Text style={s.clienteNombre}>🏪 {ruta.cliente_nombre || 'Comercio'}</Text>
            {ruta.cliente_telefono ? (
              <TouchableOpacity onPress={() => Linking.openURL(`tel:${ruta.cliente_telefono}`)} activeOpacity={0.7}>
                <Text style={s.llamarTxt}>📞 Llamar</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <Text style={s.cobroTxt}>
            Cobras ${fmtCOP(ruta.precio_total)} en efectivo al finalizar
            {ruta.valor_excedente > 0 ? ` (+ $${fmtCOP(ruta.valor_excedente)} de tiempo extra)` : ''}
          </Text>
        </View>

        {/* FASE: recogida */}
        {enRecogida && (
          <View style={s.faseCard}>
            <Text style={s.faseTitle}>1. VE AL PUNTO DE RECOGIDA</Text>
            <Text style={s.faseDir}>📍 {ruta.punto_recogida_direccion}</Text>
            <TouchableOpacity
              style={s.navegarBtn}
              onPress={() => navegarA(ruta.punto_recogida_lat, ruta.punto_recogida_lng, ruta.punto_recogida_direccion)}
              activeOpacity={0.85}
            >
              <Text style={s.navegarBtnTxt}>🧭  NAVEGAR CON GOOGLE MAPS</Text>
            </TouchableOpacity>

            {ruta.estado === 'aceptada' ? (
              <TouchableOpacity
                style={procesando === 'fase' ? s.btnDis : s.btnPrimario}
                onPress={iniciarRecogida}
                disabled={procesando === 'fase'}
                activeOpacity={0.85}
              >
                {procesando === 'fase'
                  ? <ActivityIndicator color={C.black} size="small" />
                  : <Text style={s.btnPrimarioTxt}>ESTOY EN CAMINO A LA RECOGIDA</Text>
                }
              </TouchableOpacity>
            ) : (
              <>
                {actual && (
                  actual.espera_inicio ? (
                    <TouchableOpacity style={s.esperaBtnActiva} onPress={() => detenerEspera(actual)} activeOpacity={0.85}>
                      <Text style={s.esperaBtnActivaTxt}>
                        ⏱ ESPERANDO ({(actual.espera_cliente_min || 0) + minutosDesde(actual.espera_inicio)} min) — TOCA PARA DETENER
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={s.esperaBtn} onPress={() => iniciarEspera(actual)} activeOpacity={0.85}>
                      <Text style={s.esperaBtnTxt}>⏱ EL PEDIDO NO ESTÁ LISTO — INICIAR ESPERA</Text>
                    </TouchableOpacity>
                  )
                )}
                <TouchableOpacity
                  style={procesando === 'fase' ? s.btnDis : s.btnPrimario}
                  onPress={iniciarReparto}
                  disabled={procesando === 'fase'}
                  activeOpacity={0.85}
                >
                  {procesando === 'fase'
                    ? <ActivityIndicator color={C.black} size="small" />
                    : <Text style={s.btnPrimarioTxt}>PEDIDOS A BORDO — INICIAR REPARTO</Text>
                  }
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* FASE: reparto — parada actual */}
        {ruta.estado === 'en_reparto' && actual && (
          <View style={s.faseCard}>
            <Text style={s.faseTitle}>ENTREGA {actual.orden} DE {paradas.length}</Text>
            <Text style={s.faseDir}>📍 {actual.direccion}</Text>
            {actual.nombre_destinatario ? (
              <Text style={s.destinatario}>
                👤 {actual.nombre_destinatario}
                {actual.telefono_destinatario ? `  ·  ${actual.telefono_destinatario}` : ''}
              </Text>
            ) : null}
            {actual.notas ? <Text style={s.notas}>📝 {actual.notas}</Text> : null}
            {actual.telefono_destinatario ? (
              <TouchableOpacity
                onPress={() => Linking.openURL(`tel:${actual.telefono_destinatario}`)}
                style={s.llamarDestBtn}
                activeOpacity={0.8}
              >
                <Text style={s.llamarDestTxt}>📞 Llamar al destinatario</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={s.navegarBtn}
              onPress={() => navegarA(actual.lat, actual.lng, actual.direccion)}
              activeOpacity={0.85}
            >
              <Text style={s.navegarBtnTxt}>🧭  NAVEGAR CON GOOGLE MAPS</Text>
            </TouchableOpacity>

            {actual.espera_inicio ? (
              <TouchableOpacity style={s.esperaBtnActiva} onPress={() => detenerEspera(actual)} activeOpacity={0.85}>
                <Text style={s.esperaBtnActivaTxt}>
                  ⏱ ESPERANDO ({(actual.espera_cliente_min || 0) + minutosDesde(actual.espera_inicio)} min) — TOCA PARA DETENER
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={s.esperaBtn} onPress={() => iniciarEspera(actual)} activeOpacity={0.85}>
                <Text style={s.esperaBtnTxt}>⏱ INICIAR ESPERA (cliente no listo / no contesta)</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={procesando === actual.id ? s.btnDis : s.btnPrimario}
              onPress={() => entregarParada(actual)}
              disabled={!!procesando}
              activeOpacity={0.85}
            >
              {procesando === actual.id
                ? <ActivityIndicator color={C.black} size="small" />
                : <Text style={s.btnPrimarioTxt}>📷  ENTREGADO — TOMAR FOTO</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity style={s.fallidaBtn} onPress={() => fallarParada(actual)} activeOpacity={0.8}>
              <Text style={s.fallidaBtnTxt}>No se pudo entregar</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* FASE: reparto terminado → devolución / finalizar */}
        {ruta.estado === 'en_reparto' && !actual && (
          <View style={s.faseCard}>
            {fallidas > 0 ? (
              <>
                <Text style={s.faseTitle}>DEVOLUCIÓN DE PEDIDOS FALLIDOS</Text>
                <Text style={s.faseDir}>
                  Lleva {fallidas} pedido{fallidas !== 1 ? 's' : ''} de vuelta a: {ruta.punto_recogida_direccion}
                </Text>
                <TouchableOpacity
                  style={s.navegarBtn}
                  onPress={() => navegarA(ruta.punto_recogida_lat, ruta.punto_recogida_lng, ruta.punto_recogida_direccion)}
                  activeOpacity={0.85}
                >
                  <Text style={s.navegarBtnTxt}>🧭  NAVEGAR AL PUNTO DE RECOGIDA</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={s.faseTitle}>¡TODAS LAS ENTREGAS COMPLETADAS!</Text>
            )}
            <TouchableOpacity
              style={procesando === 'finalizar' ? s.btnDis : s.btnPrimario}
              onPress={() => confirmarFinalizar(fallidas)}
              disabled={procesando === 'finalizar'}
              activeOpacity={0.85}
            >
              {procesando === 'finalizar'
                ? <ActivityIndicator color={C.black} size="small" />
                : <Text style={s.btnPrimarioTxt}>FINALIZAR RUTA</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {/* Lista de paradas */}
        <Text style={s.listaTitle}>TODAS LAS ENTREGAS</Text>
        {paradas.map((p) => {
          const esActual = actual && p.id === actual.id && ruta.estado === 'en_reparto';
          return (
            <View key={p.id} style={esActual ? s.paradaRowActual : s.paradaRow}>
              <View style={p.estado === 'entregada' ? s.paradaNumOk : (p.estado === 'pendiente' ? s.paradaNum : s.paradaNumFail)}>
                <Text style={p.estado === 'pendiente' ? s.paradaNumTxt : s.paradaNumTxtBlanco}>
                  {p.estado === 'entregada' ? '✓' : (p.estado === 'pendiente' ? p.orden : '↩')}
                </Text>
              </View>
              <View style={s.paradaTexts}>
                <Text style={s.paradaDir} numberOfLines={1}>{p.direccion}</Text>
                {p.nombre_destinatario ? (
                  <Text style={s.paradaDest} numberOfLines={1}>{p.nombre_destinatario}</Text>
                ) : null}
                {p.espera_cliente_min > 0 ? (
                  <Text style={s.paradaEspera}>⏱ {p.espera_cliente_min} min de espera registrados</Text>
                ) : null}
              </View>
              {esActual && <Text style={s.paradaActualTxt}>ACTUAL</Text>}
            </View>
          );
        })}

        {/* Cancelar */}
        <TouchableOpacity style={s.cancelarBtn} onPress={cancelarRuta} activeOpacity={0.7}>
          <Text style={s.cancelarBtnTxt}>CANCELAR RUTA</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: C.bg },
  loadingWrap: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingTop:        52,
    paddingBottom:     10,
    paddingHorizontal: 12,
  },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backArrow:   { color: C.black, fontSize: 24, fontWeight: '700' },
  headerCenter:{ flex: 1, alignItems: 'center' },
  headerTitle: { color: C.black, fontSize: 17, fontWeight: '800' },
  headerSub:   { color: C.gray, fontSize: 12, marginTop: 1 },
  chatBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.white,
    alignItems: 'center', justifyContent: 'center',
    ...SHADOW,
  },
  chatBtnTxt: { fontSize: 18 },

  progressTrack: {
    height:           6,
    backgroundColor:  C.border,
    borderRadius:     3,
    marginHorizontal: 16,
    marginBottom:     10,
    overflow:         'hidden',
  },
  progressFill: { height: 6, backgroundColor: C.green, borderRadius: 3 },

  content: { paddingHorizontal: 16, paddingBottom: 40 },

  clienteCard: {
    backgroundColor: C.white,
    borderRadius:    18,
    padding:         14,
    marginBottom:    10,
    ...SHADOW,
  },
  clienteRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  clienteNombre: { color: C.black, fontSize: 15, fontWeight: '800', flex: 1 },
  llamarTxt:     { color: C.black, fontSize: 13, fontWeight: '700' },
  cobroTxt:      { color: C.gray, fontSize: 12, lineHeight: 17 },

  faseCard: {
    backgroundColor: C.white,
    borderRadius:    20,
    padding:         16,
    marginBottom:    14,
    borderWidth:     1.5,
    borderColor:     C.yellow,
    ...SHADOW,
  },
  faseTitle:    { color: C.gray, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 },
  faseDir:      { color: C.black, fontSize: 15, fontWeight: '700', lineHeight: 22, marginBottom: 6 },
  destinatario: { color: C.black, fontSize: 13, marginBottom: 4 },
  notas:        { color: C.gray, fontSize: 12, fontStyle: 'italic', marginBottom: 4 },
  llamarDestBtn:{ paddingVertical: 4, marginBottom: 4 },
  llamarDestTxt:{ color: C.black, fontSize: 13, fontWeight: '700' },

  navegarBtn: {
    backgroundColor: C.black,
    borderRadius:    14,
    paddingVertical: 14,
    alignItems:      'center',
    marginTop:       8,
    marginBottom:    8,
  },
  navegarBtnTxt: { color: C.yellow, fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },

  esperaBtn: {
    backgroundColor: '#FFF4D6',
    borderWidth:     1,
    borderColor:     '#F5A623',
    borderRadius:    14,
    paddingVertical: 12,
    alignItems:      'center',
    marginBottom:    8,
  },
  esperaBtnTxt: { color: '#8B6000', fontSize: 12, fontWeight: '700' },
  esperaBtnActiva: {
    backgroundColor: '#F5A623',
    borderRadius:    14,
    paddingVertical: 12,
    alignItems:      'center',
    marginBottom:    8,
  },
  esperaBtnActivaTxt: { color: C.black, fontSize: 12, fontWeight: '800' },

  btnPrimario: {
    backgroundColor: C.yellow,
    borderRadius:    16,
    paddingVertical: 16,
    alignItems:      'center',
  },
  btnDis: {
    backgroundColor: C.border,
    borderRadius:    16,
    paddingVertical: 16,
    alignItems:      'center',
  },
  btnPrimarioTxt: { color: C.black, fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },

  fallidaBtn:    { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  fallidaBtnTxt: { color: C.red, fontSize: 13, fontWeight: '700' },

  listaTitle: {
    color: C.gray, fontSize: 11, fontWeight: '800',
    letterSpacing: 1.5, marginTop: 6, marginBottom: 8,
  },
  paradaRow: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: C.white,
    borderRadius:    14,
    padding:         10,
    marginBottom:    6,
    ...SHADOW,
  },
  paradaRowActual: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: '#FFF8DC',
    borderWidth:     1,
    borderColor:     C.yellow,
    borderRadius:    14,
    padding:         10,
    marginBottom:    6,
    ...SHADOW,
  },
  paradaNum: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: C.bg,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 10,
  },
  paradaNumOk: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: C.green,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 10,
  },
  paradaNumFail: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: C.red,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 10,
  },
  paradaNumTxt:       { color: C.black, fontSize: 12, fontWeight: '800' },
  paradaNumTxtBlanco: { color: C.white, fontSize: 13, fontWeight: '800' },
  paradaTexts:  { flex: 1 },
  paradaDir:    { color: C.black, fontSize: 13, fontWeight: '600' },
  paradaDest:   { color: C.gray, fontSize: 11, marginTop: 1 },
  paradaEspera: { color: '#8B6000', fontSize: 11, marginTop: 1 },
  paradaActualTxt: { color: C.black, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  cancelarBtn:    { paddingVertical: 16, alignItems: 'center', marginTop: 10 },
  cancelarBtnTxt: { color: C.red, fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },

  /* Resumen final */
  finalContent: { paddingHorizontal: 20, paddingTop: 70, paddingBottom: 48 },
  finalCircle: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: C.yellow,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  finalIcon:  { fontSize: 40 },
  finalTitle: { color: C.black, fontSize: 26, fontWeight: '800', textAlign: 'center', marginBottom: 20 },
  finalCard: {
    backgroundColor: C.white,
    borderRadius:    20,
    padding:         16,
    marginBottom:    14,
    ...SHADOW,
  },
  finalCardTitle: { color: C.gray, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 10 },
  finalRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  finalLbl:     { color: C.gray, fontSize: 13, flex: 1, marginRight: 8 },
  finalVal:     { color: C.black, fontSize: 13, fontWeight: '700' },
  finalValRojo: { color: C.red, fontSize: 13, fontWeight: '700' },
  finalTotalRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    borderTopWidth: 1,
    borderTopColor: C.border,
    marginTop:      8,
    paddingTop:     12,
  },
  finalTotalLbl: { color: C.black, fontSize: 14, fontWeight: '700' },
  finalTotalVal: { color: '#15803D', fontSize: 24, fontWeight: '800' },

  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 14 },
  starOn:   { fontSize: 40, color: C.yellow },
  starOff:  { fontSize: 40, color: C.border },
  comentarioInput: {
    backgroundColor:   C.bg,
    borderRadius:      14,
    paddingHorizontal: 14,
    paddingVertical:   12,
    color:             C.black,
    fontSize:          14,
    minHeight:         70,
    textAlignVertical: 'top',
    marginBottom:      12,
  },
  graciasTxt: { color: C.black, fontSize: 14, fontWeight: '600', textAlign: 'center', paddingVertical: 10 },

  btnVolver:    { paddingVertical: 16, alignItems: 'center' },
  btnVolverTxt: { color: C.yellow, fontSize: 14, fontWeight: '800', letterSpacing: 1.5 },
});
