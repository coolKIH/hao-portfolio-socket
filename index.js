const { WebSocketServer, OPEN } = require('ws');
const { Pool } = require('pg');
const http = require('http');
require('dotenv').config();

const port = process.env.PORT || 8080;
const ACCESS_KEY = process.env.ACCESS_KEY;
const ALLOWED_ORIGIN = "https://hao-portfolio-gilt.vercel.app";

// Database Pool Configuration
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5
});

// Rate limiting storage: { ip: timestamp }
const ipRateLimit = new Map();

const getRandomNickname = () => {
    const suffixes = ['Coder', 'Gopher', 'Buffer', 'Node', 'Pixel', 'Logic', 'Protocol'];
    return `Anonymous ${suffixes[Math.floor(Math.random() * suffixes.length)]}`;
};

const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Hao Portfolio Socket Server is up');
});

// Helper: Log current status
const logStats = () => {
    console.log(`📊 Clients: ${wss.clients.size} | Pool: ${pool.totalCount} | Time: ${new Date().toLocaleTimeString()}`);
};

// Security: Verify Origin and AccessKey before establishing connection
const wss = new WebSocketServer({
    server,
    verifyClient: (info) => {
        const origin = info.origin;
        const url = new URL(info.req.url, `http://${info.req.headers.host}`);
        const key = url.searchParams.get('accessKey');

        // 1. Allow Production Origin
        if (origin === ALLOWED_ORIGIN) return true;

        // 2. Allow local dev if correct AccessKey is provided
        if (key && key === ACCESS_KEY) return true;

        console.warn(`⚠️ Connection blocked: Origin=${origin}, KeyProvided=${!!key}`);
        return false;
    }
});

wss.on('connection', async (ws, req) => {
    logStats();

    // Get real IP (handling Render's proxy)
    const ip = req.headers['x-forwarded-for']?.split(/\s*,\s*/)[0] || req.socket.remoteAddress;

    // Fetch initial history for the new client
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
        // --- Rate Limiting (5s cooldown per IP) ---
        const now = Date.now();
        const lastTime = ipRateLimit.get(ip) || 0;

        if (now - lastTime < 5000) {
            ws.send(JSON.stringify({
                type: 'ERROR',
                message: 'Too frequent. Please wait 5 seconds.'
            }));
            return;
        }

        try {
            const { content, nickname } = JSON.parse(rawData);

            // Clean and Validate
            const cleanContent = content?.trim() || "";
            const cleanNickname = nickname?.trim() || "";

            // Backend enforcement of DB VARCHAR limits
            if (cleanContent.length === 0) return;
            if (cleanContent.length > 200) {
                return ws.send(JSON.stringify({ type: 'ERROR', message: 'Content max 200 chars.' }));
            }
            if (cleanNickname.length > 50) {
                return ws.send(JSON.stringify({ type: 'ERROR', message: 'Nickname max 50 chars.' }));
            }

            const finalNickname = cleanNickname || getRandomNickname();

            // Update IP rate limit timestamp
            ipRateLimit.set(ip, now);

            const insertQuery = 'INSERT INTO footprints (content, nickname) VALUES ($1, $2) RETURNING *';
            const insertResult = await pool.query(insertQuery, [content.trim(), finalNickname]);

            const payload = JSON.stringify({ type: 'NEW_MESSAGE', data: insertResult.rows[0] });

            // Broadcast to all connected clients
            wss.clients.forEach((client) => {
                if (client.readyState === OPEN) client.send(payload);
            });
        } catch (err) {
            console.error('Error processing message:', err);
        }
    });

    ws.on('close', () => {
        logStats();
        // Maintenance: Cleanup rate limit map if it gets too large
        if (ipRateLimit.size > 1000) ipRateLimit.clear();
    });
});

// Heartbeat interval to detect "zombie" connections
const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

wss.on('close', () => clearInterval(interval));

// Startup Sequence
async function checkDatabaseConnection() {
    try {
        const client = await pool.connect();
        console.log('✅ Database connected successfully');
        client.release();

        server.listen(port, () => {
            console.log(`🚀 Server running on port ${port}`);
        });
    } catch (err) {
        console.error('❌ DB connection failed:', err.message);
        process.exit(1);
    }
}

checkDatabaseConnection();