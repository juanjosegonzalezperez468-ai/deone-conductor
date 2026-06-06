import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, StatusBar, ActivityIndicator, Modal, Alert,
} from 'react-native';
import { conductorApi, billingApi } from '../api/client';
import { SERVICES } from '../constants/services';
import { getUserUuid } from '../utils/tokenStorage';
import { C, SHADOW } from '../constants/theme';

const PERIODOS = ['Hoy', 'Semana', 'Mes'];

function isHoy(d) {
  if (!d) return false;
  return new Date(d).toDateString() === new Date().toDateString();
}

function isSemana(d) {
  if (!d) return false;
  const dt = new Date(d);
  const limite = new Date();
  limite.setDate(limite.getDate() - 7);
  return dt >= limite && dt <= new Date();
}

function isMes(d) {
  if (!d) return false;
  const dt = new Date(d);
  const hoy = new Date();
  return dt.getMonth() === hoy.getMonth() && dt.getFullYear() === hoy.getFullYear();
}

function getLast7DaysChart(historial) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const ds = d.toDateString();
    const total = historial
      .filter(v => v.created_at && new Date(v.created_at).toDateString() === ds)
      .reduce((a, v) => a + (v.precio_final || 0), 0);
    return {
      label: d.toLocaleDateString('es-CO', { weekday: 'short' }).slice(0, 2).toUpperCase(),
      total,
      isToday: d.toDateString() === new Date().toDateString(),
    };
  });
}

