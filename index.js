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
let isReady = false;
let clientStatus = 'Initializing...';

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Initialize WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './wa_auth',
        clientId: 'client-one'
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
            '--disable-gpu'
        ]
    },
    // Add these options to help with stability
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
    }
});

// QR Code event
client.on('qr', async (qr) => {
    console.log('📱 QR Code received!');
    clientStatus = 'QR Code Ready - Scan to connect';
    
    try {
        qrCodeData = await qrcode.toDataURL(qr);
        console.log('✅ QR Code generated successfully');
        console.log('🔗 Access http://localhost:' + PORT + ' to scan');
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
});

// Authentication events
client.on('authenticated', () => {
    console.log('✅ Authenticated successfully!');
    clientStatus = 'Authenticated - Loading...';
});

client.on('auth_failure', (msg) => {
    console.error('❌ Authentication failed:', msg);
    clientStatus = 'Authentication Failed';
    qrCodeData = null;
});

client.on('disconnected', (reason) => {
    console.log('❌ Client disconnected:', reason);
    isReady = false;
    clientStatus = 'Disconnected';
    qrCodeData = null;
    
    // Optional: Auto-restart
    console.log('🔄 Attempting to reconnect...');
    setTimeout(() => {
        client.initialize();
    }, 5000);
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
    const sent = await message.reply('🏓 Pinging...');
    const latency = Date.now() - start;
    
    // Note: message.edit() is not available in whatsapp-web.js
    // Send a new message instead
    await message.reply(`🏓 *Pong!*\n⏱️ Latency: ${latency}ms`);
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
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WhatsApp Bot - Connect</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 500px;
            width: 100%;
            text-align: center;
        }
        h1 {
            color: #333;
            margin-bottom: 10px;
            font-size: 28px;
        }
        .status {
            padding: 12px 24px;
            border-radius: 25px;
            margin: 20px 0;
            font-weight: 600;
            font-size: 14px;
        }
        .status.ready {
            background: #d4edda;
            color: #155724;
        }
        .status.waiting {
            background: #fff3cd;
            color: #856404;
        }
        .status.error {
            background: #f8d7da;
            color: #721c24;
        }
        #qrcode {
            margin: 30px auto;
            padding: 20px;
            background: white;
            border-radius: 15px;
            display: inline-block;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        #qrcode img {
            max-width: 300px;
            width: 100%;
            height: auto;
            display: block;
        }
        .loading {
            display: inline-block;
            width: 50px;
            height: 50px;
            border: 5px solid #f3f3f3;
            border-top: 5px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .info {
            background: #e7f3ff;
            border-left: 4px solid #2196F3;
            padding: 15px;
            margin: 20px 0;
            text-align: left;
            border-radius: 5px;
        }
        .info p {
            margin: 5px 0;
            color: #333;
            font-size: 14px;
        }
        button {
            background: #667eea;
            color: white;
            border: none;
            padding: 12px 30px;
            border-radius: 25px;
            font-size: 16px;
            cursor: pointer;
            margin-top: 15px;
            transition: all 0.3s;
        }
        button:hover {
            background: #764ba2;
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        }
        .hidden {
            display: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🤖 WhatsApp Bot</h1>
        <div id="statusBadge" class="status waiting">Initializing...</div>
        
        <div id="qrcodeContainer" class="hidden">
            <p style="margin-bottom: 15px; color: #666;">Scan this QR code with WhatsApp</p>
            <div id="qrcode">
                <div class="loading"></div>
            </div>
        </div>
        
        <div id="connectedMessage" class="hidden">
            <div style="font-size: 60px; margin: 20px 0;">✅</div>
            <h2 style="color: #155724;">Connected Successfully!</h2>
            <p style="color: #666; margin-top: 10px;">Your bot is now active and ready to use.</p>
        </div>
        
        <div class="info">
            <p><strong>📱 Prefix:</strong> ${PREFIX}</p>
            <p><strong>🔧 Status:</strong> <span id="statusText">Checking...</span></p>
            <p><strong>⏱️ Uptime:</strong> <span id="uptimeText">0s</span></p>
        </div>
        
        <button onclick="refreshStatus()">🔄 Refresh Status</button>
    </div>

    <script>
        let checkInterval;

        async function checkStatus() {
            try {
                const response = await fetch('/api/status');
                const data = await response.json();
                
                document.getElementById('statusText').textContent = data.status;
                document.getElementById('uptimeText').textContent = formatUptime(data.uptime);
                
                const statusBadge = document.getElementById('statusBadge');
                const qrcodeContainer = document.getElementById('qrcodeContainer');
                const connectedMessage = document.getElementById('connectedMessage');
                
                if (data.isReady) {
                    statusBadge.className = 'status ready';
                    statusBadge.textContent = '✅ Connected & Ready';
                    qrcodeContainer.classList.add('hidden');
                    connectedMessage.classList.remove('hidden');
                    clearInterval(checkInterval);
                } else if (data.hasQR) {
                    statusBadge.className = 'status waiting';
                    statusBadge.textContent = '📱 Waiting for QR Scan';
                    qrcodeContainer.classList.remove('hidden');
                    connectedMessage.classList.add('hidden');
                    loadQRCode();
                } else {
                    statusBadge.className = 'status waiting';
                    statusBadge.textContent = '⏳ ' + data.status;
                    qrcodeContainer.classList.add('hidden');
                    connectedMessage.classList.add('hidden');
                }
            } catch (error) {
                console.error('Error checking status:', error);
                document.getElementById('statusBadge').className = 'status error';
                document.getElementById('statusBadge').textContent = '❌ Connection Error';
            }
        }

        async function loadQRCode() {
            try {
                const response = await fetch('/api/qr');
                const data = await response.json();
                
                if (data.qr) {
                    document.getElementById('qrcode').innerHTML = 
                        '<img src="' + data.qr + '" alt="QR Code">';
                }
            } catch (error) {
                console.error('Error loading QR code:', error);
            }
        }

        function formatUptime(seconds) {
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = Math.floor(seconds % 60);
            return h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`;
        }

        function refreshStatus() {
            checkStatus();
        }

        // Check status every 3 seconds
        checkStatus();
        checkInterval = setInterval(checkStatus, 3000);
    </script>
</body>
</html>
    `;
    res.send(html);
});

app.get('/api/status', (req, res) => {
    res.json({
        status: clientStatus,
        isReady: isReady,
        hasQR: qrCodeData !== null,
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
    console.log(`🔗 Open http://localhost:${PORT} to connect your device`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n👋 Shutting down gracefully...');
    await client.destroy();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('👋 Shutting down gracefully...');
    await client.destroy();
    process.exit(0);
});
