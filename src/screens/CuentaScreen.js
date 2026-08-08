import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, StatusBar, ActivityIndicator, Alert, Linking, Platform, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import {
  authApi, billingApi, conductorApi, documentosApi, vehiculoApi,
} from '../api/client';
import { getUserUuid, clearBackendToken, clearPhone, clearUserUuid } from '../utils/tokenStorage';
import { detenerUbicacionSegundoPlano, KEY_TIPO_SERVICIO } from '../utils/backgroundLocation';
import { marcarDocPendiente, limpiarDocPendiente } from '../utils/docPendiente';
import { C, SHADOW } from '../constants/theme';
import { NEQUI_RECARGAS, WHATSAPP_SOPORTE, WHATSAPP_URL as WA_URL, TEL_SOPORTE } from '../constants/config';

/* ─── Constants ─────────────────────────────────────────── */

const DOCUMENTOS_DEF = [
  { tipo: 'foto_perfil',    label: 'Foto de perfil',         icon: '📸' },
  { tipo: 'cedula_frente',  label: 'Cédula – Frente',        icon: '🪪' },
  { tipo: 'cedula_reverso', label: 'Cédula – Reverso',       icon: '🪪' },
  { tipo: 'licencia',       label: 'Licencia de conducción', icon: '📋' },
  { tipo: 'soat',           label: 'SOAT vigente',           icon: '🛡️' },
  { tipo: 'tarjeta_propiedad', label: 'Tarjeta de propiedad', icon: '📑' },
  { tipo: 'foto_vehiculo',  label: 'Foto del vehículo',      icon: '🚗' },
];

const TIPOS_SERVICIO = [
  { id: 'moto_pasajero',  label: 'Moto',      icon: '🏍️' },
  { id: 'carro_pasajero', label: 'Carro',     icon: '🚗' },
  { id: 'domicilio',      label: 'Domicilio', icon: '📦' },
  { id: 'acarreo',        label: 'Acarreo',   icon: '🚚' },
  { id: 'grua',           label: 'Grúa',      icon: '🚛' },
];

// Sub-tipos de vehículo por servicio (grúa/acarreo). Deben coincidir con el backend.
const SUBTIPOS = {
  grua: [
    { id: 'motocarro', label: 'Motocarro' },
    { id: 'camioneta', label: 'Camioneta' },
    { id: 'camabaja',  label: 'Camabaja' },
  ],
  acarreo: [
    { id: 'motocarro', label: 'Motocarro' },
    { id: 'camioneta', label: 'Camioneta' },
    { id: 'turbo',     label: 'Turbo' },
    { id: 'nh',        label: 'NH' },
  ],
};

const FAQ = [
  {
    q: '¿Cuándo me activan la cuenta?',
    a: 'El equipo Deone revisa tu documentación en 24–48 horas hábiles. Te notificaremos por WhatsApp.',
  },
  {
    q: '¿Cómo funciona la comisión?',
    a: 'Descontamos el 8.5% del valor de cada viaje, de tu saldo.',
  },
  {
    q: '¿Cómo recargo mi saldo?',
    a: `Envía el dinero por Nequi al ${NEQUI_RECARGAS} y el comprobante por WhatsApp al ${WHATSAPP_SOPORTE}. Son números distintos: el dinero va al Nequi, el comprobante al WhatsApp.`,
  },
  {
    q: '¿Qué pasa si rechazo un viaje?',
    a: 'Puedes rechazar sin penalización directa, pero muchos rechazos seguidos afectan tu calificación.',
  },
];

const WHATSAPP_URL = WA_URL;
const TEL_URL      = TEL_SOPORTE;

/* ─── Sub-screen: Perfil ─────────────────────────────────── */

