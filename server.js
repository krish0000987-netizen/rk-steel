const express = require('express');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const fs = require('fs');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// EJS Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static Folders
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1y' }));
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin'), { maxAge: '1y' }));

// Direct imports for bundler analysis
const adminRoutes = require('./routes/admin');
const publicRoutes = require('./routes/public');
const db = require('./models');
const autoSeed = require('./autoseed');

// Helper to seed /tmp DB on Vercel if needed (SQLite-only, no-op with Postgres)
let initialized = false;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const ensureDbInit = async () => {
    if (initialized) return;
    if (process.env.VERCEL && !process.env.DATABASE_URL) {
        const tmpDb = '/tmp/database.sqlite';
        const sourceDb = path.join(__dirname, 'database.sqlite');
        if (!fs.existsSync(tmpDb) && fs.existsSync(sourceDb)) {
            try {
                fs.copyFileSync(sourceDb, tmpDb);
            } catch (e) {
                console.error('Failed to copy db to /tmp:', e);
            }
        }
    }

    // Retry sync to absorb transient races when several serverless instances
    // cold-start against the same database at the same time.
    let lastErr;
    for (let attempt = 1; attempt <= 5; attempt++) {
        try {
            await db.sequelize.sync({ force: false });
            lastErr = null;
            break;
        } catch (e) {
            lastErr = e;
            console.error(`DB sync attempt ${attempt} failed:`, e.message);
            await sleep(800 * attempt);
        }
    }
    if (lastErr) throw lastErr;

    // Auto-migrate to add missing columns (Postgres-safe syntax)
    try {
        const qi = db.sequelize.getQueryInterface();
        const cols = await qi.describeTable('Products');
        const migrations = [
            { col: 'stock', sql: 'ALTER TABLE "Products" ADD COLUMN "stock" INTEGER DEFAULT 0' },
            { col: 'specs',  sql: 'ALTER TABLE "Products" ADD COLUMN "specs" TEXT' },
            { col: 'imageBase64',  sql: 'ALTER TABLE "Products" ADD COLUMN "imageBase64" TEXT' },
        ];
        for (const m of migrations) {
            if (!cols[m.col]) {
                await db.sequelize.query(m.sql);
                console.log('Migration: added column Products.' + m.col);
            }
        }
        // Media table base64 support for 300 images
        try {
            const mediaCols = await qi.describeTable('Media');
            if (!mediaCols['imageBase64']) {
                await db.sequelize.query('ALTER TABLE "Media" ADD COLUMN "imageBase64" TEXT');
                console.log('Migration: added column Media.imageBase64');
            }
        } catch (e) {
            // Media table may not exist yet (first sync will create it)
            if (!e.message.includes('does not exist')) console.error('Media migration warning:', e.message);
        }
    } catch (migErr) {
        console.error('Migration warning (non-fatal):', migErr.message);
    }

    await autoSeed(db);
    initialized = true;
};

// Middleware to ensure DB is initialized
app.use(async (req, res, next) => {
    try {
        await ensureDbInit();
        next();
    } catch (e) {
        next(e);
    }
});

// Routes
app.use('/api/admin', adminRoutes);
app.use('/', publicRoutes);

// Catch-all for React Admin Panel
app.get(/^\/admin(?:\/(.*))?$/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Express Error Handler:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// Local Development server listener
if (!process.env.VERCEL) {
    db.sequelize.sync({ force: false }).then(async () => {
        console.log('Database synced successfully.');

        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    }).catch(err => {
        console.error('Failed to sync database:', err);
    });
}

module.exports = app;
