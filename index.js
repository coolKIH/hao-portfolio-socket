const { WebSocketServer, OPEN } = require('ws');
const { Pool } = require('pg');
const http = require('http');
require('dotenv').config();

const port = process.env.PORT || 8080;
const ACCESS_KEY = process.env.ACCESS_KEY;
const ALLOWED_ORIGIN = "https://hao-portfolio-gilt.vercel.app";

// --- Database Configuration ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5
});

// --- Memory Storage ---
const ipRateLimit = new Map(); // Tracks last post time per IP

// --- Utility Functions ---

/**
 * Generates a random fun nickname if the user doesn't provide one.
 */
const getRandomNickname = () => {
    const suffixes = ['Coder', 'Gopher', 'Buffer', 'Node', 'Pixel', 'Logic', 'Protocol'];
    return `Anonymous ${suffixes[Math.floor(Math.random() * suffixes.length)]}`;
};

/**
 * Broadcasts a message payload to all currently connected and open clients.
 */
const broadcast = (wss, payload) => {
    const data = JSON.stringify(payload);
    wss.clients.forEach((client) => {
        if (client.readyState === OPEN) {
            client.send(data);
        }
    });
};

/**
 * Centralized logging for monitoring server health.
 */
const logStats = (wss) => {
    console.log(`📊 Clients: ${wss.clients.size} | Pool: ${pool.totalCount} | Time: ${new Date().toLocaleTimeString()}`);
};

// --- Logic Extractors ---

/**
 * Fetches the last 7 days of footprint history.
 */
async function sendHistory(ws) {
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
}

/**
 * Handles message validation, rate limiting, and database insertion.
 */
async function handleIncomingMessage(ws, wss, rawData, ip) {
    let nonce; // The unique ID from the frontend to identify this specific transaction

    try {
        const parsed = JSON.parse(rawData);
        const { content, nickname } = parsed;
        nonce = parsed.nonce;

        // 1. Rate Limiting Check (5s cooldown per IP)
        const now = Date.now();
        const lastTime = ipRateLimit.get(ip) || 0;
        if (now - lastTime < 5000) {
            return ws.send(JSON.stringify({
                type: 'ERROR',
                nonce, // Return nonce so client knows which message failed
                message: 'Too frequent. Please wait 5 seconds.'
            }));
        }

        // 2. Data Cleaning & Validation
        const cleanContent = content?.trim() || "";
        const cleanNickname = nickname?.trim() || "";

        if (cleanContent.length === 0) return;
        if (cleanContent.length > 200) {
            return ws.send(JSON.stringify({ type: 'ERROR', nonce, message: 'Content max 200 chars.' }));
        }
        if (cleanNickname.length > 50) {
            return ws.send(JSON.stringify({ type: 'ERROR', nonce, message: 'Nickname max 50 chars.' }));
        }

        // 3. Preparation & Persistence
        const finalNickname = cleanNickname || getRandomNickname();
        ipRateLimit.set(ip, now); // Update rate limit timestamp

        const insertQuery = 'INSERT INTO footprints (content, nickname) VALUES ($1, $2) RETURNING *';

        let insertResult;
        try {
            insertResult = await pool.query(insertQuery, [cleanContent, finalNickname]);
        } catch (err) {
            console.error('❌ Database insertion failed:', err);
            return ws.send(JSON.stringify({
                type: 'ERROR',
                nonce,
                message: 'Database error. Please try again later.'
            }));
        }

        const newMessage = insertResult.rows[0];

        // 4. Success Acknowledgment (ACK)
        // Send only to the sender so they can clear their form
        ws.send(JSON.stringify({
            type: 'ACK',
            nonce,
            status: 'success'
        }));

        // 5. Global Update (Broadcast)
        // Tell everyone (including sender) to add the new message to their list
        broadcast(wss, { type: 'NEW_MESSAGE', data: newMessage });

    } catch (err) {
        console.error('Error processing message:', err);
        ws.send(JSON.stringify({
            type: 'ERROR',
            nonce,
            message: 'Internal server error.'
        }));
    }
}

// --- Server Setup ---

const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Hao Portfolio Socket Server is up');
});

const wss = new WebSocketServer({
    server,
    verifyClient: (info) => {
        const origin = info.origin;
        const url = new URL(info.req.url, `http://${info.req.headers.host}`);
        const key = url.searchParams.get('accessKey');

        if (origin === ALLOWED_ORIGIN) return true;
        if (key && key === ACCESS_KEY) return true;

        console.warn(`⚠️ Connection blocked: Origin=${origin}, KeyProvided=${!!key}`);
        return false;
    }
});

// --- Main Connection Handler ---

wss.on('connection', async (ws, req) => {
    logStats(wss);

    // Identify the user's IP (trusting Render's proxy header)
    const ip = req.headers['x-forwarded-for']?.split(/\s*,\s*/)[0] || req.socket.remoteAddress;

    // Send the last 50 messages to the new client
    await sendHistory(ws);

    // Heartbeat setup
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    // Message router
    ws.on('message', (rawData) => {
        handleIncomingMessage(ws, wss, rawData, ip);
    });

    ws.on('close', () => {
        logStats(wss);
        if (ipRateLimit.size > 1000) ipRateLimit.clear();
    });
});

// --- Zombie Connection Detection (Heartbeat) ---

const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

wss.on('close', () => clearInterval(interval));

// --- Startup Sequence ---

async function startServer() {
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

startServer();