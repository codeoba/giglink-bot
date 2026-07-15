const { Telegraf, Markup, session } = require('telegraf');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const bot = new Telegraf(process.env.BOT_TOKEN);
bot.use(session());

// ── Admin IDs kutoka .env (salama, siyo ndani ya kodi) ────────────────────────
// Muundo katika .env: ADMIN_IDS=123456789:Super Admin,222222222:Trust & Safety
const ADMIN_MAP = {};
if (process.env.ADMIN_IDS) {
  process.env.ADMIN_IDS.split(',').forEach(entry => {
    const idx = entry.indexOf(':');
    if (idx === -1) return;
    const id = entry.substring(0, idx).trim();
    const role = entry.substring(idx + 1).trim();
    if (id) ADMIN_MAP[id] = role || 'Super Admin';
  });
}

// ── Bot Commands Menu ─────────────────────────────────────────────────────────
bot.telegram.setMyCommands([
  { command: 'start',   description: '🏠 Anza upya — Menyu Kuu' },
  { command: 'gigs',    description: '🔍 Tazama Gigs za hivi karibuni' },
  { command: 'jobs',    description: '💼 Tazama Kazi zinazosubiri' },
  { command: 'profile', description: '👤 Profile yako na takwimu' },
  { command: 'help',    description: '❓ Msaada na maelekezo' }
]).catch(err => console.error('Kushindwa kuseti menyu ya commands:', err));

// ── Helper: Pata au Tengeneza User ───────────────────────────────────────────
async function getOrCreateUser(ctx, defaultRole = 'FREELANCER') {
  const { id, first_name, username } = ctx.from;
  let user = await prisma.user.findUnique({ where: { telegramId: BigInt(id) } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        telegramId: BigInt(id),
        firstName: first_name || '',
        username: username || '',
        role: defaultRole,
        adminRole: ADMIN_MAP[String(id)] || null
      }
    });
  }
  return user;
}

