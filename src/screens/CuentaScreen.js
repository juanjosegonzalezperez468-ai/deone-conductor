import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, StatusBar, ActivityIndicator,
} from 'react-native';
import { billingApi } from '../api/client';
import { CONDUCTOR_ID } from '../constants/config';
import { C, SHADOW } from '../constants/theme';

const MENU_ITEMS = [
  { icon: '📄', label: 'Documentos',         sub: 'Licencia, SOAT, Revisión' },
  { icon: '🏍️', label: 'Mi Vehículo',        sub: 'Yamaha YZ 150' },
  { icon: '❓', label: 'Ayuda',              sub: 'Preguntas frecuentes' },
  { icon: '💬', label: 'Soporte',            sub: 'Chatea con nosotros' },
  { icon: '📋', label: 'Comisiones',         sub: '9.5% estándar · 7% con +20 viajes' },
  { icon: '🔒', label: 'Privacidad',         sub: 'Términos y condiciones' },
];

export default function CuentaScreen() {
  const [penalizaciones, setPenalizaciones] = useState(null);
  const [loading, setLoading]               = useState(true);

  useEffect(() => {
    billingApi.penalizaciones(CONDUCTOR_ID)
      .then(({ data }) => setPenalizaciones(data))
      .catch(() => setPenalizaciones({ advertencias: [], suspendido: false }))
      .finally(() => setLoading(false));
  }, []);

  const advertencias = penalizaciones?.advertencias || [];
  const suspendido   = penalizaciones?.suspendido   || false;
  const suspHasta    = penalizaciones?.suspension_hasta;

  const formatFecha = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-CO', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
  };

  return (
    <View style={s.root}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >

        {/* Perfil header */}
        <View style={s.profileCard}>
          <View style={s.avatar}>
            <Text style={s.avatarTxt}>J</Text>
          </View>
          <View style={s.profileInfo}>
            <Text style={s.profileName}>Juan Pérez</Text>
            <View style={s.ratingRow}>
              <Text style={s.star}>★</Text>
              <Text style={s.ratingTxt}>4.8</Text>
              <Text style={s.ratingCount}> · Conductor</Text>
            </View>
          </View>
          <View style={s.conductorBadge}>
            <Text style={s.conductorBadgeTxt}>CONDUCTOR</Text>
          </View>
        </View>

        {/* Estado de cuenta */}
        {loading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator color={C.yellow} />
          </View>
        ) : (
          <View style={suspendido ? s.estadoSuspendido : s.estadoActivo}>
            <Text style={s.estadoIcon}>{suspendido ? '🚫' : '✅'}</Text>
            <View style={s.estadoTexts}>
              <Text style={suspendido ? s.estadoTitleRed : s.estadoTitleGreen}>
                {suspendido ? 'CUENTA SUSPENDIDA' : 'CUENTA ACTIVA'}
              </Text>
              {suspendido && suspHasta
                ? <Text style={s.suspHasta}>Habilitada el {formatFecha(suspHasta)}</Text>
                : <Text style={s.estadoSub}>Tu cuenta está en buen estado</Text>
              }
            </View>
          </View>
        )}

        {/* Penalizaciones / advertencias */}
        {!loading && advertencias.length > 0 && (
          <>
            <Text style={s.sectionLbl}>ADVERTENCIAS</Text>
            {advertencias.map((adv, i) => (
              <View key={adv.id || i} style={s.advCard}>
                <View style={s.advDot} />
                <View style={s.advInfo}>
                  <Text style={s.advMotivo}>{adv.motivo || 'Advertencia'}</Text>
                  {adv.fecha && <Text style={s.advFecha}>{formatFecha(adv.fecha)}</Text>}
                </View>
              </View>
            ))}
          </>
        )}

        {/* Menú */}
        <Text style={s.sectionLbl}>MI CUENTA</Text>
        <View style={s.menuCard}>
          {MENU_ITEMS.map((item, i) => (
            <React.Fragment key={item.label}>
              <TouchableOpacity style={s.menuRow} activeOpacity={0.7}>
                <View style={s.menuIconWrap}>
                  <Text style={s.menuIcon}>{item.icon}</Text>
                </View>
                <View style={s.menuInfo}>
                  <Text style={s.menuLabel}>{item.label}</Text>
                  <Text style={s.menuSub}>{item.sub}</Text>
                </View>
                <Text style={s.menuArrow}>›</Text>
              </TouchableOpacity>
              {i < MENU_ITEMS.length - 1 && <View style={s.menuSep} />}
            </React.Fragment>
          ))}
        </View>

        {/* ID de conductor */}
        <View style={s.idCard}>
          <Text style={s.idLbl}>ID CONDUCTOR</Text>
          <Text style={s.idVal} numberOfLines={1} ellipsizeMode="middle">
            {CONDUCTOR_ID}
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 52, paddingBottom: 48 },

  /* Profile */
  profileCard: {
    backgroundColor: C.white,
    borderRadius:    24,
    padding:         18,
    flexDirection:   'row',
    alignItems:      'center',
    marginBottom:    14,
    ...SHADOW,
  },
  avatar:       {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: C.yellow,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 14,
  },
  avatarTxt:    { color: C.black, fontSize: 28, fontWeight: '800' },
  profileInfo:  { flex: 1 },
  profileName:  { color: C.black, fontSize: 18, fontWeight: '800', marginBottom: 4 },
  ratingRow:    { flexDirection: 'row', alignItems: 'center' },
  star:         { color: C.yellow, fontSize: 14, marginRight: 3 },
  ratingTxt:    { color: C.black, fontSize: 14, fontWeight: '700' },
  ratingCount:  { color: C.gray,  fontSize: 13 },
  conductorBadge: {
    backgroundColor: C.black,
    borderRadius:    10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  conductorBadgeTxt: { color: C.yellow, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },

  /* Estado */
  estadoActivo: {
    backgroundColor: C.greenBg,
    borderRadius:    20,
    padding:         16,
    flexDirection:   'row',
    alignItems:      'center',
    marginBottom:    14,
    borderWidth:     1.5,
    borderColor:     C.greenBorder,
  },
  estadoSuspendido: {
    backgroundColor: C.redBg,
    borderRadius:    20,
    padding:         16,
    flexDirection:   'row',
    alignItems:      'center',
    marginBottom:    14,
    borderWidth:     1.5,
    borderColor:     C.redBorder,
  },
  estadoIcon:      { fontSize: 26, marginRight: 12 },
  estadoTexts:     { flex: 1 },
  estadoTitleGreen:{ color: '#15803D', fontSize: 15, fontWeight: '800', marginBottom: 2 },
  estadoTitleRed:  { color: C.red, fontSize: 15, fontWeight: '800', marginBottom: 2 },
  estadoSub:       { color: '#15803D', fontSize: 13 },
  suspHasta:       { color: C.red, fontSize: 13 },

  loadingWrap: { paddingVertical: 24, alignItems: 'center', marginBottom: 14 },

  sectionLbl: {
    color:         C.gray,
    fontSize:      11,
    fontWeight:    '700',
    letterSpacing: 2,
    marginBottom:  10,
    marginTop:     4,
  },

  /* Advertencias */
  advCard: {
    flexDirection:   'row',
    backgroundColor: C.white,
    borderRadius:    16,
    padding:         14,
    marginBottom:    8,
    borderWidth:     1,
    borderColor:     C.redBorder,
    ...SHADOW,
  },
  advDot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: C.red, marginRight: 12, marginTop: 4 },
  advInfo:   { flex: 1 },
  advMotivo: { color: C.black, fontSize: 14, fontWeight: '600', marginBottom: 2 },
  advFecha:  { color: C.gray, fontSize: 12 },

  /* Menu */
  menuCard: {
    backgroundColor: C.white,
    borderRadius:    24,
    marginBottom:    14,
    overflow:        'hidden',
    ...SHADOW,
  },
  menuRow: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuIconWrap: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: C.bg,
    alignItems:      'center',
    justifyContent:  'center',
    marginRight:     12,
  },
  menuIcon:  { fontSize: 20 },
  menuInfo:  { flex: 1 },
  menuLabel: { color: C.black, fontSize: 15, fontWeight: '600', marginBottom: 2 },
  menuSub:   { color: C.gray, fontSize: 12 },
  menuArrow: { color: C.gray, fontSize: 22, fontWeight: '300' },
  menuSep:   { height: 1, backgroundColor: C.border, marginLeft: 68 },

  /* ID */
  idCard: {
    backgroundColor: C.white,
    borderRadius:    18,
    padding:         16,
    ...SHADOW,
  },
  idLbl: { color: C.gray, fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 6 },
  idVal: { color: C.black, fontSize: 13, fontWeight: '500' },
});