export default function GananciasScreen({ navigate }) {
  const [periodo, setPeriodo]     = useState('Hoy');
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saldo, setSaldo]         = useState(null);
  const [showRecarga, setShowRecarga]       = useState(false);
  const [recargaMonto, setRecargaMonto]     = useState(null);
  const [enviandoRecarga, setEnviandoRecarga] = useState(false);

  useEffect(() => {
    getUserUuid().then((uuid) => {
      Promise.all([
        conductorApi.historial(uuid)
          .then(({ data }) => setHistorial(Array.isArray(data) ? data : []))
          .catch(() => {}),
        billingApi.saldo(uuid)
          .then(({ data }) => {
            const val = typeof data === 'object' ? data.saldo : data;
            if (typeof val === 'number') setSaldo(val);
          })
          .catch(() => {}),
      ]).finally(() => setLoading(false));
    });
  }, []);

  const filtrado = historial.filter(v =>
    periodo === 'Hoy'    ? isHoy(v.created_at)
    : periodo === 'Semana' ? isSemana(v.created_at)
    : isMes(v.created_at)
  );

  const totalPeriodo = filtrado.reduce((a, v) => a + (v.precio_final || 0), 0);
  const viajesPeriodo = filtrado.length;
  const chartData = getLast7DaysChart(historial);
  const maxChart = Math.max(...chartData.map(d => d.total), 1);

  const getBarHeight = (total) => Math.max((total / maxChart) * 90, 4);
  const getBarColor = (isToday) => isToday ? C.yellow : C.border;

  const cerrarModalRecarga = () => {
    setShowRecarga(false);
    setRecargaMonto(null);
  };

  const confirmarRecarga = async () => {
    if (!recargaMonto) return;
    setEnviandoRecarga(true);
    try {
      await billingApi.solicitarRecarga(recargaMonto);
      cerrarModalRecarga();
      Alert.alert(
        'Solicitud enviada',
        'Tu solicitud de recarga fue recibida. El equipo Deone la verificará y activará tu saldo en minutos.',
        [{ text: 'OK' }],
      );
    } catch {
      Alert.alert('Error', 'No se pudo enviar la solicitud. Intenta de nuevo.');
    } finally {
      setEnviandoRecarga(false);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />

      {/* Modal recarga */}
      <Modal visible={showRecarga} transparent animationType="fade">
        <TouchableOpacity style={s.modalBg} onPress={cerrarModalRecarga} activeOpacity={1}>
          <View style={s.modalCard} onStartShouldSetResponder={() => true}>
            <Text style={s.modalTitle}>Recargar saldo</Text>

            <View style={s.nequiCard}>
              <Text style={s.nequiLabel}>NEQUI</Text>
              <Text style={s.nequiNum}>323 942 0671</Text>
            </View>

            <Text style={s.modalInstruccion}>
              Concepto: <Text style={{ fontWeight: '700' }}>DEONE + tu número</Text>
            </Text>

            <Text style={s.modalStepLbl}>SELECCIONA EL MONTO QUE ENVIASTE</Text>
            <View style={s.montosRow}>
              {[10000, 25000, 50000].map((m) => (
                <TouchableOpacity
                  key={m}
                  style={recargaMonto === m ? s.montoSelActive : s.montoSel}
                  onPress={() => setRecargaMonto(m)}
                  activeOpacity={0.8}
                >
                  <Text style={recargaMonto === m ? s.montoSelTxtActive : s.montoSelTxt}>
                    ${m.toLocaleString('es-CO')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={recargaMonto ? s.modalBtn : s.modalBtnDis}
              onPress={confirmarRecarga}
              activeOpacity={recargaMonto ? 0.85 : 1}
              disabled={!recargaMonto || enviandoRecarga}
            >
              {enviandoRecarga
                ? <ActivityIndicator color={C.yellow} />
                : <Text style={recargaMonto ? s.modalBtnTxt : s.modalBtnTxtDis}>
                    {recargaMonto ? 'YA PAGUÉ · SOLICITAR ACTIVACIÓN' : 'SELECCIONA UN MONTO'}
                  </Text>
              }
            </TouchableOpacity>

            <TouchableOpacity onPress={cerrarModalRecarga} style={s.cancelarBtn}>
              <Text style={s.cancelarTxt}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Header */}
      <View style={s.header}>
        <Text style={s.heading}>Ganancias</Text>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >

        {/* Saldo + Recargar */}
        <View style={s.saldoCard}>
          <View style={s.saldoLeft}>
            <Text style={s.saldoLbl}>SALDO DISPONIBLE</Text>
            <Text style={s.saldoVal}>
              {saldo !== null ? `$${saldo.toLocaleString('es-CO')}` : '—'}
            </Text>
          </View>
          <TouchableOpacity style={s.btnRecargar} onPress={() => setShowRecarga(true)} activeOpacity={0.85}>
            <Text style={s.btnRecargarTxt}>Recargar</Text>
          </TouchableOpacity>
        </View>

        {/* Crédito WEWIN */}
        <TouchableOpacity
          style={s.wewinBanner}
          onPress={() => navigate('CreditoWEWIN')}
          activeOpacity={0.85}
        >
          <View style={s.wewinLeft}>
            <Text style={s.wewinEmoji}>💳</Text>
            <View>
              <Text style={s.wewinTitle}>Crédito WEWIN</Text>
              <Text style={s.wewinSub}>Solicita crédito según tu perfil Deone</Text>
            </View>
          </View>
          <Text style={s.wewinArrow}>›</Text>
        </TouchableOpacity>

        {/* Tabs de periodo */}
        <View style={s.tabsRow}>
          {PERIODOS.map(p => (
            <TouchableOpacity
              key={p}
              style={p === periodo ? s.tabActive : s.tab}
              onPress={() => setPeriodo(p)}
              activeOpacity={0.7}
            >
              <Text style={p === periodo ? s.tabTxtActive : s.tabTxt}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Resumen del periodo */}
        <View style={s.resumenCard}>
          <View style={s.resumenItem}>
            <Text style={s.resumenVal}>${totalPeriodo.toLocaleString('es-CO')}</Text>
            <Text style={s.resumenLbl}>Ganado</Text>
          </View>
          <View style={s.resumenDivider} />
          <View style={s.resumenItem}>
            <Text style={s.resumenVal}>{viajesPeriodo}</Text>
            <Text style={s.resumenLbl}>Viajes</Text>
          </View>
          <View style={s.resumenDivider} />
          <View style={s.resumenItem}>
            <Text style={s.resumenVal}>
              {viajesPeriodo > 0
                ? `$${Math.round(totalPeriodo / viajesPeriodo).toLocaleString('es-CO')}`
                : '—'}
            </Text>
            <Text style={s.resumenLbl}>Promedio</Text>
          </View>
        </View>

        {/* Gráfico últimos 7 días */}
        <Text style={s.sectionLbl}>ÚLTIMOS 7 DÍAS</Text>
        <View style={s.chartCard}>
          <View style={s.chartBars}>
            {loading
              ? <ActivityIndicator color={C.yellow} />
              : chartData.map((bar, i) => (
                <View key={i} style={s.barCol}>
                  <View style={s.barSlot}>
                    <View style={{
                      width:           28,
                      height:          getBarHeight(bar.total),
                      backgroundColor: getBarColor(bar.isToday),
                      borderRadius:    6,
                    }} />
                  </View>
                  <Text style={bar.isToday ? s.barLblActive : s.barLbl}>{bar.label}</Text>
                </View>
              ))
            }
          </View>
        </View>

        {/* Lista de viajes */}
        <Text style={s.sectionLbl}>HISTORIAL</Text>

        {loading && (
          <View style={s.loadingWrap}>
            <ActivityIndicator size="large" color={C.yellow} />
          </View>
        )}

        {!loading && filtrado.length === 0 && (
          <View style={s.emptyWrap}>
            <Text style={s.emptyIcon}>🏍️</Text>
            <Text style={s.emptyTxt}>Sin viajes en este periodo</Text>
          </View>
        )}

        {!loading && filtrado.map((viaje, i) => (
          <ViajeItem key={viaje.id || i} viaje={viaje} />
        ))}

      </ScrollView>
    </View>
  );
}

function ViajeItem({ viaje }) {
  const srv   = SERVICES.find(s => s.id === viaje.tipo_servicio);
  const hora  = viaje.created_at
    ? new Date(viaje.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
    : '—';
  const fecha = viaje.created_at
    ? new Date(viaje.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
    : '—';

  return (
    <View style={vi.card}>
      <View style={vi.iconWrap}>
        <Text style={vi.icon}>{srv?.icon || '🚗'}</Text>
      </View>
      <View style={vi.info}>
        <Text style={vi.destino} numberOfLines={1}>
          {viaje.origen_direccion || '—'}  →  {viaje.destino_direccion || '—'}
        </Text>
        <Text style={vi.meta}>{fecha} · {hora} · {srv?.label || viaje.tipo_servicio}</Text>
      </View>
      <Text style={vi.precio}>${(viaje.precio_final || 0).toLocaleString('es-CO')}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 40 },

  header:  { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 8, backgroundColor: C.bg },
  heading: { color: C.black, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },

  /* Saldo */
  saldoCard: {
    backgroundColor: C.white,
    borderRadius:    24,
    padding:         18,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    marginBottom:    16,
    ...SHADOW,
  },
  saldoLeft:      { flex: 1 },
  saldoLbl:       { color: C.gray, fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 4 },
  saldoVal:       { color: C.black, fontSize: 28, fontWeight: '800' },
  btnRecargar:    { backgroundColor: C.yellow, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10 },
  btnRecargarTxt: { color: C.black, fontSize: 13, fontWeight: '700' },

  /* WEWIN banner */
  wewinBanner: {
    backgroundColor:   C.black,
    borderRadius:      20,
    padding:           16,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    marginBottom:      14,
    ...SHADOW,
  },
  wewinLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  wewinEmoji:{ fontSize: 24, marginRight: 12 },
  wewinTitle:{ color: C.yellow, fontSize: 15, fontWeight: '800', marginBottom: 2 },
  wewinSub:  { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  wewinArrow:{ color: C.yellow, fontSize: 24, fontWeight: '300' },

  /* Tabs */
  tabsRow: {
    flexDirection:  'row',
    backgroundColor: C.white,
    borderRadius:   24,
    padding:        4,
    marginBottom:   14,
    ...SHADOW,
  },
  tab: {
    flex:            1,
    paddingVertical: 10,
    alignItems:      'center',
    borderRadius:    20,
  },
  tabActive: {
    flex:            1,
    paddingVertical: 10,
    alignItems:      'center',
    borderRadius:    20,
    backgroundColor: C.yellow,
  },
  tabTxt:       { color: C.gray, fontSize: 13, fontWeight: '600' },
  tabTxtActive: { color: C.black, fontSize: 13, fontWeight: '700' },

  /* Resumen */
  resumenCard: {
    backgroundColor: C.white,
    borderRadius:    24,
    padding:         18,
    flexDirection:   'row',
    alignItems:      'center',
    marginBottom:    16,
    ...SHADOW,
  },
  resumenItem:    { flex: 1, alignItems: 'center' },
  resumenVal:     { color: C.black, fontSize: 20, fontWeight: '800', marginBottom: 2 },
  resumenLbl:     { color: C.gray,  fontSize: 11 },
  resumenDivider: { width: 1, height: 36, backgroundColor: C.border },

  /* Chart */
  sectionLbl: {
    color:         C.gray,
    fontSize:      11,
    fontWeight:    '700',
    letterSpacing: 2,
    marginBottom:  10,
    marginTop:     4,
  },
  chartCard: {
    backgroundColor: C.white,
    borderRadius:    24,
    padding:         16,
    marginBottom:    16,
    ...SHADOW,
  },
  chartBars: {
    flexDirection: 'row',
    alignItems:    'flex-end',
    gap:           4,
  },
  barCol:  { flex: 1, alignItems: 'center' },
  barSlot: {
    height:         90,
    justifyContent: 'flex-end',
    alignItems:     'center',
  },
  barLbl:       { color: C.gray,  fontSize: 9,  fontWeight: '500', marginTop: 4 },
  barLblActive: { color: C.black, fontSize: 9,  fontWeight: '700', marginTop: 4 },

  /* Loading / empty */
  loadingWrap: { paddingVertical: 32, alignItems: 'center' },
  emptyWrap:   { paddingVertical: 40, alignItems: 'center' },
  emptyIcon:   { fontSize: 44, marginBottom: 10 },
  emptyTxt:    { color: C.gray, fontSize: 14 },

  /* Modal */
  modalBg: {
    flex:             1,
    backgroundColor:  'rgba(0,0,0,0.55)',
    justifyContent:   'center',
    alignItems:       'center',
    paddingHorizontal: 24,
  },
  modalCard:   { backgroundColor: C.white, borderRadius: 24, padding: 24, width: '100%', ...SHADOW },
  modalTitle:  { color: C.black, fontSize: 20, fontWeight: '800', marginBottom: 16 },
  nequiCard:   {
    backgroundColor: C.yellow,
    borderRadius:    16,
    padding:         16,
    alignItems:      'center',
    marginBottom:    12,
  },
  nequiLabel:       { color: C.black, fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 4 },
  nequiNum:         { color: C.black, fontSize: 28, fontWeight: '800' },
  modalInstruccion: { color: C.gray, fontSize: 13, textAlign: 'center', marginBottom: 18 },
  modalStepLbl:     { color: C.gray, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 10 },
  montosRow:        { flexDirection: 'row', gap: 8, marginBottom: 20 },
  montoSel: {
    flex:            1,
    borderWidth:     1.5,
    borderColor:     C.border,
    borderRadius:    14,
    paddingVertical: 14,
    alignItems:      'center',
  },
  montoSelActive: {
    flex:            1,
    borderWidth:     2,
    borderColor:     C.black,
    borderRadius:    14,
    paddingVertical: 14,
    alignItems:      'center',
    backgroundColor: '#FFF8DC',
  },
  montoSelTxt:       { color: C.gray,  fontSize: 13, fontWeight: '600' },
  montoSelTxtActive: { color: C.black, fontSize: 13, fontWeight: '800' },
  modalBtn:    { backgroundColor: C.black, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
  modalBtnDis: { backgroundColor: C.border, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
  modalBtnTxt:    { color: C.yellow, fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
  modalBtnTxtDis: { color: C.gray,   fontSize: 14, fontWeight: '600' },
  cancelarBtn: { alignItems: 'center', paddingVertical: 8 },
  cancelarTxt: { color: C.gray, fontSize: 14 },
});

const vi = StyleSheet.create({
  card: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: C.white,
    borderRadius:    18,
    padding:         14,
    marginBottom:    10,
    ...SHADOW,
  },
  iconWrap: {
    width:           42,
    height:          42,
    borderRadius:    21,
    backgroundColor: '#FFF8DC',
    alignItems:      'center',
    justifyContent:  'center',
    marginRight:     12,
  },
  icon:    { fontSize: 20 },
  info:    { flex: 1 },
  destino: { color: C.black, fontSize: 13, fontWeight: '600', marginBottom: 3 },
  meta:    { color: C.gray,  fontSize: 11 },
  precio:  { color: C.black, fontSize: 16, fontWeight: '800' },
});
