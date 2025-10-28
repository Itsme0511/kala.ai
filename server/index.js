require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const upload = multer();
const app = express();
app.use(bodyParser.json({ limit: '15mb' }));
const PORT = process.env.PORT || 4000;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const REMOVE_BG_KEY = process.env.REMOVE_BG_KEY;

async function removeBackground(imageBase64) {
  try {
    if (REMOVE_BG_KEY) {
      const fetch = (await import('node-fetch')).default;
      const resp = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: { 'X-Api-Key': REMOVE_BG_KEY },
        body: new URLSearchParams({ image_file_b64: imageBase64, size: 'auto' }),
      });
      if (resp.ok) {
        const arrayBuf = await resp.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        return buf;
      }
    }
  } catch (e) {
    console.error('remove.bg failed', e.message);
  }
  return Buffer.from(imageBase64, 'base64');
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
    let enhancedImageUrl = null;

    if (GEMINI_KEY) {
      try {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(GEMINI_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const prompt = `Write a concise, SEO-friendly product title and a 80-120 word description in the locale ${language || 'en-IN'} for a handmade artisan product. Output JSON with keys: title, description.`;
        const result = await model.generateContent([{ text: prompt }]);
        const text = result.response.text();
        try {
          const parsed = JSON.parse(text);
          title = parsed.title || title;
          description = parsed.description || description;
        } catch (_) {}
      } catch (err) {
        console.error('Gemini call failed', err.message);
      }
    }

    if (imageBase64) {
      const noBg = await removeBackground(imageBase64);
      const enhanced = await enhanceImagePng(noBg);
      enhancedImageUrl = `data:image/png;base64,${enhanced.toString('base64')}`;
    }

    res.json({ ok: true, title, description, enhancedImageUrl });
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

app.listen(PORT, () => console.log(`Server running on :${PORT}`));