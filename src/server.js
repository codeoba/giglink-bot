require('dotenv').config();
const express = require('express');
const { bot } = require('./bot'); // Leta kodi za bot kutoka src/bot.js

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const SECRET_PATH = `/telegraf/${bot.secretPathComponent()}`;

// 1. Weka Webhook kwa Telegram (Endapo WEBHOOK_URL ipo)
if (WEBHOOK_URL) {
  bot.telegram.setWebhook(`${WEBHOOK_URL}${SECRET_PATH}`).then(() => {
    console.log(`Webhook imesetiwa: ${WEBHOOK_URL}${SECRET_PATH}`);
  });

  // Pokea requests kutoka Telegram kwenda kwenye bot yetu
  app.use(bot.webhookCallback(SECRET_PATH));
} else {
  // Kama hakuna Webhook, tumia Polling (kwa ajili ya development)
  bot.launch();
  console.log('Bot inafanya kazi kwa njia ya Polling (Development Mode).');
}

// 2. Health check route kwa ajili ya aaPanel na PM2
app.get('/', (req, res) => {
  res.send('GigLink Bot Server inafanya kazi vizuri!');
});

// 3. TMA Dashboard Route (Telegram Mini App)
app.get('/dashboard', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="sw">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GigLink Dashboard</title>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <style>
    body {
      background-color: var(--tg-theme-bg-color, #121212);
      color: var(--tg-theme-text-color, #ffffff);
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      margin: 0;
      padding: 20px;
    }
    .card {
      background-color: var(--tg-theme-secondary-bg-color, #1e1e1e);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    }
    h1 { font-size: 24px; margin-top: 0; color: #4facfe; }
    h2 { font-size: 18px; color: #00f2fe; }
    .stat { font-size: 32px; font-weight: bold; margin: 10px 0; }
    .btn {
      background: linear-gradient(90deg, #4facfe 0%, #00f2fe 100%);
      color: white;
      border: none;
      padding: 12px 20px;
      border-radius: 8px;
      width: 100%;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1 id="greeting">Jambo!</h1>
    <p>Karibu kwenye Dashboard yako ya GigLink.</p>
  </div>
  
  <div class="card">
    <h2>Mapato Yako (TZS)</h2>
    <div class="stat">0.00</div>
    <button class="btn" onclick="tg.close()">Rudi Kwenye Bot</button>
  </div>

  <script>
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
    const user = tg.initDataUnsafe?.user;
    if (user) {
      document.getElementById('greeting').innerText = 'Jambo, ' + user.first_name + '!';
    }
  </script>
</body>
</html>
  `;
  res.send(html);
});

// Washa Server
app.listen(PORT, () => {
  console.log(`Express server inasikiliza kwenye port ${PORT}`);
});

// Kusimamia kufungwa kwa server (Graceful shutdown)
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
