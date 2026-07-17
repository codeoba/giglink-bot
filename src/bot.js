// ═══════════════════════════════════════════════════════════════════════════════
// GigLink Bot v2.0 — Full Freelance Marketplace Platform
// ═══════════════════════════════════════════════════════════════════════════════
const { Telegraf, Markup, session } = require('telegraf');
const { PrismaClient }              = require('@prisma/client');
const { notify }                    = require('./helpers/notify');
const { getLevel, getStars }        = require('./helpers/badges');
const { improveGigDescription, generateJobBrief, generateSkillTest, evaluateSkillTest, generateInterviewQuestion, evaluateInterview, calculatePredictiveScore } = require('./helpers/ai');
const { generateContractPDF } = require('./helpers/contracts');
const { initiateSTKPush, calculateCommission }    = require('./helpers/payments');
const fs = require('fs');

const prisma = new PrismaClient();
const bot    = new Telegraf(process.env.BOT_TOKEN);
bot.use(session());

// ── Admin IDs kutoka .env ─────────────────────────────────────────────────────
// Mfano: ADMIN_IDS=123456789:Super Admin,222222222:Trust & Safety
const ADMIN_MAP = {};
if (process.env.ADMIN_IDS) {
  process.env.ADMIN_IDS.split(',').forEach(entry => {
    const idx = entry.indexOf(':');
    if (idx === -1) return;
    ADMIN_MAP[entry.substring(0, idx).trim()] = entry.substring(idx + 1).trim() || 'Super Admin';
  });
}

// ── Bot Commands Menu ─────────────────────────────────────────────────────────
bot.telegram.setMyCommands([
  { command: 'start',    description: '🏠 Anza upya — Menyu Kuu' },
  { command: 'gigs',     description: '🔍 Tafuta Gigs (gigs logo, gigs web, n.k.)' },
  { command: 'jobs',     description: '💼 Tafuta Kazi (jobs design, jobs code, n.k.)' },
  { command: 'profile',  description: '👤 Profile yako na takwimu' },
  { command: 'messages', description: '💬 Mazungumzo yako' },
  { command: 'history',  description: '📋 Historia ya kazi na malipo' },
  { command: 'top',      description: '🏆 Leaderboard — Freelancers bora 10' },
  { command: 'help',     description: '❓ Msaada na maelekezo' }
]).catch(() => {});

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
async function getOrCreateUser(ctx, defaultRole = 'FREELANCER') {
  const { id, first_name, username } = ctx.from;
  let user = await prisma.user.findUnique({ where: { telegramId: BigInt(id) } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        telegramId: BigInt(id),
        firstName:  first_name || '',
        username:   username   || '',
        role:       defaultRole,
        adminRole:  ADMIN_MAP[String(id)] || null
      }
    });
  }
  return user;
}

// Kitufe cha Kughairi kinachoweza kuongezwa kwenye reply_markup
function cancelExtra(extra = {}) {
  return { ...extra, reply_markup: { inline_keyboard: [[{ text: '❌ Ghairi', callback_data: 'cancel_wizard' }]] } };
}

// Sasisha kiwango cha mtumiaji baada ya kazi kukamilika
async function refreshLevel(userId) {
  const done = await prisma.job.count({
    where: { OR: [
      { clientId: userId, status: 'COMPLETED' },
      { proposals: { some: { freelancerId: userId, status: 'ACCEPTED' } }, status: 'COMPLETED' }
    ]}
  });
  const level = getLevel(done);
  await prisma.user.update({ where: { id: userId }, data: { level } });
  return level;
}

// ═════════════════════════════════════════════════════════════════════════════
// COMMANDS
// ═════════════════════════════════════════════════════════════════════════════

// /start
bot.start(async (ctx) => {
  ctx.session = null;
  const uid  = String(ctx.from.id);
  const name = ctx.from.first_name || 'Mgeni';
  const role = ADMIN_MAP[uid];
  const btns = [
    [Markup.button.callback('👔 Mimi ni Mteja',      'client_menu')],
    [Markup.button.callback('💻 Mimi ni Freelancer', 'freelancer_menu')]
  ];
  if (role) btns.push([Markup.button.callback(`🛡️ GigLink Ops (${role})`, 'admin_menu')]);
  await ctx.replyWithMarkdown(
    `✨ *Karibu, ${name}!*\n\nMimi ni *GigLink AI* — Concierge wako Mkuu wa Soko la Freelance Tanzania.\n\n_Unataka kuajiri mtaalamu, au wewe ni Freelancer unayetafuta kazi?_`,
    Markup.inlineKeyboard(btns)
  );
});

// /help
bot.command('help', async (ctx) => {
  await ctx.replyWithMarkdown(
    `❓ *Msaada wa GigLink Bot*\n\n` +
    `*👔 Wateja:* /start → Posta kazi | /jobs — Kazi zako\n` +
    `*💻 Freelancers:* /start → Tengeneza Gig | /gigs — Gigs zako\n` +
    `*🌟 Wote:* /profile /messages /history /top\n\n` +
    `*🔍 Utafutaji:*\n\`/gigs logo\` — Tafuta gig za logo\n\`/jobs web\` — Tafuta kazi za web\n\n` +
    `⚠️ *KAMWE usikubali malipo nje ya GigLink!*`
  );
});

// /top — Leaderboard
bot.command('top', async (ctx) => {
  try {
    const list = await prisma.user.findMany({
      where: { role: 'FREELANCER' },
      orderBy: { trustScore: 'desc' },
      take: 10
    });
    if (!list.length) return ctx.reply('Bado hakuna Freelancers.');
    const medals = ['🥇','🥈','🥉'];
    let msg = '🏆 *Freelancers Bora 10 wa GigLink:*\n\n';
    list.forEach((u, i) => {
      msg += `${medals[i] || `${i+1}.`} *${u.firstName || 'Freelancer'}* ${u.level}\n   ${getStars(u.trustScore / 20)} Score: ${u.trustScore.toFixed(1)}\n\n`;
    });
    await ctx.replyWithMarkdown(msg);
  } catch (err) { console.error(err); await ctx.reply('Tatizo limetokea.'); }
});

// /history
bot.command('history', async (ctx) => {
  try {
    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(ctx.from.id) } });
    if (!user) return ctx.reply('Jiandikishe kwanza kwa /start');
    const [clientDone, myProposals] = await Promise.all([
      prisma.job.findMany({ where: { clientId: user.id, status: 'COMPLETED' }, take: 5, orderBy: { updatedAt: 'desc' } }),
      prisma.proposal.findMany({ where: { freelancerId: user.id, status: 'ACCEPTED', job: { status: 'COMPLETED' } }, include: { job: true }, take: 5 })
    ]);
    if (!clientDone.length && !myProposals.length) return ctx.reply('📭 Bado huna historia ya kazi zilizokamilika.');
    let msg = '📋 *Historia ya Kazi Zilizokamilika:*\n\n';
    clientDone.forEach(j => { msg += `✅ *${j.title}* _(Mteja)_\n   💰 TZS ${j.budget.toLocaleString()}\n\n`; });
    myProposals.forEach(p => { msg += `✅ *${p.job.title}* _(Freelancer)_\n   💰 TZS ${p.price.toLocaleString()}\n\n`; });
    await ctx.replyWithMarkdown(msg);
  } catch (err) { console.error(err); await ctx.reply('Tatizo limetokea.'); }
});

