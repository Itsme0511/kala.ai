import React, { useEffect, useState } from 'react';
import { View, Alert } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase/firebase';
import { useRouter } from 'expo-router';


export default function Profile() {
const [profile, setProfile] = useState<any>(null);
const [name, setName] = useState<string>('');
const [location, setLocation] = useState<string>('');
const [loading, setLoading] = useState<boolean>(true);
const router = useRouter();


useEffect(() => {
const unsub = onAuthStateChanged(auth, async (user) => {
if (user) {
const ref = doc(db, 'users', user.uid);
const snap = await getDoc(ref);
if (snap.exists()) {
const data = snap.data();
setProfile(data);
setName(data.name || '');
setLocation(data.location || '');
}
}
setLoading(false);
});
return unsub;
}, []);


async function save() {
try {
const user = auth.currentUser;
if (!user) return Alert.alert('Not signed in');
const ref = doc(db, 'users', user.uid);
await updateDoc(ref, { name, location });
Alert.alert('Profile saved');
} catch (err: any) {
Alert.alert('Save failed', err.message || String(err));
}
}

async function onLogout() {
try {
await signOut(auth);
router.replace('/login');
} catch (err: any) {
Alert.alert('Logout failed', err.message || String(err));
}
}


if (loading) return <View style={{ flex: 1 }} />;


return (
<View style={{ flex: 1, padding: 16 }}>
<Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 12 }}>Profile</Text>
<TextInput label="Full name" value={name} onChangeText={setName} style={{ marginTop: 12 }} />
<TextInput label="Location" value={location} onChangeText={setLocation} style={{ marginTop: 12 }} />
<Button mode="contained" onPress={save} style={{ marginTop: 16 }}>Save</Button>
<Button onPress={onLogout} style={{ marginTop: 8 }}>Logout</Button>
</View>
);
}

