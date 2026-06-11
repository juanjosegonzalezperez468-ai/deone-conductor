import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, StatusBar, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { adminApi } from '../api/client';
import { C, SHADOW } from '../constants/theme';

/* ─── Constantes ──────────────────────────────────── */

const SECCIONES = [
  { key: 'conductores', label: 'Conductores', icon: '👤' },
  { key: 'recargas',    label: 'Recargas',    icon: '💳' },
  { key: 'alertas',     label: 'Alertas',     icon: '🚨' },
  { key: 'stats',       label: 'Estadísticas',icon: '📊' },
];

/* ─── Modal de motivo de rechazo ─────────────────── */

function MotivoModal({ visible, titulo, onConfirm, onCancel }) {
  const [motivo, setMotivo] = useState('');

  const handleConfirm = () => {
    if (!motivo.trim()) {
      Alert.alert('Campo requerido', 'Escribe un motivo de rechazo.');
      return;
    }
    onConfirm(motivo.trim());
    setMotivo('');
  };

  const handleCancel = () => {
    setMotivo('');
    onCancel();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.overlay}>
        <View style={s.motivoCard}>
          <Text style={s.motivoTitle}>{titulo}</Text>
          <TextInput
            style={s.motivoInput}
            placeholder="Escribe el motivo..."
            placeholderTextColor={C.gray}
            value={motivo}
            onChangeText={setMotivo}
            multiline
            numberOfLines={3}
            autoFocus
          />
          <View style={s.motivoBtns}>
            <TouchableOpacity style={s.motivoCancelBtn} onPress={handleCancel} activeOpacity={0.8}>
              <Text style={s.motivoCancelTxt}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.motivoConfirmBtn} onPress={handleConfirm} activeOpacity={0.85}>
              <Text style={s.motivoConfirmTxt}>Rechazar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ─── Sección: Conductores pendientes ────────────── */