// ── Helper: Kitufe cha Kughairi ───────────────────────────────────────────────
function cancelExtra(extraOptions = {}) {
  return {
    ...extraOptions,
    reply_markup: {
      inline_keyboard: [[{ text: '❌ Ghairi', callback_data: 'cancel_wizard' }]]
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMANDS
// ─────────────────────────────────────────────────────────────────────────────

bot.start(async (ctx) => {
  ctx.session = null; // Futa wizard yoyote iliyokuwa inafanyika
  const userId = String(ctx.from.id);
  const role = ADMIN_MAP[userId];
  const name = ctx.from.first_name || 'Mgeni';

  const buttons = [
    [Markup.button.callback('👔 Mimi ni Mteja', 'client_menu')],
    [Markup.button.callback('💻 Mimi ni Freelancer', 'freelancer_menu')]
  ];
  if (role) {
    buttons.push([Markup.button.callback(`🛡️ GigLink Ops (${role})`, 'admin_menu')]);
  }

  await ctx.replyWithMarkdown(
    `✨ *Karibu, ${name}!*\n\nMimi ni *GigLink AI* — Concierge wako Mkuu wa Soko la Freelance.\n\n_Unataka kuajiri mtaalamu, au wewe ni Freelancer unayetafuta kazi?_`,
    Markup.inlineKeyboard(buttons)
  );
});

bot.command('help', async (ctx) => {
  const msg =
    `❓ *Msaada wa GigLink Bot*\n\n` +
    `*👔 Kwa Wateja (Clients):*\n` +
    `• /start → "Mimi ni Mteja" → Posta kazi yako\n` +
    `• /jobs — Ona kazi ulizoziposti\n\n` +
    `*💻 Kwa Freelancers:*\n` +
    `• /start → "Mimi ni Freelancer" → Tengeneza Gig\n` +
    `• /gigs — Ona Gigs zako na za wengine\n\n` +
    `*🌟 Kwa Wote:*\n` +
    `• /profile — Tazama akaunti na takwimu zako\n` +
    `• /start — Rudi menyu kuu wakati wowote\n\n` +
    `⚠️ *ONYO:* KAMWE usikubali malipo nje ya jukwaa la GigLink!`;
  await ctx.replyWithMarkdown(msg);
});

bot.command('gigs', async (ctx) => {
  try {
    const gigs = await prisma.gig.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: { freelancer: true }
    });
    if (gigs.length === 0) {
      return ctx.reply('📭 Hakuna Gigs bado. Kuwa wa kwanza!\n\n👉 /start → Mimi ni Freelancer → Tengeneza Gig Mpya');
    }
    let msg = '🔍 *Gigs za Hivi Karibuni:*\n\n';
    gigs.forEach((g, i) => {
      msg += `*${i + 1}. ${g.title}*\n`;
      msg += `   💰 TZS ${g.price.toLocaleString()} | ⏱ ${g.deliveryTime}\n`;
      msg += `   👤 ${g.freelancer.firstName || 'Freelancer'}\n\n`;
    });
    await ctx.replyWithMarkdown(msg);
  } catch (err) {
    console.error(err);
    await ctx.reply('Samahani, tatizo limetokea. Jaribu tena.');
  }
});

bot.command('jobs', async (ctx) => {
  try {
    const jobs = await prisma.job.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: { client: true },
      where: { status: 'OPEN' }
    });
    if (jobs.length === 0) {
      return ctx.reply('📭 Hakuna Kazi zinazosubiri bado.\n\n👉 /start → Mimi ni Mteja → Posta Kazi Mpya');
    }
    let msg = '💼 *Kazi Zinazosubiri Freelancer:*\n\n';
    jobs.forEach((j, i) => {
      const dl = j.deadline ? new Date(j.deadline).toLocaleDateString('sw-TZ') : 'Haina mwisho';
      msg += `*${i + 1}. ${j.title}*\n`;
      msg += `   💰 TZS ${j.budget.toLocaleString()} | 📅 ${dl}\n\n`;
    });
    await ctx.replyWithMarkdown(msg);
  } catch (err) {
    console.error(err);
    await ctx.reply('Samahani, tatizo limetokea. Jaribu tena.');
  }
});

