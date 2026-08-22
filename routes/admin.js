const express = require('express');
const router = express.Router();
const db = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');

const JWT_SECRET = process.env.JWT_SECRET || 'rk_steel_super_secret_key_123';

let put, del;
try {
    ({ put, del } = require('@vercel/blob'));
} catch (e) {
    // @vercel/blob not available locally
    put = null;
    del = null;
}

// Use memory storage ALWAYS - reliable on Vercel serverless, no /tmp disk issues, scales to 300 images
const storage = multer.memoryStorage();

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/;
        const ok = allowed.test(file.mimetype) && allowed.test(path.extname(file.originalname).toLowerCase());
        ok ? cb(null, true) : cb(new Error('Only image files are allowed'));
    },
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB per file - supports 300 images total via DB
});

// Helper to handle upload to Blob or return base64 (persistent on Vercel without Blob)
const processImageUpload = async (reqFile) => {
    if (!reqFile) return null;
    // If Blob token is configured, upload to Vercel Blob (persistent, CDN)
    if (process.env.BLOB_READ_WRITE_TOKEN && put) {
        try {
            const ext = path.extname(reqFile.originalname).toLowerCase();
            const filename = 'product_' + Date.now() + '_' + Math.random().toString(36).slice(2,6) + ext;
            const blob = await put(filename, reqFile.buffer, { access: 'public' });
            return { image: blob.url, imageBase64: null };
        } catch (e) {
            console.error('Blob upload failed, falling back to base64:', e.message);
            // Fall through to base64
        }
    }
    // Fallback: store as base64 in DB (works on Vercel without Blob, persists for 300+ images)
    const imageBase64 = `data:${reqFile.mimetype};base64,${reqFile.buffer.toString('base64')}`;
    // Keep a filename reference for legacy /assets fallback
    const ext = path.extname(reqFile.originalname).toLowerCase();
    const filename = 'product_' + Date.now() + '_' + Math.random().toString(36).slice(2,6) + ext;
    return { image: filename, imageBase64 };
};

// Auth Middleware
const auth = (req, res, next) => {
    const token = req.cookies.admin_token || req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid Token' });
    }
};

// --- AUTH ROUTES ---
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const envEmail = process.env.ADMIN_EMAIL || 'admin@rksteelfurniture.com';
    const envPassword = process.env.ADMIN_PASSWORD || 'admin123';

    let user = await db.User.findOne({ where: { email } });
    const matchesEnv = (email === envEmail && password === envPassword);

    if (!user && matchesEnv) {
        const hashedPassword = await bcrypt.hash(envPassword, 10);
        user = await db.User.create({ email: envEmail, password: hashedPassword });
    }

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
          if (matchesEnv) {
              const hashedPassword = await bcrypt.hash(envPassword, 10);
              await user.update({ password: hashedPassword });
          } else {
              return res.status(401).json({ error: 'Invalid credentials' });
          }
    }
    
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '1d' });
    res.cookie('admin_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
    res.json({ success: true, token });
});

router.post('/logout', (req, res) => {
    res.clearCookie('admin_token');
    res.json({ success: true });
});

router.get('/me', auth, async (req, res) => {
    const user = await db.User.findByPk(req.user.id, { attributes: { exclude: ['password'] } });
    res.json({ user });
});

// --- SETTINGS ROUTES ---
router.get('/settings', auth, async (req, res) => {
    const settings = await db.Settings.findAll();
    res.json(settings);
});
router.post('/settings', auth, async (req, res) => {
    const settingsArray = req.body;
    for (const setting of settingsArray) {
        await db.Settings.upsert(setting);
    }
    res.json({ success: true });
});

