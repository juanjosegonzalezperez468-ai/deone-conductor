import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, StatusBar, ActivityIndicator, Alert, Modal, RefreshControl, Linking,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { adminApi } from '../api/client';
import { C, SHADOW } from '../constants/theme';
import { SERVICES } from '../constants/services';

/* ─── Constantes ──────────────────────────────────── */

const SECCIONES = [
  { key: 'mapa',        label: 'Mapa',        icon: '🗺️' },
  { key: 'rutas',       label: 'Rutas',       icon: '📦' },
  { key: 'conductores', label: 'Conductores', icon: '👤' },
  { key: 'directorio',  label: 'Directorio',  icon: '👥' },
  { key: 'recargas',    label: 'Recargas',    icon: '💳' },
  { key: 'alertas',     label: 'Alertas',     icon: '🚨' },
  { key: 'stats',       label: 'Estadísticas',icon: '📊' },
];

const ESTADO_BADGE = {
  activo:    { bg: '#F0FDF4', border: '#BBF7D0', color: '#15803D', label: 'Activo' },
  pendiente: { bg: '#FFF9E6', border: '#FFD700', color: '#7A5C00', label: 'Pendiente' },
  suspendido:{ bg: '#FEF2F2', border: '#FECACA', color: '#B91C1C', label: 'Suspendido' },
  inactivo:  { bg: '#F3F4F6', border: '#E5E7EB', color: '#6B7280', label: 'Inactivo (saldo)' },
  rechazado: { bg: '#FEF2F2', border: '#FECACA', color: '#B91C1C', label: 'Rechazado' },
};
const ESTADO_DEFAULT = { bg: '#F3F4F6', border: '#E5E7EB', color: '#6B7280', label: null };