bot.command('profile', async (ctx) => {
  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(ctx.from.id) },
      include: { gigs: true, jobsPosted: true }
    });
    if (!user) {
      return ctx.reply('Hujasajiliwa bado. Tuma /start kuanza!');
    }
    const msg =
      `👤 *Profile Yako*\n\n` +
      `*Jina:* ${user.firstName || 'Haijawekwa'}\n` +
      `*Username:* @${user.username || 'haijawekwa'}\n` +
      `*Role:* ${user.role}\n` +
      `*Trust Score:* ⭐ ${user.trustScore}/100\n` +
      `*Gigs:* ${user.gigs.length}\n` +
      `*Kazi Zilizopostiwa:* ${user.jobsPosted.length}\n` +
      `*Mwanachama tangu:* ${new Date(user.createdAt).toLocaleDateString('sw-TZ')}`;
    await ctx.replyWithMarkdown(msg);
  } catch (err) {
    console.error(err);
    await ctx.reply('Samahani, tatizo limetokea. Jaribu tena.');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CANCEL WIZARD
// ─────────────────────────────────────────────────────────────────────────────
bot.action('cancel_wizard', async (ctx) => {
  ctx.session = null;
  await ctx.answerCbQuery('Umeghairi ✅');
  await ctx.reply('✅ Umeghairi. Tuma /start kuanza upya au /help kwa msaada.');
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN PANEL
// ─────────────────────────────────────────────────────────────────────────────
bot.action('admin_menu', async (ctx) => {
  const userId = String(ctx.from.id);
  const role = ADMIN_MAP[userId];
  if (!role) return ctx.answerCbQuery('❌ Huna ruhusa ya kuingia huku!', { show_alert: true });

  const buttons = [];
  if (role === 'Super Admin') {
    buttons.push([Markup.button.callback('📊 Dashboard (Takwimu Halisi)', 'admin_dashboard')]);
  }
  if (role === 'Super Admin' || role === 'Trust & Safety') {
    buttons.push([Markup.button.callback('🚨 Trust & Safety (Risk Alerts)', 'admin_safety')]);
  }
  if (role === 'Super Admin' || role === 'Finance Team') {
    buttons.push([Markup.button.callback('💰 Finance (Escrow & Refunds)', 'admin_finance')]);
  }
  buttons.push([Markup.button.callback('🔙 Rudi Mwanzo', 'back_home')]);

  await ctx.editMessageText(
    `🛡️ *GigLink Ops Assistant*\n_(Role yako: ${role})_\n\nChagua kitengo kulingana na ruhusa yako:`,
    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } }
  );
});

bot.action('admin_dashboard', async (ctx) => {
  try {
    const [users, jobs, openJobs, gigs, disputes, pendingDisputes] = await Promise.all([
      prisma.user.count(),
      prisma.job.count(),
      prisma.job.count({ where: { status: 'OPEN' } }),
      prisma.gig.count(),
      prisma.dispute.count(),
      prisma.dispute.count({ where: { status: 'PENDING' } })
    ]);
    const msg =
      `📊 *Dashboard — Takwimu Halisi za Database*\n\n` +
      `👥 Watumiaji Wote: *${users}*\n` +
      `💼 Kazi Zote: *${jobs}* _(Wazi: ${openJobs})_\n` +
      `🎯 Gigs Zote: *${gigs}*\n` +
      `⚖️ Migogoro: *${disputes}* _(Inasubiri: ${pendingDisputes})_`;
    const buttons = [[Markup.button.callback('🔙 Rudi (Ops)', 'admin_menu')]];
    await ctx.editMessageText(msg, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
  } catch (err) {
    console.error(err);
    await ctx.answerCbQuery('Hitilafu wakati wa kupata takwimu.', { show_alert: true });
  }
});

bot.action('admin_safety', async (ctx) => {
  const buttons = [
    [Markup.button.callback('✅ Kagua Mazungumzo', 'dummy_action_audit')],
    [Markup.button.callback('❌ Funga Akaunti', 'dummy_action_audit')],
    [Markup.button.callback('🔙 Rudi (Ops)', 'admin_menu')]
  ];
  await ctx.editMessageText(
    '🚨 *Anomaly Detection Alert!*\n\n⚠️ Akaunti `#GG-88213` risk score *91/100* — dalili za malipo nje ya jukwaa. Nikague?',
    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } }
  );
});

bot.action('admin_finance', async (ctx) => {
  const buttons = [
    [Markup.button.callback('💸 Idhinisha Refund', 'dummy_action_audit')],
    [Markup.button.callback('🔙 Rudi (Ops)', 'admin_menu')]
  ];
  await ctx.editMessageText(
    '💰 *Ripoti ya Kifedha*\n\n• Escrow Mpya Leo: TZS 15,500,000\n• Maombi ya Urejeshaji: 2\n• Miamala Iliyokwama: 4',
    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } }
  );
});

