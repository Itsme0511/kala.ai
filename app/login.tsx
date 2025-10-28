import React, { useEffect, useState } from 'react';
import { View, Alert } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'expo-router';
import { auth } from '../firebase/firebase';


export default function Login() {
const [email, setEmail] = useState<string>('');
const [pass, setPass] = useState<string>('');
const router = useRouter();

 useEffect(() => {
 const unsub = onAuthStateChanged(auth, (user) => {
 if (user) router.replace('/');
 });
 return unsub;
 }, []);


async function onLogin() {
try {
await signInWithEmailAndPassword(auth, email.trim(), pass);
router.replace('/');
} catch (err: any) {
Alert.alert('Login failed', err.message || String(err));
}
}


return (
<View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
<Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 12 }}>Kala.ai — Login</Text>
<TextInput label="Email" value={email} onChangeText={setEmail} style={{ marginTop: 12 }} keyboardType="email-address" autoCapitalize="none" />
<TextInput label="Password" secureTextEntry value={pass} onChangeText={setPass} style={{ marginTop: 12 }} />
<Button mode="contained" onPress={onLogin} style={{ marginTop: 16 }}>Log in</Button>
<Button onPress={() => router.push('/signup')} style={{ marginTop: 8 }}>Create account</Button>
</View>
);
}