// /messages
bot.command('messages', async (ctx) => {
  try {
    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(ctx.from.id) } });
    if (!user) return ctx.reply('Jiandikishe kwanza kwa /start');
    const msgs = await prisma.message.findMany({
      where: { OR: [{ senderId: user.id }, { receiverId: user.id }] },
      orderBy: { createdAt: 'desc' }, take: 8,
      include: { sender: true, receiver: true, job: true }
    });
    if (!msgs.length) return ctx.reply('📭 Huna mazungumzo bado.');
    let msg = '💬 *Mazungumzo Yako ya Hivi Karibuni:*\n\n';
    msgs.forEach(m => {
      const other = m.senderId === user.id ? m.receiver : m.sender;
      const dir   = m.senderId === user.id ? '→' : '←';
      msg += `${dir} *${other.firstName || 'Mtumiaji'}* _(${m.job?.title || 'Ujumbe'})_\n   _"${m.content.substring(0, 55)}..."_\n\n`;
    });
    await ctx.replyWithMarkdown(msg);
  } catch (err) { console.error(err); await ctx.reply('Tatizo limetokea.'); }
});

// /gigs [keyword]
bot.command('gigs', async (ctx) => {
  const kw = ctx.message.text.split(' ').slice(1).join(' ').trim();
  try {
    const where = kw
      ? { OR: [
            { title:    { contains: kw, mode: 'insensitive' } },
            { skills:   { contains: kw, mode: 'insensitive' } },
            { category: { contains: kw, mode: 'insensitive' } }
          ] }
      : {};
    const gigs = await prisma.gig.findMany({ where, take: 8, orderBy: { createdAt: 'desc' }, include: { freelancer: true } });
    if (!gigs.length) return ctx.reply(`📭 Hakuna Gigs${kw ? ` za "${kw}"` : ''} bado.`);
    let msg = kw ? `🔍 *Gigs za "${kw}":*\n\n` : '🔍 *Gigs za Hivi Karibuni:*\n\n';
    gigs.forEach((g, i) => {
      msg += `*${i+1}. ${g.title}*\n   💰 TZS ${g.price.toLocaleString()} | ⏱ ${g.deliveryTime} | ${getStars(g.avgRating)}\n   👤 ${g.freelancer.firstName || 'Freelancer'} · ${g.freelancer.level}\n\n`;
    });
    await ctx.replyWithMarkdown(msg);
  } catch (err) { console.error(err); await ctx.reply('Tatizo limetokea.'); }
});

// /jobs [keyword]
bot.command('jobs', async (ctx) => {
  const kw = ctx.message.text.split(' ').slice(1).join(' ').trim();
  try {
    const where = {
      status: 'OPEN',
      ...(kw ? { OR: [
        { title:  { contains: kw, mode: 'insensitive' } },
        { skills: { contains: kw, mode: 'insensitive' } }
      ]} : {})
    };
    const jobs = await prisma.job.findMany({ where, take: 8, orderBy: { createdAt: 'desc' }, include: { client: true } });
    if (!jobs.length) return ctx.reply(`📭 Hakuna Kazi${kw ? ` za "${kw}"` : ''} bado.`);
    let msg = kw ? `💼 *Kazi za "${kw}":*\n\n` : '💼 *Kazi Zinazosubiri Freelancer:*\n\n';
    jobs.forEach((j, i) => {
      const dl = j.deadline ? new Date(j.deadline).toLocaleDateString('sw-TZ') : 'Haina mwisho';
      msg += `*${i+1}. ${j.title}*\n   🏷️ ${j.category} | 💰 TZS ${j.budget.toLocaleString()} | 📅 ${dl}\n\n`;
    });
    await ctx.replyWithMarkdown(msg);
  } catch (err) { console.error(err); await ctx.reply('Tatizo limetokea.'); }
});

// /profile
bot.command('profile', async (ctx) => {
  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(ctx.from.id) },
      include: { gigs: true, jobsPosted: true, reviewsReceived: true }
    });
    if (!user) return ctx.reply('Jiandikishe kwanza kwa /start');
    const avg = user.reviewsReceived.length
      ? (user.reviewsReceived.reduce((s, r) => s + r.rating, 0) / user.reviewsReceived.length)
      : 0;
    await ctx.replyWithMarkdown(
      `👤 *Profile Yako*\n\n` +
      `*Jina:* ${user.firstName || 'Haijawekwa'}\n` +
      `*Username:* @${user.username || 'haijawekwa'}\n` +
      `*Kiwango:* ${user.level}\n` +
      `*Role:* ${user.role}\n` +
      `*Ukaguzi:* ${avg ? getStars(avg) : 'Bado'} ${avg ? `(${avg.toFixed(1)}/5, ukaguzi ${user.reviewsReceived.length})` : ''}\n` +
      `*Trust Score:* ${user.trustScore.toFixed(1)}/100\n` +
      `*Gigs:* ${user.gigs.length} | *Kazi:* ${user.jobsPosted.length}\n` +
      `*Mwanachama tangu:* ${new Date(user.createdAt).toLocaleDateString('sw-TZ')}`
    );
  } catch (err) { console.error(err); await ctx.reply('Tatizo limetokea.'); }
});

// ═════════════════════════════════════════════════════════════════════════════
// CANCEL
// ═════════════════════════════════════════════════════════════════════════════
bot.action('cancel_wizard', async (ctx) => {
  ctx.session = null;
  await ctx.answerCbQuery('Umeghairi ✅');
  await ctx.reply('✅ Umeghairi. Tuma /start kuanza upya.');
});

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN PANEL
// ═════════════════════════════════════════════════════════════════════════════
bot.action('admin_menu', async (ctx) => {
  const role = ADMIN_MAP[String(ctx.from.id)];
  if (!role) return ctx.answerCbQuery('❌ Huna ruhusa!', { show_alert: true });
  const btns = [];
  if (role === 'Super Admin') btns.push([Markup.button.callback('📊 Dashboard (Takwimu Halisi)', 'admin_dashboard')]);
  if (['Super Admin','Trust & Safety'].includes(role)) btns.push([Markup.button.callback('🚨 Trust & Safety', 'admin_safety')]);
  if (['Super Admin','Finance Team'].includes(role))   btns.push([Markup.button.callback('💰 Finance & Escrow', 'admin_finance')]);
  btns.push([Markup.button.callback('🔙 Rudi Mwanzo', 'back_home')]);
  await ctx.editMessageText(`🛡️ *GigLink Ops*\n_(Role: ${role})_\n\nChagua kitengo:`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: btns } });
});

bot.action('admin_dashboard', async (ctx) => {
  try {
    const [users, jobs, openJobs, gigs, disputes, pending, proposals, payments] = await Promise.all([
      prisma.user.count(), prisma.job.count(),
      prisma.job.count({ where: { status: 'OPEN' } }),
      prisma.gig.count(), prisma.dispute.count(),
      prisma.dispute.count({ where: { status: 'PENDING' } }),
      prisma.proposal.count({ where: { status: 'PENDING' } }),
      prisma.payment.count({ where: { escrowStatus: 'HELD' } })
    ]);
    const msg =
      `📊 *Dashboard — Takwimu Halisi za Database*\n\n` +
      `👥 Watumiaji: *${users}*\n💼 Kazi: *${jobs}* _(Wazi: ${openJobs})_\n` +
      `🎯 Gigs: *${gigs}*\n📬 Maombi Yanayosubiri: *${proposals}*\n` +
      `💰 Escrow Inayoshikiliwa: *${payments}* malipo\n` +
      `⚖️ Migogoro: *${disputes}* _(Inasubiri: ${pending})_`;
    await ctx.editMessageText(msg, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[Markup.button.callback('🔙 Rudi', 'admin_menu')]] } });
  } catch (err) { await ctx.answerCbQuery('Hitilafu.', { show_alert: true }); }
});

