require('dotenv').config();
const express = require('express');
const { bot } = require('./bot'); // Leta kodi za bot kutoka src/bot.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
app.get('/dashboard', async (req, res) => {
  try {
    const tgId = req.query.tgId;
    let totalIncome = 0;
    let totalSpent = 0;
    let completedJobs = 0;
    let balance = 0;
    let trustScore = 0;
    let streak = 0;

    if (tgId) {
      const user = await prisma.user.findUnique({
        where: { telegramId: BigInt(tgId) }
      });
      
      if (user) {
        balance = user.balance;
        trustScore = user.trustScore.toFixed(1);
        streak = user.streakDays;
        
        // Income
        const incomeProposals = await prisma.proposal.findMany({
          where: { freelancerId: user.id, status: 'ACCEPTED', job: { status: 'COMPLETED' } }
        });
        totalIncome = incomeProposals.reduce((sum, p) => sum + p.price, 0);
        completedJobs = incomeProposals.length;
        
        // Spent
        const spentJobs = await prisma.job.findMany({
          where: { clientId: user.id, status: 'COMPLETED' },
          include: { payment: true }
        });
        totalSpent = spentJobs.reduce((sum, j) => sum + (j.payment ? j.payment.amount : j.budget), 0);
      }
    }

    // -- LIVE ACTIVITY FEED --
    let activities = [];
    
    const recentJobs = await prisma.job.findMany({
      where: { status: 'COMPLETED' },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      include: { freelancer: true }
    });
    for (const j of recentJobs) {
      if (j.freelancer) {
        activities.push({
          date: j.updatedAt,
          text: `✅ <b>${j.freelancer.firstName}</b> amemaliza kazi ya ${j.title.substring(0, 20)}...`
        });
      }
    }

    const recentProds = await prisma.digitalProduct.findMany({
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: { seller: true }
    });
    for (const p of recentProds) {
      if (p.seller) {
        activities.push({
          date: p.createdAt,
          text: `🛒 <b>${p.seller.firstName}</b> ameweka bidhaa mpya: ${p.title.substring(0, 20)}...`
        });
      }
    }

    activities.sort((a, b) => b.date - a.date);
    activities = activities.slice(0, 5);

    let activityHtml = activities.map(a => `<div class="activity-item">${a.text}</div>`).join('');
    if (!activityHtml) activityHtml = `<div class="activity-item">Hakuna matukio mapya kwa sasa.</div>`;

    const html = `
<!DOCTYPE html>
<html lang="sw">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>GigLink Dashboard</title>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-color: #0f172a;
      --card-bg: rgba(30, 41, 59, 0.7);
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #38bdf8;
      --accent-grad: linear-gradient(135deg, #38bdf8, #818cf8);
    }
    body {
      background-color: var(--bg-color);
      color: var(--text-main);
      font-family: 'Outfit', sans-serif;
      margin: 0;
      padding: 20px;
      min-height: 100vh;
      background-image: radial-gradient(circle at top right, rgba(56,189,248,0.15), transparent 40%),
                        radial-gradient(circle at bottom left, rgba(129,140,248,0.15), transparent 40%);
    }
    .glass-card {
      background: var(--card-bg);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 10px 30px -10px rgba(0,0,0,0.5);
      animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .header h1 { margin: 0 0 5px 0; font-size: 26px; font-weight: 700; background: var(--accent-grad); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .header p { margin: 0; color: var(--text-muted); font-size: 14px; }
    
    .feed-container {
      background: rgba(0,0,0,0.25);
      border-radius: 12px;
      padding: 12px 15px;
      margin-bottom: 20px;
      border: 1px solid rgba(255,255,255,0.05);
      display: flex;
      align-items: center;
      overflow: hidden;
      white-space: nowrap;
    }
    .feed-title {
      font-size: 12px; color: var(--accent); font-weight: bold; margin-right: 15px;
      border-right: 1px solid rgba(255,255,255,0.1); padding-right: 15px; flex-shrink: 0;
    }
    .activity-wrapper {
      display: inline-block;
      animation: marquee 25s linear infinite;
      padding-left: 100%;
    }
    .activity-item {
      display: inline-block;
      font-size: 14px;
      color: #e2e8f0;
      margin-right: 50px;
    }
    .activity-item b { color: var(--accent); }
    @keyframes marquee {
      0% { transform: translateX(0); }
      100% { transform: translateX(-100%); }
    }

    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
    .stat-box { background: rgba(0,0,0,0.25); border-radius: 12px; padding: 16px; border: 1px solid rgba(255,255,255,0.05); }
    .stat-box.highlight { background: linear-gradient(135deg, rgba(56,189,248,0.1), rgba(129,140,248,0.1)); border-color: rgba(56,189,248,0.2); }
    .stat-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; font-weight: 600; }
    .stat-value { font-size: 22px; font-weight: 700; color: var(--text-main); }
    .stat-value.large { font-size: 32px; background: var(--accent-grad); -webkit-background-clip: text; -webkit-text-fill-color: transparent; line-height: 1.1; }
    
    .btn {
      background: var(--accent-grad);
      color: #fff;
      border: none;
      padding: 16px 20px;
      border-radius: 12px;
      width: 100%;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
      box-shadow: 0 4px 15px rgba(56,189,248,0.3);
      font-family: 'Outfit', sans-serif;
    }
    .btn:active { opacity: 0.8; transform: scale(0.98); }
  </style>
</head>
<body>
  <div class="glass-card header">
    <h1 id="greeting">Jambo!</h1>
    <p>Huu ni muhtasari wako wa GigLink Dashboard</p>
  </div>

  <div class="feed-container glass-card" style="padding: 12px 15px;">
    <div class="feed-title">🔥 LIVE</div>
    <div class="activity-wrapper">
      ${activityHtml}
    </div>
  </div>
  
  <div class="glass-card">
    <div class="stat-label">Mapato Yako Jumla</div>
    <div class="stat-value large" style="margin-bottom: 12px;">TZS ${totalIncome.toLocaleString()}</div>
    <div class="stat-label">Salio Lako (Wallet)</div>
    <div class="stat-value">TZS ${balance.toLocaleString()}</div>
  </div>

  <div class="grid-2">
    <div class="stat-box highlight">
      <div class="stat-label">Kazi Zilizoisha</div>
      <div class="stat-value">${completedJobs}</div>
    </div>
    <div class="stat-box">
      <div class="stat-label">Matumizi</div>
      <div class="stat-value">TZS ${totalSpent.toLocaleString()}</div>
    </div>
    <div class="stat-box">
      <div class="stat-label">Trust Score</div>
      <div class="stat-value">${trustScore}%</div>
    </div>
    <div class="stat-box highlight">
      <div class="stat-label">Streak (Siku)</div>
      <div class="stat-value">🔥 ${streak}</div>
    </div>
  </div>

  <button class="btn" onclick="tg.close()">Funga na Rudi Kwenye Bot</button>

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
  } catch(e) {
    console.error('Dashboard Error:', e);
    res.status(500).send('Hitilafu imetokea kwenye mfumo.');
  }
});

// Washa Server
app.listen(PORT, () => {
  console.log(`Express server inasikiliza kwenye port ${PORT}`);
});

// Kusimamia kufungwa kwa server (Graceful shutdown)
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
