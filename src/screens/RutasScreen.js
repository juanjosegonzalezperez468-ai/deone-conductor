import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Modal,
  StyleSheet, StatusBar, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { rutasApi } from '../api/client';
import { C, SHADOW } from '../constants/theme';

const VEHICULO_LABEL = {
  moto:      '🏍️ Moto',
  carro:     '🚗 Carro',
  motocarro: '🛺 Motocarro',
  camioneta: '🛻 Camioneta',
};

const ESTADO_MIS_RUTAS = {
  aceptada:            { label: 'Aceptada — ve a la recogida', color: '#3B82F6' },
  en_recogida:         { label: 'En recogida',                 color: '#3B82F6' },
  en_reparto:          { label: 'En reparto',                  color: '#3B82F6' },
  finalizada:          { label: 'Finalizada ✔',               color: '#15803D' },
  cancelada_cliente:   { label: 'Cancelada por el cliente',    color: '#B91C1C' },
  cancelada_conductor: { label: 'Cancelaste esta ruta',        color: '#B91C1C' },
};

const ACTIVAS = ['aceptada', 'en_recogida', 'en_reparto'];

const fmtCOP  = (n) => Number(n || 0).toLocaleString('es-CO');
const fmtHora = (min) => {
  const m = Math.round(min || 0);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ''}`.trim();
};
const fmtProgramada = (iso) => {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('es-CO', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
};

export default function RutasScreen({ navigate, onMenuPress }) {
  const [tab, setTab]               = useState('disponibles'); // disponibles | mias
  const [disponibles, setDisponibles] = useState([]);
  const [aviso, setAviso]           = useState(null);
  const [mias, setMias]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detalle, setDetalle]       = useState(null);
  const [aceptando, setAceptando]   = useState(false);

  const cargar = useCallback(async (esRefresh = false) => {
    if (esRefresh) setRefreshing(true);
    try {
      const [dispRes, miasRes] = await Promise.all([
        rutasApi.disponibles(),
        rutasApi.misRutas(),
      ]);
      setDisponibles(dispRes.data.rutas || []);
      setAviso(dispRes.data.aviso || null);
      setMias(miasRes.data.rutas || []);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    cargar();
    const iv = setInterval(() => cargar(), 15000);
    return () => clearInterval(iv);
  }, [cargar]);

  const abrirDetalle = async (ruta) => {
    setDetalle({ ...ruta, cargandoParadas: true });
    try {
      const { data } = await rutasApi.obtener(ruta.id);
      setDetalle((prev) => (prev && prev.id === ruta.id ? { ...ruta, ...data, cargandoParadas: false } : prev));
    } catch {
      setDetalle((prev) => (prev && prev.id === ruta.id ? { ...prev, cargandoParadas: false } : prev));
    }
  };

  const aceptar = async () => {
    if (!detalle || aceptando) return;
    setAceptando(true);
    try {
      await rutasApi.aceptar(detalle.id);
      const rutaId = detalle.id;
      setDetalle(null);
      navigate('RutaActiva', { rutaId });
    } catch (e) {
      const detalleErr = e?.response?.data?.detail;
      const msg = typeof detalleErr === 'string' ? detalleErr : (e?.friendlyMessage || 'No se pudo aceptar la ruta.');
      Alert.alert('No disponible', msg);
      setDetalle(null);
      cargar();
    }
    setAceptando(false);
  };

  const rutaActiva = mias.find((r) => ACTIVAS.includes(r.estado));

  return (
    <View style={s.root}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onMenuPress} style={s.menuBtn} activeOpacity={0.7}>
          <View style={s.bar} />
          <View style={s.bar} />
          <View style={s.bar} />
        </TouchableOpacity>
        <Text style={s.heading}>Rutas</Text>
        <View style={s.headerSpacer} />
      </View>

      {/* Pestañas */}
      <View style={s.tabsRow}>
        <TouchableOpacity
          style={tab === 'disponibles' ? s.tabActive : s.tabInactive}
          onPress={() => setTab('disponibles')}
          activeOpacity={0.8}
        >
          <Text style={tab === 'disponibles' ? s.tabTxtActive : s.tabTxt}>
            Disponibles ({disponibles.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={tab === 'mias' ? s.tabActive : s.tabInactive}
          onPress={() => setTab('mias')}
          activeOpacity={0.8}
        >
          <Text style={tab === 'mias' ? s.tabTxtActive : s.tabTxt}>Mis rutas</Text>
        </TouchableOpacity>
      </View>

      {/* Ruta activa: acceso rápido */}
      {rutaActiva && (
        <TouchableOpacity
          style={s.activaBanner}
          onPress={() => navigate('RutaActiva', { rutaId: rutaActiva.id })}
          activeOpacity={0.85}
        >
          <Text style={s.activaBannerIcon}>📦</Text>
          <View style={s.activaBannerTexts}>
            <Text style={s.activaBannerTitle}>Tienes una ruta en curso</Text>
            <Text style={s.activaBannerSub}>
              {rutaActiva.paradas_entregadas}/{rutaActiva.numero_paradas} entregas — toca para continuar
            </Text>
          </View>
          <Text style={s.activaBannerArrow}>→</Text>
        </TouchableOpacity>
      )}

      {loading ? (
        <View style={s.centerWrap}>
          <ActivityIndicator size="large" color={C.yellow} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => cargar(true)} colors={[C.yellow]} />
          }
        >
          {tab === 'disponibles' && (
            <>
              {aviso && (
                <View style={s.avisoCard}>
                  <Text style={s.avisoTxt}>ℹ️ {aviso}</Text>
                </View>
              )}
              {!aviso && disponibles.length === 0 && (
                <View style={s.emptyWrap}>
                  <Text style={s.emptyIcon}>📦</Text>
                  <Text style={s.emptyTitle}>Sin rutas por ahora</Text>
                  <Text style={s.emptySub}>
                    Los comercios publican rutas de entregas por horas. La lista se actualiza sola.
                  </Text>
                </View>
              )}
              {disponibles.map((r) => {
                const bloqueada = !!r.motivo_bloqueo;
                return (
                  <View key={r.id} style={bloqueada ? s.cardBloqueada : s.card}>
                    <View style={s.cardTop}>
                      <View style={s.cardIconWrap}>
                        <Text style={s.cardIcon}>📦</Text>
                      </View>
                      <View style={s.cardInfo}>
                        <Text style={s.cardTitle}>
                          {r.numero_paradas} entrega{r.numero_paradas !== 1 ? 's' : ''} · {r.horas_cotizadas} h
                        </Text>
                        <Text style={s.cardSub} numberOfLines={1}>
                          Recogida: {r.punto_recogida_direccion}
                        </Text>
                        <Text style={s.cardMeta}>
                          {Number(r.distancia_km || 0).toFixed(1)} km · {fmtHora(r.tiempo_estimado_min)} ·{' '}
                          {VEHICULO_LABEL[r.tipo_vehiculo] || r.tipo_vehiculo}
                        </Text>
                      </View>
                      <View style={r.programada_para ? s.badgeProgramada : s.badgeAhora}>
                        <Text style={r.programada_para ? s.badgeProgramadaTxt : s.badgeAhoraTxt}>
                          {r.programada_para ? '⏳ Programada' : '⚡ Ahora'}
                        </Text>
                      </View>
                    </View>

                    {r.programada_para && (
                      <Text style={s.programadaFecha}>📅 {fmtProgramada(r.programada_para)}</Text>
                    )}

                    <View style={s.cardBottom}>
                      <View>
                        <Text style={s.gananciaVal}>${fmtCOP(r.ganancia_neta)}</Text>
                        <Text style={s.gananciaLbl}>Ganancia neta (comisión descontada)</Text>
                      </View>
                      {bloqueada ? (
                        <View style={s.bloqueoWrap}>
                          <Text style={s.bloqueoTxt}>🔒 {r.motivo_bloqueo}</Text>
                        </View>
                      ) : (
                        <TouchableOpacity style={s.verBtn} onPress={() => abrirDetalle(r)} activeOpacity={0.85}>
                          <Text style={s.verBtnTxt}>VER RUTA</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </>
          )}

          {tab === 'mias' && (
            <>
              {mias.length === 0 && (
                <View style={s.emptyWrap}>
                  <Text style={s.emptyIcon}>🗂️</Text>
                  <Text style={s.emptyTitle}>Aún no has tomado rutas</Text>
                  <Text style={s.emptySub}>Cuando aceptes una ruta de reparto aparecerá aquí.</Text>
                </View>
              )}
              {mias.map((r) => {
                const est = ESTADO_MIS_RUTAS[r.estado] || { label: r.estado, color: C.gray };
                const activa = ACTIVAS.includes(r.estado);
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={s.card}
                    onPress={() => { if (activa) navigate('RutaActiva', { rutaId: r.id }); }}
                    activeOpacity={activa ? 0.8 : 1}
                  >
                    <View style={s.cardTop}>
                      <View style={s.cardIconWrap}>
                        <Text style={s.cardIcon}>{r.estado === 'finalizada' ? '🏁' : '📦'}</Text>
                      </View>
                      <View style={s.cardInfo}>
                        <Text style={s.cardTitle}>
                          {r.numero_paradas} entrega{r.numero_paradas !== 1 ? 's' : ''} · {r.horas_cotizadas} h
                        </Text>
                        <Text style={s.cardSub} numberOfLines={1}>{r.punto_recogida_direccion}</Text>
                        <Text style={[s.cardEstado, { color: est.color }]}>{est.label}</Text>
                      </View>
                      <View style={s.cardRight}>
                        <Text style={s.gananciaVal}>
                          ${fmtCOP((r.valor_final || r.precio_total) - (r.comision || Math.round(r.precio_total * 0.085)))}
                        </Text>
                        {activa && <Text style={s.continuarTxt}>Continuar →</Text>}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </ScrollView>
      )}

      {/* Modal detalle antes de aceptar */}
      <Modal visible={!!detalle} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.modalCard}>
            <View style={s.modalTop}>
              <Text style={s.modalTitle}>
                {detalle ? `${detalle.numero_paradas} entrega${detalle.numero_paradas !== 1 ? 's' : ''} · ${detalle.horas_cotizadas} h` : ''}
              </Text>
              <TouchableOpacity onPress={() => setDetalle(null)} style={s.closeBtn}>
                <Text style={s.closeTxt}>✕</Text>
              </TouchableOpacity>
            </View>

            {detalle && (
              <ScrollView style={s.modalScroll} showsVerticalScrollIndicator={false}>
                <View style={s.modalMetaRow}>
                  <View style={s.modalMetaItem}>
                    <Text style={s.modalMetaVal}>${fmtCOP(detalle.ganancia_neta)}</Text>
                    <Text style={s.modalMetaLbl}>Ganancia neta</Text>
                  </View>
                  <View style={s.modalMetaDivider} />
                  <View style={s.modalMetaItem}>
                    <Text style={s.modalMetaVal}>{Number(detalle.distancia_km || 0).toFixed(1)} km</Text>
                    <Text style={s.modalMetaLbl}>Recorrido</Text>
                  </View>
                  <View style={s.modalMetaDivider} />
                  <View style={s.modalMetaItem}>
                    <Text style={s.modalMetaVal}>{fmtHora(detalle.tiempo_estimado_min)}</Text>
                    <Text style={s.modalMetaLbl}>Estimado</Text>
                  </View>
                </View>

                <View style={s.modalInfoBox}>
                  <Text style={s.modalInfoRow}>
                    💵 Cobras ${fmtCOP(detalle.precio_total)} en efectivo · comisión Deone ${fmtCOP(detalle.comision)}
                  </Text>
                  {detalle.programada_para
                    ? <Text style={s.modalInfoRow}>📅 Programada: {fmtProgramada(detalle.programada_para)}</Text>
                    : <Text style={s.modalInfoRow}>⚡ Para empezar ya</Text>}
                  {detalle.peso_declarado_kg
                    ? <Text style={s.modalInfoRow}>⚖️ Peso aproximado: {detalle.peso_declarado_kg} kg</Text>
                    : null}
                  {detalle.orden_obligatorio
                    ? <Text style={s.modalInfoRow}>📋 El cliente pide entregar en el orden de su lista</Text>
                    : <Text style={s.modalInfoRow}>🧭 Orden de entregas optimizado por el sistema</Text>}
                  {detalle.es_nocturna
                    ? <Text style={s.modalInfoRow}>🌙 Ruta nocturna (tarifa +20% ya incluida)</Text>
                    : null}
                </View>

                <Text style={s.modalSection}>RECOGIDA</Text>
                <Text style={s.modalDir}>🏪 {detalle.punto_recogida_direccion}</Text>

                <Text style={s.modalSection}>PARADAS</Text>
                {detalle.cargandoParadas && <ActivityIndicator color={C.yellow} style={s.modalLoading} />}
                {(detalle.paradas || []).map((p) => (
                  <Text key={p.id} style={s.modalDir}>
                    {p.orden}. {p.direccion}
                  </Text>
                ))}
                {!detalle.cargandoParadas && (
                  <Text style={s.modalNota}>
                    Los nombres y teléfonos de los destinatarios se muestran al aceptar la ruta.
                  </Text>
                )}
              </ScrollView>
            )}

            <TouchableOpacity
              style={aceptando ? s.aceptarBtnDis : s.aceptarBtn}
              onPress={aceptar}
              disabled={aceptando}
              activeOpacity={0.85}
            >
              {aceptando
                ? <ActivityIndicator color={C.black} size="small" />
                : <Text style={s.aceptarBtnTxt}>ACEPTAR RUTA</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  header: {
    paddingHorizontal: 12,
    paddingTop:        52,
    paddingBottom:     14,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
  },
  menuBtn:      { padding: 10, justifyContent: 'center' },
  bar:          { width: 22, height: 2.5, backgroundColor: C.black, borderRadius: 2, marginVertical: 2.5 },
  heading:      { color: C.black, fontSize: 24, fontWeight: '800', letterSpacing: -0.5, flex: 1, textAlign: 'center' },
  headerSpacer: { width: 42 },

  tabsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  tabActive: {
    flex: 1,
    backgroundColor: C.black,
    borderRadius:    18,
    paddingVertical: 10,
    alignItems:      'center',
  },
  tabInactive: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius:    18,
    paddingVertical: 10,
    alignItems:      'center',
    ...SHADOW,
  },
  tabTxt:       { color: C.gray, fontSize: 13, fontWeight: '600' },
  tabTxtActive: { color: C.yellow, fontSize: 13, fontWeight: '800' },

  activaBanner: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  C.greenBg,
    borderWidth:      1.5,
    borderColor:      C.greenBorder,
    borderRadius:     16,
    marginHorizontal: 16,
    marginBottom:     10,
    padding:          12,
  },
  activaBannerIcon:  { fontSize: 22, marginRight: 10 },
  activaBannerTexts: { flex: 1 },
  activaBannerTitle: { color: '#15803D', fontSize: 13, fontWeight: '800' },
  activaBannerSub:   { color: '#15803D', fontSize: 12, marginTop: 1 },
  activaBannerArrow: { color: '#15803D', fontSize: 18, fontWeight: '800' },

  centerWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },

  avisoCard: {
    backgroundColor: '#FFF4D6',
    borderRadius:    14,
    padding:         14,
    marginBottom:    10,
  },
  avisoTxt: { color: '#8B6000', fontSize: 13, fontWeight: '600', lineHeight: 19 },

  emptyWrap:  { alignItems: 'center', paddingTop: 70, paddingHorizontal: 32 },
  emptyIcon:  { fontSize: 52, marginBottom: 16 },
  emptyTitle: { color: C.black, fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  emptySub:   { color: C.gray, fontSize: 13, textAlign: 'center', lineHeight: 20 },

  card: {
    backgroundColor: C.white,
    borderRadius:    20,
    padding:         14,
    marginBottom:    10,
    ...SHADOW,
  },
  cardBloqueada: {
    backgroundColor: C.white,
    borderRadius:    20,
    padding:         14,
    marginBottom:    10,
    opacity:         0.75,
    ...SHADOW,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  cardIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FFF8DC',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 10,
  },
  cardIcon:  { fontSize: 20 },
  cardInfo:  { flex: 1, marginRight: 8 },
  cardTitle: { color: C.black, fontSize: 15, fontWeight: '800', marginBottom: 3 },
  cardSub:   { color: C.gray, fontSize: 12, marginBottom: 3 },
  cardMeta:  { color: C.gray, fontSize: 11 },
  cardEstado:{ fontSize: 12, fontWeight: '700', marginTop: 2 },
  cardRight: { alignItems: 'flex-end' },
  continuarTxt: { color: C.yellow, fontSize: 12, fontWeight: '700', marginTop: 4 },

  badgeAhora: {
    backgroundColor: C.greenBg,
    borderWidth:     1,
    borderColor:     C.greenBorder,
    borderRadius:    10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeAhoraTxt: { color: '#15803D', fontSize: 10, fontWeight: '700' },
  badgeProgramada: {
    backgroundColor: '#FFF4D6',
    borderWidth:     1,
    borderColor:     '#F5A623',
    borderRadius:    10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeProgramadaTxt: { color: '#8B6000', fontSize: 10, fontWeight: '700' },
  programadaFecha:    { color: C.gray, fontSize: 12, fontWeight: '600', marginTop: 8 },

  cardBottom: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginTop:      12,
    paddingTop:     12,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  gananciaVal: { color: '#15803D', fontSize: 20, fontWeight: '800' },
  gananciaLbl: { color: C.gray, fontSize: 10, marginTop: 1 },
  verBtn: {
    backgroundColor:   C.yellow,
    borderRadius:      14,
    paddingHorizontal: 18,
    paddingVertical:   12,
  },
  verBtnTxt:   { color: C.black, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  bloqueoWrap: { flex: 1, marginLeft: 12 },
  bloqueoTxt:  { color: C.gray, fontSize: 12, fontWeight: '600', textAlign: 'right', lineHeight: 17 },

  /* Modal */
  overlay: {
    flex:              1,
    backgroundColor:   'rgba(0,0,0,0.55)',
    justifyContent:    'flex-end',
    paddingHorizontal: 16,
    paddingBottom:     40,
  },
  modalCard: {
    backgroundColor: C.white,
    borderRadius:    24,
    padding:         20,
    maxHeight:       '82%',
    ...SHADOW,
  },
  modalTop:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle: { color: C.black, fontSize: 17, fontWeight: '800', flex: 1 },
  closeBtn:   { padding: 8 },
  closeTxt:   { color: C.gray, fontSize: 18, fontWeight: '700' },
  modalScroll:{ marginBottom: 14 },

  modalMetaRow: {
    flexDirection:   'row',
    backgroundColor: C.bg,
    borderRadius:    16,
    padding:         14,
    marginBottom:    12,
  },
  modalMetaItem:    { flex: 1, alignItems: 'center' },
  modalMetaVal:     { color: C.black, fontSize: 16, fontWeight: '800', marginBottom: 2 },
  modalMetaLbl:     { color: C.gray, fontSize: 10 },
  modalMetaDivider: { width: 1, backgroundColor: C.border },

  modalInfoBox: {
    backgroundColor: '#FFF8DC',
    borderRadius:    14,
    padding:         12,
    marginBottom:    6,
  },
  modalInfoRow: { color: C.black, fontSize: 12.5, fontWeight: '500', lineHeight: 21 },

  modalSection: {
    color: C.gray, fontSize: 11, fontWeight: '800',
    letterSpacing: 1.5, marginTop: 12, marginBottom: 6,
  },
  modalDir:     { color: C.black, fontSize: 13, lineHeight: 22 },
  modalNota:    { color: C.gray, fontSize: 11, marginTop: 8, fontStyle: 'italic' },
  modalLoading: { marginVertical: 8 },

  aceptarBtn: {
    backgroundColor: C.yellow,
    borderRadius:    18,
    paddingVertical: 17,
    alignItems:      'center',
  },
  aceptarBtnDis: {
    backgroundColor: C.border,
    borderRadius:    18,
    paddingVertical: 17,
    alignItems:      'center',
  },
  aceptarBtnTxt: { color: C.black, fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
});
