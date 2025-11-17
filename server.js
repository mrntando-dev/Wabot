const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration
const PREFIX = process.env.PREFIX || '!';
const OWNER_NUMBER = process.env.OWNER_NUMBER || '1234567890';
const OWNER_NAME = process.env.OWNER_NAME || 'Bot Owner';

// State management
let qrCodeData = null;
let pairingCode = null;
let isReady = false;
let clientStatus = 'Initializing...';

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Initialize WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './wa_auth'
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-software-rasterizer'
        ]
    }
});

// QR Code event
client.on('qr', async (qr) => {
    console.log('📱 QR Code received!');
    clientStatus = 'QR Code Ready - Scan to connect';
    
    try {
        qrCodeData = await qrcode.toDataURL(qr);
        console.log('✅ QR Code generated successfully');
    } catch (err) {
        console.error('❌ Error generating QR code:', err);
    }
});

// Ready event
client.on('ready', () => {
    console.log('✅ WhatsApp Bot is ready!');
    isReady = true;
    clientStatus = 'Connected and Ready';
    qrCodeData = null;
    pairingCode = null;
});

// Authentication events
client.on('authenticated', () => {
    console.log('✅ Authenticated successfully!');
    clientStatus = 'Authenticated';
});

client.on('auth_failure', (msg) => {
    console.error('❌ Authentication failed:', msg);
    clientStatus = 'Authentication Failed';
});

client.on('disconnected', (reason) => {
    console.log('❌ Client disconnected:', reason);
    isReady = false;
    clientStatus = 'Disconnected';
});

// Loading event
client.on('loading_screen', (percent, message) => {
    console.log('Loading:', percent, message);
    clientStatus = `Loading... ${percent}%`;
});

// Message handler
client.on('message', async (message) => {
    if (!isReady) return;
    
    const body = message.body.trim();
    
    if (!body.startsWith(PREFIX)) return;
    
    const args = body.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    
    try {
        switch (command) {
            case 'ping':
                await handlePing(message);
                break;
            
            case 'alive':
                await handleAlive(message);
                break;
            
            case 'owner':
                await handleOwner(message);
                break;
            
            case 'help':
                await handleHelp(message);
                break;
        }
    } catch (error) {
        console.error('Error handling command:', error);
        try {
            await message.reply('❌ An error occurred while processing your command.');
        } catch (e) {
            console.error('Failed to send error message:', e);
        }
    }
});

// Command handlers
async function handlePing(message) {
    const start = Date.now();
    const sent = await message.reply('Pinging...');
    const latency = Date.now() - start;
    
    await sent.edit(`🏓 *Pong!*\n⏱️ Latency: ${latency}ms`);
}

async function handleAlive(message) {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    
    const aliveMessage = `
✅ *Bot is Alive!*

⏰ *Uptime:* ${hours}h ${minutes}m ${seconds}s
🤖 *Status:* Running
📱 *Platform:* WhatsApp Web
🔧 *Version:* 1.0.0
💾 *Memory:* ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB
    `.trim();
    
    await message.reply(aliveMessage);
}

async function handleOwner(message) {
    const ownerMessage = `
👤 *Bot Owner Information*

📛 *Name:* ${OWNER_NAME}
📞 *Number:* +${OWNER_NUMBER}
🔗 *Contact:* wa.me/${OWNER_NUMBER}

_Thank you for using this bot!_
    `.trim();
    
    await message.reply(ownerMessage);
}

async function handleHelp(message) {
    const helpMessage = `
📚 *Available Commands*

${PREFIX}ping - Check bot latency
${PREFIX}alive - Check bot status
${PREFIX}owner - Get owner info
${PREFIX}help - Show this message

_Prefix: ${PREFIX}_
    `.trim();
    
    await message.reply(helpMessage);
}

// API Routes
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

app.get('/api/status', (req, res) => {
    res.json({
        status: clientStatus,
        isReady: isReady,
        hasQR: qrCodeData !== null,
        hasPairingCode: pairingCode !== null,
        uptime: process.uptime(),
        prefix: PREFIX
    });
});

app.get('/api/qr', (req, res) => {
    if (qrCodeData) {
        res.json({ qr: qrCodeData });
    } else {
        res.status(404).json({ error: 'QR code not available' });
    }
});

app.post('/api/request-pairing', async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        
        if (!phoneNumber) {
            return res.status(400).json({ error: 'Phone number is required' });
        }
        
        // Clean phone number (remove spaces, dashes, etc.)
        const cleanNumber = phoneNumber.replace(/\D/g, '');
        
        console.log('📱 Requesting pairing code for:', cleanNumber);
        
        // Request pairing code
        const code = await client.requestPairingCode(cleanNumber);
        pairingCode = code;
        
        console.log('✅ Pairing code generated:', code);
        
        res.json({ 
            success: true, 
            code: code,
            message: 'Pairing code generated successfully'
        });
        
    } catch (error) {
        console.error('❌ Error requesting pairing code:', error);
        res.status(500).json({ 
            error: 'Failed to generate pairing code',
            details: error.message 
        });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        bot: isReady ? 'ready' : 'not ready'
    });
});

// Initialize client
console.log('🚀 Initializing WhatsApp client...');
client.initialize().catch(err => {
    console.error('❌ Failed to initialize client:', err);
    clientStatus = 'Initialization Failed';
});

// Start server
app.listen(PORT, () => {
    console.log(`🌐 Server running on port ${PORT}`);
    console.log(`📱 Bot prefix: ${PREFIX}`);
    console.log(`👤 Owner: ${OWNER_NAME}`);
    console.log(`🔗 Open http://localhost:${PORT} to pair your device`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    await client.destroy();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Shutting down gracefully...');
    await client.destroy();
    process.exit(0);
});