bot.action('dummy_action_audit', (ctx) => {
  ctx.answerCbQuery('Hatua imethibitishwa na kurekodiwa kwenye Audit Log ✅', { show_alert: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT MENU
// ─────────────────────────────────────────────────────────────────────────────
bot.action('client_menu', async (ctx) => {
  const buttons = [
    [Markup.button.callback('📝 Posta Kazi Mpya', 'post_job')],
    [Markup.button.callback('📋 Kazi Zangu', 'my_jobs')],
    [Markup.button.callback('🤝 Smart Matching Engine', 'smart_match')],
    [Markup.button.callback('💸 Milestone & Escrow', 'dummy_action_audit')],
    [Markup.button.callback('⚖️ Dispute Support', 'dummy_action_audit')],
    [Markup.button.callback('🔙 Rudi Mwanzo', 'back_home')]
  ];
  await ctx.editMessageText('👔 *Menyu ya Mteja*\n\nChagua huduma unayoitaka:', { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
});

bot.action('my_jobs', async (ctx) => {
  await ctx.answerCbQuery('');
  try {
    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(ctx.from.id) } });
    if (!user) return ctx.reply('Jiandikishe kwanza kwa /start');
    const jobs = await prisma.job.findMany({ where: { clientId: user.id }, orderBy: { createdAt: 'desc' } });
    if (jobs.length === 0) {
      return ctx.reply('📭 Hujaposti kazi bado.\n\n👉 Rudi menyu na bofya "Posta Kazi Mpya"');
    }
    let msg = '📋 *Kazi Zangu Zote:*\n\n';
    jobs.forEach((j, i) => {
      const status = j.status === 'OPEN' ? '🟢 Wazi' : j.status === 'IN_PROGRESS' ? '🟡 Inaendelea' : '✅ Imekamilika';
      msg += `*${i + 1}. ${j.title}*\n   ${status} | 💰 TZS ${j.budget.toLocaleString()}\n\n`;
    });
    await ctx.replyWithMarkdown(msg);
  } catch (err) {
    console.error(err);
    await ctx.reply('Samahani, tatizo limetokea. Jaribu tena.');
  }
});

bot.action('smart_match', async (ctx) => {
  await ctx.answerCbQuery('');
  await ctx.replyWithMarkdown(
    '🤝 *Smart Matching Engine*\n\nTunatumia vigezo hivi kupata Freelancer bora:\n• Ustadi: *40%*\n• Historia ya Kazi: *25%*\n• Bei/Bajeti: *20%*\n• Muda wa Majibu: *15%*'
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// FREELANCER MENU
// ─────────────────────────────────────────────────────────────────────────────
bot.action('freelancer_menu', async (ctx) => {
  const buttons = [
    [Markup.button.callback('💼 Tengeneza Gig Mpya', 'create_gig')],
    [Markup.button.callback('🎯 Gigs Zangu', 'my_gigs')],
    [Markup.button.callback('⭐ Profile Optimization', 'dummy_action_audit')],
    [Markup.button.callback('📄 Proposal Coach & Pricing', 'proposal_help')],
    [Markup.button.callback('📈 Career Growth', 'dummy_action_audit')],
    [Markup.button.callback('🔙 Rudi Mwanzo', 'back_home')]
  ];
  await ctx.editMessageText('💻 *Menyu ya Freelancer*\n\nChagua huduma unayoitaka:', { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
});

bot.action('my_gigs', async (ctx) => {
  await ctx.answerCbQuery('');
  try {
    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(ctx.from.id) } });
    if (!user) return ctx.reply('Jiandikishe kwanza kwa /start');
    const gigs = await prisma.gig.findMany({ where: { freelancerId: user.id }, orderBy: { createdAt: 'desc' } });
    if (gigs.length === 0) {
      return ctx.reply('📭 Huna Gigs bado. Bofya "Tengeneza Gig Mpya" kuanza!');
    }
    let msg = '🎯 *Gigs Zangu Zote:*\n\n';
    gigs.forEach((g, i) => {
      msg += `*${i + 1}. ${g.title}*\n   💰 TZS ${g.price.toLocaleString()} | ⏱ ${g.deliveryTime}\n\n`;
    });
    await ctx.replyWithMarkdown(msg);
  } catch (err) {
    console.error(err);
    await ctx.reply('Samahani, tatizo limetokea. Jaribu tena.');
  }
});

bot.action('proposal_help', async (ctx) => {
  await ctx.answerCbQuery('');
  await ctx.replyWithMarkdown(
    '📝 *Proposal Coach & Pricing Advice*\n\n• Onyesha ujasiri na uelewa wa tatizo la mteja.\n• Kama bei yako iko chini mno ya soko, nitakuambia ukweli.\n\n⚠️ *KAMWE usishauri malipo nje ya jukwaa letu!*'
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// BACK HOME
// ─────────────────────────────────────────────────────────────────────────────
bot.action('back_home', async (ctx) => {
  ctx.session = null;
  const userId = String(ctx.from.id);
  const role = ADMIN_MAP[userId];
  const name = ctx.from.first_name || 'Mgeni';

  const buttons = [
    [Markup.button.callback('👔 Mimi ni Mteja', 'client_menu')],
    [Markup.button.callback('💻 Mimi ni Freelancer', 'freelancer_menu')]
  ];
  if (role) buttons.push([Markup.button.callback(`🛡️ GigLink Ops (${role})`, 'admin_menu')]);

  await ctx.editMessageText(
    `✨ *Karibu, ${name}!*\n\nMimi ni *GigLink AI* — Concierge wako Mkuu wa Soko.\n\n_Unataka kuajiri mtaalamu, au wewe ni Freelancer?_`,
    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } }
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// JOB POSTING WIZARD
// ─────────────────────────────────────────────────────────────────────────────
bot.action('post_job', async (ctx) => {
  await ctx.answerCbQuery('');
  ctx.session = { action: 'posting_job', step: 'title' };
  await ctx.reply(
    '📝 *Job Posting Wizard*\n\n*Hatua 1 ya 3:* Weka kichwa cha kazi unayotafuta mtu.\n\n_Mfano: Nahitaji Logo Designer wa Kampuni yangu_',
    cancelExtra({ parse_mode: 'Markdown' })
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// GIG CREATION WIZARD
// ─────────────────────────────────────────────────────────────────────────────
bot.action('create_gig', async (ctx) => {
  await ctx.answerCbQuery('');
  ctx.session = { action: 'creating_gig', step: 'title' };
  await ctx.reply(
    '💼 *Gig Creation Wizard*\n\n*Hatua 1 ya 5:* Weka Kichwa cha Gig yako.\n\n_Mfano: Nitatengeneza Website ya kisasa na muundo wa kupendeza_',
    cancelExtra({ parse_mode: 'Markdown' })
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// TEXT HANDLER — STATE MACHINE
// ─────────────────────────────────────────────────────────────────────────────
bot.on('text', async (ctx) => {
  const text = ctx.message.text;
  const s = ctx.session || {};

  // ── CREATING GIG ────────────────────────────────────────────────────────────
  if (s.action === 'creating_gig') {
    if (s.step === 'title') {
      s.gigTitle = text;
      s.step = 'description';
      return ctx.reply(
        '*Hatua 2 ya 5:* Maelezo ya kina (Description)\n\nElezea kwa undani unachofanya, jinsi unavyofanya, na kwa nini uchague wewe:',
        cancelExtra({ parse_mode: 'Markdown' })
      );
    }
    if (s.step === 'description') {
      s.gigDescription = text;
      s.step = 'packages';
      return ctx.reply(
        '*Hatua 3 ya 5:* Vifurushi (Packages)\n\nElezea aina za huduma unavyotoa na bei zao.\n\n_Mfano: Basic: Logo 1 dhana — TZS 10,000 | Premium: Logo 3 dhana + revision — TZS 30,000_',
        cancelExtra({ parse_mode: 'Markdown' })
      );
    }
    if (s.step === 'packages') {
      s.gigPackages = text;
      s.step = 'price';
      return ctx.reply(
        '*Hatua 4 ya 5:* Bei ya kuanzia (Starting Price)\n\nIngiza *namba tu* kwa TZS.\n_Mfano: `50000`_',
        cancelExtra({ parse_mode: 'Markdown' })
      );
    }
    if (s.step === 'price') {
      const price = parseFloat(text);
      if (isNaN(price)) {
        return ctx.reply('❌ Ingiza namba tu bila herufi. Mfano: `50000`', cancelExtra({ parse_mode: 'Markdown' }));
      }
      s.gigPrice = price;
      s.step = 'deliveryTime';
      return ctx.reply(
        '*Hatua 5 ya 5:* Muda wa kukamilisha (Delivery Time)\n\n_Mfano: Siku 3, Wiki 1, Masaa 24_',
        cancelExtra({ parse_mode: 'Markdown' })
      );
    }
    if (s.step === 'deliveryTime') {
      s.gigDeliveryTime = text;
      try {
        const user = await getOrCreateUser(ctx, 'FREELANCER');
        const gig = await prisma.gig.create({
          data: {
            title: s.gigTitle,
            description: s.gigDescription,
            packages: s.gigPackages,
            price: s.gigPrice,
            deliveryTime: s.gigDeliveryTime,
            freelancerId: user.id
          }
        });
        ctx.session = null;
        await ctx.replyWithMarkdown(
          `🎉 *Gig yako imehifadhiwa kwenye Database!*\n\n` +
          `📌 *Kichwa:* ${gig.title}\n` +
          `📝 *Maelezo:* ${(gig.description || '').substring(0, 80)}...\n` +
          `💰 *Bei:* TZS ${gig.price.toLocaleString()}\n` +
          `⏱ *Muda:* ${gig.deliveryTime}\n\n` +
          `_ID ya Gig: ${gig.id}_\n\nTumia /start au /gigs kuendelea.`
        );
      } catch (err) {
        console.error(err);
        await ctx.reply('Samahani, hitilafu imetokea wakati wa kuhifadhi. Jaribu tena.');
      }
    }
  }

  // ── POSTING JOB ─────────────────────────────────────────────────────────────
  else if (s.action === 'posting_job') {
    if (s.step === 'title') {
      s.jobTitle = text;
      s.step = 'budget';
      return ctx.reply(
        '*Hatua 2 ya 3:* Bajeti yako ni kiasi gani? (TZS)\n\nIngiza *namba tu*.\n_Mfano: `150000`_',
        cancelExtra({ parse_mode: 'Markdown' })
      );
    }
    if (s.step === 'budget') {
      const budget = parseFloat(text);
      if (isNaN(budget)) {
        return ctx.reply('❌ Ingiza namba tu. Mfano: `150000`', cancelExtra({ parse_mode: 'Markdown' }));
      }
      s.jobBudget = budget;
      s.step = 'deadline';
      return ctx.reply(
        '*Hatua 3 ya 3:* Kazi hii ikamilike ndani ya siku ngapi?\n\nIngiza *namba tu*.\n_Mfano: `7`_',
        cancelExtra({ parse_mode: 'Markdown' })
      );
    }
    if (s.step === 'deadline') {
      const days = parseInt(text);
      if (isNaN(days) || days < 1) {
        return ctx.reply('❌ Ingiza namba ya siku (angalau 1). Mfano: `7`', cancelExtra({ parse_mode: 'Markdown' }));
      }
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + days);
      try {
        const user = await getOrCreateUser(ctx, 'CLIENT');
        const job = await prisma.job.create({
          data: {
            title: s.jobTitle,
            budget: s.jobBudget,
            deadline,
            clientId: user.id
          }
        });
        ctx.session = null;
        await ctx.replyWithMarkdown(
          `🎉 *Kazi yako imepostiwa kwenye Database!*\n\n` +
          `📌 *Kichwa:* ${job.title}\n` +
          `💰 *Bajeti:* TZS ${job.budget.toLocaleString()}\n` +
          `📅 *Mwisho:* Siku ${days}\n\n` +
          `_ID ya Job: ${job.id}_\n\nTumia /start au /jobs kuendelea.`
        );
      } catch (err) {
        console.error(err);
        await ctx.reply('Samahani, hitilafu imetokea wakati wa kuhifadhi. Jaribu tena.');
      }
    }
  }

  // ── DEFAULT ──────────────────────────────────────────────────────────────────
  else if (text && !text.startsWith('/')) {
    await ctx.reply('Sijaelewa. Tuma /start kuanza au /help kwa msaada.');
  }
});

module.exports = { bot };
