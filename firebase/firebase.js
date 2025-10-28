import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { firebaseConfig } from './firebaseConfig';


if (!getApps().length) {
initializeApp(firebaseConfig);
}


export const auth = initializeAuth(getApps()[0], {
persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});
export const db = getFirestore();