function PerfilView({ perfil, conductorId, onBack, onSave }) {
  const [nombre,  setNombre]  = useState(perfil?.nombre   || '');
  const [saving,  setSaving]  = useState(false);
  const [foto,         setFoto]         = useState(perfil?.foto_url || null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  const subirNuevaFoto = async (uri) => {
    setSubiendoFoto(true);
    try {
      // Mismo flujo que "Mis Documentos": queda en revisión del admin y el
      // backend la publica en users.foto_url para que el cliente la vea.
      const formData = new FormData();
      formData.append('archivo', { uri, type: 'image/jpeg', name: 'foto_perfil.jpg' });
      formData.append('tipo_documento', 'foto_perfil');
      formData.append('conductor_id', conductorId);
      await documentosApi.subir(formData);
      setFoto(uri);
      await onSave();
    } catch (err) {
      const detalle = err.response?.data?.detail || err.message || 'Error desconocido';
      Alert.alert('Error al subir la foto', detalle);
    } finally {
      setSubiendoFoto(false);
    }
  };

  const cambiarFoto = () => {
    if (subiendoFoto) return;
    Alert.alert(
      'Foto de perfil',
      'Tu foto la verán los clientes en tus ofertas.',
      [
        {
          text: 'Tomar foto',
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permiso denegado', 'Necesitamos acceso a tu cámara para tomar la foto.');
              return;
            }
            await marcarDocPendiente('foto_perfil');
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.8,
              allowsEditing: true,
              aspect: [1, 1],
            });
            limpiarDocPendiente();
            if (!result.canceled) subirNuevaFoto(result.assets[0].uri);
          },
        },
        {
          text: 'Elegir de galería',
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permiso denegado', 'Necesitamos acceso a tu galería para seleccionar la foto.');
              return;
            }
            await marcarDocPendiente('foto_perfil');
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.8,
              allowsEditing: true,
              aspect: [1, 1],
            });
            limpiarDocPendiente();
            if (!result.canceled) subirNuevaFoto(result.assets[0].uri);
          },
        },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  };

  const save = async () => {
    if (!nombre.trim() || saving) return;
    setSaving(true);
    try {
      await conductorApi.actualizarPerfil(conductorId, { nombre: nombre.trim() });
      await onSave();
      Alert.alert('Guardado', 'Perfil actualizado correctamente.');
    } catch {
      Alert.alert('Error', 'No se pudo guardar el perfil. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const inicial = (nombre || 'C')[0].toUpperCase();

  return (
    <View style={s.root}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />

      <View style={s.subHeader}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.subTitle}>Mi Perfil</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView contentContainerStyle={s.subContent} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={cambiarFoto} activeOpacity={0.8} disabled={subiendoFoto} style={s.avatarTouch}>
          {subiendoFoto ? (
            <View style={s.avatarBig}>
              <ActivityIndicator color={C.black} />
            </View>
          ) : foto ? (
            <Image source={{ uri: foto }} style={s.avatarBigFoto} />
          ) : (
            <View style={s.avatarBig}>
              <Text style={s.avatarBigTxt}>{inicial}</Text>
            </View>
          )}
          <View style={s.avatarCamBadge}>
            <Text style={s.avatarCamIcon}>📷</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={cambiarFoto} activeOpacity={0.7} disabled={subiendoFoto}>
          <Text style={s.cambiarFotoTxt}>
            {subiendoFoto ? 'Subiendo foto…' : 'Cambiar foto de perfil'}
          </Text>
        </TouchableOpacity>

        <Text style={s.fieldLabel}>Nombre completo</Text>
        <TextInput
          style={s.fieldInput}
          value={nombre}
          onChangeText={setNombre}
          placeholder="Tu nombre completo"
          placeholderTextColor={C.gray}
          autoCapitalize="words"
          returnKeyType="done"
        />

        <Text style={s.fieldLabel}>Teléfono</Text>
        <View style={s.fieldReadOnly}>
          <Text style={s.fieldReadOnlyTxt}>{perfil?.telefono || '(vinculado al inicio de sesión)'}</Text>
        </View>
        <Text style={s.fieldNote}>El teléfono está vinculado a tu cuenta de Firebase y no se puede cambiar aquí.</Text>

        <TouchableOpacity
          style={saving ? s.btnDis : s.btn}
          onPress={save}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color={C.black} />
            : <Text style={s.btnTxt}>GUARDAR CAMBIOS</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

/* ─── Sub-screen: Documentos ─────────────────────────────── */

function DocumentosView({ documentos, conductorId, onBack, onRefresh }) {
  const [uploading, setUploading] = useState(null);

  const getDocStatus = (tipo) => {
    const doc = documentos.find(d => d.tipo_documento === tipo);
    return doc?.estado || null;
  };

  const pickAndUpload = (tipo) => {
    Alert.alert(
      'Subir documento',
      'Elige una opción',
      [
        {
          text: 'Tomar foto',
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permiso denegado', 'Necesitamos acceso a tu cámara para tomar la foto.');
              return;
            }
            // Si Android mata la app mientras la cámara está abierta, este
            // marcador permite recuperar la foto y subirla al reiniciar.
            await marcarDocPendiente(tipo);
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.8,
              allowsEditing: true,
            });
            limpiarDocPendiente();
            if (!result.canceled) uploadDoc(tipo, result.assets[0].uri);
          },
        },
        {
          text: 'Elegir de galería',
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permiso denegado', 'Necesitamos acceso a tu galería para seleccionar la foto.');
              return;
            }
            await marcarDocPendiente(tipo);
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.8,
              allowsEditing: true,
            });
            limpiarDocPendiente();
            if (!result.canceled) uploadDoc(tipo, result.assets[0].uri);
          },
        },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  };

  const uploadDoc = async (tipo, uri) => {
    setUploading(tipo);
    try {
      const formData = new FormData();
      formData.append('archivo', { uri, type: 'image/jpeg', name: `${tipo}.jpg` });
      formData.append('tipo_documento', tipo);
      formData.append('conductor_id', conductorId);
      await documentosApi.subir(formData);
      await onRefresh();
    } catch (err) {
      const detalle = err.response?.data?.detail || err.message || 'Error desconocido';
      Alert.alert('Error al subir', detalle);
    } finally {
      setUploading(null);
    }
  };

  const aprobados = DOCUMENTOS_DEF.filter(d => getDocStatus(d.tipo) === 'aprobado').length;
  const pct = Math.round((aprobados / DOCUMENTOS_DEF.length) * 100);

  return (
    <View style={s.root}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />

      <View style={s.subHeader}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.subTitle}>Mis Documentos</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView contentContainerStyle={s.subContent} showsVerticalScrollIndicator={false}>
        <View style={s.docsProgressCard}>
          <View style={s.docsProgressTop}>
            <Text style={s.docsProgressLabel}>Progreso de documentación</Text>
            <Text style={s.docsProgressCount}>{aprobados}/{DOCUMENTOS_DEF.length} aprobados</Text>
          </View>
          <View style={s.progressBarBg}>
            <View style={[s.progressBarFill, { width: `${pct}%` }]} />
          </View>
          <Text style={s.docsProgressSub}>
            {aprobados === DOCUMENTOS_DEF.length
              ? '¡Documentación completa!'
              : `Sube los documentos faltantes para poder activarte`}
          </Text>
        </View>

        {DOCUMENTOS_DEF.map((doc) => {
          const estado = getDocStatus(doc.tipo);
          const isUploading = uploading === doc.tipo;

          return (
            <View key={doc.tipo} style={s.docCard}>
              <View style={s.docIconWrap}>
                <Text style={s.docIcon}>{doc.icon}</Text>
              </View>
              <View style={s.docInfo}>
                <Text style={s.docLabel}>{doc.label}</Text>
                {estado === 'aprobado' && (
                  <View style={s.estadoBadgeGreen}>
                    <Text style={s.estadoBadgeTxtGreen}>✓ Aprobado</Text>
                  </View>
                )}
                {estado === 'rechazado' && (
                  <View style={s.estadoBadgeRed}>
                    <Text style={s.estadoBadgeTxtRed}>✗ Rechazado</Text>
                  </View>
                )}
                {estado === 'pendiente' && (
                  <View style={s.estadoBadgeYellow}>
                    <Text style={s.estadoBadgeTxtYellow}>⏳ En revisión</Text>
                  </View>
                )}
                {!estado && (
                  <View style={s.estadoBadgeGray}>
                    <Text style={s.estadoBadgeTxtGray}>○ Sin subir</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={estado === 'aprobado' ? s.uploadBtnDone : s.uploadBtn}
                onPress={() => pickAndUpload(doc.tipo)}
                disabled={isUploading}
                activeOpacity={0.8}
              >
                {isUploading
                  ? <ActivityIndicator size="small" color={C.black} />
                  : <Text style={estado === 'aprobado' ? s.uploadBtnTxtDone : s.uploadBtnTxt}>
                      {estado ? 'Actualizar' : 'Subir'}
                    </Text>
                }
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

/* ─── Sub-screen: Vehículo ───────────────────────────────── */

function VehiculoView({ vehiculo, conductorId, onBack, onSave, esNuevo = false }) {
  const [marca,        setMarca]        = useState(vehiculo?.marca         || '');
  const [modelo,       setModelo]       = useState(vehiculo?.modelo        || '');
  const [placa,        setPlaca]        = useState(vehiculo?.placa         || '');
  const [color,        setColor]        = useState(vehiculo?.color         || '');
  const [anio,         setAnio]         = useState(vehiculo?.año ? String(vehiculo.año) : '');
  const [subtipo,      setSubtipo]      = useState(vehiculo?.subtipo || null);
  const [capacidad,    setCapacidad]    = useState(vehiculo?.capacidad_kg ? String(vehiculo.capacidad_kg) : '');
  const [saving,       setSaving]       = useState(false);

  // Servicios que presta este vehículo. El primero es el principal, que es el
  // que el backend guarda como tipo_servicio.
  const [servicios, setServicios] = useState(
    vehiculo?.servicios?.length ? vehiculo.servicios
      : vehiculo?.tipo_servicio ? [vehiculo.tipo_servicio] : []
  );

  const alternarServicio = (id) => {
    setServicios((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  // Sub-tipos que sirven para TODOS los servicios pesados marcados: una
  // camioneta hace grúa y acarreo, una camabaja solo grúa. Si no hay ninguno
  // en común, la combinación es imposible y se avisa antes de guardar.
  const pesados = servicios.filter((sv) => SUBTIPOS[sv]);
  const subtiposDisponibles = pesados.length
    ? SUBTIPOS[pesados[0]].filter((st) => pesados.every((sv) => SUBTIPOS[sv].some((x) => x.id === st.id)))
    : null;
  const requiereSubtipo = pesados.length > 0;
  const combinacionImposible = requiereSubtipo && subtiposDisponibles.length === 0;

  // Si al marcar otro servicio el sub-tipo elegido deja de valer, se limpia.
  useEffect(() => {
    if (!requiereSubtipo) { setSubtipo(null); setCapacidad(''); }
    else if (subtipo && !subtiposDisponibles.some((x) => x.id === subtipo)) setSubtipo(null);
  }, [servicios.join(',')]);

  const tipoServicio = servicios[0] || null;

  const valid =
    marca.trim() && modelo.trim() && placa.trim() && color.trim() && anio.trim() &&
    servicios.length > 0 && !combinacionImposible && (!requiereSubtipo || !!subtipo);

  const save = async () => {
    if (!valid || saving) return;
    const placaNorm = placa.replace(/[^a-z0-9]/gi, '').toUpperCase();
    if (placaNorm.length < 5 || placaNorm.length > 7) {
      Alert.alert('Placa inválida', 'Revisa la placa: debe tener entre 5 y 7 letras y números, sin espacios ni guiones (Ej. ABC123).');
      return;
    }
    const anioNum = parseInt(anio, 10);
    const anioMax = new Date().getFullYear() + 1;
    if (!anioNum || anioNum < 1980 || anioNum > anioMax) {
      Alert.alert('Año inválido', `El año del vehículo debe estar entre 1980 y ${anioMax}. Es el año/modelo del vehículo, no el año actual.`);
      return;
    }
    setSaving(true);
    try {
      await vehiculoApi.registrar({
        conductor_id:  conductorId,
        marca:         marca.trim(),
        modelo:        modelo.trim(),
        placa:         placaNorm,
        color:         color.trim(),
        año:           anioNum,
        tipo_servicio: tipoServicio,
        servicios,
        subtipo:       requiereSubtipo ? subtipo : null,
        capacidad_kg:  servicios.includes('acarreo') && capacidad ? parseInt(capacidad, 10) : null,
        // Sin vehiculo_id el backend edita el único existente; con `nuevo`
        // crea otro. Es lo que distingue "editar" de "agregar".
        ...(vehiculo?.id ? { vehiculo_id: vehiculo.id } : {}),
        ...(esNuevo ? { nuevo: true } : {}),
      });
      // El heartbeat de segundo plano lee el tipo de servicio de AsyncStorage
      AsyncStorage.setItem(KEY_TIPO_SERVICIO, tipoServicio).catch(() => {});
      await onSave();
      Alert.alert('Guardado', 'Información del vehículo guardada.');
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Error desconocido';
      Alert.alert('Error al guardar', msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />

      <View style={s.subHeader}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.subTitle}>{esNuevo ? 'Nuevo vehículo' : 'Editar vehículo'}</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView contentContainerStyle={s.subContent} keyboardShouldPersistTaps="handled">
        <Text style={s.fieldLabel}>Marca</Text>
        <TextInput
          style={s.fieldInput}
          value={marca}
          onChangeText={setMarca}
          placeholder="Ej. Yamaha"
          placeholderTextColor={C.gray}
          autoCapitalize="words"
        />

        <Text style={s.fieldLabel}>Línea / Referencia</Text>
        <TextInput
          style={s.fieldInput}
          value={modelo}
          onChangeText={setModelo}
          placeholder="Ej. YZ 150, Spark GT"
          placeholderTextColor={C.gray}
          autoCapitalize="words"
        />

        <Text style={s.fieldLabel}>Placa</Text>
        <TextInput
          style={s.fieldInput}
          value={placa}
          onChangeText={setPlaca}
          placeholder="Ej. ABC123"
          placeholderTextColor={C.gray}
          autoCapitalize="characters"
        />

        <Text style={s.fieldLabel}>Color</Text>
        <TextInput
          style={s.fieldInput}
          value={color}
          onChangeText={setColor}
          placeholder="Ej. Rojo"
          placeholderTextColor={C.gray}
          autoCapitalize="words"
        />

        <Text style={s.fieldLabel}>Año / Modelo del vehículo</Text>
        <TextInput
          style={s.fieldInput}
          value={anio}
          onChangeText={setAnio}
          placeholder="Ej. 2022"
          placeholderTextColor={C.gray}
          keyboardType="numeric"
          maxLength={4}
        />

        <Text style={s.fieldLabel}>¿Qué servicios puede prestar?</Text>
        <Text style={s.fieldHint}>
          Puedes marcar varios: una camioneta sirve igual para grúa de motos que
          para acarreo.
        </Text>
        <View style={s.tipoGrid}>
          {TIPOS_SERVICIO.map((t) => {
            const sel = servicios.includes(t.id);
            return (
              <TouchableOpacity
                key={t.id}
                style={sel ? s.tipoCardSelected : s.tipoCard}
                onPress={() => alternarServicio(t.id)}
                activeOpacity={0.8}
              >
                <Text style={s.tipoIcon}>{t.icon}</Text>
                <Text style={sel ? s.tipoLabelSelected : s.tipoLabel}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {servicios.length > 1 && (
          <Text style={s.fieldHint}>
            Al usar este vehículo recibirás carreras de {servicios.length} servicios.
          </Text>
        )}

        {/* Sub-tipo del vehículo (solo grúa/acarreo) */}
        {requiereSubtipo && (
          <>
            <Text style={s.fieldLabel}>
              {tipoServicio === 'grua' ? 'Tipo de grúa' : 'Tipo de vehículo de carga'}
            </Text>
            <View style={s.tipoGrid}>
              {subtiposDisponibles.map((st) => (
                <TouchableOpacity
                  key={st.id}
                  style={subtipo === st.id ? s.subtipoSelected : s.subtipoCard}
                  onPress={() => setSubtipo(st.id)}
                  activeOpacity={0.8}
                >
                  <Text style={subtipo === st.id ? s.tipoLabelSelected : s.tipoLabel}>
                    {st.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Capacidad de carga (solo acarreo, opcional) */}
        {tipoServicio === 'acarreo' && (
          <>
            <Text style={s.fieldLabel}>Capacidad de carga en kg (opcional)</Text>
            <TextInput
              style={s.fieldInput}
              value={capacidad}
              onChangeText={(v) => setCapacidad(v.replace(/[^0-9]/g, ''))}
              placeholder="Ej. 1500"
              placeholderTextColor={C.gray}
              keyboardType="numeric"
              maxLength={6}
            />
          </>
        )}

        <TouchableOpacity
          style={valid ? s.btn : s.btnDis}
          onPress={save}
          disabled={!valid || saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color={C.black} />
            : <Text style={s.btnTxt}>GUARDAR VEHÍCULO</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

/* ─── Sub-screen: Ayuda / Soporte ────────────────────────── */

function AyudaView({ onBack }) {
  const [faqOpen, setFaqOpen] = useState(null);

  return (
    <View style={s.root}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />

      <View style={s.subHeader}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.subTitle}>Ayuda y Soporte</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView contentContainerStyle={s.subContent} showsVerticalScrollIndicator={false}>
        <View style={s.contactCard}>
          <TouchableOpacity
            style={s.whatsappBtn}
            onPress={() => Linking.openURL(WHATSAPP_URL)}
            activeOpacity={0.85}
          >
            <Text style={s.contactIcon}>💬</Text>
            <View>
              <Text style={s.whatsappLabel}>WhatsApp</Text>
              <Text style={s.whatsappSub}>Respuesta rápida</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.callBtn}
            onPress={() => Linking.openURL(TEL_URL)}
            activeOpacity={0.85}
          >
            <Text style={s.contactIcon}>📞</Text>
            <View>
              <Text style={s.callLabel}>Llamar</Text>
              <Text style={s.callSub}>{WHATSAPP_SOPORTE}</Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={s.sectionLbl}>PREGUNTAS FRECUENTES</Text>

        {FAQ.map((item, i) => (
          <TouchableOpacity
            key={i}
            style={s.faqCard}
            onPress={() => setFaqOpen(faqOpen === i ? null : i)}
            activeOpacity={0.8}
          >
            <View style={s.faqQuestion}>
              <Text style={s.faqQ}>{item.q}</Text>
              <Text style={s.faqArrow}>{faqOpen === i ? '∧' : '∨'}</Text>
            </View>
            {faqOpen === i && <Text style={s.faqA}>{item.a}</Text>}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

/* ─── Sub-screen: Mis vehículos ──────────────────────────── */

const LABEL_SERVICIO = Object.fromEntries(TIPOS_SERVICIO.map((t) => [t.id, t.label]));

function VehiculosView({ conductorId, onBack, onSave }) {
  const [vehiculos, setVehiculos] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [editando,  setEditando]  = useState(null);   // vehículo | 'nuevo' | null
  const [cambiando, setCambiando] = useState(null);

  const cargar = async () => {
    try {
      const { data } = await vehiculoApi.listar(conductorId);
      setVehiculos(data.vehiculos || []);
    } catch {
      setVehiculos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const activar = async (v) => {
    if (v.activo || cambiando) return;
    if (!v.verificado) {
      Alert.alert(
        'Vehículo en revisión',
        'El equipo Deone está revisando los documentos de este vehículo. Te avisamos cuando quede habilitado.',
      );
      return;
    }
    setCambiando(v.id);
    try {
      const { data } = await vehiculoApi.activar(v.id);
      // El servicio de segundo plano lee de aquí qué carreras pedir.
      AsyncStorage.setItem(KEY_TIPO_SERVICIO, (data.servicios || [])[0] || '').catch(() => {});
      await cargar();
      await onSave();
      Alert.alert(
        'Vehículo cambiado',
        `Ahora recibirás carreras de: ${(data.servicios || []).map((x) => LABEL_SERVICIO[x] || x).join(', ')}.`,
      );
    } catch (err) {
      Alert.alert('No se pudo cambiar', err?.response?.data?.detail || 'Intenta de nuevo.');
    } finally {
      setCambiando(null);
    }
  };

  const eliminar = (v) => {
    Alert.alert('Eliminar vehículo', `¿Eliminar ${v.marca} ${v.modelo} (${v.placa})?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          try {
            await vehiculoApi.eliminar(v.id);
            await cargar();
            await onSave();
          } catch (err) {
            Alert.alert('No se pudo eliminar', err?.response?.data?.detail || 'Intenta de nuevo.');
          }
        },
      },
    ]);
  };

  if (editando) {
    return (
      <VehiculoView
        vehiculo={editando === 'nuevo' ? null : editando}
        conductorId={conductorId}
        esNuevo={editando === 'nuevo'}
        onBack={() => setEditando(null)}
        onSave={async () => { await cargar(); await onSave(); setEditando(null); }}
      />
    );
  }

  return (
    <View style={s.root}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />
      <View style={s.subHeader}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.subTitle}>Mis vehículos</Text>
        <View style={s.backBtn} />
      </View>

      {loading ? (
        <View style={s.centerWrap}><ActivityIndicator color={C.yellow} size="large" /></View>
      ) : (
        <ScrollView contentContainerStyle={s.subContent}>
          <Text style={s.vehIntro}>
            Toca un vehículo para usarlo. Solo recibirás carreras de los servicios
            del vehículo que tengas en uso.
          </Text>

          {vehiculos.map((v) => (
            <TouchableOpacity
              key={v.id}
              style={v.activo ? s.vehCardActivo : s.vehCard}
              onPress={() => activar(v)}
              activeOpacity={0.8}
            >
              <View style={{ flex: 1 }}>
                <View style={s.vehTop}>
                  <Text style={s.vehNombre} numberOfLines={1}>
                    {v.marca} {v.modelo}
                  </Text>
                  {v.activo && <View style={s.vehBadgeUso}><Text style={s.vehBadgeUsoTxt}>EN USO</Text></View>}
                  {!v.verificado && <View style={s.vehBadgeRev}><Text style={s.vehBadgeRevTxt}>EN REVISIÓN</Text></View>}
                </View>
                <Text style={s.vehPlaca}>{v.placa} · {v.color}</Text>
                <Text style={s.vehServicios}>
                  {(v.servicios || [v.tipo_servicio]).map((x) => LABEL_SERVICIO[x] || x).join(' · ')}
                </Text>
              </View>
              {cambiando === v.id
                ? <ActivityIndicator color={C.yellow} />
                : (
                  <View style={s.vehAcciones}>
                    <TouchableOpacity onPress={() => setEditando(v)} activeOpacity={0.7}>
                      <Text style={s.vehEditar}>Editar</Text>
                    </TouchableOpacity>
                    {vehiculos.length > 1 && (
                      <TouchableOpacity onPress={() => eliminar(v)} activeOpacity={0.7}>
                        <Text style={s.vehEliminar}>Eliminar</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={s.vehAgregar} onPress={() => setEditando('nuevo')} activeOpacity={0.8}>
            <Text style={s.vehAgregarTxt}>+ Agregar otro vehículo</Text>
          </TouchableOpacity>

          <Text style={s.vehNota}>
            Un vehículo nuevo pasa por revisión antes de poder usarse. Sube sus
            documentos desde "Mis documentos".
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

/* ─── Main Screen ─────────────────────────────────────────── */

const MENU_ITEMS = [
  { icon: '👤', label: 'Mi perfil',      key: 'perfil' },
  { icon: '📄', label: 'Mis documentos', key: 'documentos' },
  { icon: '🏍️', label: 'Mis vehículos', key: 'vehiculo' },
  { icon: '❓', label: 'Ayuda',         key: 'ayuda' },
  { icon: '💬', label: 'Soporte',       key: 'ayuda' },
  { icon: '📋', label: 'Comisiones',    key: null },
];

export default function CuentaScreen({ navigate, onMenuPress }) {
  const uuidRef              = useRef('');
  const [subScreen,      setSubScreen]      = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [penalizaciones, setPenalizaciones] = useState(null);
  const [perfil,         setPerfil]         = useState({ nombre: 'Conductor Deone', telefono: '' });
  const [documentos,     setDocumentos]     = useState([]);
  const [vehiculo,       setVehiculo]       = useState(null);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const uuid = await getUserUuid();
    if (uuid) uuidRef.current = uuid;
    return Promise.all([
      fetchPenalizaciones(),
      fetchPerfil(),
      fetchDocumentos(),
      fetchVehiculo(),
    ]).finally(() => setLoading(false));
  };

  const fetchPenalizaciones = () =>
    billingApi.penalizaciones(uuidRef.current)
      .then(({ data }) => setPenalizaciones(data))
      .catch(() => setPenalizaciones({ advertencias: [], suspendido: false }));

  const fetchPerfil = () =>
    conductorApi.perfil(uuidRef.current)
      .then(({ data }) => { if (data) setPerfil(data); })
      .catch(() => {});

  const fetchDocumentos = () =>
    documentosApi.obtener(uuidRef.current)
      .then(({ data }) => setDocumentos(Array.isArray(data) ? data : []))
      .catch(() => setDocumentos([]));

  const fetchVehiculo = () =>
    vehiculoApi.obtener(uuidRef.current)
      .then(({ data }) => setVehiculo(data || null))
      .catch(() => setVehiculo(null));

  const advertencias  = penalizaciones?.advertencias || [];
  const suspendido    = penalizaciones?.suspendido   || false;
  const suspHasta     = penalizaciones?.suspension_hasta;
  const docsAprobados = DOCUMENTOS_DEF.filter(d =>
    documentos.find(doc => doc.tipo_documento === d.tipo && doc.estado === 'aprobado')
  ).length;
  const docsPct = Math.round((docsAprobados / DOCUMENTOS_DEF.length) * 100);

  const formatFecha = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-CO', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
  };

  const back = () => setSubScreen(null);

  const handleLogout = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Seguro que quieres cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: async () => {
            await detenerUbicacionSegundoPlano();
            await Promise.all([
              clearBackendToken(), clearPhone(), clearUserUuid(),
              AsyncStorage.removeItem('conductor_disponible'),
              AsyncStorage.removeItem(KEY_TIPO_SERVICIO),
            ]);
            await auth().signOut();
            navigate('Login');
          },
        },
      ],
    );
  };

  // Exigido por Google Play: la app debe ofrecer eliminar la cuenta y sus
  // datos desde dentro. Doble confirmación porque es irreversible.
  const handleEliminarCuenta = () => {
    Alert.alert(
      'Eliminar cuenta',
      'Se borrarán tu acceso, tus datos personales, documentos y vehículo de ' +
        'forma permanente. El historial de servicios se conserva de forma ' +
        'anónima por razones contables.\n\nEsta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              '¿Eliminar definitivamente?',
              'Confirma que quieres eliminar tu cuenta de Deone Conductor.',
              [
                { text: 'No, conservar mi cuenta', style: 'cancel' },
                {
                  text: 'Sí, eliminar',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await authApi.eliminarCuenta(uuidRef.current);
                    } catch (err) {
                      const msg = err?.response?.data?.detail ||
                        'No se pudo eliminar la cuenta. Intenta de nuevo o escríbenos por WhatsApp.';
                      Alert.alert('Error', msg);
                      return;
                    }
                    await detenerUbicacionSegundoPlano();
                    await Promise.all([
                      clearBackendToken(), clearPhone(), clearUserUuid(),
                      AsyncStorage.removeItem('conductor_disponible'),
                      AsyncStorage.removeItem(KEY_TIPO_SERVICIO),
                    ]);
                    try { await auth().signOut(); } catch {}
                    Alert.alert('Cuenta eliminada', 'Tu cuenta y tus datos personales fueron eliminados.');
                    navigate('Login');
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  /* Sub-screen routing */
  if (subScreen === 'perfil') {
    return <PerfilView perfil={perfil} conductorId={uuidRef.current} onBack={back} onSave={fetchPerfil} />;
  }
  if (subScreen === 'documentos') {
    return <DocumentosView documentos={documentos} conductorId={uuidRef.current} onBack={back} onRefresh={fetchDocumentos} />;
  }
  if (subScreen === 'vehiculo') {
    return <VehiculosView conductorId={uuidRef.current} onBack={back} onSave={fetchVehiculo} />;
  }
  if (subScreen === 'ayuda') {
    return <AyudaView onBack={back} />;
  }

  const vehiculoSub = vehiculo
    ? `${vehiculo.marca || ''} ${vehiculo.modelo || ''}`.trim()
    : 'Sin registrar';

  const menuSubs = {
    'Mi perfil':      perfil.nombre || 'Editar información',
    'Mis documentos': `${docsAprobados}/${DOCUMENTOS_DEF.length} aprobados`,
    'Mis vehículos':  vehiculoSub,
    'Ayuda':          'Preguntas frecuentes',
    'Soporte':        'WhatsApp y llamadas',
    'Comisiones':     '8.5% por viaje',
  };

  return (
    <View style={s.root}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />

      <View style={s.topHeader}>
        <TouchableOpacity onPress={onMenuPress} style={s.menuBtn} activeOpacity={0.7}>
          <View style={s.bar} />
          <View style={s.bar} />
          <View style={s.bar} />
        </TouchableOpacity>
        <Text style={s.topHeading}>Mi cuenta</Text>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile card */}
        <View style={s.profileCard}>
          <TouchableOpacity style={s.avatar} onPress={() => setSubScreen('perfil')} activeOpacity={0.8}>
            <Text style={s.avatarTxt}>{(perfil.nombre || 'C')[0].toUpperCase()}</Text>
          </TouchableOpacity>
          <View style={s.profileInfo}>
            <Text style={s.profileName}>{perfil.nombre || 'Conductor Deone'}</Text>
            <View style={s.ratingRow}>
              <Text style={s.star}>★</Text>
              <Text style={s.ratingTxt}>{(perfil?.rating_promedio ?? perfil?.rating)?.toFixed(1) ?? '—'}</Text>
              <Text style={s.ratingCount}> · Conductor</Text>
            </View>
          </View>
          <View style={s.conductorBadge}>
            <Text style={s.conductorBadgeTxt}>CONDUCTOR</Text>
          </View>
        </View>

        {/* Documentación progress */}
        {!loading && (
          <TouchableOpacity
            style={s.docsProgress}
            onPress={() => setSubScreen('documentos')}
            activeOpacity={0.8}
          >
            <View style={s.docsProgressTop}>
              <Text style={s.docsProgressLabel}>Documentación</Text>
              <Text style={s.docsProgressCount}>{docsAprobados}/{DOCUMENTOS_DEF.length}</Text>
            </View>
            <View style={s.progressBarBg}>
              <View style={[s.progressBarFill, { width: `${docsPct}%` }]} />
            </View>
            <Text style={s.docsProgressSub}>
              {docsAprobados === DOCUMENTOS_DEF.length
                ? '¡Documentación completa!'
                : `${DOCUMENTOS_DEF.length - docsAprobados} documento${DOCUMENTOS_DEF.length - docsAprobados !== 1 ? 's' : ''} pendiente${DOCUMENTOS_DEF.length - docsAprobados !== 1 ? 's' : ''} · Toca para gestionar`}
            </Text>
          </TouchableOpacity>
        )}

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

        {/* Advertencias */}
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

        {/* Menu */}
        <Text style={s.sectionLbl}>MI CUENTA</Text>
        <View style={s.menuCard}>
          {MENU_ITEMS.map((item, i) => (
            <React.Fragment key={`${item.label}-${i}`}>
              <TouchableOpacity
                style={s.menuRow}
                activeOpacity={0.7}
                onPress={item.key ? () => setSubScreen(item.key) : undefined}
              >
                <View style={s.menuIconWrap}>
                  <Text style={s.menuIcon}>{item.icon}</Text>
                </View>
                <View style={s.menuInfo}>
                  <Text style={s.menuLabel}>{item.label}</Text>
                  <Text style={s.menuSub}>{menuSubs[item.label]}</Text>
                </View>
                <Text style={s.menuArrow}>›</Text>
              </TouchableOpacity>
              {i < MENU_ITEMS.length - 1 && <View style={s.menuSep} />}
            </React.Fragment>
          ))}
        </View>

        {/* ID */}
        <View style={s.idCard}>
          <Text style={s.idLbl}>ID CONDUCTOR</Text>
          <Text style={s.idVal} numberOfLines={1} ellipsizeMode="middle">
            {perfil.id || uuidRef.current}
          </Text>
        </View>

        {/* Cerrar sesión */}
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Text style={s.logoutTxt}>Cerrar sesión</Text>
        </TouchableOpacity>

        {/* Eliminar cuenta (requisito de Google Play) */}
        <TouchableOpacity style={s.deleteBtn} onPress={handleEliminarCuenta} activeOpacity={0.8}>
          <Text style={s.deleteTxt}>Eliminar mi cuenta</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────── */

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  scroll:  { flex: 1 },
  topHeader:  { paddingHorizontal: 12, paddingTop: Platform.OS === 'android' ? 48 : 52, paddingBottom: 8, backgroundColor: C.bg, flexDirection: 'row', alignItems: 'center' },
  menuBtn:    { padding: 10, justifyContent: 'center', marginRight: 4 },
  bar:        { width: 22, height: 2.5, backgroundColor: C.black, borderRadius: 2, marginVertical: 2.5 },
  topHeading: { color: C.black, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 48 },

  /* ── Sub-screen header ── */
  subHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    paddingTop:        52,
    paddingBottom:     14,
    backgroundColor:   C.bg,
  },
  backBtn: {
    width:          44,
    height:         44,
    alignItems:     'center',
    justifyContent: 'center',
  },
  backArrow: { fontSize: 32, color: C.black, fontWeight: '300', lineHeight: 38 },
  subTitle:  { fontSize: 17, fontWeight: '700', color: C.black },
  subContent:{ paddingHorizontal: 16, paddingBottom: 48, paddingTop: 8 },

  /* ── Profile ── */
  profileCard: {
    backgroundColor: C.white,
    borderRadius:    24,
    padding:         18,
    flexDirection:   'row',
    alignItems:      'center',
    marginBottom:    14,
    ...SHADOW,
  },
  avatar: {
    width:           60,
    height:          60,
    borderRadius:    30,
    backgroundColor: C.yellow,
    alignItems:      'center',
    justifyContent:  'center',
    marginRight:     14,
  },
  avatarTxt:     { color: C.black, fontSize: 28, fontWeight: '800' },
  profileInfo:   { flex: 1 },
  profileName:   { color: C.black, fontSize: 18, fontWeight: '800', marginBottom: 4 },
  ratingRow:     { flexDirection: 'row', alignItems: 'center' },
  star:          { color: C.yellow, fontSize: 14, marginRight: 3 },
  ratingTxt:     { color: C.black, fontSize: 14, fontWeight: '700' },
  ratingCount:   { color: C.gray,  fontSize: 13 },
  conductorBadge: {
    backgroundColor:   C.black,
    borderRadius:      10,
    paddingHorizontal: 10,
    paddingVertical:   4,
  },
  conductorBadgeTxt: { color: C.yellow, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },

  /* ── Docs progress ── */
  docsProgress: {
    backgroundColor: C.white,
    borderRadius:    20,
    padding:         16,
    marginBottom:    14,
    ...SHADOW,
  },
  docsProgressCard: {
    backgroundColor: C.white,
    borderRadius:    20,
    padding:         16,
    marginBottom:    16,
    ...SHADOW,
  },
  docsProgressTop:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  docsProgressLabel: { color: C.black, fontSize: 14, fontWeight: '700' },
  docsProgressCount: { color: C.yellow, fontSize: 14, fontWeight: '800' },
  progressBarBg: {
    height:          8,
    backgroundColor: C.border,
    borderRadius:    4,
    overflow:        'hidden',
    marginBottom:    8,
  },
  progressBarFill: { height: 8, backgroundColor: C.yellow, borderRadius: 4 },
  docsProgressSub: { color: C.gray, fontSize: 12 },

  /* ── Estado ── */
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
  estadoIcon:       { fontSize: 26, marginRight: 12 },
  estadoTexts:      { flex: 1 },
  estadoTitleGreen: { color: '#15803D', fontSize: 15, fontWeight: '800', marginBottom: 2 },
  estadoTitleRed:   { color: C.red,    fontSize: 15, fontWeight: '800', marginBottom: 2 },
  estadoSub:        { color: '#15803D', fontSize: 13 },
  suspHasta:        { color: C.red, fontSize: 13 },
  loadingWrap:      { paddingVertical: 24, alignItems: 'center', marginBottom: 14 },

  sectionLbl: {
    color:         C.gray,
    fontSize:      11,
    fontWeight:    '700',
    letterSpacing: 2,
    marginBottom:  10,
    marginTop:     4,
  },

  /* ── Advertencias ── */
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

  /* ── Menu ── */
  menuCard: {
    backgroundColor: C.white,
    borderRadius:    24,
    marginBottom:    14,
    overflow:        'hidden',
    ...SHADOW,
  },
  menuRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingVertical:   14,
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

  /* ── ID Card ── */
  idCard: { backgroundColor: C.white, borderRadius: 18, padding: 16, ...SHADOW },
  idLbl:  { color: C.gray, fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 6 },
  idVal:  { color: C.black, fontSize: 13, fontWeight: '500' },

  /* ── Logout ── */
  logoutBtn: {
    marginTop:      20,
    marginBottom:   8,
    paddingVertical:16,
    borderRadius:   16,
    borderWidth:    1.5,
    borderColor:    C.redBorder,
    alignItems:     'center',
  },
  logoutTxt: { color: C.red, fontSize: 15, fontWeight: '700' },

  deleteBtn: {
    marginBottom:    8,
    paddingVertical: 12,
    alignItems:      'center',
  },
  deleteTxt: { color: C.gray, fontSize: 13, textDecorationLine: 'underline' },

  /* ── Shared sub-screen elements ── */
  avatarTouch: { alignSelf: 'center' },
  avatarBig: {
    width:           96,
    height:          96,
    borderRadius:    48,
    backgroundColor: C.yellow,
    alignItems:      'center',
    justifyContent:  'center',
    ...SHADOW,
  },
  avatarBigTxt: { color: C.black, fontSize: 44, fontWeight: '800' },
  avatarBigFoto: {
    width:           96,
    height:          96,
    borderRadius:    48,
    backgroundColor: C.border,
    ...SHADOW,
  },
  avatarCamBadge: {
    position:        'absolute',
    right:           -2,
    bottom:          -2,
    width:           30,
    height:          30,
    borderRadius:    15,
    backgroundColor: C.white,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     C.border,
  },
  avatarCamIcon:  { fontSize: 15 },
  cambiarFotoTxt: {
    color:              C.gray,
    fontSize:           13,
    textAlign:          'center',
    marginTop:          10,
    marginBottom:       24,
    textDecorationLine: 'underline',
  },

  fieldLabel: { fontSize: 13, fontWeight: '600', color: C.black, marginBottom: 8, marginTop: 4 },
  fieldHint:  { fontSize: 11, color: C.gray, marginBottom: 10, lineHeight: 16, marginTop: -4 },

  /* Mis vehículos */
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  vehIntro:   { fontSize: 12, color: C.gray, lineHeight: 18, marginBottom: 16 },
  vehCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.white, borderRadius: 16, padding: 14,
    marginBottom: 10, borderWidth: 1.5, borderColor: C.border, ...SHADOW,
  },
  vehCardActivo: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.white, borderRadius: 16, padding: 14,
    marginBottom: 10, borderWidth: 2, borderColor: C.yellow, ...SHADOW,
  },
  vehTop:    { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  vehNombre: { fontSize: 15, fontWeight: '700', color: C.black, flexShrink: 1 },
  vehBadgeUso: {
    backgroundColor: C.yellow, borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  vehBadgeUsoTxt: { fontSize: 9, fontWeight: '800', color: C.black },
  vehBadgeRev: {
    backgroundColor: '#FFF9E6', borderColor: '#FFD700', borderWidth: 1,
    borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2,
  },
  vehBadgeRevTxt: { fontSize: 9, fontWeight: '800', color: '#7A5C00' },
  vehPlaca:     { fontSize: 12, color: C.gray, marginTop: 4 },
  vehServicios: { fontSize: 12, color: C.black, fontWeight: '600', marginTop: 4 },
  vehAcciones:  { alignItems: 'flex-end', gap: 8, marginLeft: 10 },
  vehEditar:    { fontSize: 12, fontWeight: '700', color: C.yellow },
  vehEliminar:  { fontSize: 12, fontWeight: '700', color: C.red },
  vehAgregar: {
    backgroundColor: C.white, borderRadius: 16, paddingVertical: 15,
    alignItems: 'center', borderWidth: 1.5, borderColor: C.yellow,
    borderStyle: 'dashed', marginTop: 4,
  },
  vehAgregarTxt: { fontSize: 14, fontWeight: '700', color: C.black },
  vehNota: { fontSize: 11, color: C.gray, lineHeight: 16, marginTop: 14 },
  fieldInput: {
    borderWidth:      1.5,
    borderColor:      C.border,
    borderRadius:     12,
    height:           54,
    paddingHorizontal:16,
    fontSize:         16,
    color:            C.black,
    backgroundColor:  C.white,
    marginBottom:     20,
  },
  fieldReadOnly: {
    borderWidth:      1.5,
    borderColor:      C.border,
    borderRadius:     12,
    height:           54,
    paddingHorizontal:16,
    justifyContent:   'center',
    backgroundColor:  C.bg,
    marginBottom:     8,
  },
  fieldReadOnlyTxt: { fontSize: 15, color: C.gray },
  fieldNote:        { fontSize: 12, color: C.gray, marginBottom: 24, lineHeight: 18 },

  btn: {
    backgroundColor: C.yellow,
    borderRadius:    14,
    height:          54,
    justifyContent:  'center',
    alignItems:      'center',
    marginTop:       8,
  },
  btnDis: {
    backgroundColor: '#FFE082',
    borderRadius:    14,
    height:          54,
    justifyContent:  'center',
    alignItems:      'center',
    marginTop:       8,
  },
  btnTxt: { fontSize: 16, fontWeight: '800', color: C.black, letterSpacing: 0.5 },

  /* ── Documentos ── */
  docCard: {
    backgroundColor:   C.white,
    borderRadius:      16,
    padding:           14,
    flexDirection:     'row',
    alignItems:        'center',
    marginBottom:      10,
    ...SHADOW,
  },
  docIconWrap: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: C.bg,
    alignItems:      'center',
    justifyContent:  'center',
    marginRight:     12,
  },
  docIcon: { fontSize: 20 },
  docInfo: { flex: 1 },
  docLabel:{ color: C.black, fontSize: 14, fontWeight: '600', marginBottom: 5 },

  estadoBadgeGreen:  { alignSelf: 'flex-start', backgroundColor: C.greenBg,    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  estadoBadgeRed:    { alignSelf: 'flex-start', backgroundColor: C.redBg,      borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  estadoBadgeYellow: { alignSelf: 'flex-start', backgroundColor: '#FFF9E6',    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  estadoBadgeGray:   { alignSelf: 'flex-start', backgroundColor: C.border,     borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },

  estadoBadgeTxtGreen:  { fontSize: 11, fontWeight: '700', color: '#15803D' },
  estadoBadgeTxtRed:    { fontSize: 11, fontWeight: '700', color: C.red },
  estadoBadgeTxtYellow: { fontSize: 11, fontWeight: '700', color: '#7A5C00' },
  estadoBadgeTxtGray:   { fontSize: 11, fontWeight: '700', color: C.gray },

  uploadBtn: {
    backgroundColor:   C.yellow,
    borderRadius:      10,
    paddingHorizontal: 12,
    paddingVertical:   8,
    minWidth:          70,
    alignItems:        'center',
  },
  uploadBtnDone: {
    backgroundColor:   C.bg,
    borderRadius:      10,
    paddingHorizontal: 12,
    paddingVertical:   8,
    minWidth:          70,
    alignItems:        'center',
    borderWidth:       1,
    borderColor:       C.border,
  },
  uploadBtnTxt:     { fontSize: 12, fontWeight: '700', color: C.black },
  uploadBtnTxtDone: { fontSize: 12, fontWeight: '600', color: C.gray },

  /* ── Vehículo ── */
  tipoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 },
  tipoCard: {
    width:           '47%',
    borderWidth:     1.5,
    borderColor:     C.border,
    borderRadius:    14,
    paddingVertical: 16,
    alignItems:      'center',
    backgroundColor: C.white,
    ...SHADOW,
  },
  tipoCardSelected: {
    width:           '47%',
    borderWidth:     2,
    borderColor:     C.yellow,
    borderRadius:    14,
    paddingVertical: 16,
    alignItems:      'center',
    backgroundColor: '#FFFBEA',
    ...SHADOW,
  },
  tipoIcon:          { fontSize: 26, marginBottom: 6 },
  tipoLabel:         { fontSize: 13, fontWeight: '600', color: C.gray },
  tipoLabelSelected: { fontSize: 13, fontWeight: '700', color: C.black },

  subtipoCard: {
    width:           '47%',
    borderWidth:     1.5,
    borderColor:     C.border,
    borderRadius:    14,
    paddingVertical: 14,
    alignItems:      'center',
    backgroundColor: C.white,
  },
  subtipoSelected: {
    width:           '47%',
    borderWidth:     2,
    borderColor:     C.yellow,
    borderRadius:    14,
    paddingVertical: 14,
    alignItems:      'center',
    backgroundColor: '#FFFBEA',
  },

  /* ── Ayuda ── */
  contactCard: {
    backgroundColor: C.white,
    borderRadius:    20,
    padding:         4,
    marginBottom:    20,
    ...SHADOW,
  },
  whatsappBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: '#25D366',
    borderRadius:    16,
    padding:         16,
    marginBottom:    4,
    gap:             14,
  },
  callBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: C.black,
    borderRadius:    16,
    padding:         16,
    gap:             14,
  },
  contactIcon:  { fontSize: 24 },
  whatsappLabel:{ color: C.white, fontSize: 15, fontWeight: '700' },
  whatsappSub:  { color: 'rgba(255,255,255,0.75)', fontSize: 12 },
  callLabel:    { color: C.yellow, fontSize: 15, fontWeight: '700' },
  callSub:      { color: 'rgba(255,255,255,0.6)', fontSize: 12 },

  faqCard: {
    backgroundColor: C.white,
    borderRadius:    16,
    padding:         16,
    marginBottom:    8,
    ...SHADOW,
  },
  faqQuestion: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  faqQ:        { flex: 1, color: C.black, fontSize: 14, fontWeight: '600', marginRight: 8 },
  faqArrow:    { color: C.gray, fontSize: 14 },
  faqA:        { color: C.gray, fontSize: 13, lineHeight: 20, marginTop: 10 },
});
