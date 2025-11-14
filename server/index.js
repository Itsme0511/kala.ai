require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const upload = multer();
const app = express();

// Enable CORS for mobile/web app
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
const DEFAULT_MONGO_URI = 'mongodb+srv://apoorv2002singh:NhkqYjQqG10kn13E@cluster0.mmtos.mongodb.net/';
const DEFAULT_JWT_SECRET = 'NhkqYjQqG10kn13E';
const MONGO_URI = process.env.MONGO_URI || DEFAULT_MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;

if (!process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET not set. Using fallback secret provided in source.');
}

let mongoPromise = null;
async function connectDB(uri = MONGO_URI) {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  if (!uri) {
    throw new Error('MONGO_URI not configured');
  }
  if (!mongoPromise) {
    mongoPromise = mongoose.connect(uri, {
      autoIndex: true,
      serverSelectionTimeoutMS: 5000,
    });
  }
  await mongoPromise;
  return mongoose.connection;
}

if (process.env.NODE_ENV !== 'test') {
  connectDB()
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch((err) => console.error('MongoDB connection failed:', err.message));
}

const artisanSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    bio: { type: String },
    location: { type: String },
    avatar: { type: String },
  },
  { timestamps: true }
);

const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    images: [{ type: String }],
    category: { type: String, required: true },
    stock: { type: Number, default: 0 },
    artisanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Artisan', required: true },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  },
  { timestamps: true }
);

productSchema.index({ title: 'text', description: 'text', category: 'text' });

const Artisan = mongoose.models.Artisan || mongoose.model('Artisan', artisanSchema);
const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

function sanitizeArtisan(doc) {
  if (!doc) return null;
  const plain = doc.toObject ? doc.toObject() : doc;
  const { passwordHash, __v, ...rest } = plain;
  return rest;
}

