import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Image,
  StyleSheet, StatusBar, ActivityIndicator, Alert, Modal, RefreshControl,
} from 'react-native';
import { adminApi, documentosApi } from '../api/client';
import { C, SHADOW } from '../constants/theme';

const ETIQUETAS = {
  foto_perfil:    'Foto de perfil',
  cedula_frente:  'Cédula – Frente',
  cedula_reverso: 'Cédula – Reverso',
  licencia:       'Licencia de conducción',
  soat:           'SOAT vigente',
  foto_vehiculo:  'Foto del vehículo',
};

const ICONOS = {
  foto_perfil:    '📸',
  cedula_frente:  '🪪',
  cedula_reverso: '🪪',
  licencia:       '📋',
  soat:           '🛡️',
  foto_vehiculo:  '🚗',
};

/* ─── Modal imagen completa ──────────────────────── */

function ImagenModal({ uri, onClose }) {
  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.imgOverlay}>
        <TouchableOpacity style={s.imgClose} onPress={onClose} activeOpacity={0.8}>
          <Text style={s.imgCloseTxt}>✕</Text>
        </TouchableOpacity>
        <Image
          source={{ uri }}
          style={s.imgFull}
          resizeMode="contain"
        />
      </View>
    </Modal>
  );
}

/* ─── Modal motivo rechazo ───────────────────────── */

