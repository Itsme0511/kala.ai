// --- app/(tabs)/add.tsx --- (Add Product)
import React, { useState } from 'react';
import { View, ScrollView, Image, Alert } from 'react-native';
import { TextInput, Button, Text, Checkbox } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { API_BASE_URL } from '../../constants/api';

export default function AddProduct() {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [marketplaces, setMarketplaces] = useState<{ amazon: boolean; flipkart: boolean; etsy: boolean }>({ amazon: true, flipkart: false, etsy: false });

  async function pickImage() {
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, allowsEditing: true });
    if (!res.canceled) setImageUri(res.assets[0].uri!);
  }

  async function enhanceAndGenerate() {
    if (!imageUri) return Alert.alert('Please pick an image first');
    
    try {
      Alert.alert('Processing', 'Analyzing image with AI...');
      const b = await FileSystem.readAsStringAsync(imageUri, { encoding: 'base64' });

      const resp = await fetch(`${API_BASE_URL}/api/enhance-and-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: b, language: 'hi-IN' }),
      });

      const json = await resp.json();
      if (json.ok) {
        setTitle(json.title || '');
        setDesc(json.description || '');
        // Set estimated price if provided by AI
        if (json.estimatedPrice && json.estimatedPrice !== '0') {
          setPrice(json.estimatedPrice);
        }
        if (json.enhancedImageUrl) setImageUri(json.enhancedImageUrl);
        Alert.alert('Success', 'Product analyzed! Title, description, and price have been generated.');
      } else {
        Alert.alert('AI generation failed', json.error || 'Unknown error');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to generate product details');
    }
  }

  async function publish() {
    try {
      if (!title || !desc || !imageUri) return Alert.alert('Please fill title, description and image');
      const payload = {
        title,
        description: desc,
        price,
        quantity,
        marketplaces,
        imageUri,
      };
      const resp = await fetch(`${API_BASE_URL}/api/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await resp.json();
      if (json.ok) Alert.alert('Published', 'Product submitted to selected marketplaces');
      else Alert.alert('Publish failed', json.error || 'Unknown error');
    } catch (err: any) {
      Alert.alert('Publish failed', err.message || String(err));
    }
  }

  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 12 }}>Add Product</Text>
      <TextInput label="Product Title" value={title} onChangeText={setTitle} mode="outlined" />
      <TextInput label="Description" value={desc} onChangeText={setDesc} multiline numberOfLines={4} mode="outlined" style={{ marginTop: 12 }} />
      <TextInput 
        label="Price (₹)" 
        value={price} 
        onChangeText={setPrice} 
        keyboardType="numeric" 
        mode="outlined"
        style={{ marginTop: 12 }} 
        left={<TextInput.Icon icon="currency-inr" />}
      />
      {price ? (
        <Text style={{ fontSize: 12, color: '#666', marginTop: 4, marginLeft: 12 }}>
          AI estimated price - you can edit this
        </Text>
      ) : (
        <Text style={{ fontSize: 12, color: '#666', marginTop: 4, marginLeft: 12 }}>
          Will be estimated by AI
        </Text>
      )}
      <TextInput label="Quantity" value={quantity} onChangeText={setQuantity} keyboardType="numeric" style={{ marginTop: 12 }} />

      <Button onPress={pickImage} style={{ marginTop: 12 }}>Pick Image</Button>
      {imageUri ? <Image source={{ uri: imageUri }} style={{ height: 220, marginTop: 12 }} /> : null}

      <Button mode="contained" onPress={enhanceAndGenerate} style={{ marginTop: 16 }}>
        Enhance Image & Generate Text (AI)
      </Button>

      <View style={{ marginTop: 16 }}>
        <Text style={{ fontWeight: '600', marginBottom: 8 }}>Select Marketplaces</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Checkbox status={marketplaces.amazon ? 'checked' : 'unchecked'} onPress={() => setMarketplaces({ ...marketplaces, amazon: !marketplaces.amazon })} />
          <Text>Amazon</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Checkbox status={marketplaces.flipkart ? 'checked' : 'unchecked'} onPress={() => setMarketplaces({ ...marketplaces, flipkart: !marketplaces.flipkart })} />
          <Text>Flipkart</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Checkbox status={marketplaces.etsy ? 'checked' : 'unchecked'} onPress={() => setMarketplaces({ ...marketplaces, etsy: !marketplaces.etsy })} />
          <Text>Etsy</Text>
        </View>
      </View>

      <Button mode="contained" onPress={publish} style={{ marginTop: 16 }}>Publish</Button>
    </ScrollView>
  );
}