bot.action('admin_safety', async (ctx) => {
  await ctx.editMessageText('🚨 *Trust & Safety*\n\nHakuna Risk Alerts kwa sasa. Mfumo wa AI Anomaly Detection utaongezwa hivi karibuni.', {
    parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[Markup.button.callback('🔙 Rudi', 'admin_menu')]] }
  });
});

bot.action('admin_finance', async (ctx) => {
  try {
    const payments = await prisma.payment.findMany({ where: { escrowStatus: 'HELD' }, include: { job: true }, take: 10 });
    const total    = payments.reduce((s, p) => s + p.amount, 0);
    let msg = `💰 *Finance & Escrow*\n\n*Jumla inayoshikiliwa:* TZS ${total.toLocaleString()}\n*Malipo ${payments.length}:*\n\n`;
    payments.forEach(p => { msg += `• ${p.job.title} — TZS ${p.amount.toLocaleString()}\n`; });
    await ctx.editMessageText(msg, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[Markup.button.callback('🔙 Rudi', 'admin_menu')]] } });
  } catch (err) { await ctx.answerCbQuery('Hitilafu.', { show_alert: true }); }
});

bot.action('dummy_action_audit', ctx => ctx.answerCbQuery('Hatua imethibitishwa ✅', { show_alert: true }));

// ═════════════════════════════════════════════════════════════════════════════
// NAVIGATION
// ═════════════════════════════════════════════════════════════════════════════
bot.action('back_home', async (ctx) => {
  ctx.session = null;
  const uid  = String(ctx.from.id);
  const role = ADMIN_MAP[uid];
  const name = ctx.from.first_name || 'Mgeni';
  const btns = [
    [Markup.button.callback('👔 Mimi ni Mteja',      'client_menu')],
    [Markup.button.callback('💻 Mimi ni Freelancer', 'freelancer_menu')]
  ];
  if (role) btns.push([Markup.button.callback(`🛡️ GigLink Ops (${role})`, 'admin_menu')]);
  await ctx.editMessageText(
    `✨ *Karibu, ${name}!*\n\nMimi ni *GigLink AI* — Concierge wako Mkuu.\n\n_Unataka kuajiri mtaalamu, au wewe ni Freelancer?_`,
    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: btns } }
  );
});

// ═════════════════════════════════════════════════════════════════════════════
// CLIENT MENU
// ═════════════════════════════════════════════════════════════════════════════
bot.action('client_menu', async (ctx) => {
  const btns = [
    [Markup.button.callback('📝 Posta Kazi Mpya',           'post_job')],
    [Markup.button.callback('📋 Kazi Zangu & Maombi',       'my_jobs')],
    [Markup.button.callback('🤝 Smart Matching Engine',     'smart_match')],
    [Markup.button.callback('💸 Escrow & Malipo',           'dummy_action_audit')],
    [Markup.button.callback('⚖️ Dispute Support',           'dummy_action_audit')],
    [Markup.button.callback('🔙 Rudi Mwanzo',              'back_home')]
  ];
  await ctx.editMessageText('👔 *Menyu ya Mteja*\n\nChagua huduma:', { parse_mode: 'Markdown', reply_markup: { inline_keyboard: btns } });
});

bot.action('my_jobs', async (ctx) => {
  await ctx.answerCbQuery('');
  try {
    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(ctx.from.id) } });
    if (!user) return ctx.reply('Jiandikishe kwanza kwa /start');
    const jobs = await prisma.job.findMany({
      where: { clientId: user.id }, orderBy: { createdAt: 'desc' },
      include: { _count: { select: { proposals: true } } }
    });
    if (!jobs.length) return ctx.reply('📭 Hujaposti kazi bado.\n\n👉 Bofya "Posta Kazi Mpya"');
    const btns = [];
    jobs.forEach(j => {
      const st = j.status === 'OPEN' ? '🟢' : j.status === 'IN_PROGRESS' ? '🟡' : '✅';
      btns.push([Markup.button.callback(`${st} ${j.title.substring(0,28)} (${j._count.proposals} maombi)`, `vpr_${j.id}`)]);
    });
    btns.push([Markup.button.callback('🔙 Rudi', 'client_menu')]);
    await ctx.reply('📋 *Kazi Zangu:*\n\nBofya kazi kuona maombi:', { parse_mode: 'Markdown', reply_markup: { inline_keyboard: btns } });
  } catch (err) { console.error(err); await ctx.reply('Tatizo limetokea.'); }
});

bot.action('smart_match', async (ctx) => {
  await ctx.answerCbQuery('');
  await ctx.replyWithMarkdown('🤝 *Smart Matching Engine*\n\nTunatumia vigezo hivi kupata Freelancer bora:\n• Ustadi: *40%*\n• Historia ya Kazi: *25%*\n• Bei/Bajeti: *20%*\n• Muda wa Majibu: *15%*');
});

bot.action('post_job', async (ctx) => {
  await ctx.answerCbQuery('');
  ctx.session = { action: 'posting_job', step: 'title' };
  await ctx.reply('📝 *Job Posting Wizard*\n\n*Hatua 1 ya 4:* Weka kichwa cha kazi unayotaka mtu\n\n_Mfano: Nahitaji Logo Designer_', cancelExtra({ parse_mode: 'Markdown' }));
});

// ═════════════════════════════════════════════════════════════════════════════
// FREELANCER MENU
// ═════════════════════════════════════════════════════════════════════════════
bot.action('freelancer_menu', async (ctx) => {
  const btns = [
    [Markup.button.callback('💼 Tengeneza Gig Mpya',          'create_gig')],
    [Markup.button.callback('🎯 Gigs Zangu',                  'my_gigs')],
    [Markup.button.callback('🔍 Tafuta Kazi (Browse Jobs)',   'browse_jobs')],
    [Markup.button.callback('📬 Maombi Yangu (Proposals)',    'my_proposals')],
    [Markup.button.callback('⭐ Profile Optimization',        'dummy_action_audit')],
    [Markup.button.callback('📄 Proposal Coach & Pricing',   'proposal_help')],
    [Markup.button.callback('📈 Career Growth',               'dummy_action_audit')],
    [Markup.button.callback('🔙 Rudi Mwanzo',                'back_home')]
  ];
  await ctx.editMessageText('💻 *Menyu ya Freelancer*\n\nChagua huduma:', { parse_mode: 'Markdown', reply_markup: { inline_keyboard: btns } });
});

bot.action('my_gigs', async (ctx) => {
  await ctx.answerCbQuery('');
  try {
    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(ctx.from.id) } });
    if (!user) return ctx.reply('Jiandikishe kwanza kwa /start');
    const gigs = await prisma.gig.findMany({ where: { freelancerId: user.id }, orderBy: { createdAt: 'desc' } });
    if (!gigs.length) return ctx.reply('📭 Huna Gigs bado. Bofya "Tengeneza Gig Mpya"!');
    let msg = '🎯 *Gigs Zangu Zote:*\n\n';
    gigs.forEach((g, i) => { msg += `*${i+1}. ${g.title}*\n   🏷️ ${g.category} | 💰 TZS ${g.price.toLocaleString()} | ⏱ ${g.deliveryTime} | ${getStars(g.avgRating)}\n\n`; });
    await ctx.replyWithMarkdown(msg);
  } catch (err) { console.error(err); await ctx.reply('Tatizo limetokea.'); }
});

