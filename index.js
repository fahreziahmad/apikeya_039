const express = require('express');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');

const app = express();
const port = 3000;

// MySQL connection configuration
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'panggunggembira623',
    database: 'apikey_db',
    port: 3308
};

// Create MySQL connection pool
const pool = mysql.createPool(dbConfig);

// Initialize database and tables
async function initDatabase() {
    try {
        const connection = await mysql.createConnection({
            host: dbConfig.host,
            user: dbConfig.user,
            password: dbConfig.password,
            port: dbConfig.port
        });

        // Create database if not exists
        await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
        await connection.query(`USE ${dbConfig.database}`);

        // Drop existing table if exists
        await connection.query('DROP TABLE IF EXISTS apikeys');
        
        // Create apikeys table with fresh configuration
        await connection.query(`
            CREATE TABLE apikeys (
                id INTEGER PRIMARY KEY AUTO_INCREMENT,
                api_key VARCHAR(255) NOT NULL UNIQUE,
                created_at VARCHAR(50) NULL,
                last_used VARCHAR(50) NULL,
                is_active VARCHAR(10) NULL DEFAULT 'aktif'
            ) ENGINE=InnoDB
        `);

        await connection.end();
        console.log('Database and tables initialized successfully');
    } catch (err) {
        console.error('Error initializing database:', err);
        process.exit(1);
    }
}

// Initialize database when starting the server
initDatabase();

// Middleware to parse JSON body
app.use(express.json());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve the main page explicitly
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Create API key (POST /create)
app.post('/create', async (req, res) => {
    try {
        const randomBytes = crypto.randomBytes(32);
        const token = randomBytes.toString('base64url');
        const stamp = Date.now().toString(36);
        const apiKey = `hpx-16-${stamp}.${token}`;

        // Store the API key in database with current timestamp
        const created_at = new Date().toLocaleString('id-ID');
        await pool.query(
            'INSERT INTO apikeys (api_key, created_at, is_active) VALUES (?, ?, ?)',
            [apiKey, created_at, 'aktif']
        );

        res.json({ 
            apiKey,
            message: 'API key berhasil dibuat dan disimpan'
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Gagal membuat API key' });
    }
});

// Check API key validity (POST /check)
app.post('/check', async (req, res) => {
    try {
        const { apiKey } = req.body;
        
        // Check if API key exists in request
        if (!apiKey) {
            return res.status(400).json({ 
                valid: false, 
                error: 'API key tidak ditemukan dalam request' 
            });
        }

        // Validate API key format (hpx-16-timestamp.token)
        const keyPattern = /^hpx-16-[a-z0-9]+\.[A-Za-z0-9_-]+$/;
        const isValidFormat = keyPattern.test(apiKey);

        if (!isValidFormat) {
            return res.status(400).json({ 
                valid: false, 
                error: 'Format API key tidak valid' 
            });
        }

        // Check if API key exists in database and is active
        const [rows] = await pool.query(
            'SELECT * FROM apikeys WHERE api_key = ? AND is_active = ?',
            [apiKey, 'aktif']
        );

        if (rows.length === 0) {
            return res.status(400).json({ 
                valid: false, 
                error: 'API key tidak terdaftar atau tidak aktif' 
            });
        }

        // Update last_used with current timestamp
        const last_used = new Date().toLocaleString('id-ID');
        await pool.query(
            'UPDATE apikeys SET last_used = ? WHERE api_key = ?',
            [last_used, apiKey]
        );

        res.json({ 
            valid: true, 
            message: 'API key Valid dan Terdaftar, Mantap!',
            created_at: rows[0].created_at,
            last_used: rows[0].last_used
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ 
            valid: false, 
            error: 'Gagal memverifikasi API key' 
        });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
