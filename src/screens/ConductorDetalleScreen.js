import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput, Linking,
  StyleSheet, StatusBar, ActivityIndicator, Alert, Modal, RefreshControl,
} from 'react-native';
import { adminApi } from '../api/client';
import { C, SHADOW } from '../constants/theme';
import { SERVICES } from '../constants/services';
import { estadoBadgeInfo } from './AdminScreen';

const ESTADOS_REACTIVABLES = new Set([
  'suspension_rating', 'revision_manual', 'suspension_pendiente_revision',
  'suspendido', 'advertencia', 'inactivo',
]);

function labelVehiculo(tipoServicio) {
  return SERVICES.find((s) => s.id === tipoServicio)?.label || tipoServicio || '—';
}

function formatFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function limpiarTelefono(telefono) {
  return (telefono || '').replace(/[^\d+]/g, '');
}

/* ─── Modal de suspensión ─────────────────────────── */

function SuspenderModal({ visible, onConfirm, onCancel }) {
  const [motivo, setMotivo] = useState('');
  const [dias,   setDias]   = useState('');

  const handleConfirm = () => {
    if (!motivo.trim()) {
      Alert.alert('Campo requerido', 'Escribe un motivo de suspensión.');
      return;
    }
    const diasNum = dias.trim() ? parseInt(dias, 10) : null;
    onConfirm(motivo.trim(), diasNum && diasNum > 0 ? diasNum : null);
    setMotivo('');
    setDias('');
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.overlay}>
        <View style={s.motivoCard}>
          <Text style={s.motivoTitle}>Suspender conductor</Text>
          <TextInput
            style={s.motivoInput}
            placeholder="Motivo de la suspensión..."
            placeholderTextColor={C.gray}
            value={motivo}
            onChangeText={setMotivo}
            multiline
            numberOfLines={3}
            autoFocus
          />
          <TextInput
            style={s.diasInput}
            placeholder="Días (vacío = indefinida)"
            placeholderTextColor={C.gray}
            value={dias}
            onChangeText={setDias}
            keyboardType="number-pad"
          />
          <View style={s.motivoBtns}>
            <TouchableOpacity style={s.motivoCancelBtn} onPress={onCancel} activeOpacity={0.8}>
              <Text style={s.motivoCancelTxt}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.motivoConfirmBtn} onPress={handleConfirm} activeOpacity={0.85}>
              <Text style={s.motivoConfirmTxt}>Suspender</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ─── Pantalla principal ─────────────────────────── */

