import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView,
  StyleSheet, StatusBar, ActivityIndicator,
} from 'react-native';
import { conductorApi } from '../api/client';
import { SERVICES } from '../constants/services';
import { CONDUCTOR_ID } from '../constants/config';
import { C, SHADOW } from '../constants/theme';

export default function ActividadScreen() {
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    conductorApi.historial(CONDUCTOR_ID)
      .then(({ data }) => setHistorial(Array.isArray(data) ? data : []))
      .catch(() => setHistorial([]))
      .finally(() => setLoading(false));
  }, []);

  const completados = historial.filter(v => v.estado === 'completado' || v.precio_final > 0);

  return (
    <View style={s.root}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />

      <View style={s.header}>
        <Text style={s.heading}>Actividad</Text>
        {!loading && (
          <View style={s.countBadge}>
            <Text style={s.countTxt}>{completados.length} viajes</Text>
          </View>
        )}
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {loading && (
          <View style={s.loadingWrap}>
            <ActivityIndicator size="large" color={C.yellow} />
            <Text style={s.loadingTxt}>Cargando historial…</Text>
          </View>
        )}

        {!loading && completados.length === 0 && (
          <View style={s.emptyWrap}>
            <Text style={s.emptyIcon}>📋</Text>
            <Text style={s.emptyTitle}>Sin viajes aún</Text>
            <Text style={s.emptySub}>Actívate y comienza a recibir solicitudes</Text>
          </View>
        )}

        {!loading && completados.map((viaje, i) => (
          <TripCard key={viaje.id || i} viaje={viaje} />
        ))}
      </ScrollView>
    </View>
  );
}

function TripCard({ viaje }) {
  const srv     = SERVICES.find(s => s.id === viaje.tipo_servicio);
  const hora    = viaje.created_at
    ? new Date(viaje.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
    : '—';
  const fecha   = viaje.created_at
    ? new Date(viaje.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
    : '—';
  const calif   = viaje.calificacion_conductor || viaje.calificacion || null;

  return (
    <View style={tc.card}>
      {/* Icon */}
      <View style={tc.iconWrap}>
        <Text style={tc.icon}>{srv?.icon || '🚗'}</Text>
      </View>

      {/* Info */}
      <View style={tc.info}>
        <View style={tc.routeRow}>
          <View style={tc.dotA} />
          <Text style={tc.addr} numberOfLines={1}>{viaje.origen_direccion || 'Origen'}</Text>
        </View>
        <View style={tc.lineSep} />
        <View style={tc.routeRow}>
          <View style={tc.dotB} />
          <Text style={tc.addr} numberOfLines={1}>{viaje.destino_direccion || 'Destino'}</Text>
        </View>
        <View style={tc.metaRow}>
          <Text style={tc.meta}>{fecha} · {hora}</Text>
          {calif && (
            <View style={tc.rating}>
              <Text style={tc.star}>★</Text>
              <Text style={tc.ratingTxt}>{Number(calif).toFixed(1)}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Precio */}
      <Text style={tc.precio}>${(viaje.precio_final || 0).toLocaleString('es-CO')}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 40 },

  header: {
    paddingHorizontal: 20,
    paddingTop:        52,
    paddingBottom:     14,
    backgroundColor:   C.bg,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
  },
  heading:    { color: C.black, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  countBadge: {
    backgroundColor: C.border,
    borderRadius:    12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countTxt: { color: C.gray, fontSize: 12, fontWeight: '600' },

  loadingWrap: { paddingVertical: 48, alignItems: 'center' },
  loadingTxt:  { color: C.gray, fontSize: 13, marginTop: 12 },

  emptyWrap:  { paddingVertical: 60, alignItems: 'center' },
  emptyIcon:  { fontSize: 52, marginBottom: 16 },
  emptyTitle: { color: C.black, fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptySub:   { color: C.gray, fontSize: 13, textAlign: 'center' },
});

const tc = StyleSheet.create({
  card: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: C.white,
    borderRadius:    20,
    padding:         14,
    marginBottom:    10,
    ...SHADOW,
  },
  iconWrap: {
    width:           46,
    height:          46,
    borderRadius:    23,
    backgroundColor: '#FFF8DC',
    alignItems:      'center',
    justifyContent:  'center',
    marginRight:     12,
    flexShrink:      0,
  },
  icon:     { fontSize: 22 },
  info:     { flex: 1, marginRight: 8 },
  routeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2 },
  dotA:     { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.yellow, marginRight: 8, flexShrink: 0 },
  dotB:     { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.black,  marginRight: 8, flexShrink: 0 },
  addr:     { flex: 1, color: C.black, fontSize: 12, fontWeight: '500' },
  lineSep:  { height: 1, backgroundColor: C.border, marginLeft: 15, marginVertical: 2 },
  metaRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  meta:     { color: C.gray, fontSize: 11 },
  rating:   { flexDirection: 'row', alignItems: 'center' },
  star:     { color: C.yellow, fontSize: 12, marginRight: 2 },
  ratingTxt:{ color: C.black, fontSize: 12, fontWeight: '600' },
  precio:   { color: C.black, fontSize: 16, fontWeight: '800', flexShrink: 0 },
});
