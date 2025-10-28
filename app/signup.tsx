import React, { useEffect, useState } from 'react';
import { View, Alert } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { createUserWithEmailAndPassword, updateProfile, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { auth, db } from '../firebase/firebase';


export default function Signup() {
const [email, setEmail] = useState<string>('');
const [pass, setPass] = useState<string>('');
const [name, setName] = useState<string>('');
const [location, setLocation] = useState<string>('');
const router = useRouter();

 useEffect(() => {
 const unsub = onAuthStateChanged(auth, (user) => {
 if (user) router.replace('/');
 });
 return unsub;
 }, []);


async function onSignup() {
try {
const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), pass);
const user = userCredential.user;
await updateProfile(user, { displayName: name });


const userRef = doc(db, 'users', user.uid);
await setDoc(userRef, {
uid: user.uid,
email: user.email,
name,
location,
artisanCategory: '',
createdAt: serverTimestamp(),
});


router.replace('/');
} catch (err: any) {
Alert.alert('Signup failed', err.message || String(err));
}
}


return (
<View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
<Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 12 }}>Kala.ai — Create account</Text>
<TextInput label="Full name" value={name} onChangeText={setName} style={{ marginTop: 12 }} />
<TextInput label="Location" value={location} onChangeText={setLocation} style={{ marginTop: 12 }} />
<TextInput label="Email" value={email} onChangeText={setEmail} style={{ marginTop: 12 }} keyboardType="email-address" autoCapitalize="none" />
<TextInput label="Password" secureTextEntry value={pass} onChangeText={setPass} style={{ marginTop: 12 }} />
<Button mode="contained" onPress={onSignup} style={{ marginTop: 16 }}>Create account</Button>
<Button onPress={() => router.push('/login')} style={{ marginTop: 8 }}>Already have an account?</Button>
</View>
);
}