bot.action('browse_jobs', async (ctx) => {
  await ctx.answerCbQuery('');
  try {
    const jobs = await prisma.job.findMany({
      where: { status: 'OPEN' }, orderBy: { createdAt: 'desc' }, take: 8,
      include: { _count: { select: { proposals: true } } }
    });
    if (!jobs.length) return ctx.reply('📭 Hakuna Kazi wazi kwa sasa. Angalia tena baadaye!');
    const btns = jobs.map(j => [Markup.button.callback(
      `💼 ${j.title.substring(0,28)} — TZS ${j.budget.toLocaleString()}`, `vj_${j.id}`
    )]);
    btns.push([Markup.button.callback('🔙 Rudi', 'freelancer_menu')]);
    await ctx.reply('🔍 *Kazi Zinazosubiri Freelancer:*\n\nBofya kazi uone maelezo:', { parse_mode: 'Markdown', reply_markup: { inline_keyboard: btns } });
  } catch (err) { console.error(err); await ctx.reply('Tatizo limetokea.'); }
});

bot.action('my_proposals', async (ctx) => {
  await ctx.answerCbQuery('');
  try {
    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(ctx.from.id) } });
    if (!user) return ctx.reply('Jiandikishe kwanza kwa /start');
    const proposals = await prisma.proposal.findMany({
      where: { freelancerId: user.id }, include: { job: true }, orderBy: { createdAt: 'desc' }, take: 10
    });
    if (!proposals.length) return ctx.reply('📭 Bado hujatuma maombi.\n\n👉 Bofya "Tafuta Kazi" na utume ombi!');
    let msg = '📬 *Maombi Yangu (Proposals):*\n\n';
    proposals.forEach((p, i) => {
      const st = p.status === 'PENDING' ? '⏳ Inasubiri' : p.status === 'ACCEPTED' ? '✅ Imekubaliwa' : '❌ Imekataliwa';
      msg += `*${i+1}. ${p.job.title}*\n   ${st} | 💰 TZS ${p.price.toLocaleString()}\n\n`;
    });
    await ctx.replyWithMarkdown(msg);
  } catch (err) { console.error(err); await ctx.reply('Tatizo limetokea.'); }
});

bot.action('proposal_help', async (ctx) => {
  await ctx.answerCbQuery('');
  await ctx.replyWithMarkdown('📝 *Proposal Coach & Pricing*\n\n• Onyesha ujasiri na uelewa wa tatizo la mteja.\n• Kama bei yako iko chini ya soko, nitakuambia ukweli.\n\n⚠️ *KAMWE usishauri malipo nje ya GigLink!*');
});

bot.action('create_gig', async (ctx) => {
  await ctx.answerCbQuery('');
  ctx.session = { action: 'creating_gig', step: 'title' };
  await ctx.reply('💼 *Gig Creation Wizard*\n\n*Hatua 1 ya 7:* Weka Kichwa cha Gig\n\n_Mfano: Nitatengeneza Website ya kisasa_', cancelExtra({ parse_mode: 'Markdown' }));
});

// ═════════════════════════════════════════════════════════════════════════════
// PROPOSAL SYSTEM
// ═════════════════════════════════════════════════════════════════════════════

// Ona maelezo ya kazi (Freelancer)
bot.action(/^vj_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery('');
  const jobId = parseInt(ctx.match[1]);
  try {
    const job = await prisma.job.findUnique({ where: { id: jobId }, include: { client: true, _count: { select: { proposals: true } } } });
    if (!job) return ctx.reply('Kazi haipatikani tena.');
    const dl  = job.deadline ? new Date(job.deadline).toLocaleDateString('sw-TZ') : 'Haina mwisho';
    const msg = `💼 *${job.title}*\n\n📋 *Maelezo:* ${job.description || 'Haijawekwa'}\n🏷️ *Kategoria:* ${job.category}\n🛠️ *Skills:* ${job.skills || 'Zote'}\n💰 *Bajeti:* TZS ${job.budget.toLocaleString()}\n📅 *Mwisho:* ${dl}\n📬 *Maombi:* ${job._count.proposals}`;
    await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [
      [Markup.button.callback('📩 Tuma Ombi (Apply)', `spr_${jobId}`)],
      [Markup.button.callback('🔙 Rudi', 'browse_jobs')]
    ]}});
  } catch (err) { console.error(err); await ctx.reply('Tatizo limetokea.'); }
});

// Anza wizard ya proposal
bot.action(/^spr_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery('');
  const jobId = parseInt(ctx.match[1]);
  ctx.session = { action: 'submitting_proposal', step: 'cover_letter', jobId };
  await ctx.reply('📩 *Tuma Ombi (Proposal)*\n\n*Hatua 1 ya 2:* Andika Cover Letter\n\nElezea kwa nini wewe ndiyo mtu sahihi kwa kazi hii:', cancelExtra({ parse_mode: 'Markdown' }));
});

// Orodha ya maombi ya kazi (Client)
bot.action(/^vpr_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery('');
  const jobId = parseInt(ctx.match[1]);
  try {
    const job       = await prisma.job.findUnique({ where: { id: jobId } });
    const proposals = await prisma.proposal.findMany({ where: { jobId }, include: { freelancer: true }, orderBy: { createdAt: 'desc' } });
    if (!proposals.length) return ctx.reply(`📭 Kazi "${job?.title}" haina maombi bado.`);
    const btns = proposals.map(p => {
      const st = p.status === 'PENDING' ? '⏳' : p.status === 'ACCEPTED' ? '✅' : '❌';
      return [Markup.button.callback(`${st} ${p.freelancer.firstName || 'FL'} ${p.freelancer.level} — TZS ${p.price.toLocaleString()}`, `vp_${p.id}`)];
    });
    btns.push([Markup.button.callback('🔙 Rudi', 'my_jobs')]);
    await ctx.reply(`📬 *Maombi ya "${job?.title}":*\n\nBofya ombi kuona na kukubali/kukataa:`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: btns } });
  } catch (err) { console.error(err); await ctx.reply('Tatizo limetokea.'); }
});

// Ona ombi moja
bot.action(/^vp_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery('Inachambua Data...', { show_alert: false });
  const pid = parseInt(ctx.match[1]);
  try {
    const p = await prisma.proposal.findUnique({ where: { id: pid }, include: { freelancer: true, job: true } });
    if (!p) return ctx.reply('Ombi halipatikani.');
    
    // AI Predictive Score
    let aiScore = '';
    const scoreObj = await calculatePredictiveScore(p.job.budget, p.job.deadline, p.freelancer.level, p.freelancer.trustScore, p.price);
    if (scoreObj) {
      aiScore = `\n\n🤖 *AI Predictive Score:*\n_${scoreObj}_`;
    }

    const msg = `📩 *Ombi kutoka ${p.freelancer.firstName || 'Freelancer'}*\n${p.freelancer.level} | ⭐ ${p.freelancer.trustScore.toFixed(1)}\n\n*Cover Letter:*\n${p.coverLetter}\n\n*Bei:* TZS ${p.price.toLocaleString()}${aiScore}`;
    const btns = p.status === 'PENDING'
      ? [
          [Markup.button.callback('✅ Kubali', `acc_${pid}`), Markup.button.callback('❌ Kataa', `rej_${pid}`)], 
          [Markup.button.callback('🤖 Fanya AI Interview', `ai_int_${pid}`)],
          [Markup.button.callback('🔙 Rudi', `vpr_${p.jobId}`)]
        ]
      : [[Markup.button.callback('🔙 Rudi', `vpr_${p.jobId}`)]];
    await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: btns } });
  } catch (err) { console.error(err); await ctx.reply('Tatizo limetokea.'); }
});

