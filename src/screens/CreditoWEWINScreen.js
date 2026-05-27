import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, StatusBar, ActivityIndicator, Linking,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import axios from 'axios';
import { conductorApi } from '../api/client';
import { CONDUCTOR_ID } from '../constants/config';
import { C, SHADOW } from '../constants/theme';

const WEWIN_SCORE_URL  = 'https://lhdngsrdznfoefjpzzhl.supabase.co/functions/v1/recibir-score-deone';
const WEWIN_TOKEN      = '9c6dd824e683023ea426cf8eeea8efabeaeba6ff676797f282314d3ee0b62ac5';
const WEWIN_SOLICITAR  = 'https://wewin.com.co/solicitar?lider=1ccd54ee-5633-49aa-8a9f-c05ea0934ef3';

/* ── Cálculo de score ─────────────────────────────── */

function calcScore({ antiguedad_dias, viajes_completados, rating, cancelaciones, documentos_verificados }) {
  const ptAntig  = Math.min(antiguedad_dias   / 90  * 20, 20);
  const ptViajes = Math.min(viajes_completados / 500 * 25, 25);
  const ptRating = Math.max(0, Math.min((rating - 3.0) / 2.0 * 25, 25));
  const ptCancel = cancelaciones === 0 ? 15 : cancelaciones <= 2 ? 8 : 0;
  const ptDocs   = documentos_verificados ? 15 : 0;
  return {
    total:    Math.round(ptAntig + ptViajes + ptRating + ptCancel + ptDocs),
    ptAntig,
    ptViajes,
    ptRating,
    ptCancel,
    ptDocs,
  };
}