function generateToken(artisan) {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET not configured');
  }
  return jwt.sign(
    { id: artisan._id.toString(), email: artisan.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

async function authMiddleware(req, res, next) {
  try {
    await connectDB();
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    const payload = jwt.verify(token, JWT_SECRET);
    const artisanId = payload.id || payload.sub;
    if (!artisanId) {
      return res.status(401).json({ ok: false, error: 'Invalid token payload' });
    }
    const artisan = await Artisan.findById(artisanId);
    if (!artisan) {
      return res.status(401).json({ ok: false, error: 'Account not found' });
    }
    req.artisan = artisan;
    next();
  } catch (err) {
    console.error('Auth error:', err.message);
    return res.status(401).json({ ok: false, error: 'Invalid or expired token' });
  }
}

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

// ---------- Auth & Account endpoints ----------
app.post('/api/auth/register', async (req, res) => {
  try {
    await connectDB();
    const { name, email, password, location, bio } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ ok: false, error: 'Name, email, and password are required' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await Artisan.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ ok: false, error: 'An account with this email already exists' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const artisan = await Artisan.create({ name: name.trim(), email: normalizedEmail, passwordHash, location, bio });
    const token = generateToken(artisan);
    res.status(201).json({ ok: true, token, artisan: sanitizeArtisan(artisan) });
  } catch (err) {
    console.error('Register failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    await connectDB();
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: 'Email and password are required' });
    }
    const artisan = await Artisan.findOne({ email: email.trim().toLowerCase() });
    if (!artisan) {
      return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    }
    const valid = await bcrypt.compare(password, artisan.passwordHash);
    if (!valid) {
      return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    }
    const token = generateToken(artisan);
    res.json({ ok: true, token, artisan: sanitizeArtisan(artisan) });
  } catch (err) {
    console.error('Login failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/account/profile', authMiddleware, async (req, res) => {
  res.json({ ok: true, artisan: sanitizeArtisan(req.artisan) });
});

app.put('/api/account/profile', authMiddleware, async (req, res) => {
  try {
    const updatableFields = ['name', 'bio', 'location', 'avatar'];
    updatableFields.forEach((field) => {
      if (field in req.body) {
        req.artisan[field] = req.body[field];
      }
    });
    await req.artisan.save();
    res.json({ ok: true, artisan: sanitizeArtisan(req.artisan) });
  } catch (err) {
    console.error('Profile update failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------- Product endpoints ----------
app.post('/api/products', authMiddleware, async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      images = [],
      category,
      stock = 0,
      status = 'draft',
    } = req.body || {};

    if (!title || !description || typeof price === 'undefined' || !category) {
      return res.status(400).json({ ok: false, error: 'Title, description, price, and category are required' });
    }

    const normalizedStatus = status === 'published' ? 'published' : 'draft';
    const priceNumber = Number(price);
    const stockNumber = Number(stock) || 0;

    const safeImages = Array.isArray(images)
      ? images.filter(Boolean)
      : String(images || '')
          .split(',')
          .map((img) => img.trim())
          .filter(Boolean);

    let product = await Product.create({
      title: title.trim(),
      description: description.trim(),
      price: priceNumber,
      images: safeImages,
      category: category.trim(),
      stock: stockNumber,
      status: normalizedStatus,
      artisanId: req.artisan._id,
    });

    product = await product.populate('artisanId', 'name email location');

    res.status(201).json({ ok: true, product });
  } catch (err) {
    console.error('Create product failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.put('/api/products/:id', authMiddleware, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ ok: false, error: 'Product not found' });
    }
    if (product.artisanId.toString() !== req.artisan._id.toString()) {
      return res.status(403).json({ ok: false, error: 'You do not have permission to update this product' });
    }

    const updatableFields = ['title', 'description', 'price', 'images', 'category', 'stock', 'status'];
    updatableFields.forEach((field) => {
      if (field in req.body) {
        if (field === 'status') {
          product.status = req.body.status === 'published' ? 'published' : 'draft';
        } else if (field === 'images') {
          product.images = Array.isArray(req.body.images)
            ? req.body.images.filter(Boolean)
            : [];
        } else if (field === 'price') {
          product.price = Number(req.body.price);
        } else if (field === 'stock') {
          product.stock = Number(req.body.stock) || 0;
        } else if (typeof req.body[field] === 'string') {
          product[field] = req.body[field].trim();
        } else {
          product[field] = req.body[field];
        }
      }
    });

    await product.save();
    await product.populate('artisanId', 'name email location');
    res.json({ ok: true, product });
  } catch (err) {
    console.error('Update product failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/products/mine', authMiddleware, async (req, res) => {
  try {
    const products = await Product.find({ artisanId: req.artisan._id })
      .sort({ updatedAt: -1 })
      .populate('artisanId', 'name email location');
    res.json({ ok: true, products });
  } catch (err) {
    console.error('Fetch my products failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/marketplace', async (req, res) => {
  try {
    await connectDB();
    const { page = 1, limit = 12, q, category, sort = 'newest' } = req.query;
    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 12, 1), 48);

    const filters = { status: 'published' };
    if (q) {
      filters.title = { $regex: q, $options: 'i' };
    }
    if (category && category !== 'all') {
      filters.category = category;
    }

    const sortOptions = {
      newest: { createdAt: -1 },
      price_asc: { price: 1 },
      price_desc: { price: -1 },
    };
    const sortOrder = sortOptions[sort] || sortOptions.newest;

    const [products, total] = await Promise.all([
      Product.find(filters)
        .sort(sortOrder)
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber)
        .populate('artisanId', 'name email location'),
      Product.countDocuments(filters),
    ]);

    res.json({
      ok: true,
      products,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (err) {
    console.error('Marketplace fetch failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------- Existing AI image endpoints ----------
app.post('/api/enhance-image', upload.none(), async (req, res) => {
  try {
    const { croppedImageBase64 } = req.body || {};
    
    if (!croppedImageBase64) {
      return res.status(400).json({ ok: false, error: 'No cropped image provided. Please crop the image first.' });
    }

    let enhancedImageUrl = null;
    
    try {
      // Enhance image (remove background, resize, sharpen)
      const noBg = await removeBackground(croppedImageBase64);
      const enhanced = await enhanceImagePng(noBg);
      enhancedImageUrl = `data:image/png;base64,${enhanced.toString('base64')}`;
    } catch (enhanceErr) {
      console.error('Image enhancement failed:', enhanceErr.message);
      // Fallback: return cropped image as data URL
      let cleanBase64 = croppedImageBase64;
      if (croppedImageBase64.includes(',')) {
        cleanBase64 = croppedImageBase64.split(',')[1];
      }
      // Detect MIME type
      let mimeType = 'image/jpeg';
      if (cleanBase64.startsWith('iVBORw0KG')) {
        mimeType = 'image/png';
      }
      enhancedImageUrl = `data:${mimeType};base64,${cleanBase64}`;
    }

    res.json({ ok: true, enhancedImageUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Keep the old combined endpoint for backward compatibility
app.post('/api/crop-and-enhance', upload.none(), async (req, res) => {
  try {
    const { imageBase64, croppedImageBase64 } = req.body || {};
    // Use cropped image if available, otherwise use original
    const imageToUse = croppedImageBase64 || imageBase64;
    
    if (!imageToUse) {
      return res.status(400).json({ ok: false, error: 'No image provided' });
    }

    let enhancedImageUrl = null;
    
    try {
      // Enhance image (remove background, resize, sharpen)
      const noBg = await removeBackground(imageToUse);
      const enhanced = await enhanceImagePng(noBg);
      enhancedImageUrl = `data:image/png;base64,${enhanced.toString('base64')}`;
    } catch (enhanceErr) {
      console.error('Image enhancement failed:', enhanceErr.message);
      // Fallback: return cropped image as data URL
      let cleanBase64 = imageToUse;
      if (imageToUse.includes(',')) {
        cleanBase64 = imageToUse.split(',')[1];
      }
      // Detect MIME type
      let mimeType = 'image/jpeg';
      if (cleanBase64.startsWith('iVBORw0KG')) {
        mimeType = 'image/png';
      }
      enhancedImageUrl = `data:${mimeType};base64,${cleanBase64}`;
    }

    res.json({ ok: true, enhancedImageUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Endpoint 2: Generate title, description, and price using cropped/enhanced image
app.post('/api/generate-product-info', upload.none(), async (req, res) => {
  try {
    const { croppedImageBase64, language } = req.body || {};
    
    if (!croppedImageBase64) {
      return res.status(400).json({ ok: false, error: 'No cropped image provided. Please crop and enhance the image first.' });
    }

    let title = 'Generated Title';
    let description = 'Generated description';
    let estimatedPrice = '0';

    if (GEMINI_KEY) {
      try {
        // Clean base64 string - use cropped image for price prediction
        let cleanBase64 = croppedImageBase64;
        let mimeType = 'image/jpeg';
        
        if (croppedImageBase64.includes(',')) {
          const parts = croppedImageBase64.split(',');
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

        // Use Vision API - send cropped image and prompt
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
        console.error('Gemini Vision API call failed:', err.message);
      }
    } else {
      return res.status(500).json({ ok: false, error: 'Gemini API key not configured' });
    }

    res.json({ ok: true, title, description, estimatedPrice });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Keep the old endpoint for backward compatibility (optional - can be removed)
app.post('/api/enhance-and-generate', upload.none(), async (req, res) => {
  try {
    const { imageBase64, croppedImageBase64, language } = req.body || {};
    // Use cropped image if available, otherwise fall back to original
    const imageToUse = croppedImageBase64 || imageBase64;
    let title = 'Generated Title';
    let description = 'Generated description';
    let estimatedPrice = '0';
    let enhancedImageUrl = null;

    if (imageToUse && GEMINI_KEY) {
      try {
        // Clean base64 string - use cropped image for price prediction
        let cleanBase64 = imageToUse;
        let mimeType = 'image/jpeg';
        
        if (imageToUse.includes(',')) {
          const parts = imageToUse.split(',');
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
        console.error('Gemini Vision API call failed:', err.message);
      }
    }

    // Enhance image (remove background, resize, sharpen) - use cropped image
    if (imageToUse) {
      try {
        const noBg = await removeBackground(imageToUse);
        const enhanced = await enhanceImagePng(noBg);
        enhancedImageUrl = `data:image/png;base64,${enhanced.toString('base64')}`;
      } catch (enhanceErr) {
        console.error('Image enhancement failed:', enhanceErr.message);
        // Fallback: return cropped image as data URL
        let cleanBase64 = imageToUse;
        if (imageToUse.includes(',')) {
          cleanBase64 = imageToUse.split(',')[1];
        }
        // Detect MIME type
        let mimeType = 'image/jpeg';
        if (cleanBase64.startsWith('iVBORw0KG')) {
          mimeType = 'image/png';
        }
        enhancedImageUrl = `data:${mimeType};base64,${cleanBase64}`;
      }
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

async function startServer(port = PORT) {
  await connectDB();
  return new Promise((resolve) => {
    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`Server running on 0.0.0.0:${port}`);
      console.log(`Local: http://localhost:${port}`);
      console.log(`Network: http://<your-ip>:${port}`);
      resolve(server);
    });
  });
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

module.exports = {
  app,
  startServer,
  connectDB,
  Artisan,
  Product,
};