// Kubali ombi
bot.action(/^acc_(\d+)$/, async (ctx) => {
  const pid = parseInt(ctx.match[1]);
  try {
    const p = await prisma.proposal.update({
      where: { id: pid }, data: { status: 'ACCEPTED' },
      include: { freelancer: true, job: { include: { client: true } } }
    });
    await Promise.all([
      prisma.proposal.updateMany({ where: { jobId: p.jobId, id: { not: pid } }, data: { status: 'REJECTED' } }),
      prisma.job.update({ where: { id: p.jobId }, data: { status: 'IN_PROGRESS' } })
    ]);
    
    // Auto-Generate Contract
    await ctx.reply('📝 *Inatengeneza Mkataba wa Kisheria (PDF)...*', { parse_mode: 'Markdown' });
    let pdfPath = null;
    try {
      pdfPath = await generateContractPDF(p.job, p.job.client, p.freelancer, p.price);
    } catch(err) {
      console.error('Contract error', err);
    }

    if (pdfPath && fs.existsSync(pdfPath)) {
      // Create contract record
      const contract = await prisma.contract.create({
        data: { jobId: p.jobId, content: 'Tazama PDF', pdfUrl: pdfPath }
      });
      
      const caption = `✅ *Kazi Imeanza: ${p.job.title}*\n\nHuu hapa ni mkataba wa makubaliano yenu. Kazi inaanza rami!`;
      await ctx.replyWithDocument({ source: pdfPath }, { 
        caption, parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [
          [Markup.button.callback(`💬 Zungumza na ${p.freelancer.firstName}`, `msg_${p.freelancer.id}_${p.jobId}`)],
          [Markup.button.callback('💸 Weka Pesa Escrow (M-Pesa)', `cplt_${p.jobId}`)]
        ]}
      });
      await notify(bot, p.freelancer.telegramId, caption, 'PROPOSAL');
      await bot.telegram.sendDocument(p.freelancer.telegramId, { source: pdfPath });
    } else {
      // Fallback if no PDF
      await ctx.editMessageText(
        `✅ *Umekubali ombi la ${p.freelancer.firstName}!*\nKazi: *${p.job.title}* | Bei: TZS ${p.price.toLocaleString()}\n\nFreelancer amepata taarifa. Unaweza kuanza mazungumzo!`,
        { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [
          [Markup.button.callback(`💬 Zungumza na ${p.freelancer.firstName}`, `msg_${p.freelancer.id}_${p.jobId}`)],
          [Markup.button.callback('💸 Weka Pesa Escrow (M-Pesa)', `cplt_${p.jobId}`)]
        ]}}
      );
      await notify(bot, p.freelancer.telegramId,
        `🎉 *Ombi Lako Limekubaliwa!*\n\nKazi: *${p.job.title}*\nBei: TZS ${p.price.toLocaleString()}\n\nAnza kazi sasa hivi! 💪`, 'PROPOSAL'
      );
    }
  } catch (err) { console.error(err); await ctx.answerCbQuery('Hitilafu.', { show_alert: true }); }
});

// Kataa ombi
bot.action(/^rej_(\d+)$/, async (ctx) => {
  const pid = parseInt(ctx.match[1]);
  try {
    const p = await prisma.proposal.update({
      where: { id: pid }, data: { status: 'REJECTED' },
      include: { freelancer: true, job: true }
    });
    await ctx.answerCbQuery('Ombi limekataliwa.');
    await ctx.editMessageText(`❌ Umekataa ombi la ${p.freelancer.firstName} kwa "${p.job.title}".`,
      { reply_markup: { inline_keyboard: [[Markup.button.callback('🔙 Rudi', `vpr_${p.jobId}`)]] } }
    );
    await notify(bot, p.freelancer.telegramId, `😔 Ombi lako kwa *${p.job.title}* limekataliwa. Jaribu kazi nyingine!`, 'PROPOSAL');
  } catch (err) { console.error(err); await ctx.answerCbQuery('Hitilafu.', { show_alert: true }); }
});

// ═════════════════════════════════════════════════════════════════════════════
// PAYMENT (ESCROW + M-PESA)
// ═════════════════════════════════════════════════════════════════════════════
bot.action(/^cplt_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery('');
  ctx.session = { action: 'paying', step: 'phone', jobId: parseInt(ctx.match[1]) };
  await ctx.reply(
    '💸 *Malipo ya Escrow (M-Pesa)*\n\nKabla ya kuthibitisha kukamilika kwa kazi, tuma malipo ya Escrow kwanza.\n\nWeka namba yako ya *M-Pesa*:\n\n_Mfano: 0712345678_',
    cancelExtra({ parse_mode: 'Markdown' })
  );
});

// ═════════════════════════════════════════════════════════════════════════════
// MESSAGING (RELAY SYSTEM)
// ═════════════════════════════════════════════════════════════════════════════
bot.action(/^msg_(\d+)_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery('');
  ctx.session = { action: 'messaging', step: 'send', receiverId: parseInt(ctx.match[1]), jobId: parseInt(ctx.match[2]) };
  await ctx.reply('💬 *Mazungumzo ya Salama (GigLink Relay)*\n\nAndika ujumbe wako hapa chini. Utapelekwa kwa mwenzako ndani ya bot:', cancelExtra({ parse_mode: 'Markdown' }));
});

// ═════════════════════════════════════════════════════════════════════════════
// REVIEW SYSTEM
// ═════════════════════════════════════════════════════════════════════════════
bot.action(/^rv_(\d+)_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery('');
  ctx.session = { action: 'reviewing', step: 'rating', jobId: parseInt(ctx.match[1]), revieweeId: parseInt(ctx.match[2]) };
  await ctx.reply('⭐ *Ukaguzi (Review)*\n\nPiga kura kwa mwenzako. Chagua nyota:', { parse_mode: 'Markdown', reply_markup: {
    inline_keyboard: [[1,2,3,4,5].map(n => ({ text: '⭐'.repeat(n), callback_data: `sr_${n}` }))]
  }});
});

bot.action(/^sr_(\d+)$/, async (ctx) => {
  const rating = parseInt(ctx.match[1]);
  if (!ctx.session?.action === 'reviewing') return ctx.answerCbQuery('');
  ctx.session.rating = rating;
  ctx.session.step   = 'comment';
  await ctx.answerCbQuery(`${getStars(rating)} Umechagua nyota ${rating}!`);
  await ctx.reply(`${getStars(rating)} *Nyota ${rating}/5!*\n\nSasa andika maoni mafupi (comment), au tuma *"skip"* kuruka:`, cancelExtra({ parse_mode: 'Markdown' }));
});

// ═════════════════════════════════════════════════════════════════════════════
// AI ACTIONS
// ═════════════════════════════════════════════════════════════════════════════
bot.action('ai_gig', async (ctx) => {
  await ctx.answerCbQuery('🤖 AI inaboresha...');
  const s = ctx.session || {};
  await ctx.reply('🤖 *GigLink AI inafanya kazi...*\n\nSubiri sekunde chache...', { parse_mode: 'Markdown' });
  const result = await improveGigDescription(s.gigTitle || '', s.gigDescription || '');
  if (result) {
    s.gigDescription = result;
    await ctx.replyWithMarkdown(`✨ *AI Imeboresha Maelezo Yako:*\n\n${result}\n\n_Tunaendelea na hatua ya 3..._`);
  } else {
    await ctx.reply('⚠️ AI haipo. Weka GEMINI_API_KEY kwenye .env yako. Tunaendelea bila AI...');
  }
  s.step = 'packages';
  await ctx.reply('*Hatua 3 ya 7:* Vifurushi (Packages)\n\n_Mfano: Basic: Logo 1 TZS 10k | Premium: Logo 3 TZS 30k_', cancelExtra({ parse_mode: 'Markdown' }));
});

