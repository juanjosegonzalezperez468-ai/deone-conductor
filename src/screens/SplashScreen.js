import React, { useEffect } from 'react';
import { View, Image, ActivityIndicator, StyleSheet, StatusBar } from 'react-native';
import auth from '@react-native-firebase/auth';
import { C } from '../constants/theme';

export default function SplashScreen({ navigate }) {
  useEffect(() => {
    let resolved = false;
    const unsubscribe = auth().onAuthStateChanged((user) => {
      if (resolved) return;
      resolved = true;
      setTimeout(() => {
        navigate(user ? 'App' : 'Login');
      }, 1400);
    });
    return unsubscribe;
  }, []);

  return (
    <View style={s.root}>
      <StatusBar backgroundColor={C.white} barStyle="dark-content" />
      <Image source={require('../../assets/logo.png')} style={s.logo} />
      <ActivityIndicator size="small" color={C.yellow} style={s.spinner} />
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.white, justifyContent: 'center', alignItems: 'center' },
  logo:    { width: 200, height: 200, resizeMode: 'contain' },
  spinner: { marginTop: 48 },
});