function ConductoresSection({ navigate }) {
  const [conductores, setConductores] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [procesando,  setProcesando]  = useState(null);
  const [motivoModal, setMotivoModal] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.conductoresPendientes();
      setConductores(data.conductores || []);
    } catch {
      Alert.alert('Error', 'No se pudo cargar la lista de conductores.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const aprobar = async (id) => {
    setProcesando(id + '_aprobar');
    try {
      await adminApi.aprobarConductor(id);
      Alert.alert('Aprobado', 'Conductor activado correctamente.');
      cargar();
    } catch {
      Alert.alert('Error', 'No se pudo aprobar el conductor.');
    } finally {
      setProcesando(null);
    }
  };

  const rechazar = async (id, motivo) => {
    setMotivoModal(null);
    setProcesando(id + '_rechazar');
    try {
      await adminApi.rechazarConductor(id, motivo);
      Alert.alert('Rechazado', 'Conductor rechazado.');
      cargar();
    } catch {
      Alert.alert('Error', 'No se pudo rechazar el conductor.');
    } finally {
      setProcesando(null);
    }
  };

  const formatFecha = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  };

  if (loading) {
    return (
      <View style={s.centerWrap}>
        <ActivityIndicator color={C.yellow} size="large" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false}>
      {motivoModal && (
        <MotivoModal
          visible
          titulo="Motivo de rechazo"
          onConfirm={(m) => rechazar(motivoModal, m)}
          onCancel={() => setMotivoModal(null)}
        />
      )}

      {conductores.length === 0 && (
        <View style={s.emptyWrap}>
          <Text style={s.emptyIcon}>✅</Text>
          <Text style={s.emptyTxt}>Sin conductores pendientes</Text>
        </View>
      )}

      {conductores.map((c) => (
        <View key={c.id} style={s.conductorCard}>
          <View style={s.conductorHeader}>
            <View style={s.conductorAvatar}>
              <Text style={s.conductorAvatarTxt}>{(c.nombre || 'C')[0].toUpperCase()}</Text>
            </View>
            <View style={s.conductorInfo}>
              <Text style={s.conductorNombre}>{c.nombre || '—'}</Text>
              <Text style={s.conductorTel}>{c.telefono || '—'}</Text>
            </View>
            <View style={s.pendienteBadge}>
              <Text style={s.pendienteBadgeTxt}>PENDIENTE</Text>
            </View>
          </View>

          <View style={s.conductorMeta}>
            <View style={s.metaItem}>
              <Text style={s.metaLbl}>Vehículo</Text>
              <Text style={s.metaVal}>{c.tipo_vehiculo || '—'}</Text>
            </View>
            <View style={s.metaDivider} />
            <View style={s.metaItem}>
              <Text style={s.metaLbl}>Registro</Text>
              <Text style={s.metaVal}>{formatFecha(c.created_at)}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={s.verDocsBtn}
            onPress={() => navigate('DocumentosAdmin', { conductorId: c.id, conductorNombre: c.nombre })}
            activeOpacity={0.8}
          >
            <Text style={s.verDocsBtnTxt}>📄  Ver documentos</Text>
          </TouchableOpacity>

          <View style={s.actionRow}>
            <TouchableOpacity
              style={s.rechazarBtn}
              onPress={() => setMotivoModal(c.id)}
              disabled={!!procesando}
              activeOpacity={0.85}
            >
              {procesando === c.id + '_rechazar'
                ? <ActivityIndicator color={C.white} size="small" />
                : <Text style={s.rechazarBtnTxt}>RECHAZAR</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity
              style={s.aprobarBtn}
              onPress={() => aprobar(c.id)}
              disabled={!!procesando}
              activeOpacity={0.85}
            >
              {procesando === c.id + '_aprobar'
                ? <ActivityIndicator color={C.black} size="small" />
                : <Text style={s.aprobarBtnTxt}>APROBAR</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

/* ─── Sección: Recargas pendientes ───────────────── */

function RecargasSection() {
  const [recargas,   setRecargas]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [procesando, setProcesando] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.recargasPendientes();
      setRecargas(data.recargas || []);
    } catch {
      Alert.alert('Error', 'No se pudo cargar las recargas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const aprobar = async (id) => {
    setProcesando(id);
    try {
      await adminApi.aprobarRecarga(id);
      Alert.alert('Aprobado', 'Recarga procesada correctamente.');
      cargar();
    } catch {
      Alert.alert('Error', 'No se pudo aprobar la recarga.');
    } finally {
      setProcesando(null);
    }
  };

  const formatFecha = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return <View style={s.centerWrap}><ActivityIndicator color={C.yellow} size="large" /></View>;
  }

  return (
    <ScrollView contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false}>
      {recargas.length === 0 && (
        <View style={s.emptyWrap}>
          <Text style={s.emptyIcon}>✅</Text>
          <Text style={s.emptyTxt}>Sin recargas pendientes</Text>
        </View>
      )}

      {recargas.map((r) => (
        <View key={r.id} style={s.recargaCard}>
          <View style={s.recargaTop}>
            <View>
              <Text style={s.recargaNombre}>{r.conductor?.nombre || r.conductor_id}</Text>
              <Text style={s.recargaTel}>{r.conductor?.telefono || '—'}</Text>
            </View>
            <View style={s.recargaMontoWrap}>
              <Text style={s.recargaMonto}>${Number(r.monto || 0).toLocaleString('es-CO')}</Text>
              <Text style={s.recargaFecha}>{formatFecha(r.created_at)}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={procesando === r.id ? s.aprobarBtnDis : s.aprobarBtn}
            onPress={() => aprobar(r.id)}
            disabled={procesando === r.id}
            activeOpacity={0.85}
          >
            {procesando === r.id
              ? <ActivityIndicator color={C.black} size="small" />
              : <Text style={s.aprobarBtnTxt}>APROBAR RECARGA</Text>
            }
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

/* ─── Sección: Alertas ───────────────────────────── */

function AlertasSection() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.alertas()
      .then(({ data: d }) => setData(d))
      .catch(() => setData({ conductores_rating_bajo: [], conductores_muchas_cancelaciones: [] }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <View style={s.centerWrap}><ActivityIndicator color={C.yellow} size="large" /></View>;
  }

  const sinAlertas =
    (data?.conductores_rating_bajo?.length || 0) === 0 &&
    (data?.conductores_muchas_cancelaciones?.length || 0) === 0;

  return (
    <ScrollView contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false}>
      {sinAlertas && (
        <View style={s.emptyWrap}>
          <Text style={s.emptyIcon}>✅</Text>
          <Text style={s.emptyTxt}>Sin alertas activas</Text>
        </View>
      )}

      {(data?.conductores_rating_bajo?.length || 0) > 0 && (
        <>
          <Text style={s.alertaSectionLbl}>RATING BAJO (&lt; 4.0)</Text>
          {data.conductores_rating_bajo.map((c) => (
            <View key={c.id} style={s.alertaCard}>
              <Text style={s.alertaIcon}>⚠️</Text>
              <View style={s.alertaInfo}>
                <Text style={s.alertaNombre}>{c.nombre || c.id}</Text>
                <Text style={s.alertaDetalle}>Rating: {c.rating ?? '—'} ★</Text>
              </View>
            </View>
          ))}
        </>
      )}

      {(data?.conductores_muchas_cancelaciones?.length || 0) > 0 && (
        <>
          <Text style={s.alertaSectionLbl}>CANCELACIONES FRECUENTES</Text>
          {data.conductores_muchas_cancelaciones.map((c) => (
            <View key={c.conductor_id} style={s.alertaCard}>
              <Text style={s.alertaIcon}>🚫</Text>
              <View style={s.alertaInfo}>
                <Text style={s.alertaNombre}>{c.conductor_id}</Text>
                <Text style={s.alertaDetalle}>{c.cancelaciones} cancelaciones en 30 días</Text>
              </View>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

/* ─── Sección: Estadísticas ──────────────────────── */

function EstadisticasSection() {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.estadisticas()
      .then(({ data }) => setStats(data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <View style={s.centerWrap}><ActivityIndicator color={C.yellow} size="large" /></View>;
  }

  if (!stats) {
    return (
      <View style={s.emptyWrap}>
        <Text style={s.emptyTxt}>No se pudieron cargar las estadísticas</Text>
      </View>
    );
  }

  const fmt = (n) => Number(n || 0).toLocaleString('es-CO');

  return (
    <ScrollView contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false}>
      <View style={s.statsGrid}>
        <View style={s.statCardYellow}>
          <Text style={s.statNum}>{fmt(stats.conductores_activos)}</Text>
          <Text style={s.statLbl}>Conductores activos</Text>
        </View>
        <View style={s.statCardWhite}>
          <Text style={s.statNum}>{fmt(stats.servicios_hoy)}</Text>
          <Text style={s.statLbl}>Servicios hoy</Text>
        </View>
      </View>

      <Text style={s.statsSectionLbl}>COMISIONES GENERADAS</Text>
      <View style={s.comisionCard}>
        <View style={s.comisionRow}>
          <Text style={s.comisionLbl}>Hoy</Text>
          <Text style={s.comisionVal}>${fmt(stats.comisiones_hoy)}</Text>
        </View>
        <View style={s.comisionSep} />
        <View style={s.comisionRow}>
          <Text style={s.comisionLbl}>Esta semana</Text>
          <Text style={s.comisionVal}>${fmt(stats.comisiones_semana)}</Text>
        </View>
        <View style={s.comisionSep} />
        <View style={s.comisionRow}>
          <Text style={s.comisionLbl}>Este mes</Text>
          <Text style={s.comisionVal}>${fmt(stats.comisiones_mes)}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

/* ─── Pantalla principal Admin ───────────────────── */

export default function AdminScreen({ navigate, onMenuPress }) {
  const [seccion, setSeccion] = useState('conductores');

  return (
    <View style={s.root}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.menuBtn} onPress={onMenuPress} activeOpacity={0.7}>
          <Text style={s.menuIcon}>☰</Text>
        </TouchableOpacity>
        <View style={s.headerLeft}>
          <Text style={s.headerTitle}>Panel Admin</Text>
          <Text style={s.headerSub}>Deone — Manizales</Text>
        </View>
        <View style={s.shieldBadge}>
          <Text style={s.shieldIcon}>🛡️</Text>
        </View>
      </View>

      {/* Selector de sección */}
      <View style={s.segmentWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.segmentScroll}>
          {SECCIONES.map((sec) => (
            <TouchableOpacity
              key={sec.key}
              style={seccion === sec.key ? s.segmentActive : s.segmentInactive}
              onPress={() => setSeccion(sec.key)}
              activeOpacity={0.8}
            >
              <Text style={s.segmentIcon}>{sec.icon}</Text>
              <Text style={seccion === sec.key ? s.segmentLabelActive : s.segmentLabel}>
                {sec.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Contenido */}
      {seccion === 'conductores' && <ConductoresSection navigate={navigate} />}
      {seccion === 'recargas'    && <RecargasSection />}
      {seccion === 'alertas'     && <AlertasSection />}
      {seccion === 'stats'       && <EstadisticasSection />}
    </View>
  );
}

/* ─── Estilos ────────────────────────────────────── */

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  /* Header */
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    paddingTop:        52,
    paddingBottom:     14,
    backgroundColor:   C.bg,
  },
  menuBtn:  { padding: 6, marginRight: 8 },
  menuIcon: { fontSize: 24, color: C.black },
  headerLeft:  { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: C.black },
  headerSub:   { fontSize: 13, color: C.gray, marginTop: 2 },
  shieldBadge: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: C.black,
    alignItems:      'center',
    justifyContent:  'center',
  },
  shieldIcon: { fontSize: 22 },

  /* Segment */
  segmentWrap:   { paddingBottom: 12 },
  segmentScroll: { paddingHorizontal: 16, gap: 8 },
  segmentActive: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   C.black,
    borderRadius:      20,
    paddingHorizontal: 16,
    paddingVertical:   8,
    gap:               6,
  },
  segmentInactive: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   C.white,
    borderRadius:      20,
    paddingHorizontal: 16,
    paddingVertical:   8,
    gap:               6,
    ...SHADOW,
  },
  segmentIcon:        { fontSize: 14 },
  segmentLabel:       { fontSize: 13, fontWeight: '600', color: C.gray },
  segmentLabelActive: { fontSize: 13, fontWeight: '700', color: C.yellow },

  /* List */
  listContent: { paddingHorizontal: 16, paddingBottom: 32, paddingTop: 4 },
  centerWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap:   { alignItems: 'center', paddingTop: 60 },
  emptyIcon:   { fontSize: 48, marginBottom: 14 },
  emptyTxt:    { color: C.gray, fontSize: 15, fontWeight: '500' },

  /* Conductor card */
  conductorCard: {
    backgroundColor: C.white,
    borderRadius:    20,
    padding:         16,
    marginBottom:    12,
    ...SHADOW,
  },
  conductorHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  conductorAvatar: {
    width:           46,
    height:          46,
    borderRadius:    23,
    backgroundColor: C.yellow,
    alignItems:      'center',
    justifyContent:  'center',
    marginRight:     12,
  },
  conductorAvatarTxt: { fontSize: 20, fontWeight: '800', color: C.black },
  conductorInfo:      { flex: 1 },
  conductorNombre:    { fontSize: 16, fontWeight: '700', color: C.black, marginBottom: 3 },
  conductorTel:       { fontSize: 13, color: C.gray },
  pendienteBadge: {
    backgroundColor:   '#FFF9E6',
    borderRadius:      10,
    paddingHorizontal: 10,
    paddingVertical:   4,
    borderWidth:       1,
    borderColor:       '#FFD700',
  },
  pendienteBadgeTxt: { fontSize: 10, fontWeight: '700', color: '#7A5C00' },

  conductorMeta: {
    flexDirection:   'row',
    backgroundColor: C.bg,
    borderRadius:    14,
    padding:         12,
    marginBottom:    12,
  },
  metaItem:    { flex: 1, alignItems: 'center' },
  metaLbl:     { fontSize: 11, color: C.gray, marginBottom: 4 },
  metaVal:     { fontSize: 14, fontWeight: '700', color: C.black },
  metaDivider: { width: 1, backgroundColor: C.border },

  verDocsBtn: {
    backgroundColor:   C.bg,
    borderRadius:      12,
    paddingVertical:   10,
    alignItems:        'center',
    marginBottom:      10,
    borderWidth:       1,
    borderColor:       C.border,
  },
  verDocsBtnTxt: { fontSize: 14, fontWeight: '600', color: C.black },

  actionRow:   { flexDirection: 'row', gap: 10 },
  rechazarBtn: {
    flex:            1,
    backgroundColor: C.red,
    borderRadius:    14,
    paddingVertical: 13,
    alignItems:      'center',
  },
  rechazarBtnTxt: { color: C.white, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  aprobarBtn: {
    flex:            2,
    backgroundColor: '#22C55E',
    borderRadius:    14,
    paddingVertical: 13,
    alignItems:      'center',
  },
  aprobarBtnDis: {
    flex:            2,
    backgroundColor: C.border,
    borderRadius:    14,
    paddingVertical: 13,
    alignItems:      'center',
  },
  aprobarBtnTxt: { color: C.white, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },

  /* Recarga card */
  recargaCard: {
    backgroundColor: C.white,
    borderRadius:    20,
    padding:         16,
    marginBottom:    12,
    ...SHADOW,
  },
  recargaTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  recargaNombre:   { fontSize: 15, fontWeight: '700', color: C.black, marginBottom: 3 },
  recargaTel:      { fontSize: 13, color: C.gray },
  recargaMontoWrap:{ alignItems: 'flex-end' },
  recargaMonto:    { fontSize: 20, fontWeight: '800', color: C.black },
  recargaFecha:    { fontSize: 11, color: C.gray, marginTop: 3 },

  /* Alertas */
  alertaSectionLbl: {
    fontSize:      11,
    fontWeight:    '700',
    letterSpacing: 2,
    color:         C.gray,
    marginBottom:  8,
    marginTop:     12,
  },
  alertaCard: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: C.white,
    borderRadius:    16,
    padding:         14,
    marginBottom:    8,
    ...SHADOW,
  },
  alertaIcon:    { fontSize: 22, marginRight: 14 },
  alertaInfo:    { flex: 1 },
  alertaNombre:  { fontSize: 14, fontWeight: '700', color: C.black, marginBottom: 3 },
  alertaDetalle: { fontSize: 13, color: C.gray },

  /* Estadísticas */
  statsGrid: {
    flexDirection: 'row',
    gap:           12,
    marginBottom:  20,
  },
  statCardYellow: {
    flex:            1,
    backgroundColor: C.yellow,
    borderRadius:    20,
    padding:         18,
    alignItems:      'center',
    ...SHADOW,
  },
  statCardWhite: {
    flex:            1,
    backgroundColor: C.white,
    borderRadius:    20,
    padding:         18,
    alignItems:      'center',
    ...SHADOW,
  },
  statNum: { fontSize: 32, fontWeight: '800', color: C.black, marginBottom: 6 },
  statLbl: { fontSize: 12, color: C.black, fontWeight: '500', textAlign: 'center' },

  statsSectionLbl: {
    fontSize:      11,
    fontWeight:    '700',
    letterSpacing: 2,
    color:         C.gray,
    marginBottom:  10,
  },
  comisionCard: {
    backgroundColor: C.white,
    borderRadius:    20,
    overflow:        'hidden',
    ...SHADOW,
  },
  comisionRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 18,
    paddingVertical:   16,
  },
  comisionSep: { height: 1, backgroundColor: C.border, marginHorizontal: 18 },
  comisionLbl: { fontSize: 14, color: C.gray },
  comisionVal: { fontSize: 18, fontWeight: '800', color: C.black },

  /* Motivo modal */
  overlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent:  'center',
    paddingHorizontal: 24,
  },
  motivoCard: {
    backgroundColor: C.white,
    borderRadius:    24,
    padding:         24,
    ...SHADOW,
  },
  motivoTitle:   { fontSize: 17, fontWeight: '700', color: C.black, marginBottom: 16 },
  motivoInput: {
    borderWidth:      1.5,
    borderColor:      C.border,
    borderRadius:     12,
    padding:          14,
    fontSize:         15,
    color:            C.black,
    minHeight:        90,
    textAlignVertical:'top',
    marginBottom:     18,
  },
  motivoBtns:       { flexDirection: 'row', gap: 10 },
  motivoCancelBtn: {
    flex:            1,
    backgroundColor: C.bg,
    borderRadius:    12,
    paddingVertical: 13,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     C.border,
  },
  motivoCancelTxt: { color: C.gray, fontSize: 14, fontWeight: '600' },
  motivoConfirmBtn: {
    flex:            2,
    backgroundColor: C.red,
    borderRadius:    12,
    paddingVertical: 13,
    alignItems:      'center',
  },
  motivoConfirmTxt: { color: C.white, fontSize: 14, fontWeight: '700' },
});