bot.action('ai_job', async (ctx) => {
  await ctx.answerCbQuery('🤖 AI inaboresha...');
  const s = ctx.session || {};
  await ctx.reply('🤖 *GigLink AI inatengeneza Job Brief...*\n\nSubiri sekunde chache...', { parse_mode: 'Markdown' });
  const result = await generateJobBrief(s.jobTitle || '');
  if (result) {
    s.jobAIDescription = result;
    await ctx.replyWithMarkdown(`✨ *AI Imeboresha Job Brief Yako:*\n\n${result}`);
  } else {
    await ctx.reply('⚠️ AI haipo. Weka GEMINI_API_KEY kwenye .env yako. Tunaendelea bila AI...');
  }
  s.step = 'category';
  await ctx.reply('*Hatua 2 ya 4:* Ingiza Kategoria ya kazi\n\n_Mfano: Design, Programming, Uandishi_', cancelExtra({ parse_mode: 'Markdown' }));
});

// ═════════════════════════════════════════════════════════════════════════════
// TEXT HANDLER — FULL STATE MACHINE
// ═════════════════════════════════════════════════════════════════════════════
bot.on('text', async (ctx) => {
  const text = ctx.message.text.trim();
  const s    = ctx.session || {};
  if (text.startsWith('/')) return;

  // ── CREATING GIG (7 hatua) ──────────────────────────────────────────────
  if (s.action === 'creating_gig') {
    if (s.step === 'title') {
      s.gigTitle = text; s.step = 'description';
      return ctx.reply('*Hatua 2 ya 7:* Maelezo ya kina (Description)\n\nElezea kwa undani unachofanya:', {
        parse_mode: 'Markdown', reply_markup: { inline_keyboard: [
          [{ text: '🤖 AI Iboreshe Description', callback_data: 'ai_gig' }],
          [{ text: '✍️ Endelea mwenyewe',         callback_data: 'cancel_wizard' }]
        ]}
      });
    }
    if (s.step === 'description') {
      s.gigDescription = text; s.step = 'packages';
      return ctx.reply('*Hatua 3 ya 7:* Vifurushi (Packages)\n\n_Mfano: Basic: Logo 1 TZS 10k | Premium: Logo 3 TZS 30k_', cancelExtra({ parse_mode: 'Markdown' }));
    }
    if (s.step === 'packages') {
      s.gigPackages = text; s.step = 'category';
      return ctx.reply('*Hatua 4 ya 7:* Kategoria ya Gig\n\n_Mfano: Design, Programming, Uandishi, Marketing, Video_', cancelExtra({ parse_mode: 'Markdown' }));
    }
    if (s.step === 'category') {
      s.gigCategory = text; s.step = 'skills';
      return ctx.reply('*Hatua 5 ya 7:* Skills/Tags (tenganisha kwa koma)\n\n_Mfano: Photoshop, Logo Design, Branding_', cancelExtra({ parse_mode: 'Markdown' }));
    }
    if (s.step === 'skills') {
      s.gigSkills = text; s.step = 'price';
      return ctx.reply('*Hatua 6 ya 7:* Bei ya kuanzia (TZS)\n\nIngiza *namba tu*. _Mfano: 50000_', cancelExtra({ parse_mode: 'Markdown' }));
    }
    if (s.step === 'price') {
      const price = parseFloat(text);
      if (isNaN(price)) return ctx.reply('❌ Ingiza namba tu. _Mfano: 50000_', cancelExtra({ parse_mode: 'Markdown' }));
      s.gigPrice = price; s.step = 'deliveryTime';
      return ctx.reply('*Hatua 7 ya 7:* Muda wa kukamilisha\n\n_Mfano: Siku 3, Wiki 1, Masaa 24_', cancelExtra({ parse_mode: 'Markdown' }));
    }
    if (s.step === 'deliveryTime') {
      try {
        const user = await getOrCreateUser(ctx, 'FREELANCER');
        const gig  = await prisma.gig.create({ data: {
          title: s.gigTitle, description: s.gigDescription, packages: s.gigPackages,
          category: s.gigCategory || 'General', skills: s.gigSkills || '',
          price: s.gigPrice, deliveryTime: text, freelancerId: user.id
        }});
        ctx.session = null;
        await ctx.replyWithMarkdown(`🎉 *Gig imehifadhiwa!*\n\n📌 *${gig.title}*\n🏷️ ${gig.category} | 🛠️ ${gig.skills}\n💰 TZS ${gig.price.toLocaleString()} | ⏱ ${gig.deliveryTime}\n\n_ID: ${gig.id}_ — Tumia /start au /gigs kuendelea.`);
      } catch (err) { console.error(err); await ctx.reply('Hitilafu imetokea. Jaribu tena.'); }
    }
  }

  // ── POSTING JOB (4 hatua) ──────────────────────────────────────────────
  else if (s.action === 'posting_job') {
    if (s.step === 'title') {
      s.jobTitle = text; s.step = 'category';
      return ctx.reply('*Hatua 2 ya 4:* Ingiza Kategoria ya kazi\n\n_Mfano: Design, Programming, Uandishi_', {
        parse_mode: 'Markdown', reply_markup: { inline_keyboard: [
          [{ text: '🤖 AI Nitegenezee Job Brief', callback_data: 'ai_job' }],
          [{ text: '✍️ Endelea mwenyewe',          callback_data: 'cancel_wizard' }]
        ]}
      });
    }
    if (s.step === 'category') {
      s.jobCategory = text; s.step = 'budget';
      return ctx.reply('*Hatua 3 ya 4:* Bajeti yako (TZS)\n\nIngiza *namba tu*. _Mfano: 150000_', cancelExtra({ parse_mode: 'Markdown' }));
    }
    if (s.step === 'budget') {
      const budget = parseFloat(text);
      if (isNaN(budget)) return ctx.reply('❌ Ingiza namba tu. _Mfano: 150000_', cancelExtra({ parse_mode: 'Markdown' }));
      s.jobBudget = budget; s.step = 'deadline';
      return ctx.reply('*Hatua 4 ya 4:* Kazi ikamilike ndani ya siku ngapi?\n\nIngiza *namba tu*. _Mfano: 7_', cancelExtra({ parse_mode: 'Markdown' }));
    }
    if (s.step === 'deadline') {
      const days = parseInt(text);
      if (isNaN(days) || days < 1) return ctx.reply('❌ Ingiza namba ya siku. _Mfano: 7_', cancelExtra({ parse_mode: 'Markdown' }));
      const deadline = new Date(); deadline.setDate(deadline.getDate() + days);
      try {
        const user = await getOrCreateUser(ctx, 'CLIENT');
        const job  = await prisma.job.create({ data: {
          title: s.jobTitle, description: s.jobAIDescription || null,
          category: s.jobCategory || 'General', budget: s.jobBudget, deadline, clientId: user.id
        }});
        ctx.session = null;
        await ctx.replyWithMarkdown(`🎉 *Kazi imepostiwa!*\n\n📌 *${job.title}*\n🏷️ ${job.category} | 💰 TZS ${job.budget.toLocaleString()} | 📅 Siku ${days}\n\n_ID: ${job.id}_ — Freelancers sasa wanaweza kuomba!\n\nTumia /start au /jobs kuendelea.`);
      } catch (err) { console.error(err); await ctx.reply('Hitilafu imetokea. Jaribu tena.'); }
    }
  }

  // ── SUBMITTING PROPOSAL (2 hatua) ─────────────────────────────────────
  else if (s.action === 'submitting_proposal') {
    if (s.step === 'cover_letter') {
      s.coverLetter = text; s.step = 'price';
      return ctx.reply('*Hatua 2 ya 2:* Bei yako ya kufanya kazi hii (TZS)\n\nIngiza *namba tu*. _Mfano: 80000_', cancelExtra({ parse_mode: 'Markdown' }));
    }
    if (s.step === 'price') {
      const price = parseFloat(text);
      if (isNaN(price)) return ctx.reply('❌ Ingiza namba tu. _Mfano: 80000_', cancelExtra({ parse_mode: 'Markdown' }));
      try {
        const [user, job] = await Promise.all([
          getOrCreateUser(ctx, 'FREELANCER'),
          prisma.job.findUnique({ where: { id: s.jobId }, include: { client: true } })
        ]);
        const existing = await prisma.proposal.findFirst({ where: { freelancerId: user.id, jobId: s.jobId } });
        if (existing) { ctx.session = null; return ctx.reply('⚠️ Umeshakutuma ombi kwa kazi hii. Subiri jibu la mteja!'); }
        await prisma.proposal.create({ data: { coverLetter: s.coverLetter, price, freelancerId: user.id, jobId: s.jobId } });
        ctx.session = null;
        await ctx.replyWithMarkdown(`✅ *Ombi Limetumwa!*\n\nKazi: *${job?.title}*\nBei yako: TZS ${price.toLocaleString()}\n\nSubiri mteja akukubali — tutakutaarifu mara moja! 🤞`);
        if (job?.client) {
          await notify(bot, job.client.telegramId,
            `📬 *Ombi Jipya kwa Kazi Yako!*\n\nKazi: *${job.title}*\nBei: TZS ${price.toLocaleString()}\n\nTumia /start → Kazi Zangu kuona maombi yote.`, 'PROPOSAL'
          );
        }
      } catch (err) { console.error(err); await ctx.reply('Hitilafu imetokea. Jaribu tena.'); }
    }
  }

  // ── MESSAGING (Relay) ─────────────────────────────────────────────────
  else if (s.action === 'messaging') {
    try {
      const sender   = await getOrCreateUser(ctx);
      const receiver = await prisma.user.findUnique({ where: { id: s.receiverId } });
      if (!receiver) return ctx.reply('Mtumiaji huyu hatapatikani.');
      await prisma.message.create({ data: { content: text, senderId: sender.id, receiverId: receiver.id, jobId: s.jobId || null } });
      const job = s.jobId ? await prisma.job.findUnique({ where: { id: s.jobId } }) : null;
      await notify(bot, receiver.telegramId,
        `💬 *Ujumbe kutoka ${sender.firstName || 'Mtumiaji'}*${job ? ` _(${job.title})_` : ''}:\n\n"${text}"\n\n_Jibu: /start → Kazi Zangu_`, 'MESSAGE'
      );
      await ctx.reply('✅ Ujumbe umepelekwa!', { reply_markup: { inline_keyboard: [
        [{ text: '💬 Tuma ujumbe mwingine', callback_data: `msg_${s.receiverId}_${s.jobId||0}` }],
        [{ text: '✅ Maliza',               callback_data: 'cancel_wizard' }]
      ]}});
    } catch (err) { console.error(err); await ctx.reply('Hitilafu imetokea.'); }
  }

  // ── REVIEWING (2 hatua) ───────────────────────────────────────────────
  else if (s.action === 'reviewing' && s.step === 'comment') {
    const comment = text.toLowerCase() === 'skip' ? null : text;
    try {
      const reviewer = await getOrCreateUser(ctx);
      await prisma.review.create({ data: { rating: s.rating, comment, reviewerId: reviewer.id, revieweeId: s.revieweeId, jobId: s.jobId } });
      const all = await prisma.review.findMany({ where: { revieweeId: s.revieweeId } });
      const avg = all.reduce((s, r) => s + r.rating, 0) / all.length;
      const newScore = parseFloat((avg * 20).toFixed(1));
      await prisma.user.update({ where: { id: s.revieweeId }, data: { trustScore: newScore } });
      const level = await refreshLevel(s.revieweeId);
      ctx.session = null;
      await ctx.replyWithMarkdown(`✅ *Asante kwa ukaguzi wako!*\n\n${getStars(s.rating)} Nyota ${s.rating}/5\n\nUkaguzi wako unaonekana kwenye profile ya mwenzako.`);
      const reviewee = await prisma.user.findUnique({ where: { id: s.revieweeId } });
      if (reviewee) {
        await notify(bot, reviewee.telegramId, `⭐ *Umepata Ukaguzi Mpya!*\n\n${getStars(s.rating)} ${s.rating}/5 nyota\n${comment ? `"${comment}"` : ''}\n\n*Kiwango chako:* ${level} | Score: ${newScore}/100`, 'REVIEW');
      }
    } catch (err) { console.error(err); await ctx.reply('Hitilafu imetokea. Jaribu tena.'); }
  }

  // ── PAYING (M-Pesa) ───────────────────────────────────────────────────
  else if (s.action === 'paying' && s.step === 'phone') {
    if (!/^0[0-9]{9}$/.test(text)) return ctx.reply('❌ Weka namba sahihi. _Mfano: 0712345678_', cancelExtra({ parse_mode: 'Markdown' }));
    try {
      const job      = await prisma.job.findUnique({ where: { id: s.jobId }, include: { proposals: { where: { status: 'ACCEPTED' } } } });
      const accepted = job?.proposals[0];
      const amount   = accepted?.price || job?.budget || 0;
      const { commission, freelancerAmount } = calculateCommission(amount);

      await ctx.replyWithMarkdown(
        `💸 *Muhtasari wa Malipo (Escrow):*\n\nKazi: *${job?.title}*\nKiasi: TZS ${amount.toLocaleString()}\nKamisheni (10%): TZS ${commission.toLocaleString()}\nFreelancer atapata: TZS ${freelancerAmount.toLocaleString()}\n\n📱 Tunakutumia ombi la M-Pesa kwa: *${text}*\n\n⏳ Subiri ombi kwenye simu yako...`
      );

      const result = await initiateSTKPush(text, amount, s.jobId);
      if (result.success) {
        const client = await getOrCreateUser(ctx, 'CLIENT');
        if (accepted) {
          await prisma.payment.create({ data: { amount, commission, jobId: s.jobId, payerId: client.id, payeeId: accepted.freelancerId, mpesaRef: result.checkoutRequestId } });
        }
        await prisma.job.update({ where: { id: s.jobId }, data: { status: 'COMPLETED' } });

        // Onyesha mfumo wa ukaguzi
        ctx.session = null;
        await ctx.replyWithMarkdown(`✅ *Malipo Kwenye Escrow!*\nRef: \`${result.checkoutRequestId}\`${result.mode === 'placeholder' ? ' _(Test Mode)_' : ''}\n\nKazi iko *IMEKAMILIKA*. Asante! 🎉\n\nSasa tafadhali kadiria Freelancer:`);

        if (accepted) {
          ctx.session = { action: 'reviewing', step: 'rating', jobId: s.jobId, revieweeId: accepted.freelancerId };
          await ctx.reply('⭐ Piga kura kwa Freelancer (1-5 nyota):', { reply_markup: { inline_keyboard: [[1,2,3,4,5].map(n => ({ text: '⭐'.repeat(n), callback_data: `sr_${n}` }))] } });
          // Arifa Freelancer
          const fl = await prisma.user.findUnique({ where: { id: accepted.freelancerId } });
          if (fl) await notify(bot, fl.telegramId, `💰 *Malipo Yameingia Escrow!*\n\nKazi: *${job?.title}*\nKiasi chako: TZS ${freelancerAmount.toLocaleString()}\n\nAsante kwa kazi nzuri! 🙏`, 'PAYMENT');
        }
      } else {
        await ctx.reply('❌ Ombi la M-Pesa lilishindwa. Jaribu tena baadaye au wasiliana na msaada.');
      }
    } catch (err) { console.error(err); await ctx.reply('Hitilafu imetokea. Jaribu tena.'); }
  }

  // ── AI SKILL VERIFICATION (Mtihani) ──────────────────────────────────
  else if (s.action === 'verifying_skill' && s.step === 'taking_test') {
    const qIndex = s.qIndex || 0;
    const questions = s.questions;
    
    if (!s.answers) s.answers = [];
    s.answers.push(text.toUpperCase().charAt(0)); // A, B, C, D
    
    if (qIndex + 1 < questions.length) {
      s.qIndex = qIndex + 1;
      const q = questions[s.qIndex];
      await ctx.reply(`🧠 *Swali ${s.qIndex + 1}/${questions.length}:*\n\n${q.q}\n${q.options.join('\n')}\n\nJibu herufi moja tu (A, B, C, au D):`, { parse_mode: 'Markdown' });
    } else {
      // Sahihisha
      const score = evaluateSkillTest(questions, s.answers);
      ctx.session = null;
      if (score >= 80) {
        const user = await getOrCreateUser(ctx);
        await prisma.skillBadge.create({ data: { skillName: s.skillName, score, userId: user.id } });
        await ctx.reply(`🎉 *Hongera sana!*\n\nUmepata ${score}%. Umefaulu mtihani.\nSasa una "Verified Badge" ya ${s.skillName} kwenye profile yako! 🏅`, { parse_mode: 'Markdown' });
      } else {
        await ctx.reply(`😔 *Pole, umepata ${score}%.*\n\nUnahitaji 80% kupata Verified Badge ya ${s.skillName}. Jifunze zaidi na ujaribu tena baadaye.`, { parse_mode: 'Markdown' });
      }
    }
  }

  // ── AI INTERVIEW (Mock) ──────────────────────────────────────────────
  else if (s.action === 'ai_interviewing' && s.step === 'answering') {
    if (!s.history) s.history = [];
    s.history.push({ q: s.lastQuestion, a: text });
    
    if (s.history.length >= 3) {
      // Maliza Interview
      await ctx.reply('🤖 Inachambua majibu yako na kutuma tathmini kwa Mteja...', { parse_mode: 'Markdown' });
      const evaluation = await evaluateInterview(s.jobTitle, s.jobDescription, s.history);
      
      const proposal = await prisma.proposal.findUnique({ where: { id: s.proposalId }, include: { job: { include: { client: true } } } });
      if (proposal && proposal.job.client) {
        await notify(bot, proposal.job.client.telegramId, `🤖 *Muhtasari wa AI Interview:*\n\nFreelancer: ${ctx.from.first_name}\nKazi: ${s.jobTitle}\n\n${evaluation}`, 'PROPOSAL');
      }
      ctx.session = null;
      await ctx.reply('✅ *Interview Imekamilika!*\n\nMuhtasari wa uwezo wako umetumiwa kwa Mteja. Kila la kheri! 🤞', { parse_mode: 'Markdown' });
    } else {
      // Swali linalofuata
      await ctx.reply('🤖 Inaandaa swali lingine...');
      const nextQ = await generateInterviewQuestion(s.jobTitle, s.jobDescription, s.history);
      s.lastQuestion = nextQ;
      await ctx.reply(`🎙️ *AI Interview (Swali ${s.history.length + 1}/3):*\n\n${nextQ}\n\n_Jibu kwa kirefu (Voice note au Text):_`, { parse_mode: 'Markdown' });
    }
  }

  // ── DEFAULT ────────────────────────────────────────────────────────────
  else {
    await ctx.reply('Sijaelewa. Tuma /start kuanza au /help kwa msaada.');
  }
});