function scoreMeta(score) {
  if (score >= 81) return { label: 'Crédito premium', color: C.green,   bg: C.greenBg, border: C.greenBorder };
  if (score >= 61) return { label: 'Crédito medio',   color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE'     };
  if (score >= 41) return { label: 'Crédito básico',  color: '#F97316', bg: '#FFF7ED', border: '#FED7AA'     };
  return               { label: 'Sin crédito',        color: C.red,     bg: C.redBg,   border: C.redBorder   };
}

/* ── Pantalla ─────────────────────────────────────── */

export default function CreditoWEWINScreen({ onBack }) {
  const [loading,  setLoading]  = useState(true);
  const [score,    setScore]    = useState(null);
  const [factores, setFactores] = useState(null);
  const [error,    setError]    = useState(null);

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: perfil } = await conductorApi.perfil(CONDUCTOR_ID);

      const antiguedad_dias        = Number(perfil.antiguedad_dias        ?? 0);
      const viajes_completados     = Number(perfil.viajes_completados     ?? 0);
      const rating                 = Number(perfil.rating                 ?? 3.0);
      const cancelaciones          = Number(perfil.cancelaciones          ?? 0);
      const documentos_verificados = Boolean(perfil.documentos_verificados ?? false);

      const resultado = calcScore({ antiguedad_dias, viajes_completados, rating, cancelaciones, documentos_verificados });
      setScore(resultado);
      setFactores({ antiguedad_dias, viajes_completados, rating, cancelaciones, documentos_verificados });

      const user = auth().currentUser;
      axios.post(
        WEWIN_SCORE_URL,
        {
          conductor_id:          user?.uid || CONDUCTOR_ID,
          nombre:                perfil.nombre || '',
          telefono:              user?.phoneNumber || perfil.telefono || '',
          antiguedad_dias,
          viajes_completados,
          rating_promedio:       rating,
          cancelaciones,
          documentos_verificados,
          score_deone:           resultado.total,
        },
        {
          headers: {
            Authorization:  `Bearer ${WEWIN_TOKEN}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      ).catch(() => {});
    } catch {
      setError('No se pudo cargar tu perfil. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Header compartido ── */
  const Header = () => (
    <View style={s.header}>
      <TouchableOpacity style={s.backBtn} onPress={onBack} activeOpacity={0.7}>
        <Text style={s.backArrow}>‹</Text>
      </TouchableOpacity>
      <Text style={s.headerTitle}>Crédito WEWIN</Text>
      <View style={s.backBtn} />
    </View>
  );

  if (loading) {
    return (
      <View style={s.root}>
        <StatusBar backgroundColor={C.bg} barStyle="dark-content" />
        <Header />
        <View style={s.center}>
          <ActivityIndicator size="large" color={C.yellow} />
          <Text style={s.loadingTxt}>Calculando tu score…</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={s.root}>
        <StatusBar backgroundColor={C.bg} barStyle="dark-content" />
        <Header />
        <View style={s.center}>
          <Text style={s.errorIcon}>⚠️</Text>
          <Text style={s.errorTxt}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={cargar} activeOpacity={0.85}>
            <Text style={s.retryTxt}>Intentar de nuevo</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const meta = scoreMeta(score.total);

  const FACTORES_DEF = [
    {
      label:   'Antigüedad',
      pts:     score.ptAntig,
      max:     20,
      icon:    '🕐',
      detalle: `${factores.antiguedad_dias} día${factores.antiguedad_dias !== 1 ? 's' : ''} activo`,
    },
    {
      label:   'Viajes',
      pts:     score.ptViajes,
      max:     25,
      icon:    '🏍️',
      detalle: `${factores.viajes_completados} completados`,
    },
    {
      label:   'Rating',
      pts:     score.ptRating,
      max:     25,
      icon:    '⭐',
      detalle: `${factores.rating.toFixed(1)} ★ promedio`,
    },
    {
      label:   'Cancelaciones',
      pts:     score.ptCancel,
      max:     15,
      icon:    '📊',
      detalle: factores.cancelaciones === 0 ? 'Ninguna — perfecto' : `${factores.cancelaciones} cancelacion${factores.cancelaciones !== 1 ? 'es' : ''}`,
    },
    {
      label:   'Documentos',
      pts:     score.ptDocs,
      max:     15,
      icon:    '📄',
      detalle: factores.documentos_verificados ? 'Todos verificados' : 'Pendientes de verificar',
    },
  ];

  const mejoras = [];
  if (score.total < 41) {
    if (!factores.documentos_verificados)
      mejoras.push('Verifica todos tus documentos en "Mi Cuenta" — suma 15 puntos al instante');
    if (factores.cancelaciones > 2)
      mejoras.push('Reduce tus cancelaciones a 2 o menos para recuperar puntaje');
    else if (factores.cancelaciones > 0)
      mejoras.push('Llega a 0 cancelaciones para obtener el puntaje máximo de este factor');
    if (factores.rating < 4.0)
      mejoras.push('Mantén tu calificación en ★ 4.0 o más — suma hasta 25 pts');
    if (factores.viajes_completados < 100)
      mejoras.push(`Completa más viajes — cada 20 viajes suman ~1 punto`);
    if (factores.antiguedad_dias < 45)
      mejoras.push('Sigue activo — la antigüedad acumula hasta 20 puntos en 90 días');
  }

  const puedesSolicitar = score.total >= 41;

  return (
    <View style={s.root}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />
      <Header />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* ── Score card ── */}
        <View style={[s.scoreCard, { backgroundColor: meta.bg, borderColor: meta.border }]}>
          <Text style={s.scoreLbl}>TU SCORE DEONE</Text>
          <Text style={[s.scoreNum, { color: meta.color }]}>{score.total}</Text>
          <Text style={s.scoreMax}>de 100 puntos</Text>

          <View style={s.barBg}>
            <View style={[s.barFill, { width: `${score.total}%`, backgroundColor: meta.color }]} />
          </View>

          <View style={[s.niveBadge, { backgroundColor: meta.color }]}>
            <Text style={s.niveTxt}>{meta.label.toUpperCase()}</Text>
          </View>
        </View>

        {/* ── Factores ── */}
        <Text style={s.sectionLbl}>FACTORES DEL SCORE</Text>
        <View style={s.factoresCard}>
          {FACTORES_DEF.map((f, i) => {
            const pct    = Math.min(100, Math.round(Math.max(0, f.pts / f.max) * 100));
            const barClr = pct >= 80 ? C.green : pct >= 50 ? C.yellow : C.red;
            return (
              <React.Fragment key={f.label}>
                <View style={s.factorRow}>
                  <Text style={s.factorIcon}>{f.icon}</Text>
                  <View style={s.factorInfo}>
                    <View style={s.factorTop}>
                      <Text style={s.factorLabel}>{f.label}</Text>
                      <Text style={s.factorPts}>
                        {Math.round(Math.max(0, f.pts))}/{f.max} pts
                      </Text>
                    </View>
                    <Text style={s.factorDetalle}>{f.detalle}</Text>
                    <View style={s.factorBarBg}>
                      <View style={[s.factorBarFill, { width: `${pct}%`, backgroundColor: barClr }]} />
                    </View>
                  </View>
                </View>
                {i < FACTORES_DEF.length - 1 && <View style={s.factorSep} />}
              </React.Fragment>
            );
          })}
        </View>

        {/* ── Qué mejorar ── */}
        {mejoras.length > 0 && (
          <>
            <Text style={s.sectionLbl}>CÓMO MEJORAR TU SCORE</Text>
            <View style={s.mejorasCard}>
              {mejoras.map((m, i) => (
                <View key={i} style={s.mejoraRow}>
                  <View style={s.mejoraDot} />
                  <Text style={s.mejoraTxt}>{m}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── CTA ── */}
        <TouchableOpacity
          style={puedesSolicitar ? s.btn : s.btnDis}
          onPress={puedesSolicitar ? () => Linking.openURL(WEWIN_SOLICITAR) : undefined}
          activeOpacity={puedesSolicitar ? 0.85 : 1}
          disabled={!puedesSolicitar}
        >
          <Text style={puedesSolicitar ? s.btnTxt : s.btnTxtDis}>
            {puedesSolicitar ? '💳  Solicitar mi crédito' : 'Score insuficiente para solicitar'}
          </Text>
        </TouchableOpacity>

        {!puedesSolicitar && (
          <Text style={s.ctaNote}>
            Necesitas un score de al menos 41 para acceder al crédito WEWIN.
          </Text>
        )}

        <Text style={s.powered}>Créditos gestionados por WEWIN · deone.co</Text>
      </ScrollView>
    </View>
  );
}

/* ── Estilos ─────────────────────────────────────── */

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 16, paddingBottom: 48, paddingTop: 8 },

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
  backBtn:     { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backArrow:   { fontSize: 32, color: C.black, fontWeight: '300', lineHeight: 38 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: C.black },

  /* Loading / error */
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  loadingTxt: { color: C.gray, fontSize: 14, marginTop: 16 },
  errorIcon:  { fontSize: 48, marginBottom: 14 },
  errorTxt:   { color: C.gray, fontSize: 15, textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  retryBtn:   {
    backgroundColor: C.yellow,
    borderRadius:    14,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  retryTxt: { color: C.black, fontSize: 15, fontWeight: '700' },

  /* Score card */
  scoreCard: {
    borderRadius:  24,
    padding:       24,
    alignItems:    'center',
    marginBottom:  20,
    borderWidth:   1.5,
    ...SHADOW,
  },
  scoreLbl: {
    fontSize:      11,
    fontWeight:    '700',
    letterSpacing: 2,
    color:         C.gray,
    marginBottom:  8,
  },
  scoreNum: { fontSize: 72, fontWeight: '900', lineHeight: 76 },
  scoreMax: { color: C.gray, fontSize: 13, marginBottom: 20 },
  barBg: {
    width:           '100%',
    height:          10,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius:    5,
    overflow:        'hidden',
    marginBottom:    16,
  },
  barFill:   { height: 10, borderRadius: 5 },
  niveBadge: {
    borderRadius:      12,
    paddingHorizontal: 16,
    paddingVertical:   6,
  },
  niveTxt: { color: C.white, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },

  /* Section label */
  sectionLbl: {
    fontSize:      11,
    fontWeight:    '700',
    letterSpacing: 2,
    color:         C.gray,
    marginBottom:  10,
    marginTop:     4,
  },

  /* Factores */
  factoresCard: {
    backgroundColor: C.white,
    borderRadius:    20,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom:    20,
    ...SHADOW,
  },
  factorRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    paddingVertical: 14,
  },
  factorIcon: { fontSize: 22, marginRight: 14, marginTop: 2 },
  factorInfo: { flex: 1 },
  factorTop:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  factorLabel:{ color: C.black, fontSize: 14, fontWeight: '600' },
  factorPts:  { color: C.gray,  fontSize: 13, fontWeight: '600' },
  factorDetalle: { color: C.gray, fontSize: 12, marginBottom: 8 },
  factorBarBg: {
    height:          6,
    backgroundColor: C.border,
    borderRadius:    3,
    overflow:        'hidden',
  },
  factorBarFill: { height: 6, borderRadius: 3 },
  factorSep:     { height: 1, backgroundColor: C.border },

  /* Mejoras */
  mejorasCard: {
    backgroundColor: C.redBg,
    borderRadius:    20,
    padding:         16,
    marginBottom:    20,
    borderWidth:     1,
    borderColor:     C.redBorder,
  },
  mejoraRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    marginBottom:  10,
  },
  mejoraDot: {
    width:        7,
    height:       7,
    borderRadius: 3.5,
    backgroundColor: C.red,
    marginRight:  10,
    marginTop:    5,
    flexShrink:   0,
  },
  mejoraTxt: { flex: 1, color: '#7F1D1D', fontSize: 13, lineHeight: 20 },

  /* CTA */
  btn: {
    backgroundColor: C.yellow,
    borderRadius:    20,
    paddingVertical: 18,
    alignItems:      'center',
    marginBottom:    12,
    ...SHADOW,
  },
  btnDis: {
    backgroundColor: C.border,
    borderRadius:    20,
    paddingVertical: 18,
    alignItems:      'center',
    marginBottom:    12,
  },
  btnTxt:    { color: C.black, fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  btnTxtDis: { color: C.gray,  fontSize: 15, fontWeight: '600' },

  ctaNote: {
    color:       C.gray,
    fontSize:    13,
    textAlign:   'center',
    lineHeight:  20,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  powered: {
    color:      C.gray,
    fontSize:   11,
    textAlign:  'center',
    marginTop:  8,
  },
});