export default function ConductorDetalleScreen({ params, navigate, onBack }) {
  const { conductorId, conductorNombre } = params;

  const [resumen,      setResumen]      = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [procesando,   setProcesando]   = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const cargar = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const { data } = await adminApi.conductorResumen(conductorId);
      setResumen(data);
    } catch {
      Alert.alert('Error', 'No se pudo cargar la información del conductor.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [conductorId]);

  useEffect(() => { cargar(); }, [cargar]);

  const llamar = () => {
    const tel = limpiarTelefono(resumen?.perfil?.telefono);
    if (!tel) return;
    Linking.openURL(`tel:${tel}`).catch(() => Alert.alert('Error', 'No se pudo abrir el marcador.'));
  };

  const whatsapp = () => {
    const tel = limpiarTelefono(resumen?.perfil?.telefono);
    if (!tel) return;
    Linking.openURL(`https://wa.me/${tel.replace('+', '')}`).catch(() =>
      Alert.alert('Error', 'No se pudo abrir WhatsApp.'));
  };

  const suspender = async (motivo, dias) => {
    setModalVisible(false);
    setProcesando(true);
    try {
      await adminApi.suspenderConductor(conductorId, motivo, dias);
      Alert.alert('Listo', 'Conductor suspendido.');
      cargar();
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.detail || 'No se pudo suspender al conductor.');
    } finally {
      setProcesando(false);
    }
  };

  const reactivar = async () => {
    setProcesando(true);
    try {
      await adminApi.reactivarConductor(conductorId);
      Alert.alert('Listo', 'Conductor reactivado.');
      cargar();
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.detail || 'No se pudo reactivar al conductor.');
    } finally {
      setProcesando(false);
    }
  };

  if (loading) {
    return (
      <View style={s.root}>
        <StatusBar backgroundColor={C.bg} barStyle="dark-content" />
        <View style={s.centerWrap}><ActivityIndicator color={C.yellow} size="large" /></View>
      </View>
    );
  }

  const perfil   = resumen?.perfil;
  const vehiculo = resumen?.vehiculo;
  const docs     = resumen?.documentos;
  const stats    = resumen?.estadisticas;
  const penalizaciones = resumen?.penalizaciones_recientes || [];
  const badge = estadoBadgeInfo(perfil?.estado_cuenta);

  return (
    <View style={s.root}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />

      <SuspenderModal
        visible={modalVisible}
        onConfirm={suspender}
        onCancel={() => setModalVisible(false)}
      />

      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle} numberOfLines={1}>{conductorNombre || perfil?.nombre || 'Conductor'}</Text>
          <Text style={s.headerSub}>Detalle del conductor</Text>
        </View>
        <View style={s.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => cargar(true)} colors={[C.yellow]} />}
      >
        {/* Perfil */}
        <View style={s.card}>
          <View style={s.perfilTop}>
            <View style={s.avatar}>
              <Text style={s.avatarTxt}>{(perfil?.nombre || 'C')[0].toUpperCase()}</Text>
            </View>
            <View style={s.perfilInfo}>
              <Text style={s.perfilNombre}>{perfil?.nombre || '—'}</Text>
              <Text style={s.perfilTel}>{perfil?.telefono || '—'}</Text>
            </View>
            <View style={[s.estadoBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
              <Text style={[s.estadoBadgeTxt, { color: badge.color }]}>{badge.label}</Text>
            </View>
          </View>

          <View style={s.metaRow}>
            <View style={s.metaItem}>
              <Text style={s.metaLbl}>Rating</Text>
              <Text style={s.metaVal}>★ {perfil?.rating ?? '—'}</Text>
            </View>
            <View style={s.metaDivider} />
            <View style={s.metaItem}>
              <Text style={s.metaLbl}>Registro</Text>
              <Text style={s.metaVal}>{formatFecha(perfil?.created_at)}</Text>
            </View>
            <View style={s.metaDivider} />
            <View style={s.metaItem}>
              <Text style={s.metaLbl}>Cancelaciones</Text>
              <Text style={s.metaVal}>{perfil?.cancelaciones_count ?? 0}</Text>
            </View>
          </View>

          {perfil?.suspension_hasta && (
            <Text style={s.suspensionTxt}>Suspendido hasta {formatFecha(perfil.suspension_hasta)}</Text>
          )}
          {perfil?.motivo_rechazo && (
            <Text style={s.suspensionTxt}>Motivo de rechazo: {perfil.motivo_rechazo}</Text>
          )}

          <View style={s.contactRow}>
            <TouchableOpacity style={s.contactBtn} onPress={llamar} activeOpacity={0.85}>
              <Text style={s.contactBtnTxt}>📞  Llamar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.contactBtn} onPress={whatsapp} activeOpacity={0.85}>
              <Text style={s.contactBtnTxt}>💬  WhatsApp</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Vehículo */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Vehículo</Text>
          {vehiculo ? (
            <View style={s.metaRow}>
              <View style={s.metaItem}>
                <Text style={s.metaLbl}>Tipo</Text>
                <Text style={s.metaVal}>{labelVehiculo(vehiculo.tipo_servicio)}</Text>
              </View>
              <View style={s.metaDivider} />
              <View style={s.metaItem}>
                <Text style={s.metaLbl}>Placa</Text>
                <Text style={s.metaVal}>{vehiculo.placa || '—'}</Text>
              </View>
            </View>
          ) : (
            <Text style={s.emptyCardTxt}>Sin vehículo registrado</Text>
          )}
          {vehiculo && (
            <Text style={s.vehiculoDetalle}>
              {[vehiculo.marca, vehiculo.modelo, vehiculo.año, vehiculo.color].filter(Boolean).join(' · ')}
            </Text>
          )}
        </View>

        {/* Documentos */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Documentos</Text>
          <Text style={s.docsResumen}>
            {docs?.verificados ?? 0}/{docs?.total ?? 0} verificados · {docs?.subidos ?? 0} subidos
          </Text>
          <TouchableOpacity
            style={s.verDocsBtn}
            onPress={() => navigate('DocumentosAdmin', { conductorId, conductorNombre: perfil?.nombre })}
            activeOpacity={0.8}
          >
            <Text style={s.verDocsBtnTxt}>📄  Ver documentos</Text>
          </TouchableOpacity>
        </View>

        {/* Estadísticas */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Actividad</Text>
          <View style={s.metaRow}>
            <View style={s.metaItem}>
              <Text style={s.metaLbl}>Completados</Text>
              <Text style={s.metaVal}>{stats?.servicios_completados ?? 0}</Text>
            </View>
            <View style={s.metaDivider} />
            <View style={s.metaItem}>
              <Text style={s.metaLbl}>Cancel. 30d</Text>
              <Text style={s.metaVal}>{stats?.cancelaciones_30d ?? 0}</Text>
            </View>
            <View style={s.metaDivider} />
            <View style={s.metaItem}>
              <Text style={s.metaLbl}>Saldo</Text>
              <Text style={s.metaVal}>${Number(perfil?.saldo || 0).toLocaleString('es-CO')}</Text>
            </View>
          </View>
        </View>

        {/* Penalizaciones recientes */}
        {penalizaciones.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Penalizaciones recientes</Text>
            {penalizaciones.map((p, i) => (
              <View key={i} style={s.penaRow}>
                <Text style={s.penaAccion}>{p.accion}</Text>
                <Text style={s.penaFecha}>{formatFecha(p.created_at)}</Text>
                {p.motivo ? <Text style={s.penaMotivo}>{p.motivo}</Text> : null}
              </View>
            ))}
          </View>
        )}

        {/* Acciones */}
        <View style={s.actionsWrap}>
          {perfil?.estado_cuenta === 'activo' && (
            <TouchableOpacity
              style={s.suspenderBtn}
              onPress={() => setModalVisible(true)}
              disabled={procesando}
              activeOpacity={0.85}
            >
              {procesando
                ? <ActivityIndicator color={C.white} size="small" />
                : <Text style={s.suspenderBtnTxt}>⚠️  SUSPENDER CONDUCTOR</Text>
              }
            </TouchableOpacity>
          )}
          {ESTADOS_REACTIVABLES.has(perfil?.estado_cuenta) && (
            <TouchableOpacity
              style={s.reactivarBtn}
              onPress={reactivar}
              disabled={procesando}
              activeOpacity={0.85}
            >
              {procesando
                ? <ActivityIndicator color={C.white} size="small" />
                : <Text style={s.reactivarBtnTxt}>✓  REACTIVAR CONDUCTOR</Text>
              }
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/* ─── Estilos ────────────────────────────────────── */

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: C.bg },
  centerWrap:{ flex: 1, alignItems: 'center', justifyContent: 'center' },
  content:   { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 8 },

  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingTop:        52,
    paddingBottom:     14,
    backgroundColor:   C.bg,
  },
  backBtn:      { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backArrow:    { fontSize: 32, color: C.black, fontWeight: '300', lineHeight: 38 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle:  { fontSize: 17, fontWeight: '700', color: C.black },
  headerSub:    { fontSize: 12, color: C.gray, marginTop: 2 },

  card: {
    backgroundColor: C.white,
    borderRadius:    20,
    padding:         16,
    marginBottom:    14,
    ...SHADOW,
  },
  cardTitle: { fontSize: 13, fontWeight: '700', color: C.black, marginBottom: 12, letterSpacing: 0.3 },

  perfilTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  avatar: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: C.yellow, alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  avatarTxt:    { fontSize: 22, fontWeight: '800', color: C.black },
  perfilInfo:   { flex: 1 },
  perfilNombre: { fontSize: 17, fontWeight: '700', color: C.black, marginBottom: 3 },
  perfilTel:    { fontSize: 13, color: C.gray },

  estadoBadge: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  estadoBadgeTxt: { fontSize: 11, fontWeight: '700' },

  metaRow: {
    flexDirection:   'row',
    backgroundColor: C.bg,
    borderRadius:    14,
    padding:         12,
  },
  metaItem:    { flex: 1, alignItems: 'center' },
  metaLbl:     { fontSize: 11, color: C.gray, marginBottom: 4 },
  metaVal:     { fontSize: 14, fontWeight: '700', color: C.black },
  metaDivider: { width: 1, backgroundColor: C.border },

  suspensionTxt: { fontSize: 12, color: C.red, marginTop: 10, fontWeight: '600' },

  contactRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  contactBtn: {
    flex:            1,
    backgroundColor: C.bg,
    borderRadius:    12,
    paddingVertical: 12,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     C.border,
  },
  contactBtnTxt: { fontSize: 14, fontWeight: '600', color: C.black },

  emptyCardTxt: { fontSize: 13, color: C.gray, fontStyle: 'italic' },
  vehiculoDetalle: { fontSize: 13, color: C.gray, marginTop: 10 },

  docsResumen: { fontSize: 13, color: C.gray, marginBottom: 12 },
  verDocsBtn: {
    backgroundColor:   C.bg,
    borderRadius:      12,
    paddingVertical:   10,
    alignItems:        'center',
    borderWidth:       1,
    borderColor:       C.border,
  },
  verDocsBtnTxt: { fontSize: 14, fontWeight: '600', color: C.black },

  penaRow:    { paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.border },
  penaAccion: { fontSize: 13, fontWeight: '700', color: C.black },
  penaFecha:  { fontSize: 11, color: C.gray, marginTop: 2 },
  penaMotivo: { fontSize: 12, color: C.gray, marginTop: 3 },

  actionsWrap: { gap: 10, marginTop: 4 },
  suspenderBtn: {
    backgroundColor: C.red,
    borderRadius:    14,
    paddingVertical: 14,
    alignItems:      'center',
    ...SHADOW,
  },
  suspenderBtnTxt: { color: C.white, fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  reactivarBtn: {
    backgroundColor: '#22C55E',
    borderRadius:    14,
    paddingVertical: 14,
    alignItems:      'center',
    ...SHADOW,
  },
  reactivarBtnTxt: { color: C.white, fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },

  /* Modal */
  overlay: {
    flex:              1,
    backgroundColor:   'rgba(0,0,0,0.55)',
    justifyContent:    'center',
    paddingHorizontal: 24,
  },
  motivoCard:  { backgroundColor: C.white, borderRadius: 24, padding: 24, ...SHADOW },
  motivoTitle: { fontSize: 17, fontWeight: '700', color: C.black, marginBottom: 16 },
  motivoInput: {
    borderWidth:       1.5,
    borderColor:       C.border,
    borderRadius:      12,
    padding:           14,
    fontSize:          15,
    color:             C.black,
    minHeight:         80,
    textAlignVertical: 'top',
    marginBottom:      12,
  },
  diasInput: {
    borderWidth:  1.5,
    borderColor:  C.border,
    borderRadius: 12,
    padding:      14,
    fontSize:     15,
    color:        C.black,
    marginBottom: 18,
  },
  motivoBtns:       { flexDirection: 'row', gap: 10 },
  motivoCancelBtn:  { flex: 1, backgroundColor: C.bg, borderRadius: 12, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  motivoCancelTxt:  { color: C.gray, fontSize: 14, fontWeight: '600' },
  motivoConfirmBtn: { flex: 2, backgroundColor: C.red, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  motivoConfirmTxt: { color: C.white, fontSize: 14, fontWeight: '700' },
});
