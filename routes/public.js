const express = require('express');
const router = express.Router();
const db = require('../models');

router.get('/', async (req, res) => {
    try {
        const settingsRaw = await db.Settings.findAll();
        const settings = {
            businessName: 'RK STEEL FURNITURE',
            tagline1: 'Strong • Stylish • Durable',
            tagline2: 'Better Furniture, Better Life',
            phone: '+91 93949 40647',
            whatsapp: '+91 93949 40647',
            location: 'Assam, Lanka',
            deliveryRadius: '30 KM',
            freeDelivery: 'true',
            logo: 'logo.png'
        };
        settingsRaw.forEach(s => {
            if (s.key && s.value !== undefined && s.value !== null) {
                settings[s.key] = s.value;
            }
        });

        const products = await db.Product.findAll({
            where: { status: 'published' },
            order: [['order', 'ASC']]
        });

        const sectionsRaw = await db.Section.findAll({
            where: { isVisible: true },
            order: [['order', 'ASC']]
        });
        
        const sections = {};
        sectionsRaw.forEach(s => {
            let parsed = {};
            try {
                if (s.content) parsed = JSON.parse(s.content);
            } catch (e) {
                console.error('Invalid JSON for section:', s.sectionId);
            }
            sections[s.sectionId] = { ...parsed, isVisible: s.isVisible };
        });

        // Ensure safe defaults for critical sections
        if (!sections.showroom) sections.showroom = { isVisible: true };
        sections.showroom.image = sections.showroom.image || 'b.png';
        sections.showroom.heading = sections.showroom.heading || 'VISIT OUR SHOWROOM';
        sections.showroom.tagline = sections.showroom.tagline || 'See the Quality, Feel the Strength, Choose the Best!';

        res.render('index', { settings, products, sections });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

router.get('/image/product/:id', async (req, res) => {
    try {
        const product = await db.Product.findByPk(req.params.id);
        if (!product || !product.imageBase64) {
            return res.status(404).send('Image not found');
        }
        
        // imageBase64 format: data:image/png;base64,iVBORw0KGgo...
        const matches = product.imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            return res.status(400).send('Invalid image data');
        }
        
        const mimeType = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        res.send(buffer);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

router.get('/image/media/:id', async (req, res) => {
    try {
        const media = await db.Media.findByPk(req.params.id);
        if (!media || !media.imageBase64) {
            return res.status(404).send('Image not found');
        }
        const matches = media.imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            return res.status(400).send('Invalid image data');
        }
        const mimeType = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        res.send(buffer);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
