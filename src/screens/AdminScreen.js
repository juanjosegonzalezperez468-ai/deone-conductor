import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, StatusBar, ActivityIndicator, Alert, Modal, RefreshControl, Linking,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { adminApi, soporteApi } from '../api/client';
import { C, SHADOW } from '../constants/theme';
import { SERVICES } from '../constants/services';

/* ─── Constantes ──────────────────────────────────── */

const SECCIONES = [
  { key: 'mapa',        label: 'Mapa',        icon: '🗺️' },
  { key: 'rutas',       label: 'Rutas',       icon: '📦' },
  { key: 'conductores', label: 'Conductores', icon: '👤' },
  { key: 'directorio',  label: 'Directorio',  icon: '👥' },
  { key: 'recargas',    label: 'Recargas',    icon: '💳' },
  { key: 'soporte',     label: 'Soporte',     icon: '💬' },
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
  const [grupo,      setGrupo]      = useState('conductores'); // conductores | clientes
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

  // Si el usuario no tiene tipo (dato viejo), se asume conductor.
  const esCliente = (r) => r.conductor?.tipo === 'cliente';
  const clientes    = recargas.filter(esCliente);
  const conductores = recargas.filter((r) => !esCliente(r));
  const lista = grupo === 'clientes' ? clientes : conductores;

  return (
    <ScrollView contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false}>
      <View style={s.recargaTabs}>
        {[
          { key: 'conductores', label: `Conductores (${conductores.length})` },
          { key: 'clientes',    label: `Clientes (${clientes.length})` },
        ].map((t) => (
          <TouchableOpacity
            key={t.key}
            style={grupo === t.key ? s.recargaTabActive : s.recargaTab}
            onPress={() => setGrupo(t.key)}
            activeOpacity={0.8}
          >
            <Text style={grupo === t.key ? s.recargaTabTxtActive : s.recargaTabTxt}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {lista.length === 0 && (
        <View style={s.emptyWrap}>
          <Text style={s.emptyIcon}>✅</Text>
          <Text style={s.emptyTxt}>
            {grupo === 'clientes' ? 'Sin recargas pendientes de clientes' : 'Sin recargas pendientes de conductores'}
          </Text>
        </View>
      )}

      {lista.map((r) => (
        <View key={r.id} style={s.recargaCard}>
          <View style={s.recargaTop}>
            <View>
              <Text style={s.recargaNombre}>{r.conductor?.nombre || r.conductor_id}</Text>
              <Text style={s.recargaTel}>{r.conductor?.telefono || '—'}</Text>
              <View style={esCliente(r) ? s.tipoBadgeCliente : s.tipoBadgeConductor}>
                <Text style={esCliente(r) ? s.tipoBadgeClienteTxt : s.tipoBadgeConductorTxt}>
                  {esCliente(r) ? 'CLIENTE' : 'CONDUCTOR'}
                </Text>
              </View>
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

/* ─── Sección: Soporte ───────────────────────────── */

const haceCuanto = (iso) => {
  if (!iso) return '';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1)    return 'ahora';
  if (min < 60)   return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24)     return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
};

function SoporteSection() {
  const [grupo,   setGrupo]   = useState('conductores'); // conductores | clientes
  const [datos,   setDatos]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [caso,    setCaso]    = useState(null);   // { conversacion, mensajes }
  const [respuesta, setRespuesta] = useState('');
  const [enviando,  setEnviando]  = useState(false);

  const cargar = useCallback(async (silencioso) => {
    if (!silencioso) setLoading(true);
    try {
      const { data } = await soporteApi.bandeja(null, 'abierta');
      setDatos(data);
    } catch {
      if (!silencioso) setDatos(null);
    } finally {
      if (!silencioso) setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar(false);
    const iv = setInterval(() => cargar(true), 20000);
    return () => clearInterval(iv);
  }, [cargar]);

  const abrirCaso = async (id) => {
    try {
      const { data } = await soporteApi.caso(id);
      setCaso(data);
      setRespuesta('');
      cargar(true);   // refresca los badges tras marcar leído
    } catch {
      Alert.alert('Error', 'No se pudo abrir la conversación.');
    }
  };

  const responder = async () => {
    const msg = respuesta.trim();
    if (!msg || enviando || !caso) return;
    setEnviando(true);
    try {
      await soporteApi.responder(caso.conversacion.id, msg);
      const { data } = await soporteApi.caso(caso.conversacion.id);
      setCaso(data);
      setRespuesta('');
      cargar(true);
    } catch (e) {
      Alert.alert('No se pudo enviar', e?.response?.data?.detail || 'Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  const cerrarCaso = () => {
    if (!caso) return;
    Alert.alert(
      'Cerrar caso',
      'El usuario podrá reabrirlo escribiendo de nuevo. ¿Cerrar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar', style: 'destructive',
          onPress: async () => {
            try {
              await soporteApi.cerrar(caso.conversacion.id);
              setCaso(null);
              cargar(false);
            } catch {
              Alert.alert('Error', 'No se pudo cerrar el caso.');
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return <View style={s.centerWrap}><ActivityIndicator color={C.yellow} size="large" /></View>;
  }
  if (!datos) {
    return <View style={s.emptyWrap}><Text style={s.emptyTxt}>No se pudo cargar el soporte</Text></View>;
  }

  // ── Vista de conversación ──
  if (caso) {
    const u = caso.conversacion.usuario || {};
    return (
      <View style={{ flex: 1 }}>
        <View style={s.casoHeader}>
          <TouchableOpacity onPress={() => setCaso(null)} activeOpacity={0.7}>
            <Text style={s.casoVolver}>‹ Bandeja</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.casoNombre} numberOfLines={1}>{u.nombre || 'Usuario'}</Text>
            <Text style={s.casoTel}>{u.telefono || ''} · {caso.conversacion.usuario_tipo}</Text>
          </View>
          <TouchableOpacity onPress={cerrarCaso} activeOpacity={0.7}>
            <Text style={s.casoCerrar}>Cerrar</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false}>
          {caso.mensajes.map((m) => {
            const esAdmin = m.autor === 'admin';
            return (
              <View key={m.id} style={[s.msgFila, esAdmin ? s.msgDer : s.msgIzq]}>
                <View style={esAdmin ? s.msgBurbujaAdmin : s.msgBurbujaUser}>
                  <Text style={s.msgTxt}>{m.mensaje}</Text>
                  <Text style={s.msgHora}>{haceCuanto(m.created_at)}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View style={s.respBarra}>
          <TextInput
            style={s.respInput}
            placeholder="Responder…"
            placeholderTextColor={C.gray}
            value={respuesta}
            onChangeText={setRespuesta}
            multiline
          />
          <TouchableOpacity
            style={respuesta.trim() && !enviando ? s.respBtn : s.respBtnOff}
            onPress={responder}
            disabled={!respuesta.trim() || enviando}
            activeOpacity={0.8}
          >
            {enviando
              ? <ActivityIndicator color={C.black} size="small" />
              : <Text style={s.respBtnTxt}>➤</Text>}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Bandeja ──
  const esConductores = grupo === 'conductores';
  const lista = (datos.conversaciones || []).filter((c) =>
    esConductores ? c.usuario_tipo === 'conductor' : c.usuario_tipo !== 'conductor');

  // Mismas pestañas que la sección Recargas, para que el panel se sienta igual.
  const Pestana = ({ id, label, badge }) => (
    <TouchableOpacity
      style={grupo === id ? s.recargaTabActive : s.recargaTab}
      onPress={() => setGrupo(id)}
      activeOpacity={0.8}
    >
      <Text style={grupo === id ? s.recargaTabTxtActive : s.recargaTabTxt}>{label}</Text>
      {badge > 0 && <View style={s.badgeSop}><Text style={s.badgeSopTxt}>{badge}</Text></View>}
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={s.recargaTabs}>
        <Pestana id="conductores" label="Conductores" badge={datos.no_leidos_conductores} />
        <Pestana id="clientes"    label="Clientes"    badge={datos.no_leidos_clientes} />
      </View>

      <ScrollView contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false}>
        {!lista.length && (
          <View style={s.emptyWrap}>
            <Text style={s.emptyTxt}>
              Sin casos abiertos de {esConductores ? 'conductores' : 'clientes'}
            </Text>
          </View>
        )}
        {lista.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={s.casoCard}
            onPress={() => abrirCaso(c.id)}
            activeOpacity={0.8}
          >
            <View style={{ flex: 1 }}>
              <View style={s.casoTop}>
                <Text style={s.casoCardNombre} numberOfLines={1}>
                  {c.usuario?.nombre || 'Usuario'}
                </Text>
                {c.no_leidos_admin > 0 && (
                  <View style={s.badgeSop}>
                    <Text style={s.badgeSopTxt}>{c.no_leidos_admin}</Text>
                  </View>
                )}
              </View>
              <Text style={s.casoPreview} numberOfLines={1}>
                {c.ultimo_mensaje || c.asunto || '—'}
              </Text>
              <Text style={s.casoMeta}>{haceCuanto(c.ultimo_mensaje_at)}</Text>
            </View>
            <Text style={s.casoFlecha}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

/* ─── Sección: Estadísticas ──────────────────────── */

const RANGOS = [
  { dias: 7,  label: '7 días'  },
  { dias: 30, label: '30 días' },
  { dias: 90, label: '90 días' },
];

const fmtN = (n) => Number(n || 0).toLocaleString('es-CO');
const fmtCOP = (n) => `$${fmtN(n)}`;

// Fila del embudo: el ancho de la barra es proporcional al total de solicitudes,
// así se ve de un vistazo en qué escalón se cae la demanda.
function EmbudoFila({ label, valor, total, pct }) {
  const ancho = total > 0 ? Math.max((valor / total) * 100, 4) : 4;
  return (
    <View style={s.embudoFila}>
      <Text style={s.embudoLbl} numberOfLines={1}>{label}</Text>
      <View style={s.embudoTrack}>
        <View style={[s.embudoBarra, { width: `${ancho}%` }]}>
          <Text style={s.embudoNum}>{fmtN(valor)}</Text>
        </View>
      </View>
      <Text style={s.embudoPct}>{pct}%</Text>
    </View>
  );
}

function EstadisticasSection() {
  const [m,       setM]       = useState(null);
  const [dias,    setDias]    = useState(30);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const cargar = useCallback((d) => {
    setLoading(true);
    setError(null);
    adminApi.metricas(d)
      .then(({ data }) => setM(data))
      .catch((e) => {
        setM(null);
        setError(e?.response?.data?.detail || 'No se pudieron cargar las métricas');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { cargar(dias); }, [dias, cargar]);

  if (loading) {
    return <View style={s.centerWrap}><ActivityIndicator color={C.yellow} size="large" /></View>;
  }

  if (!m) {
    return (
      <View style={s.emptyWrap}>
        <Text style={s.emptyTxt}>{error}</Text>
      </View>
    );
  }

  const { embudo: f, demanda: d, dinero: din, registros: r, oferta: o, tiempos: t, retencion: ret } = m;

  const segAcep = t.mediana_seg_hasta_aceptacion;
  const tiempoAcep = segAcep == null ? '—'
    : segAcep < 60 ? `${Math.round(segAcep)} s` : `${(segAcep / 60).toFixed(1)} min`;

  return (
    <ScrollView contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false}>
      {/* Selector de rango */}
      <View style={s.rangoRow}>
        {RANGOS.map((rg) => (
          <TouchableOpacity
            key={rg.dias}
            style={dias === rg.dias ? s.rangoChipActivo : s.rangoChip}
            onPress={() => setDias(rg.dias)}
            activeOpacity={0.8}
          >
            <Text style={dias === rg.dias ? s.rangoTxtActivo : s.rangoTxt}>{rg.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Demanda perdida: lo único que exige acción inmediata, va primero */}
      {d.expiradas_sin_oferta > 0 ? (
        <View style={s.avisoMalo}>
          <Text style={s.avisoTitulo}>
            {fmtN(d.expiradas_sin_oferta)} solicitudes murieron sin que nadie ofertara
          </Text>
          <Text style={s.avisoTxt}>
            Es el {d.pct_expiradas_sin_oferta}% de la demanda. Clientes que pidieron y
            nadie respondió: falta de conductores conectados, no de clientes.
          </Text>
        </View>
      ) : (
        <View style={s.avisoBueno}>
          <Text style={s.avisoTitulo}>Toda la demanda recibió al menos una oferta</Text>
          <Text style={s.avisoTxt}>Ninguna solicitud se perdió por falta de conductores.</Text>
        </View>
      )}

      {/* Embudo */}
      <Text style={s.statsSectionLbl}>EMBUDO DE LA DEMANDA</Text>
      <View style={s.comisionCard}>
        <View style={s.embudoWrap}>
          <EmbudoFila label="Solicitudes" valor={f.solicitudes}  total={f.solicitudes} pct={100} />
          <EmbudoFila label="Con oferta"  valor={f.con_oferta}   total={f.solicitudes} pct={f.pct_con_oferta} />
          <EmbudoFila label="Confirmadas" valor={f.confirmadas}  total={f.solicitudes} pct={f.pct_confirmadas} />
          <EmbudoFila label="Completadas" valor={f.completadas}  total={f.solicitudes} pct={f.pct_completadas} />
        </View>
      </View>

      <View style={s.statsGrid}>
        <View style={s.statCardYellow}>
          <Text style={s.statNum}>{fmtN(d.total)}</Text>
          <Text style={s.statLbl}>Solicitudes recibidas</Text>
        </View>
        <View style={s.statCardWhite}>
          <Text style={s.statNum}>{fmtN(d.completados)}</Text>
          <Text style={s.statLbl}>Servicios completados</Text>
        </View>
      </View>

      <View style={s.statsGrid}>
        <View style={s.statCardWhite}>
          <Text style={s.statNum}>{d.tasa_cancelacion}%</Text>
          <Text style={s.statLbl}>Cancelación ({fmtN(d.cancelados)})</Text>
        </View>
        <View style={s.statCardWhite}>
          <Text style={s.statNum}>{fmtN(d.abiertos_ahora)}</Text>
          <Text style={s.statLbl}>Servicios en curso</Text>
        </View>
      </View>

      <Text style={s.statsSectionLbl}>DINERO DEL PERIODO</Text>
      <View style={s.comisionCard}>
        <View style={s.comisionRow}>
          <Text style={s.comisionLbl}>Facturado por clientes (GMV)</Text>
          <Text style={s.comisionVal}>{fmtCOP(din.gmv)}</Text>
        </View>
        <View style={s.comisionSep} />
        <View style={s.comisionRow}>
          <Text style={s.comisionLbl}>Comisiones de Deone</Text>
          <Text style={s.comisionVal}>{fmtCOP(din.comisiones)}</Text>
        </View>
        <View style={s.comisionSep} />
        <View style={s.comisionRow}>
          <Text style={s.comisionLbl}>Ticket promedio</Text>
          <Text style={s.comisionVal}>{fmtCOP(din.ticket_promedio)}</Text>
        </View>
        <View style={s.comisionSep} />
        <View style={s.comisionRow}>
          <Text style={s.comisionLbl}>Saldo sin consumir</Text>
          <Text style={s.comisionVal}>{fmtCOP(din.saldo_en_circulacion)}</Text>
        </View>
      </View>

      <Text style={s.statsSectionLbl}>CONDUCTORES</Text>
      <View style={s.comisionCard}>
        <View style={s.comisionRow}>
          <Text style={s.comisionLbl}>Aprobados</Text>
          <Text style={s.comisionVal}>{fmtN(o.conductores_activos)}</Text>
        </View>
        <View style={s.comisionSep} />
        <View style={s.comisionRow}>
          <Text style={s.comisionLbl}>Conectados ahora</Text>
          <Text style={s.comisionVal}>{o.disponibles_ahora == null ? '—' : fmtN(o.disponibles_ahora)}</Text>
        </View>
        <View style={s.comisionSep} />
        <View style={s.comisionRow}>
          <Text style={s.comisionLbl}>Trabajaron en el periodo</Text>
          <Text style={s.comisionVal}>{fmtN(o.conductores_trabajando)}</Text>
        </View>
        <View style={s.comisionSep} />
        <View style={s.comisionRow}>
          <Text style={s.comisionLbl}>Aprobados sin un solo viaje</Text>
          <Text style={[s.comisionVal, o.activos_sin_trabajar > 0 && { color: C.red }]}>
            {fmtN(o.activos_sin_trabajar)}
          </Text>
        </View>
      </View>

      <Text style={s.statsSectionLbl}>USUARIOS REGISTRADOS</Text>
      <View style={s.comisionCard}>
        <View style={s.comisionRow}>
          <Text style={s.comisionLbl}>Clientes</Text>
          <Text style={s.comisionVal}>
            {fmtN(r.total_clientes)}
            <Text style={s.tipoPct}>  +{fmtN(r.clientes_nuevos)}</Text>
          </Text>
        </View>
        <View style={s.comisionSep} />
        <View style={s.comisionRow}>
          <Text style={s.comisionLbl}>Conductores</Text>
          <Text style={s.comisionVal}>
            {fmtN(r.total_conductores)}
            <Text style={s.tipoPct}>  +{fmtN(r.conductores_nuevos)}</Text>
          </Text>
        </View>
        <View style={s.comisionSep} />
        <View style={s.comisionRow}>
          <Text style={[s.comisionLbl, { fontWeight: '700', color: C.black }]}>Total</Text>
          <Text style={s.comisionVal}>{fmtN(r.total_usuarios)}</Text>
        </View>
      </View>
      <Text style={s.notaSeccion}>
        Cada persona cuenta una sola vez; el número pequeño son los nuevos del periodo.
      </Text>

      <Text style={s.statsSectionLbl}>ONBOARDING DE CONDUCTORES</Text>
      <View style={s.comisionCard}>
        <View style={s.comisionRow}>
          <Text style={s.comisionLbl}>Pendientes de aprobar</Text>
          <Text style={s.comisionVal}>{fmtN(r.onboarding_conductores?.pendiente)}</Text>
        </View>
        <View style={s.comisionSep} />
        <View style={s.comisionRow}>
          <Text style={s.comisionLbl}>Nunca completaron un viaje</Text>
          <Text style={s.comisionVal}>{fmtN(r.conductores_sin_servicio)}</Text>
        </View>
      </View>

      <Text style={s.statsSectionLbl}>OPERACIÓN</Text>
      <View style={s.comisionCard}>
        <View style={s.comisionRow}>
          <Text style={s.comisionLbl}>Mediana hasta aceptación</Text>
          <Text style={s.comisionVal}>{tiempoAcep}</Text>
        </View>
        <View style={s.comisionSep} />
        <View style={s.comisionRow}>
          <Text style={s.comisionLbl}>Duración mediana del viaje</Text>
          <Text style={s.comisionVal}>
            {t.mediana_min_servicio == null ? '—' : `${Math.round(t.mediana_min_servicio)} min`}
          </Text>
        </View>
        <View style={s.comisionSep} />
        <View style={s.comisionRow}>
          <Text style={s.comisionLbl}>Clientes que repiten</Text>
          <Text style={s.comisionVal}>{ret.pct_repiten}%</Text>
        </View>
      </View>

      <Text style={s.statsSectionLbl}>POR TIPO DE SERVICIO</Text>
      <View style={s.comisionCard}>
        {(d.por_tipo || []).map((x, i) => (
          <View key={x.tipo}>
            {i > 0 && <View style={s.comisionSep} />}
            <View style={s.comisionRow}>
              <Text style={s.comisionLbl}>
                {iconoServicio(x.tipo)} {labelServicio(x.tipo)}
              </Text>
              <Text style={s.comisionVal}>
                {fmtN(x.completadas)}/{fmtN(x.creadas)}
                <Text style={s.tipoPct}>  {x.pct_completadas}%</Text>
              </Text>
            </View>
          </View>
        ))}
        {!(d.por_tipo || []).length && (
          <View style={s.comisionRow}>
            <Text style={s.comisionLbl}>Sin solicitudes en el periodo</Text>
          </View>
        )}
      </View>

      <Text style={s.piePanel}>
        Para el detalle completo (gráficas por día y hora, motivos de cancelación,
        línea de tiempo de eventos) abre el panel web en /panel desde un computador.
      </Text>
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
      {seccion === 'soporte'     && <SoporteSection />}
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

  /* Recargas: pestañas conductores/clientes */
  recargaTabs: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  recargaTab: {
    flex:            1,
    backgroundColor: C.white,
    borderRadius:    12,
    paddingVertical: 10,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     C.border,
  },
  recargaTabActive: {
    flex:            1,
    backgroundColor: C.black,
    borderRadius:    12,
    paddingVertical: 10,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     C.black,
  },
  recargaTabTxt:       { fontSize: 13, fontWeight: '600', color: C.gray },
  recargaTabTxtActive: { fontSize: 13, fontWeight: '700', color: C.yellow },

  /* Soporte */
  badgeSop: {
    position: 'absolute', top: 4, right: 8,
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5,
    backgroundColor: C.red, alignItems: 'center', justifyContent: 'center',
  },
  badgeSopTxt: { color: C.white, fontSize: 10, fontWeight: '800' },

  casoCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.white, borderRadius: 16,
    padding: 14, marginBottom: 8, ...SHADOW,
  },
  casoTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  casoCardNombre: { fontSize: 15, fontWeight: '700', color: C.black, flexShrink: 1 },
  casoPreview: { fontSize: 13, color: C.gray, marginTop: 3 },
  casoMeta:    { fontSize: 11, color: C.gray, marginTop: 4 },
  casoFlecha:  { fontSize: 26, color: C.gray, marginLeft: 8 },

  casoHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.white, borderRadius: 16,
    padding: 14, marginBottom: 12, ...SHADOW,
  },
  casoVolver: { fontSize: 14, fontWeight: '700', color: C.yellow },
  casoNombre: { fontSize: 15, fontWeight: '700', color: C.black },
  casoTel:    { fontSize: 12, color: C.gray, marginTop: 2 },
  casoCerrar: { fontSize: 13, fontWeight: '700', color: C.red },

  msgFila: { flexDirection: 'row', marginBottom: 8 },
  msgIzq:  { justifyContent: 'flex-start' },
  msgDer:  { justifyContent: 'flex-end' },
  msgBurbujaUser: {
    maxWidth: '84%', backgroundColor: C.white, borderRadius: 14,
    borderBottomLeftRadius: 4, paddingHorizontal: 13, paddingVertical: 9, ...SHADOW,
  },
  msgBurbujaAdmin: {
    maxWidth: '84%', backgroundColor: C.yellow, borderRadius: 14,
    borderBottomRightRadius: 4, paddingHorizontal: 13, paddingVertical: 9,
  },
  msgTxt:  { fontSize: 14, color: C.black, lineHeight: 20 },
  msgHora: { fontSize: 10, color: C.gray, marginTop: 4, alignSelf: 'flex-end' },

  respBarra: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.border,
  },
  respInput: {
    flex: 1, maxHeight: 100, backgroundColor: C.bg, borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: C.black,
  },
  respBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: C.yellow,
    alignItems: 'center', justifyContent: 'center',
  },
  respBtnOff: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  respBtnTxt: { fontSize: 16, color: C.black, fontWeight: '700' },

  tipoBadgeConductor: {
    alignSelf:         'flex-start',
    backgroundColor:   '#F0FDF4',
    borderColor:       '#BBF7D0',
    borderWidth:       1,
    borderRadius:      8,
    paddingHorizontal: 8,
    paddingVertical:   2,
    marginTop:         6,
  },
  tipoBadgeCliente: {
    alignSelf:         'flex-start',
    backgroundColor:   '#EFF6FF',
    borderColor:       '#BFDBFE',
    borderWidth:       1,
    borderRadius:      8,
    paddingHorizontal: 8,
    paddingVertical:   2,
    marginTop:         6,
  },
  tipoBadgeConductorTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: '#15803D' },
  tipoBadgeClienteTxt:   { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: '#1D4ED8' },

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

  /* Métricas — selector de rango */
  rangoRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  rangoChip: {
    flex:              1,
    backgroundColor:   C.white,
    borderRadius:      12,
    paddingVertical:   9,
    alignItems:        'center',
    borderWidth:       1,
    borderColor:       C.border,
  },
  rangoChipActivo: {
    flex:            1,
    backgroundColor: C.black,
    borderRadius:    12,
    paddingVertical: 9,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     C.black,
  },
  rangoTxt:       { fontSize: 13, fontWeight: '600', color: C.gray },
  rangoTxtActivo: { fontSize: 13, fontWeight: '700', color: C.white },

  /* Métricas — avisos */
  avisoMalo: {
    backgroundColor: C.redBg,
    borderLeftWidth: 4,
    borderLeftColor: C.red,
    borderRadius:    12,
    padding:         14,
    marginBottom:    20,
  },
  avisoBueno: {
    backgroundColor: C.greenBg,
    borderLeftWidth: 4,
    borderLeftColor: C.green,
    borderRadius:    12,
    padding:         14,
    marginBottom:    20,
  },
  avisoTitulo: { fontSize: 14, fontWeight: '800', color: C.black, marginBottom: 4 },
  avisoTxt:    { fontSize: 12, color: C.gray, lineHeight: 17 },

  /* Métricas — embudo */
  embudoWrap:  { paddingHorizontal: 18, paddingVertical: 16, gap: 10 },
  embudoFila:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  embudoLbl:   { fontSize: 12, color: C.gray, width: 78 },
  embudoTrack: { flex: 1, height: 28, justifyContent: 'center' },
  embudoBarra: {
    height:          28,
    backgroundColor: C.yellow,
    borderRadius:    7,
    justifyContent:  'center',
    paddingHorizontal: 8,
    minWidth:        34,
  },
  embudoNum: { fontSize: 12, fontWeight: '800', color: C.black },
  embudoPct: { fontSize: 11, color: C.gray, width: 42, textAlign: 'right' },

  tipoPct:   { fontSize: 12, color: C.gray, fontWeight: '600' },
  notaSeccion: {
    fontSize:   11,
    color:      C.gray,
    lineHeight: 15,
    marginTop:  8,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  piePanel:  {
    fontSize:   11,
    color:      C.gray,
    lineHeight: 16,
    textAlign:  'center',
    marginTop:  20,
    paddingHorizontal: 10,
  },
});
