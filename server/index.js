require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const upload = multer();
const app = express();

// Enable CORS for mobile app
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(bodyParser.json({ limit: '15mb' }));
const PORT = process.env.PORT || 4000;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const REMOVE_BG_KEY = process.env.REMOVE_BG_KEY;

async function removeBackground(imageBase64) {
  try {
    if (REMOVE_BG_KEY) {
      const FormData = (await import('form-data')).default;
      const fetch = (await import('node-fetch')).default;
      
      // Clean base64 string (remove data URL prefix if present)
      let cleanBase64 = imageBase64;
      if (imageBase64.includes(',')) {
        cleanBase64 = imageBase64.split(',')[1];
      }
      
      // Detect image format from base64
      let contentType = 'image/jpeg';
      let filename = 'image.jpg';
      if (cleanBase64.startsWith('/9j/') || cleanBase64.startsWith('iVBORw0KG')) {
        // JPEG or PNG detected
        if (cleanBase64.startsWith('iVBORw0KG')) {
          contentType = 'image/png';
          filename = 'image.png';
        }
      }
      
      // Convert base64 to Buffer
      const imageBuffer = Buffer.from(cleanBase64, 'base64');
      
      // Create FormData with image file
      const formData = new FormData();
      formData.append('size', 'auto');
      formData.append('image_file', imageBuffer, {
        filename: filename,
        contentType: contentType,
      });
      
      const resp = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: {
          'X-Api-Key': REMOVE_BG_KEY,
          ...formData.getHeaders(),
        },
        body: formData,
      });
      
      if (resp.ok) {
        const arrayBuf = await resp.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        return buf;
      } else {
        const errorText = await resp.text();
        console.error('remove.bg API error:', resp.status, errorText);
      }
    }
  } catch (e) {
    console.error('remove.bg failed', e.message);
  }
  // Fallback: return original image if removal fails
  let cleanBase64 = imageBase64;
  if (imageBase64.includes(',')) {
    cleanBase64 = imageBase64.split(',')[1];
  }
  return Buffer.from(cleanBase64, 'base64');
}

async function enhanceImagePng(buffer) {
  const sharp = require('sharp');
  const png = await sharp(buffer)
    .resize({ width: 1024, height: 1024, fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .sharpen()
    .png()
    .toBuffer();
  return png;
}


app.post('/api/enhance-and-generate', upload.none(), async (req, res) => {
  try {
    const { imageBase64, language } = req.body || {};
    let title = 'Generated Title';
    let description = 'Generated description';
    let estimatedPrice = '0';
    let enhancedImageUrl = null;

    if (imageBase64 && GEMINI_KEY) {
      try {
        // Clean base64 string
        let cleanBase64 = imageBase64;
        let mimeType = 'image/jpeg';
        
        if (imageBase64.includes(',')) {
          const parts = imageBase64.split(',');
          cleanBase64 = parts[1];
          // Extract MIME type from data URL if present
          if (parts[0].includes('image/png')) mimeType = 'image/png';
          else if (parts[0].includes('image/jpeg') || parts[0].includes('image/jpg')) mimeType = 'image/jpeg';
        } else {
          // Detect from base64 signature
          if (cleanBase64.startsWith('iVBORw0KG')) mimeType = 'image/png';
          else if (cleanBase64.startsWith('/9j/')) mimeType = 'image/jpeg';
        }

        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(GEMINI_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        
        // Create prompt for Vision API
        const prompt = `Analyze this image of a handmade artisan product and provide the following information:
1. A concise, SEO-friendly product title (max 60 characters)
2. A detailed product description (80-120 words) highlighting its features, craftsmanship, materials, and cultural significance
3. An estimated market price in Indian Rupees (₹) based on similar handmade artisan products available online

Consider:
- The type of product (pottery, textile, woodwork, metalwork, jewelry, etc.)
- Quality and craftsmanship visible
- Materials used
- Cultural/artisan heritage
- Current market prices for similar handmade products

Output ONLY valid JSON in this exact format (no markdown, no code blocks):
{
  "title": "Product title here",
  "description": "Detailed description here",
  "estimatedPrice": "price in rupees as number (e.g., 499, 1299, 2500)"
}`;

        // Use Vision API - send image and prompt
        const result = await model.generateContent([
          {
            inlineData: {
              data: cleanBase64,
              mimeType: mimeType,
            }
          },
          { text: prompt }
        ]);
        
        const text = result.response.text();
        
        // Try to extract JSON from response (remove markdown code blocks if present)
        let jsonText = text.trim();
        if (jsonText.startsWith('```json')) {
          jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/```\n?/g, '');
        }
        
        try {
          const parsed = JSON.parse(jsonText);
          title = parsed.title || title;
          description = parsed.description || description;
          estimatedPrice = String(parsed.estimatedPrice || parsed.price || '0');
        } catch (parseErr) {
          console.error('Failed to parse Gemini JSON response:', jsonText);
          // Fallback: try to extract info from text
          const titleMatch = jsonText.match(/"title"\s*:\s*"([^"]+)"/);
          const descMatch = jsonText.match(/"description"\s*:\s*"([^"]+)"/);
          const priceMatch = jsonText.match(/"estimatedPrice"\s*:\s*"?(\d+)"?/);
          if (titleMatch) title = titleMatch[1];
          if (descMatch) description = descMatch[1];
          if (priceMatch) estimatedPrice = priceMatch[1];
        }
      } catch (err) {
        console.error('Gemini Vision API call failed', err.message);
      }
    }

    // Enhance image (remove background, resize, sharpen)
    if (imageBase64) {
      const noBg = await removeBackground(imageBase64);
      const enhanced = await enhanceImagePng(noBg);
      enhancedImageUrl = `data:image/png;base64,${enhanced.toString('base64')}`;
    }

    res.json({ ok: true, title, description, estimatedPrice, enhancedImageUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/publish', async (req, res) => {
  try {
    const { marketplaces, title } = req.body || {};
    // Here you would integrate specific marketplace APIs
    res.json({ ok: true, submitted: Object.keys(marketplaces || {}).filter(k => marketplaces[k]), title });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ ok: true, message: 'Server is running' });
});

// Listen on all network interfaces (0.0.0.0) so phone can access it
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on 0.0.0.0:${PORT}`);
  console.log(`Local: http://localhost:${PORT}`);
  console.log(`Network: http://<your-ip>:${PORT}`);
});