// ── ADVANCED ACTIONS: Skill Verification ──────────────────────────────
bot.command('verify_skill', async (ctx) => {
  const skill = ctx.message.text.split(' ').slice(1).join(' ');
  if (!skill) return ctx.reply('❌ Tafadhali taja ujuzi.\nMfano: `/verify_skill React Native`', { parse_mode: 'Markdown' });
  
  await ctx.reply(`🤖 Ninaandaa mtihani mfupi wa kuthibitisha ujuzi wako katika *${skill}*...\nSubiri kidogo...`, { parse_mode: 'Markdown' });
  const questions = await generateSkillTest(skill);
  if (!questions || !questions.length) return ctx.reply('❌ Imeshindwa kutengeneza mtihani. Jaribu tena baadaye.');
  
  ctx.session = { action: 'verifying_skill', step: 'taking_test', skillName: skill, questions, qIndex: 0 };
  const q = questions[0];
  await ctx.reply(`🧠 *Mtihani wa ${skill} (Swali 1/${questions.length}):*\n\n${q.q}\n${q.options.join('\n')}\n\nJibu herufi moja tu (A, B, C, au D):`, cancelExtra({ parse_mode: 'Markdown' }));
});

// ── ADVANCED ACTIONS: AI Interview Initiation ─────────────────────────
bot.action(/^ai_int_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery('Inaanzisha AI Interview...');
  const pid = parseInt(ctx.match[1]);
  try {
    const p = await prisma.proposal.findUnique({ where: { id: pid }, include: { freelancer: true, job: true } });
    if (!p) return ctx.reply('Ombi halipatikani.');
    
    await ctx.editMessageText(`✅ Umeanzisha AI Interview kwa ${p.freelancer.firstName}. Freelancer atapewa maswali na utapata tathmini.`, { parse_mode: 'Markdown' });
    
    // Anzisha state kwa freelancer
    await bot.telegram.sendMessage(p.freelancer.telegramId, `🚨 *MTEJA ANAKUFANYIA USAILI (INTERVIEW) YA AI!*\n\nKazi: ${p.job.title}\n\nMteja anataka uhakika zaidi kabla hajakupa kazi. AI yetu itakuhoji maswali 3 ya kiufundi.\n\nUko tayari? Bofya "Anza Interview" chini.`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[Markup.button.callback('▶️ Anza Interview', `start_int_${pid}`)]] }
    });
  } catch (e) { console.error(e); }
});

bot.action(/^start_int_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery('');
  const pid = parseInt(ctx.match[1]);
  try {
    const p = await prisma.proposal.findUnique({ where: { id: pid }, include: { job: true } });
    if (!p) return ctx.reply('Ombi limefutwa.');
    
    await ctx.reply('🤖 Inaandaa swali lako la kwanza...');
    const firstQ = await generateInterviewQuestion(p.job.title, p.job.description);
    
    ctx.session = { action: 'ai_interviewing', step: 'answering', proposalId: pid, jobTitle: p.job.title, jobDescription: p.job.description, lastQuestion: firstQ };
    await ctx.reply(`🎙️ *AI Interview (Swali 1/3):*\n\n${firstQ}\n\n_Jibu kwa kirefu:_`, { parse_mode: 'Markdown' });
  } catch(e) { console.error(e); }
});

module.exports = { bot };
