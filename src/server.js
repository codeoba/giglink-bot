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

// Washa Server
app.listen(PORT, () => {
  console.log(`Express server inasikiliza kwenye port ${PORT}`);
});

// Kusimamia kufungwa kwa server (Graceful shutdown)
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
