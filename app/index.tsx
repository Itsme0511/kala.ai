import { useEffect } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/firebase';
import { useState } from 'react';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
      if (user) {
        router.replace('/(tabs)/' as any);
      } else {
        router.replace('/login');
      }
    });
    return unsubscribe;
  }, []);

  if (isAuthenticated === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1A73E8" />
      </View>
    );
  }

  return null;
}
