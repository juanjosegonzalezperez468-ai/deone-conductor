import auth from '@react-native-firebase/auth';

export const API_URL = process.env.EXPO_PUBLIC_API_URL;
export const getUid  = () => auth().currentUser?.uid;
