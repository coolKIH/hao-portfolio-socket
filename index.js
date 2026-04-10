// index.js
const { WebSocketServer, OPEN } = require('ws');
const { Pool } = require('pg');
const http = require('http');
require('dotenv').config();

const port = process.env.PORT || 8080;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5
});

// Helper: Random nicknames
const getRandomNickname = () => {
    const suffixes = ['Coder', 'Gopher', 'Buffer', 'Node', 'Pixel', 'Logic', 'Protocol'];
    return `Anonymous ${suffixes[Math.floor(Math.random() * suffixes.length)]}`;
};

const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Hao Portfolio Socket Server is up');
});

const wss = new WebSocketServer({ server });

wss.on('connection', async (ws) => {
    console.log('New client connected');

    try {
        const result = await pool.query(
            `SELECT id, nickname, content, created_at 
       FROM footprints 
       WHERE created_at > NOW() - INTERVAL '7 days' 
       ORDER BY created_at DESC 
       LIMIT 50`
        );
        ws.send(JSON.stringify({ type: 'HISTORY', data: result.rows }));
    } catch (err) {
        console.error('Initial data fetch failed:', err);
    }

    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', async (rawData) => {
        try {
            const { content, nickname } = JSON.parse(rawData);
            if (!content || content.length > 200) return;

            const finalNickname = nickname?.trim() || getRandomNickname();
            const insertQuery = 'INSERT INTO footprints (content, nickname) VALUES ($1, $2) RETURNING *';
            const insertResult = await pool.query(insertQuery, [content, finalNickname]);

            const payload = JSON.stringify({ type: 'NEW_MESSAGE', data: insertResult.rows[0] });
            wss.clients.forEach((client) => {
                if (client.readyState === OPEN) client.send(payload);
            });
        } catch (err) {
            console.error('Error processing message:', err);
        }
    });
});

// Startup Database Connection Check
async function checkDatabaseConnection() {
    try {
        const client = await pool.connect();
        console.log('✅ Database connected successfully to Vercel Postgres');
        client.release();

        // Start server only after successful DB connection check
        server.listen(port, () => {
            console.log(`🚀 Hao Portfolio Socket Server running on port ${port}`);
        });
    } catch (err) {
        console.error('❌ Database connection failed:', err.message);
        process.exit(1); // Exit with failure code
    }
}

const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

wss.on('close', () => clearInterval(interval));

// Initiate boot sequence
checkDatabaseConnection();