export function estadoBadgeInfo(estado) {
  const info = ESTADO_BADGE[estado] || ESTADO_DEFAULT;
  return { ...info, label: info.label || (estado || '—') };
}

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
  const [conductores,     setConductores]     = useState([]);
  const [documentosPend,  setDocumentosPend]  = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [procesando,      setProcesando]      = useState(null);
  const [motivoModal,     setMotivoModal]     = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [pendientesRes, documentosRes] = await Promise.all([
        adminApi.conductoresPendientes(),
        adminApi.documentosPendientes(),
      ]);
      setConductores(pendientesRes.data.conductores || []);
      // Solo interesan documentos de conductores YA aprobados (activo) que
      // subieron una actualización (p. ej. SOAT renovado). Los que están en
      // registro inicial se revisan arriba; los rechazados no aplican aquí.
      setDocumentosPend(
        (documentosRes.data.conductores || []).filter((c) => c.estado_cuenta === 'activo')
      );
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

      {conductores.length === 0 && documentosPend.length === 0 && (
        <View style={s.emptyWrap}>
          <Text style={s.emptyIcon}>✅</Text>
          <Text style={s.emptyTxt}>Sin conductores pendientes</Text>
        </View>
      )}

      {conductores.length > 0 && documentosPend.length > 0 && (
        <Text style={s.alertaSectionLbl}>NUEVOS REGISTROS</Text>
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

      {documentosPend.length > 0 && (
        <Text style={s.alertaSectionLbl}>DOCUMENTOS ACTUALIZADOS POR REVISAR</Text>
      )}

      {documentosPend.map((c) => (
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
              <Text style={s.pendienteBadgeTxt}>
                {c.tipos_pendientes?.length || 0} DOC{(c.tipos_pendientes?.length || 0) === 1 ? '' : 'S'}
              </Text>
            </View>
          </View>

          <View style={s.conductorMeta}>
            <View style={s.metaItem}>
              <Text style={s.metaLbl}>Vehículo</Text>
              <Text style={s.metaVal}>{c.tipo_vehiculo || '—'}</Text>
            </View>
            <View style={s.metaDivider} />
            <View style={s.metaItem}>
              <Text style={s.metaLbl}>Actualizado</Text>
              <Text style={s.metaVal}>{formatFecha(c.ultima_actualizacion)}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={s.verDocsBtn}
            onPress={() => navigate('DocumentosAdmin', { conductorId: c.id, conductorNombre: c.nombre })}
            activeOpacity={0.8}
          >
            <Text style={s.verDocsBtnTxt}>📄  Revisar documentos</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

/* ─── Sección: Directorio de conductores ─────────── */

const GRUPO_SIN_VEHICULO = { id: '__sin_vehiculo', label: 'Sin vehículo registrado', icon: '❓' };

function DirectorioSection({ navigate }) {
  const [conductores, setConductores] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);

  const cargar = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const { data } = await adminApi.conductoresTodos();
      setConductores(data.conductores || []);
    } catch {
      Alert.alert('Error', 'No se pudo cargar el directorio de conductores.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  if (loading) {
    return <View style={s.centerWrap}><ActivityIndicator color={C.yellow} size="large" /></View>;
  }

  const grupos = [...SERVICES, GRUPO_SIN_VEHICULO].map((grupo) => ({
    ...grupo,
    conductores: conductores.filter((c) => (c.tipo_vehiculo || GRUPO_SIN_VEHICULO.id) === grupo.id),
  })).filter((g) => g.conductores.length > 0);

  return (
    <ScrollView
      contentContainerStyle={s.listContent}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => cargar(true)} colors={[C.yellow]} />}
    >
      {conductores.length === 0 && (
        <View style={s.emptyWrap}>
          <Text style={s.emptyIcon}>👥</Text>
          <Text style={s.emptyTxt}>Aún no hay conductores registrados</Text>
        </View>
      )}

      {grupos.map((grupo) => (
        <View key={grupo.id} style={s.grupoWrap}>
          <View style={s.grupoHeader}>
            <Text style={s.grupoIcon}>{grupo.icon}</Text>
            <Text style={s.grupoLabel}>{grupo.label}</Text>
            <Text style={s.grupoCount}>{grupo.conductores.length}</Text>
          </View>

          {grupo.conductores.map((c) => {
            const badge = estadoBadgeInfo(c.estado_cuenta);
            return (
              <TouchableOpacity
                key={c.id}
                style={s.dirCard}
                onPress={() => navigate('ConductorDetalle', { conductorId: c.id, conductorNombre: c.nombre })}
                activeOpacity={0.8}
              >
                <View style={s.conductorAvatar}>
                  <Text style={s.conductorAvatarTxt}>{(c.nombre || 'C')[0].toUpperCase()}</Text>
                </View>
                <View style={s.dirInfo}>
                  <Text style={s.conductorNombre}>{c.nombre || '—'}</Text>
                  <Text style={s.conductorTel}>{c.telefono || '—'} · ★ {c.rating ?? '—'}</Text>
                </View>
                <View style={[s.estadoBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                  <Text style={[s.estadoBadgeTxt, { color: badge.color }]}>{badge.label}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
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

  const rechazar = (r) => {
    Alert.alert(
      'Rechazar recarga',
      `¿Rechazar la solicitud de $${Number(r.monto || 0).toLocaleString('es-CO')} de ${r.conductor?.nombre || 'este conductor'}? El conductor podrá enviar una nueva solicitud.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Rechazar',
          style: 'destructive',
          onPress: async () => {
            setProcesando(r.id);
            try {
              await adminApi.rechazarRecarga(r.id);
              Alert.alert('Rechazada', 'La recarga fue rechazada.');
              cargar();
            } catch {
              Alert.alert('Error', 'No se pudo rechazar la recarga.');
            } finally {
              setProcesando(null);
            }
          },
        },
      ],
    );
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
          <View style={s.actionRow}>
            <TouchableOpacity
              style={s.rechazarBtn}
              onPress={() => rechazar(r)}
              disabled={procesando === r.id}
              activeOpacity={0.85}
            >
              <Text style={s.rechazarBtnTxt}>RECHAZAR</Text>
            </TouchableOpacity>
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

/* ─── Sección: Mapa de conductores ───────────────── */

const MANIZALES = {
  latitude: 5.0703, longitude: -75.5138,
  latitudeDelta: 0.06, longitudeDelta: 0.06,
};

const fmtHoras = (min) => {
  const m = Math.round(min || 0);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};

const iconoServicio = (tipo) =>
  (SERVICES.find((sv) => sv.id === tipo) || {}).icon || '🚗';

const labelServicio = (tipo) =>
  (SERVICES.find((sv) => sv.id === tipo) || {}).label || tipo || '—';

// Antigüedad del último ping ("hace 30 s", "hace 4 min")
const hacePing = (iso) => {
  if (!iso) return null;
  const seg = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seg < 60) return `hace ${seg} s`;
  return `hace ${Math.round(seg / 60)} min`;
};

// Un conductor con ping reciente está realmente ahí; si lleva >3 min sin
// enviar ubicación (app cerrada, sin señal) el marcador se atenúa.
const pingReciente = (iso) =>
  iso && Date.now() - new Date(iso).getTime() < 3 * 60 * 1000;

function MapaSection() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [sel,     setSel]     = useState(null);
  const [vista,   setVista]   = useState('mapa'); // 'mapa' | 'ranking'
  const mapRef    = useRef(null);
  const encuadrado = useRef(false);

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    try {
      const { data: resp } = await adminApi.mapaConductores();
      setData(resp);
      // Refrescar también la tarjeta de detalle abierta con los datos nuevos
      setSel((prev) => {
        if (!prev) return prev;
        return (resp.conectados || []).find((c) => c.conductor_id === prev.conductor_id) || prev;
      });
      // Encuadrar el mapa a los conductores solo la primera vez
      if (!encuadrado.current && resp.conectados?.length && mapRef.current) {
        encuadrado.current = true;
        mapRef.current.fitToCoordinates(
          resp.conectados.map((c) => ({ latitude: Number(c.lat), longitude: Number(c.lng) })),
          { edgePadding: { top: 60, bottom: 220, left: 60, right: 60 }, animated: true },
        );
      }
    } catch {
      if (!silencioso) Alert.alert('Error', 'No se pudo cargar el mapa de conductores.');
    } finally {
      if (!silencioso) setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
    const interval = setInterval(() => cargar(true), 15000);
    return () => clearInterval(interval);
  }, [cargar]);

  const conectados = data?.conectados || [];
  const ranking    = data?.ranking_semana || [];

  if (loading) {
    return (
      <View style={s.centerWrap}>
        <ActivityIndicator size="large" color={C.yellow} />
      </View>
    );
  }

  if (vista === 'ranking') {
    return (
      <ScrollView contentContainerStyle={s.listContent}>
        <TouchableOpacity style={s.mapaToggleBtn} onPress={() => setVista('mapa')} activeOpacity={0.8}>
          <Text style={s.mapaToggleTxt}>🗺️  Volver al mapa</Text>
        </TouchableOpacity>

        <Text style={s.rankingTitulo}>Horas conectadas — últimos 7 días</Text>
        {ranking.length === 0 && (
          <View style={s.emptyWrap}>
            <Text style={s.emptyIcon}>⏱️</Text>
            <Text style={s.emptyTxt}>Aún no hay horas registradas.</Text>
            <Text style={s.rankingNota}>Las horas se acumulan desde que se activa esta función.</Text>
          </View>
        )}
        {ranking.map((r, i) => (
          <View key={r.conductor_id} style={s.rankingCard}>
            <Text style={s.rankingPos}>{i + 1}</Text>
            <View style={s.rankingInfo}>
              <View style={s.rankingNombreRow}>
                <View style={[s.puntoConexion, { backgroundColor: r.conectado ? C.green : C.border }]} />
                <Text style={s.rankingNombre} numberOfLines={1}>
                  {iconoServicio(r.vehiculo_tipo)}  {r.nombre}
                </Text>
              </View>
              <Text style={s.rankingSub}>
                Hoy: {fmtHoras(r.minutos_hoy)} · {r.dias_activos} día{r.dias_activos !== 1 ? 's' : ''} activo{r.dias_activos !== 1 ? 's' : ''}
              </Text>
            </View>
            <Text style={s.rankingHoras}>{fmtHoras(r.minutos_semana)}</Text>
          </View>
        ))}
      </ScrollView>
    );
  }

  return (
    <View style={s.mapaWrap}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={s.mapa}
        initialRegion={MANIZALES}
        onPress={() => setSel(null)}
      >
        {conectados.map((c) => {
          const tipo    = c.vehiculo?.tipo_servicio || (c.servicios_activos || [])[0];
          const reciente = pingReciente(c.updated_at);
          return (
            <Marker
              // La key incluye estado y frescura: con tracksViewChanges=false el
              // marcador no se re-dibuja solo, así que lo forzamos a remontarse
              // cuando el conductor cambia de disponible/no disponible.
              key={`${c.conductor_id}-${c.disponible ? 'on' : 'off'}-${reciente ? 'ok' : 'stale'}`}
              coordinate={{ latitude: Number(c.lat), longitude: Number(c.lng) }}
              onPress={() => setSel(c)}
              tracksViewChanges={false}
            >
              <View
                style={[
                  s.markerPin,
                  { borderColor: c.disponible ? C.green : C.gray, opacity: reciente ? 1 : 0.45 },
                ]}
              >
                <Text style={s.markerIcon}>{iconoServicio(tipo)}</Text>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Contador + botón ranking */}
      <View style={s.mapaTopBar}>
        <View style={s.mapaContador}>
          <View style={[s.puntoConexion, { backgroundColor: C.green }]} />
          <Text style={s.mapaContadorTxt}>
            {conectados.filter((c) => c.disponible).length} disponible
            {conectados.filter((c) => c.disponible).length !== 1 ? 's' : ''} · {conectados.length} conectado{conectados.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <TouchableOpacity style={s.mapaRankingBtn} onPress={() => setVista('ranking')} activeOpacity={0.8}>
          <Text style={s.mapaRankingBtnTxt}>⏱️ Horas</Text>
        </TouchableOpacity>
      </View>

      {/* Detalle del conductor seleccionado */}
      {sel && (
        <View style={s.mapaDetalle}>
          <View style={s.mapaDetalleHeader}>
            <Text style={s.mapaDetalleNombre} numberOfLines={1}>
              {iconoServicio(sel.vehiculo?.tipo_servicio || (sel.servicios_activos || [])[0])}  {sel.nombre}
            </Text>
            <View style={[s.dispBadge, { backgroundColor: sel.disponible ? C.greenBg : C.bg, borderColor: sel.disponible ? C.greenBorder : C.border }]}>
              <Text style={[s.dispBadgeTxt, { color: sel.disponible ? '#15803D' : C.gray }]}>
                {sel.disponible ? 'Disponible' : 'No disponible'}
              </Text>
            </View>
          </View>
          <Text style={s.mapaDetalleSub}>
            {labelServicio(sel.vehiculo?.tipo_servicio)}
            {sel.vehiculo?.subtipo ? ` · ${sel.vehiculo.subtipo}` : ''}
            {sel.vehiculo?.placa ? ` · ${sel.vehiculo.placa}` : ''}
            {sel.rating ? ` · ★ ${Number(sel.rating).toFixed(1)}` : ''}
            {hacePing(sel.updated_at) ? ` · 📡 ${hacePing(sel.updated_at)}` : ''}
          </Text>
          <View style={s.mapaDetalleMeta}>
            <View style={s.metaItem}>
              <Text style={s.metaLbl}>Hoy</Text>
              <Text style={s.metaVal}>{fmtHoras(sel.minutos_hoy)}</Text>
            </View>
            <View style={s.metaDivider} />
            <View style={s.metaItem}>
              <Text style={s.metaLbl}>Esta semana</Text>
              <Text style={s.metaVal}>{fmtHoras(sel.minutos_semana)}</Text>
            </View>
            <View style={s.metaDivider} />
            <View style={s.metaItem}>
              <Text style={s.metaLbl}>Teléfono</Text>
              <Text style={s.metaVal}>{sel.telefono || '—'}</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

/* ─── Sección: Rutas de reparto ──────────────────── */

const RUTA_ESTADOS = {
  publicada:           { label: 'Publicada',              color: '#6B7280' },
  aceptada:            { label: 'Aceptada',               color: '#3B82F6' },
  en_recogida:         { label: 'En recogida',            color: '#3B82F6' },
  en_reparto:          { label: 'En reparto',             color: '#3B82F6' },
  finalizada:          { label: 'Finalizada ✔',          color: '#15803D' },
  cancelada_cliente:   { label: 'Cancelada (cliente)',    color: '#B91C1C' },
  cancelada_conductor: { label: 'Cancelada (conductor)',  color: '#B91C1C' },
  expirada:            { label: 'Expirada',               color: '#6B7280' },
};

const fmtCOPr = (n) => Number(n || 0).toLocaleString('es-CO');
const fmtFechaHora = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
};

function RutasAdminSection() {
  const [rutas,      setRutas]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detalle,    setDetalle]    = useState(null); // ruta con paradas y penalizaciones
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const cargar = useCallback(async (esRefresh = false) => {
    if (esRefresh) setRefreshing(true); else setLoading(true);
    try {
      const { data } = await adminApi.rutas();
      setRutas(data.rutas || []);
    } catch {
      Alert.alert('Error', 'No se pudieron cargar las rutas.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirDetalle = async (rutaId) => {
    setCargandoDetalle(true);
    try {
      const { data } = await adminApi.rutaDetalle(rutaId);
      setDetalle(data);
    } catch {
      Alert.alert('Error', 'No se pudo cargar el detalle de la ruta.');
    } finally {
      setCargandoDetalle(false);
    }
  };

  if (loading) {
    return <View style={s.centerWrap}><ActivityIndicator color={C.yellow} size="large" /></View>;
  }

  /* Vista detalle */
  if (detalle) {
    const est = RUTA_ESTADOS[detalle.estado] || { label: detalle.estado, color: C.gray };
    return (
      <ScrollView contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={s.mapaToggleBtn} onPress={() => setDetalle(null)} activeOpacity={0.8}>
          <Text style={s.mapaToggleTxt}>←  Volver al listado</Text>
        </TouchableOpacity>

        <View style={s.conductorCard}>
          <View style={s.rutaDetalleHeader}>
            <Text style={s.rutaDetalleTitulo}>
              {detalle.numero_paradas} entrega{detalle.numero_paradas !== 1 ? 's' : ''} · {detalle.horas_cotizadas} h
            </Text>
            <View style={[s.estadoBadge, { backgroundColor: est.color + '22', borderColor: est.color }]}>
              <Text style={[s.estadoBadgeTxt, { color: est.color }]}>{est.label}</Text>
            </View>
          </View>
          <Text style={s.rutaDetalleLinea}>🏪 Cliente: {detalle.cliente_info?.nombre || '—'} · {detalle.cliente_info?.telefono || '—'}</Text>
          <Text style={s.rutaDetalleLinea}>
            🚚 Conductor: {detalle.conductor_info?.nombre || 'Sin asignar'}
            {detalle.conductor_info?.telefono ? ` · ${detalle.conductor_info.telefono}` : ''}
          </Text>
          <Text style={s.rutaDetalleLinea}>📍 Recogida: {detalle.punto_recogida_direccion}</Text>
          <Text style={s.rutaDetalleLinea}>
            💰 ${fmtCOPr(detalle.valor_final || detalle.precio_total)}
            {detalle.valor_excedente > 0 ? ` (incluye $${fmtCOPr(detalle.valor_excedente)} de excedente)` : ''}
            {detalle.comision ? ` · comisión $${fmtCOPr(detalle.comision)}` : ''}
          </Text>
          <Text style={s.rutaDetalleLinea}>
            🕐 {detalle.programada_para ? `Programada: ${fmtFechaHora(detalle.programada_para)}` : `Creada: ${fmtFechaHora(detalle.created_at)}`}
            {detalle.hora_inicio_real ? ` · Inició: ${fmtFechaHora(detalle.hora_inicio_real)}` : ''}
            {detalle.hora_fin_real ? ` · Terminó: ${fmtFechaHora(detalle.hora_fin_real)}` : ''}
          </Text>
          {detalle.valor_cancelacion > 0 && (
            <Text style={s.rutaDetalleCancelacion}>
              ⚠️ Multa de cancelación aplicada: ${fmtCOPr(detalle.valor_cancelacion)}
              {detalle.motivo_cancelacion ? ` — ${detalle.motivo_cancelacion}` : ''}
            </Text>
          )}
        </View>

        <Text style={s.alertaSectionLbl}>PARADAS</Text>
        {(detalle.paradas || []).map((p) => {
          const pEst = p.estado === 'entregada'
            ? { txt: 'Entregada ✓', color: '#15803D' }
            : p.estado === 'pendiente'
              ? { txt: 'Pendiente', color: '#6B7280' }
              : { txt: p.estado === 'devuelta' ? 'Devuelta' : 'Fallida', color: '#B91C1C' };
          return (
            <View key={p.id} style={s.alertaCard}>
              <Text style={s.rutaParadaOrden}>{p.orden}</Text>
              <View style={s.alertaInfo}>
                <Text style={s.alertaNombre} numberOfLines={1}>{p.direccion}</Text>
                <Text style={s.alertaDetalle}>
                  {p.nombre_destinatario || 'Sin destinatario'}
                  {p.hora_salida ? ` · ${fmtFechaHora(p.hora_salida)}` : ''}
                  {p.espera_cliente_min > 0 ? ` · ⏱ ${p.espera_cliente_min} min espera` : ''}
                </Text>
                {p.motivo_fallo ? <Text style={s.rutaMotivoFallo}>Motivo: {p.motivo_fallo}</Text> : null}
              </View>
              <View style={s.rutaParadaRight}>
                <Text style={[s.estadoBadgeTxt, { color: pEst.color }]}>{pEst.txt}</Text>
                {p.foto_url ? (
                  <TouchableOpacity onPress={() => Linking.openURL(p.foto_url).catch(() => {})} activeOpacity={0.7}>
                    <Text style={s.rutaFotoLink}>📷 Ver foto</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          );
        })}

        {(detalle.penalizaciones || []).length > 0 && (
          <>
            <Text style={s.alertaSectionLbl}>PENALIZACIONES DE ESTA RUTA</Text>
            {detalle.penalizaciones.map((pen, i) => (
              <View key={`${pen.created_at}-${i}`} style={s.alertaCard}>
                <Text style={s.alertaIcon}>🚫</Text>
                <View style={s.alertaInfo}>
                  <Text style={s.alertaNombre}>{pen.accion || pen.tipo}</Text>
                  <Text style={s.alertaDetalle}>
                    {fmtFechaHora(pen.created_at)}
                    {pen.cancelaciones_acumuladas ? ` · cancelación #${pen.cancelaciones_acumuladas} del mes` : ''}
                    {pen.suspension_hasta ? ` · suspendido hasta ${fmtFechaHora(pen.suspension_hasta)}` : ''}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    );
  }

  /* Vista listado */
  return (
    <ScrollView
      contentContainerStyle={s.listContent}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => cargar(true)} colors={[C.yellow]} />}
    >
      {cargandoDetalle && <ActivityIndicator color={C.yellow} style={s.rutaDetalleLoading} />}
      {rutas.length === 0 && (
        <View style={s.emptyWrap}>
          <Text style={s.emptyIcon}>📦</Text>
          <Text style={s.emptyTxt}>Aún no hay rutas de reparto</Text>
        </View>
      )}
      {rutas.map((r) => {
        const est = RUTA_ESTADOS[r.estado] || { label: r.estado, color: C.gray };
        return (
          <TouchableOpacity key={r.id} style={s.dirCard} onPress={() => abrirDetalle(r.id)} activeOpacity={0.8}>
            <View style={s.conductorAvatar}>
              <Text style={s.conductorAvatarTxt}>📦</Text>
            </View>
            <View style={s.dirInfo}>
              <Text style={s.conductorNombre} numberOfLines={1}>
                {r.cliente_nombre || 'Cliente'} → {r.conductor_nombre || 'sin conductor'}
              </Text>
              <Text style={s.conductorTel}>
                {r.paradas_entregadas}/{r.numero_paradas} entregas
                {r.paradas_fallidas > 0 ? ` · ${r.paradas_fallidas} fallida${r.paradas_fallidas !== 1 ? 's' : ''}` : ''}
                {' · $'}{fmtCOPr(r.valor_final || r.precio_total)}
              </Text>
              <Text style={s.rutaCardFecha}>{fmtFechaHora(r.programada_para || r.created_at)}</Text>
            </View>
            <View style={[s.estadoBadge, { backgroundColor: est.color + '22', borderColor: est.color }]}>
              <Text style={[s.estadoBadgeTxt, { color: est.color }]}>{est.label}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
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
          <Text style={s.headerSub}>Deone</Text>
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
      {seccion === 'mapa'        && <MapaSection />}
      {seccion === 'rutas'       && <RutasAdminSection />}
      {seccion === 'conductores' && <ConductoresSection navigate={navigate} />}
      {seccion === 'directorio'  && <DirectorioSection navigate={navigate} />}
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

  /* Mapa */
  mapaWrap: { flex: 1 },
  mapa:     { flex: 1 },
  markerPin: {
    backgroundColor: C.white,
    borderRadius:    18,
    borderWidth:     2.5,
    paddingHorizontal: 6,
    paddingVertical:   4,
    ...SHADOW,
  },
  markerIcon: { fontSize: 18 },
  mapaTopBar: {
    position:       'absolute',
    top:            10,
    left:           16,
    right:          16,
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  mapaContador: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   C.white,
    borderRadius:      18,
    paddingHorizontal: 14,
    paddingVertical:   8,
    gap:               8,
    ...SHADOW,
  },
  mapaContadorTxt: { fontSize: 13, fontWeight: '700', color: C.black },
  puntoConexion:   { width: 9, height: 9, borderRadius: 5 },
  mapaRankingBtn: {
    backgroundColor:   C.black,
    borderRadius:      18,
    paddingHorizontal: 14,
    paddingVertical:   8,
    ...SHADOW,
  },
  mapaRankingBtnTxt: { fontSize: 13, fontWeight: '700', color: C.yellow },
  mapaDetalle: {
    position:        'absolute',
    left:            16,
    right:           16,
    bottom:          16,
    backgroundColor: C.white,
    borderRadius:    20,
    padding:         16,
    ...SHADOW,
  },
  mapaDetalleHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   4,
  },
  mapaDetalleNombre: { fontSize: 16, fontWeight: '700', color: C.black, flex: 1, marginRight: 8 },
  dispBadge: {
    borderRadius:      10,
    paddingHorizontal: 10,
    paddingVertical:   4,
    borderWidth:       1,
  },
  dispBadgeTxt:   { fontSize: 10, fontWeight: '700' },
  mapaDetalleSub: { fontSize: 13, color: C.gray, marginBottom: 12 },
  mapaDetalleMeta: {
    flexDirection:   'row',
    backgroundColor: C.bg,
    borderRadius:    14,
    padding:         12,
  },
  mapaToggleBtn: {
    backgroundColor: C.white,
    borderRadius:    14,
    paddingVertical: 12,
    alignItems:      'center',
    marginBottom:    16,
    ...SHADOW,
  },
  mapaToggleTxt: { fontSize: 14, fontWeight: '700', color: C.black },
  rankingTitulo: { fontSize: 16, fontWeight: '800', color: C.black, marginBottom: 12 },
  rankingNota:   { fontSize: 12, color: C.gray, marginTop: 8, textAlign: 'center' },
  rankingCard: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: C.white,
    borderRadius:    16,
    padding:         14,
    marginBottom:    10,
    ...SHADOW,
  },
  rankingPos: {
    width:       30,
    fontSize:    16,
    fontWeight:  '800',
    color:       C.gray,
    textAlign:   'center',
    marginRight: 8,
  },
  rankingInfo:      { flex: 1 },
  rankingNombreRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  rankingNombre:    { fontSize: 14, fontWeight: '700', color: C.black, flex: 1 },
  rankingSub:       { fontSize: 12, color: C.gray },
  rankingHoras:     { fontSize: 15, fontWeight: '800', color: C.black, marginLeft: 8 },

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

  /* Rutas admin */
  rutaDetalleHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   10,
  },
  rutaDetalleTitulo: { fontSize: 17, fontWeight: '800', color: C.black, flex: 1, marginRight: 8 },
  rutaDetalleLinea:  { fontSize: 13, color: C.black, lineHeight: 22 },
  rutaDetalleCancelacion: {
    fontSize:   13,
    color:      '#B91C1C',
    fontWeight: '600',
    marginTop:  8,
    lineHeight: 19,
  },
  rutaDetalleLoading: { marginBottom: 10 },
  rutaParadaOrden: {
    width:       26,
    fontSize:    15,
    fontWeight:  '800',
    color:       C.gray,
    textAlign:   'center',
    marginRight: 10,
  },
  rutaMotivoFallo: { fontSize: 12, color: '#B91C1C', marginTop: 2 },
  rutaParadaRight: { alignItems: 'flex-end', gap: 4 },
  rutaFotoLink:    { fontSize: 12, color: C.black, fontWeight: '700', marginTop: 4 },
  rutaCardFecha:   { fontSize: 11, color: C.gray, marginTop: 2 },

  /* Directorio */
  grupoWrap:   { marginBottom: 18 },
  grupoHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingHorizontal: 2 },
  grupoIcon:   { fontSize: 16, marginRight: 8 },
  grupoLabel:  { flex: 1, fontSize: 13, fontWeight: '700', color: C.black, letterSpacing: 0.3 },
  grupoCount:  { fontSize: 12, fontWeight: '700', color: C.gray },

  dirCard: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: C.white,
    borderRadius:    16,
    padding:         12,
    marginBottom:    8,
    ...SHADOW,
  },
  dirInfo: { flex: 1, marginLeft: 12, marginRight: 8 },

  estadoBadge: {
    borderRadius:      10,
    borderWidth:       1,
    paddingHorizontal: 10,
    paddingVertical:   4,
  },
  estadoBadgeTxt: { fontSize: 11, fontWeight: '700' },
});
