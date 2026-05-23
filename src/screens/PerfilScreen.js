import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, StatusBar, ActivityIndicator, Image,
} from 'react-native';
import { billingApi } from '../api/client';
import { CONDUCTOR_ID } from '../constants/config';

const C = {
  white:       '#FFFFFF',
  black:       '#111111',
  yellow:      '#F4C400',
  grayLight:   '#888888',
  grayBorder:  '#EEEEEE',
  grayBg:      '#F5F5F5',
  green:       '#22C55E',
  greenBg:     '#F0FDF4',
  greenBorder: '#BBF7D0',
  red:         '#EF4444',
  redBg:       '#FEF2F2',
  redBorder:   '#FECACA',
};

const SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 3,
};

export default function PerfilScreen({ goBack }) {
  const [penalizaciones, setPenalizaciones] = useState(null);
  const [loading, setLoading]               = useState(true);

  useEffect(() => {
    billingApi.penalizaciones(CONDUCTOR_ID)
      .then(({ data }) => setPenalizaciones(data))
      .catch(() => setPenalizaciones({ advertencias: [], suspendido: false, suspension_hasta: null }))
      .finally(() => setLoading(false));
  }, []);

  const advertencias    = penalizaciones?.advertencias || [];
  const suspendido      = penalizaciones?.suspendido || false;
  const suspensionHasta = penalizaciones?.suspension_hasta;

  const formatFecha = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  return (
    <View style={s.root}>
      <StatusBar backgroundColor={C.white} barStyle="dark-content" />

      <View style={s.header}>
        <TouchableOpacity onPress={goBack} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Image source={require('../../assets/logo.png')} style={s.logo} resizeMode="contain" />
        <View style={s.backBtn} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        <Text style={s.heading}>Mi Perfil</Text>

        {/* Conductor ID */}
        <View style={s.conductorCard}>
          <View style={s.avatarCircle}>
            <Text style={s.avatarTxt}>C</Text>
          </View>
          <View style={s.conductorInfo}>
            <Text style={s.conductorLabel}>ID DE CONDUCTOR</Text>
            <Text style={s.conductorId} numberOfLines={1} ellipsizeMode="middle">
              {CONDUCTOR_ID}
            </Text>
          </View>
        </View>

        {/* Estado de cuenta */}
        <Text style={s.sectionLabel}>ESTADO DE CUENTA</Text>

        {loading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator size="large" color={C.yellow} />
            <Text style={s.loadingTxt}>Verificando estado…</Text>
          </View>
        ) : (
          <>
            <View style={suspendido ? s.estadoCardSuspendido : s.estadoCardActivo}>
              <View style={s.estadoRow}>
                <Text style={s.estadoIcon}>{suspendido ? '🚫' : '✅'}</Text>
                <View style={s.estadoTexts}>
                  <Text style={suspendido ? s.estadoTitleRed : s.estadoTitleGreen}>
                    {suspendido ? 'CUENTA SUSPENDIDA' : 'CUENTA ACTIVA'}
                  </Text>
                  {suspendido && suspensionHasta ? (
                    <Text style={s.suspensionHasta}>
                      Habilitada nuevamente el {formatFecha(suspensionHasta)}
                    </Text>
                  ) : null}
                  {!suspendido && (
                    <Text style={s.estadoSub}>Tu cuenta está en buen estado</Text>
                  )}
                </View>
              </View>
            </View>

            {/* Advertencias */}
            <Text style={s.sectionLabel}>ADVERTENCIAS ACTIVAS</Text>

            {advertencias.length === 0 ? (
              <View style={s.emptyWrap}>
                <Text style={s.emptyIcon}>👍</Text>
                <Text style={s.emptyTitle}>Sin advertencias</Text>
                <Text style={s.emptySub}>Continúa brindando un excelente servicio</Text>
              </View>
            ) : (
              advertencias.map((adv, idx) => (
                <View key={adv.id || idx} style={s.advCard}>
                  <View style={s.advDot} />
                  <View style={s.advInfo}>
                    <Text style={s.advMotivo}>{adv.motivo || 'Advertencia'}</Text>
                    {adv.fecha ? (
                      <Text style={s.advFecha}>{formatFecha(adv.fecha)}</Text>
                    ) : null}
                  </View>
                </View>
              ))
            )}

            {/* Info de comisiones */}
            <Text style={s.sectionLabel}>COMISIONES</Text>
            <View style={s.infoCard}>
              <Text style={s.infoTxt}>• Comisión estándar: 9.5% por viaje</Text>
              <Text style={s.infoTxt}>• Conductores con +20 viajes/semana: 7%</Text>
              <Text style={s.infoTxt}>• La comisión se descuenta automáticamente al finalizar cada viaje</Text>
            </View>
          </>
        )}

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.white },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 48, paddingTop: 8 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 12,
    backgroundColor: C.white,
  },
  backBtn:   { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backArrow: { color: C.black, fontSize: 24, fontWeight: '700' },
  logo:      { height: 32, width: 120 },

  heading: { color: C.black, fontSize: 30, fontWeight: '800', marginBottom: 20, letterSpacing: -0.5 },

  conductorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: C.grayBorder,
    ...SHADOW,
  },
  avatarCircle:  { width: 52, height: 52, borderRadius: 26, backgroundColor: C.yellow, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  avatarTxt:     { color: C.black, fontSize: 24, fontWeight: '800' },
  conductorInfo: { flex: 1 },
  conductorLabel:{ color: C.grayLight, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 4 },
  conductorId:   { color: C.black, fontSize: 13, fontWeight: '600' },

  sectionLabel: { color: C.grayLight, fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 12 },

  loadingWrap: { paddingVertical: 40, alignItems: 'center' },
  loadingTxt:  { color: C.grayLight, fontSize: 13, marginTop: 12 },

  estadoCardActivo: {
    backgroundColor: C.greenBg,
    borderRadius: 20,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: C.greenBorder,
    ...SHADOW,
  },
  estadoCardSuspendido: {
    backgroundColor: C.redBg,
    borderRadius: 20,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: C.redBorder,
    ...SHADOW,
  },
  estadoRow:        { flexDirection: 'row', alignItems: 'center' },
  estadoIcon:       { fontSize: 28, marginRight: 14 },
  estadoTexts:      { flex: 1 },
  estadoTitleGreen: { color: '#15803D', fontSize: 16, fontWeight: '800', marginBottom: 4, letterSpacing: 0.5 },
  estadoTitleRed:   { color: C.red, fontSize: 16, fontWeight: '800', marginBottom: 4, letterSpacing: 0.5 },
  estadoSub:        { color: '#15803D', fontSize: 13 },
  suspensionHasta:  { color: C.red, fontSize: 13, lineHeight: 18 },

  emptyWrap:  { paddingVertical: 32, alignItems: 'center', marginBottom: 24 },
  emptyIcon:  { fontSize: 44, marginBottom: 12 },
  emptyTitle: { color: C.black, fontSize: 17, fontWeight: '700', marginBottom: 4 },
  emptySub:   { color: C.grayLight, fontSize: 13, textAlign: 'center' },

  advCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.redBorder,
    ...SHADOW,
  },
  advDot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: C.red, marginRight: 12, marginTop: 4 },
  advInfo:   { flex: 1 },
  advMotivo: { color: C.black, fontSize: 14, fontWeight: '600', marginBottom: 3 },
  advFecha:  { color: C.grayLight, fontSize: 12 },

  infoCard: {
    backgroundColor: C.grayBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.grayBorder,
  },
  infoTxt: { color: C.grayLight, fontSize: 13, lineHeight: 22 },
});