function MotivoModal({ visible, onConfirm, onCancel }) {
  const [motivo, setMotivo] = useState('');
  const { TextInput } = require('react-native');

  const handleConfirm = () => {
    onConfirm(motivo.trim() || 'Documento no válido');
    setMotivo('');
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.overlay}>
        <View style={s.motivoCard}>
          <Text style={s.motivoTitle}>Motivo de rechazo</Text>
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
            <TouchableOpacity style={s.motivoCancelBtn} onPress={() => { setMotivo(''); onCancel(); }} activeOpacity={0.8}>
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

/* ─── Pantalla principal ─────────────────────────── */

export default function DocumentosAdminScreen({ params, onBack }) {
  const { conductorId, conductorNombre } = params;

  const [documentos,  setDocumentos]  = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [procesando,  setProcesando]  = useState(null);
  const [imagenModal, setImagenModal] = useState(null);
  const [motivoDoc,   setMotivoDoc]   = useState(null);

  const cargar = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const { data } = await documentosApi.obtener(conductorId);
      setDocumentos(Array.isArray(data) ? data : []);
    } catch {
      Alert.alert('Error', 'No se pudieron cargar los documentos.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [conductorId]);

  useEffect(() => { cargar(); }, [cargar]);

  const aprobarDoc = async (docId) => {
    if (!docId) return;
    setProcesando(docId + '_aprobar');
    try {
      await adminApi.aprobarDocumento(docId);
      cargar();
    } catch {
      Alert.alert('Error', 'No se pudo aprobar el documento.');
    } finally {
      setProcesando(null);
    }
  };

  const rechazarDoc = async (docId, motivo) => {
    setMotivoDoc(null);
    if (!docId) return;
    setProcesando(docId + '_rechazar');
    try {
      await adminApi.rechazarDocumento(docId, motivo);
      cargar();
    } catch {
      Alert.alert('Error', 'No se pudo rechazar el documento.');
    } finally {
      setProcesando(null);
    }
  };

  const aprobarTodo = async () => {
    const conId = documentos.filter(d => d.id && d.estado !== 'aprobado');
    if (conId.length === 0) {
      Alert.alert('Info', 'Todos los documentos ya están aprobados.');
      return;
    }
    Alert.alert(
      'Aprobar todo',
      `¿Aprobar los ${conId.length} documentos pendientes?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aprobar todo',
          onPress: async () => {
            for (const doc of conId) {
              try { await adminApi.aprobarDocumento(doc.id); } catch {}
            }
            cargar();
          },
        },
      ]
    );
  };

  const aprobados = documentos.filter(d => d.estado === 'aprobado').length;
  const total     = documentos.length;

  return (
    <View style={s.root}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />

      <ImagenModal uri={imagenModal} onClose={() => setImagenModal(null)} />

      {motivoDoc && (
        <MotivoModal
          visible
          onConfirm={(m) => rechazarDoc(motivoDoc, m)}
          onCancel={() => setMotivoDoc(null)}
        />
      )}

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle} numberOfLines={1}>{conductorNombre || 'Conductor'}</Text>
          <Text style={s.headerSub}>Documentos · {aprobados}/{total} aprobados</Text>
        </View>
        <View style={s.backBtn} />
      </View>

      {loading ? (
        <View style={s.centerWrap}>
          <ActivityIndicator color={C.yellow} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => cargar(true)} colors={[C.yellow]} />
          }
        >
          {/* Progress */}
          <View style={s.progressCard}>
            <View style={s.progressTop}>
              <Text style={s.progressLbl}>Progreso</Text>
              <Text style={s.progressCount}>{aprobados}/{total}</Text>
            </View>
            <View style={s.progressBarBg}>
              <View style={[s.progressBarFill, { width: total > 0 ? `${Math.round(aprobados / total * 100)}%` : '0%' }]} />
            </View>
          </View>

          {/* Botón aprobar todo */}
          <TouchableOpacity style={s.aprobarTodoBtn} onPress={aprobarTodo} activeOpacity={0.85}>
            <Text style={s.aprobarTodoBtnTxt}>✓  APROBAR TODOS LOS DOCUMENTOS</Text>
          </TouchableOpacity>

          {/* Lista de documentos */}
          {documentos.map((doc) => {
            const label     = ETIQUETAS[doc.tipo_documento] || doc.tipo_documento;
            const icono     = ICONOS[doc.tipo_documento]    || '📄';
            const tieneUrl  = !!doc.url_documento;
            const tieneId   = !!doc.id;
            const isAprob   = procesando === doc.id + '_aprobar';
            const isRechaz  = procesando === doc.id + '_rechazar';

            return (
              <View key={doc.tipo_documento} style={s.docCard}>
                {/* Imagen preview */}
                {tieneUrl ? (
                  <TouchableOpacity
                    style={s.imgPreviewWrap}
                    onPress={() => setImagenModal(doc.url_documento)}
                    activeOpacity={0.85}
                  >
                    <Image source={{ uri: doc.url_documento }} style={s.imgPreview} resizeMode="cover" />
                    <View style={s.imgOverlayBadge}>
                      <Text style={s.imgOverlayTxt}>Ver completo</Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <View style={s.imgPlaceholder}>
                    <Text style={s.imgPlaceholderIcon}>{icono}</Text>
                    <Text style={s.imgPlaceholderTxt}>Sin subir</Text>
                  </View>
                )}

                {/* Info del doc */}
                <View style={s.docInfo}>
                  <Text style={s.docLabel}>{label}</Text>

                  {doc.estado === 'aprobado' && (
                    <View style={s.badgeGreen}>
                      <Text style={s.badgeTxtGreen}>✓ Aprobado</Text>
                    </View>
                  )}
                  {doc.estado === 'rechazado' && (
                    <View style={s.badgeRed}>
                      <Text style={s.badgeTxtRed}>✗ Rechazado</Text>
                    </View>
                  )}
                  {doc.estado === 'pendiente' && (
                    <View style={s.badgeYellow}>
                      <Text style={s.badgeTxtYellow}>⏳ En revisión</Text>
                    </View>
                  )}
                  {!doc.estado && (
                    <View style={s.badgeGray}>
                      <Text style={s.badgeTxtGray}>○ Sin subir</Text>
                    </View>
                  )}
                </View>

                {/* Acciones */}
                {tieneId && (
                  <View style={s.docActions}>
                    <TouchableOpacity
                      style={s.docRechazarBtn}
                      onPress={() => setMotivoDoc(doc.id)}
                      disabled={!!procesando}
                      activeOpacity={0.85}
                    >
                      {isRechaz
                        ? <ActivityIndicator color={C.white} size="small" />
                        : <Text style={s.docRechazarTxt}>✗</Text>
                      }
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.docAprobarBtn}
                      onPress={() => aprobarDoc(doc.id)}
                      disabled={!!procesando}
                      activeOpacity={0.85}
                    >
                      {isAprob
                        ? <ActivityIndicator color={C.white} size="small" />
                        : <Text style={s.docAprobarTxt}>✓</Text>
                      }
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

/* ─── Estilos ────────────────────────────────────── */

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: C.bg },
  centerWrap:{ flex: 1, alignItems: 'center', justifyContent: 'center' },
  content:   { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 8 },

  /* Header */
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

  /* Progress */
  progressCard: {
    backgroundColor: C.white,
    borderRadius:    18,
    padding:         16,
    marginBottom:    14,
    ...SHADOW,
  },
  progressTop:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  progressLbl:    { fontSize: 13, fontWeight: '600', color: C.black },
  progressCount:  { fontSize: 13, fontWeight: '800', color: C.yellow },
  progressBarBg:  { height: 8, backgroundColor: C.border, borderRadius: 4, overflow: 'hidden' },
  progressBarFill:{ height: 8, backgroundColor: '#22C55E', borderRadius: 4 },

  /* Aprobar todo */
  aprobarTodoBtn: {
    backgroundColor: '#22C55E',
    borderRadius:    14,
    paddingVertical: 14,
    alignItems:      'center',
    marginBottom:    16,
    ...SHADOW,
  },
  aprobarTodoBtnTxt: { color: C.white, fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },

  /* Doc card */
  docCard: {
    backgroundColor: C.white,
    borderRadius:    20,
    overflow:        'hidden',
    marginBottom:    14,
    ...SHADOW,
  },
  imgPreviewWrap: { position: 'relative' },
  imgPreview:     { width: '100%', height: 180 },
  imgOverlayBadge:{
    position:          'absolute',
    bottom:            10,
    right:             10,
    backgroundColor:   'rgba(0,0,0,0.6)',
    borderRadius:      10,
    paddingHorizontal: 10,
    paddingVertical:   5,
  },
  imgOverlayTxt: { color: C.white, fontSize: 12, fontWeight: '600' },
  imgPlaceholder:{
    height:          120,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: C.bg,
  },
  imgPlaceholderIcon: { fontSize: 36, marginBottom: 8 },
  imgPlaceholderTxt:  { fontSize: 13, color: C.gray },

  docInfo: { padding: 14, paddingBottom: 8 },
  docLabel:{ fontSize: 15, fontWeight: '700', color: C.black, marginBottom: 8 },

  badgeGreen:  { alignSelf: 'flex-start', backgroundColor: C.greenBg,  borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeRed:    { alignSelf: 'flex-start', backgroundColor: C.redBg,    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeYellow: { alignSelf: 'flex-start', backgroundColor: '#FFF9E6',  borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeGray:   { alignSelf: 'flex-start', backgroundColor: C.border,   borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },

  badgeTxtGreen:  { fontSize: 12, fontWeight: '700', color: '#15803D' },
  badgeTxtRed:    { fontSize: 12, fontWeight: '700', color: C.red },
  badgeTxtYellow: { fontSize: 12, fontWeight: '700', color: '#7A5C00' },
  badgeTxtGray:   { fontSize: 12, fontWeight: '700', color: C.gray },

  docActions: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingBottom: 14, paddingTop: 6 },
  docRechazarBtn: {
    flex:            1,
    backgroundColor: C.red,
    borderRadius:    12,
    paddingVertical: 12,
    alignItems:      'center',
  },
  docRechazarTxt:  { color: C.white, fontSize: 18, fontWeight: '800' },
  docAprobarBtn: {
    flex:            2,
    backgroundColor: '#22C55E',
    borderRadius:    12,
    paddingVertical: 12,
    alignItems:      'center',
  },
  docAprobarTxt:   { color: C.white, fontSize: 18, fontWeight: '800' },

  /* Imagen full modal */
  imgOverlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  imgClose: {
    position:  'absolute',
    top:       52,
    right:     20,
    width:     40,
    height:    40,
    borderRadius:    20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:    10,
  },
  imgCloseTxt: { color: C.white, fontSize: 18, fontWeight: '700' },
  imgFull: {
    width:  '100%',
    height: '80%',
  },

  /* Motivo modal */
  overlay: {
    flex:              1,
    backgroundColor:   'rgba(0,0,0,0.55)',
    justifyContent:    'center',
    paddingHorizontal: 24,
  },
  motivoCard:       { backgroundColor: C.white, borderRadius: 24, padding: 24, ...SHADOW },
  motivoTitle:      { fontSize: 17, fontWeight: '700', color: C.black, marginBottom: 16 },
  motivoInput: {
    borderWidth:       1.5,
    borderColor:       C.border,
    borderRadius:      12,
    padding:           14,
    fontSize:          15,
    color:             C.black,
    minHeight:         80,
    textAlignVertical: 'top',
    marginBottom:      18,
  },
  motivoBtns:       { flexDirection: 'row', gap: 10 },
  motivoCancelBtn:  { flex: 1, backgroundColor: C.bg, borderRadius: 12, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  motivoCancelTxt:  { color: C.gray, fontSize: 14, fontWeight: '600' },
  motivoConfirmBtn: { flex: 2, backgroundColor: C.red, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  motivoConfirmTxt: { color: C.white, fontSize: 14, fontWeight: '700' },
});
