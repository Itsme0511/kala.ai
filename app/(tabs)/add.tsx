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
  const [croppedImageBase64, setCroppedImageBase64] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [marketplaces, setMarketplaces] = useState<{ amazon: boolean; flipkart: boolean; etsy: boolean }>({ amazon: true, flipkart: false, etsy: false });
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  async function pickImage() {
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, allowsEditing: true, base64: true });
    if (!res.canceled) {
      const asset = res.assets[0];
      setImageUri(asset.uri!);

      let dataUrl: string | null = null;
      if (asset.base64) {
        dataUrl = `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`;
      } else {
        const fileBase64 = await FileSystem.readAsStringAsync(asset.uri!, { encoding: 'base64' });
        dataUrl = `data:${asset.mimeType || 'image/jpeg'};base64,${fileBase64}`;
      }
      setCroppedImageBase64(dataUrl);
    }
  }

  async function cropImage() {
    if (!croppedImageBase64) return Alert.alert('Please pick and crop an image first');
    
    try {
      setIsEnhancing(true);
      const resp = await fetch(`${API_BASE_URL}/api/enhance-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ croppedImageBase64 }),
      });

      if (!resp.ok) {
        const errorText = await resp.text();
        Alert.alert('Crop Image Failed', `Server returned ${resp.status}: ${errorText}`);
        return;
      }

      const json = await resp.json();
      if (json.ok && json.enhancedImageUrl) {
        setImageUri(json.enhancedImageUrl);
        setCroppedImageBase64(json.enhancedImageUrl);
        Alert.alert('Success', 'Image cropped and enhanced successfully.');
      } else {
        Alert.alert('Crop Image Failed', json.error || 'Unknown error');
      }
    } catch (err: any) {
      console.error('Crop error:', err);
      Alert.alert('Crop Image Failed', err.message || 'Unable to crop image');
    } finally {
      setIsEnhancing(false);
    }
  }

  async function generateProductInfo() {
    if (!croppedImageBase64) return Alert.alert('Please crop the image first');
    
    try {
      setIsGenerating(true);
      const resp = await fetch(`${API_BASE_URL}/api/generate-product-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ croppedImageBase64, language: 'hi-IN' }),
      });

      if (!resp.ok) {
        const errorText = await resp.text();
        Alert.alert('Generate Text Failed', `Server returned ${resp.status}: ${errorText}`);
        return;
      }

      const json = await resp.json();
      
      if (json.ok) {
        setTitle(json.title || '');
        setDesc(json.description || '');
        if (json.estimatedPrice && json.estimatedPrice !== '0') {
          setPrice(json.estimatedPrice);
        }
        Alert.alert('Success', 'Title, description, and price generated.');
      } else {
        Alert.alert('Generate Text Failed', json.error || 'Unknown error');
      }
    } catch (err: any) {
      console.error('Generate text error:', err);
      Alert.alert('Generate Text Failed', err.message || 'Unable to generate product info');
    } finally {
      setIsGenerating(false);
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
      {imageUri ? (
        <Image 
          source={{ uri: imageUri }} 
          style={{ height: 220, marginTop: 12, width: '100%' }} 
          resizeMode="contain"
          onError={() => {
            Alert.alert('Image Error', 'Failed to load image. Please try again.');
          }}
        />
      ) : null}

      <Button 
        mode="contained" 
        onPress={cropImage} 
        style={{ marginTop: 16 }} 
        loading={isEnhancing}
        disabled={isEnhancing}
      >
        Crop Image
      </Button>

      <Button 
        mode="contained" 
        onPress={generateProductInfo} 
        style={{ marginTop: 12 }} 
        loading={isGenerating}
        disabled={isGenerating}
      >
        Generate Text
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


