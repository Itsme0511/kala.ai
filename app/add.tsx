// --- app/(tabs)/add.js --- (Add Product)
import React, { useState } from 'react';
import { View, ScrollView, Image, Alert } from 'react-native';
import { TextInput, Button, Text, Checkbox } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { API_BASE_URL } from '../constants/api';

export default function AddProduct() {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [croppedImageUri, setCroppedImageUri] = useState<string | null>(null);
  const [enhancedImageUri, setEnhancedImageUri] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [marketplaces, setMarketplaces] = useState<{ amazon: boolean; flipkart: boolean; etsy: boolean }>({ amazon: true, flipkart: false, etsy: false });
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  async function pickImage() {
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, allowsEditing: false });
    if (!res.canceled) {
      setImageUri(res.assets[0].uri!);
      setCroppedImageUri(null); // Reset cropped image when new image is picked
      setEnhancedImageUri(null); // Reset enhanced image when new image is picked
      setTitle(''); // Reset generated fields
      setDesc('');
      setPrice('');
    }
  }

  async function cropImage() {
    if (!imageUri) return Alert.alert('Please pick an image first');
    
    try {
      // Open image picker with the same image but with editing enabled for cropping
      const res = await ImagePicker.launchImageLibraryAsync({ 
        quality: 0.8, 
        allowsEditing: true,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      });
      
      if (!res.canceled && res.assets[0]) {
        setCroppedImageUri(res.assets[0].uri!);
        setEnhancedImageUri(null); // Reset enhanced image when new crop is done
        setTitle(''); // Reset generated fields
        setDesc('');
        setPrice('');
        Alert.alert('Success', 'Image cropped successfully!');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to crop image');
    }
  }

  async function enhanceImage() {
    if (!croppedImageUri) {
      return Alert.alert('Please crop the image first');
    }
    
    setIsEnhancing(true);
    try {
      const b = await FileSystem.readAsStringAsync(croppedImageUri, { encoding: 'base64' });
      const dataUrl = `data:image/jpeg;base64,${b}`;

      const resp = await fetch(`${API_BASE_URL}/api/enhance-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ croppedImageBase64: dataUrl }),
      });

      const json = await resp.json();
      if (json.ok && json.enhancedImageUrl) {
        setEnhancedImageUri(json.enhancedImageUrl);
        Alert.alert('Success', 'Image enhanced successfully!');
      } else {
        Alert.alert('Error', json.error || 'Failed to enhance image');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to enhance image');
    } finally {
      setIsEnhancing(false);
    }
  }

  async function generateProductInfo() {
    if (!enhancedImageUri) {
      return Alert.alert('Please crop and enhance the image first');
    }
    
    setIsGenerating(true);
    try {
      const resp = await fetch(`${API_BASE_URL}/api/generate-product-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ croppedImageBase64: enhancedImageUri, language: 'hi-IN' }),
      });

      const json = await resp.json();
      if (json.ok) {
        setTitle(json.title || '');
        setDesc(json.description || '');
        setPrice(json.estimatedPrice || '');
        Alert.alert('Success', 'Product information generated successfully!');
      } else {
        Alert.alert('Error', json.error || 'Failed to generate product information');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to generate product information');
    } finally {
      setIsGenerating(false);
    }
  }

  async function publish() {
    try {
      if (!title || !desc || !enhancedImageUri) return Alert.alert('Please fill title, description and enhance the image first');
      const payload = {
        title,
        description: desc,
        price,
        quantity,
        marketplaces,
        imageUri: enhancedImageUri, // Use enhanced image for publishing
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
      <TextInput label="Product Title" value={title} onChangeText={setTitle} />
      <TextInput label="Description" value={desc} onChangeText={setDesc} multiline numberOfLines={4} />
      <TextInput label="Price (₹)" value={price} onChangeText={setPrice} keyboardType="numeric" style={{ marginTop: 12 }} />
      <TextInput label="Quantity" value={quantity} onChangeText={setQuantity} keyboardType="numeric" style={{ marginTop: 12 }} />

      <Button onPress={pickImage} style={{ marginTop: 12 }}>Pick Image</Button>
      {imageUri ? (
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontWeight: '600', marginBottom: 8 }}>Original Image:</Text>
          <Image source={{ uri: imageUri }} style={{ height: 220, marginTop: 8 }} />
        </View>
      ) : null}
      {croppedImageUri ? (
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontWeight: '600', marginBottom: 8 }}>Cropped Image:</Text>
          <Image source={{ uri: croppedImageUri }} style={{ height: 220, marginTop: 8 }} />
        </View>
      ) : null}
      {enhancedImageUri ? (
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontWeight: '600', marginBottom: 8 }}>Enhanced Image:</Text>
          <Image source={{ uri: enhancedImageUri }} style={{ height: 220, marginTop: 8 }} />
        </View>
      ) : null}

      <Button 
        mode="outlined" 
        onPress={cropImage} 
        style={{ marginTop: 16 }}
        disabled={!imageUri}
      >
        Crop Image
      </Button>

      <Button 
        mode="contained" 
        onPress={enhanceImage} 
        style={{ marginTop: 12 }}
        disabled={!croppedImageUri || isEnhancing}
        loading={isEnhancing}
      >
        {isEnhancing ? 'Enhancing...' : 'Enhance Image'}
      </Button>

      <Button 
        mode="contained" 
        onPress={generateProductInfo} 
        style={{ marginTop: 12, backgroundColor: '#4CAF50' }}
        disabled={!enhancedImageUri || isGenerating}
        loading={isGenerating}
      >
        {isGenerating ? 'Generating...' : 'Generate Title, Description & Price'}
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