// --- PRODUCTS ROUTES ---
router.get('/products', auth, async (req, res) => {
    try {
        const products = await db.Product.findAll({ order: [['order', 'ASC']] });
        res.json(products);
    } catch (err) {
        console.error('GET /products error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Create product WITHOUT image (JSON body)
router.post('/products', auth, async (req, res) => {
    try {
        const product = await db.Product.create(req.body);
        res.json(product);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Create product WITH image upload (multipart/form-data) - supports 300+ products
router.post('/products/with-image', auth, upload.single('productImage'), async (req, res) => {
    try {
        const fields = { ...req.body };
        if (fields.featured === 'true') fields.featured = true;
        if (fields.featured === 'false') fields.featured = false;
        if (fields.specs) {
            try { fields.specs = JSON.stringify(JSON.parse(fields.specs)); } catch { fields.specs = null; }
        }
        // Handle image removal (when user removed image without uploading new one)
        if (fields.image === '' || fields.image === 'null') {
            fields.image = null;
            fields.imageBase64 = null;
        }
        if (req.file) {
            const uploaded = await processImageUpload(req.file);
            if (uploaded) {
                fields.image = uploaded.image;
                fields.imageBase64 = uploaded.imageBase64; // may be null if blob
                // If blob, ensure imageBase64 is cleared from previous
                if (!uploaded.imageBase64) fields.imageBase64 = null;
            }
        } else if (fields.image && typeof fields.image === 'string' && fields.image.trim() !== '') {
            // Keep existing image string if provided (edit without new upload)
            // Don't overwrite imageBase64
        }
        const product = await db.Product.create(fields);
        res.json(product);
    } catch (err) {
        console.error('POST /products/with-image error:', err.message);
        res.status(400).json({ error: err.message });
    }
});

// Update product WITH optional image upload - handles edit/delete for old and new images
router.put('/products/:id/with-image', auth, upload.single('productImage'), async (req, res) => {
    try {
        const fields = { ...req.body };
        if (fields.featured === 'true') fields.featured = true;
        if (fields.featured === 'false') fields.featured = false;
        if (fields.specs) {
            try { fields.specs = JSON.stringify(JSON.parse(fields.specs)); } catch { fields.specs = null; }
        }
        // If new image uploaded, process it (overwrites old)
        if (req.file) {
            const uploaded = await processImageUpload(req.file);
            if (uploaded) {
                fields.image = uploaded.image;
                fields.imageBase64 = uploaded.imageBase64;
                if (!uploaded.imageBase64) fields.imageBase64 = null;
            }
        } else {
            // No new file: check if user cleared image
            if (fields.image === '' || fields.image === 'null' || fields.image === 'undefined') {
                fields.image = null;
                fields.imageBase64 = null;
            } else if (fields.image) {
                // Keep provided image string, don't touch imageBase64 unless explicitly cleared
                // Ensure we don't set imageBase64 to stale value
            } else {
                // No image field sent - don't overwrite existing image columns
                delete fields.image;
                delete fields.imageBase64;
            }
        }
        await db.Product.update(fields, { where: { id: req.params.id } });
        const updated = await db.Product.findByPk(req.params.id);
        res.json(updated);
    } catch (err) {
        console.error('PUT /products/:id/with-image error:', err.message);
        res.status(400).json({ error: err.message });
    }
});

router.put('/products/:id', auth, async (req, res) => {
    try {
        await db.Product.update(req.body, { where: { id: req.params.id } });
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.delete('/products/:id', auth, async (req, res) => {
    try {
        const product = await db.Product.findByPk(req.params.id);
        if (product && product.image && product.image.startsWith('http') && del && process.env.BLOB_READ_WRITE_TOKEN) {
            try { await del(product.image); } catch (e) { console.error('Blob delete failed:', e.message); }
        }
        await db.Product.destroy({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- SECTIONS ROUTES ---
router.get('/sections', auth, async (req, res) => {
    try {
        const sections = await db.Section.findAll({ order: [['order', 'ASC']] });
        res.json(sections);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.put('/sections/:id', auth, async (req, res) => {
    try {
        await db.Section.update(req.body, { where: { id: req.params.id } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- MEDIA ROUTES - supports 300 images, persistent via DB base64 or Blob ---
router.get('/media', auth, async (req, res) => {
    try {
        const media = await db.Media.findAll({ order: [['createdAt', 'DESC']] });
        res.json(media);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/media', auth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const uploaded = await processImageUpload(req.file);
        // Create placeholder first to get ID, then set correct path
        const media = await db.Media.create({
            filename: req.file.originalname,
            path: uploaded && uploaded.image && uploaded.image.startsWith('http') ? uploaded.image : 'pending',
            mimetype: req.file.mimetype,
            size: req.file.size,
            imageBase64: uploaded ? uploaded.imageBase64 : null
        });
        // If base64 storage, path is /image/media/:id
        if (uploaded && uploaded.imageBase64) {
            media.path = `/image/media/${media.id}`;
            await media.save();
        } else if (uploaded && uploaded.image && !uploaded.image.startsWith('http')) {
            // Local filename without blob and without base64 (should not happen with memoryStorage fallback)
            media.path = `/assets/${uploaded.image}`;
            await media.save();
        }
        res.json(media);
    } catch (err) {
        console.error('POST /media error:', err.message);
        res.status(500).json({ error: err.message });
    }
});
router.delete('/media/:id', auth, async (req, res) => {
    try {
        const media = await db.Media.findByPk(req.params.id);
        if (media && media.path && media.path.startsWith('http') && del && process.env.BLOB_READ_WRITE_TOKEN) {
            try { await del(media.path); } catch (e) { console.error('Blob delete failed:', e.message); }
        }
        await db.Media.destroy({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Dashboard Stats
router.get('/stats', auth, async (req, res) => {
    try {
        const totalProducts = await db.Product.count();
        const publishedProducts = await db.Product.count({ where: { status: 'published' } });
        const totalMedia = await db.Media.count();
        res.json({ totalProducts, publishedProducts, totalMedia });
    } catch (err) {
        console.error('GET /stats error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
