const { Sequelize } = require('sequelize');
const path = require('path');

// Persistent Postgres connection. Set DATABASE_URL as an env var (recommended)
// to override this. The committed fallback keeps the site's data persistent on
// Vercel without requiring manual env-var setup.
const FALLBACK_DATABASE_URL = 'postgresql://postgres.sbykgvkhntbiqgdzjgte:cb4c8dc04c51da4fe9d8cdefccfeb71fca07acfc7afa2f78@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

const databaseUrl = process.env.DATABASE_URL || FALLBACK_DATABASE_URL;

const dbPath = process.env.VERCEL
  ? '/tmp/database.sqlite'
  : path.join(__dirname, '..', 'database.sqlite');

let sequelize;
if (databaseUrl) {
  // Use Postgres (Supabase / Vercel Postgres / Neon) for persistent storage
  sequelize = new Sequelize(databaseUrl, {
    dialect: 'postgres',
    dialectModule: require('pg'),
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  });
} else {
  // Fallback to local SQLite (development only)
  sequelize = new Sequelize({
    dialect: 'sqlite',
    dialectModule: require('sqlite3'),
    storage: dbPath,
    logging: false
  });
}

const db = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.User = require('./User')(sequelize, Sequelize);
db.Product = require('./Product')(sequelize, Sequelize);
db.Section = require('./Section')(sequelize, Sequelize);
db.Settings = require('./Settings')(sequelize, Sequelize);
db.Media = require('./Media')(sequelize, Sequelize);

module.exports = db;
