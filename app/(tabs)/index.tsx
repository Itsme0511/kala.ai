import React, { useEffect, useState } from 'react';
import { View, FlatList } from 'react-native';
import { Text, Card, FAB } from 'react-native-paper';
import { Link, useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase/firebase';


type UserProfile = {
uid?: string;
email?: string;
name?: string;
location?: string;
};


export default function Home() {
const [userProfile, setUserProfile] = useState<UserProfile | null>(null);


useEffect(() => {
const unsub = onAuthStateChanged(auth, async (user) => {
if (user) {
const ref = doc(db, 'users', user.uid);
const snap = await getDoc(ref);
if (snap.exists()) setUserProfile(snap.data() as UserProfile);
else setUserProfile({ uid: user.uid, email: user.email || '' });
} else {
setUserProfile(null);
}
});
return unsub;
}, []);


const SAMPLE_PRODUCTS = [
{ id: '1', title: 'Handwoven Scarf', price: '499' },
{ id: '2', title: 'Clay Pottery Bowl', price: '899' },
];


return (
<View style={{ flex: 1, padding: 16 }}>
<Card style={{ padding: 16, marginBottom: 12 }}>
<Text style={{ fontSize: 20, fontWeight: 'bold' }}>{userProfile ? `Kala.ai — ${userProfile.name || 'Artisan'}` : 'Kala.ai'}</Text>
<Text>{userProfile ? `${userProfile.location || ''} · ${userProfile.email || ''}` : 'Loading...'}</Text>
</Card>


<FlatList
data={SAMPLE_PRODUCTS}
keyExtractor={(item) => item.id}
renderItem={({ item }) => (
<Card style={{ marginBottom: 10, padding: 12 }}>
<Text style={{ fontSize: 16, fontWeight: '600' }}>{item.title}</Text>
<Text>₹{item.price}</Text>
<Link href={`/note/${item.id}` as any}><Text>Open</Text></Link>
</Card>
)}
/>


<Link href="/(tabs)/add" asChild>
<FAB icon="plus" style={{ position: 'absolute', right: 16, bottom: 16 }} />
</Link>
</View>
);
}

