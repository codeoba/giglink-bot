const { Telegraf, Markup, session } = require('telegraf');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const bot = new Telegraf(process.env.BOT_TOKEN);
bot.use(session());

// Mfano wa Admin ID na Roles (Hii itasomwa kutoka Database baadaye)
const ADMINS = {
  123456789: "Super Admin",
  222222222: "Trust & Safety",
  333333333: "Finance Team"
};

bot.start((ctx) => {
  const userId = ctx.from.id;
  const role = ADMINS[userId];

  const buttons = [
    [Markup.button.callback("👔 Mimi ni Mteja", "client_menu")],
    [Markup.button.callback("💻 Mimi ni Freelancer", "freelancer_menu")]
  ];

  if (role) {
    buttons.push([Markup.button.callback(`🛡️ GigLink Ops (${role})`, "admin_menu")]);
  }

  const welcome_text = "**Karibu GigLink!** Mimi ni GigLink AI, Concierge wako Mkuu wa Soko.\n\nUnatafuta kuajiri mtaalamu, au wewe ni freelancer unayetafuta kazi?";
  
  ctx.replyWithMarkdown(welcome_text, Markup.inlineKeyboard(buttons));
});

bot.action('admin_menu', async (ctx) => {
  const userId = ctx.from.id;
  const role = ADMINS[userId];
  
  if (!role) {
    return ctx.answerCbQuery("❌ Huna ruhusa ya kuingia huku!", { show_alert: true });
  }

  const buttons = [];
  if (role === "Super Admin") {
    buttons.push([Markup.button.callback("📊 Dashboard (Ripoti Kamili)", "admin_dashboard")]);
  }
  if (role === "Super Admin" || role === "Trust & Safety") {
    buttons.push([Markup.button.callback("🚨 Trust & Safety (Risk Alerts)", "admin_safety")]);
  }
  if (role === "Super Admin" || role === "Finance Team") {
    buttons.push([Markup.button.callback("💰 Finance (Escrow & Refunds)", "admin_finance")]);
  }
  buttons.push([Markup.button.callback("🔙 Rudi Mwanzo", "back_home")]);

  await ctx.editMessageText(
    `**GigLink Ops Assistant** 🛡️\n*(Role yako: ${role})*\n\nChagua kitengo cha kiutendaji kulingana na ruhusa yako:`,
    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } }
  );
});

bot.action('admin_dashboard', async (ctx) => {
  const buttons = [
    [Markup.button.callback("📄 Pakua Ripoti (PDF)", "dummy_action_audit")],
    [Markup.button.callback("🔙 Rudi (Ops)", "admin_menu")]
  ];
  const msg = "📊 **Muhtasari wa Leo:**\nKazi mpya 47 · Migogoro 3 · Malipo yaliyokwama TZS 2,340,000 (miamala 4).";
  
  await ctx.editMessageText(msg, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
});

bot.action('admin_safety', async (ctx) => {
  const buttons = [
    [Markup.button.callback("✅ Kagua Mazungumzo", "dummy_action_audit")],
    [Markup.button.callback("❌ Funga Akaunti", "dummy_action_audit")],
    [Markup.button.callback("🔙 Rudi (Ops)", "admin_menu")]
  ];
  const msg = "🚨 **Anomaly Detection Alert!**\n\n⚠️ Akaunti `#GG-88213` risk score **91/100** — dalili za malipo nje ya jukwaa. Nikague?";
  
  await ctx.editMessageText(msg, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
});

bot.action('admin_finance', async (ctx) => {
  const buttons = [
    [Markup.button.callback("💸 Idhinisha Refund", "dummy_action_audit")],
    [Markup.button.callback("🔙 Rudi (Ops)", "admin_menu")]
  ];
  const msg = "💰 **Ripoti ya Kifedha**\n\n• Escrow Mpya Leo: TZS 15,500,000\n• Maombi ya Urejeshaji (Refunds): 2\n• Miamala Iliyokwama: 4";
  
  await ctx.editMessageText(msg, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
});

bot.action('dummy_action_audit', (ctx) => {
  ctx.answerCbQuery("Hatua imethibitishwa na kurekodiwa kwenye Audit Log ✅", { show_alert: true });
});

bot.action('client_menu', async (ctx) => {
  const buttons = [
    [Markup.button.callback("📝 Job Posting Wizard", "post_job")],
    [Markup.button.callback("🤝 Smart Matching Engine", "smart_match")],
    [Markup.button.callback("💸 Milestone Management (Escrow)", "dummy_action_audit")],
    [Markup.button.callback("⚖️ Dispute Support", "dummy_action_audit")],
    [Markup.button.callback("🔙 Rudi Mwanzo", "back_home")]
  ];
  await ctx.editMessageText("Karibu Mteja! Chagua huduma:", { reply_markup: { inline_keyboard: buttons } });
});

bot.action('freelancer_menu', async (ctx) => {
  const buttons = [
    [Markup.button.callback("💼 Tengeneza Gig Mpya", "create_gig")],
    [Markup.button.callback("⭐ Profile Optimization", "dummy_action_audit")],
    [Markup.button.callback("📄 Proposal Coach & Pricing", "proposal_help")],
    [Markup.button.callback("📈 Career Growth", "dummy_action_audit")],
    [Markup.button.callback("🔙 Rudi Mwanzo", "back_home")]
  ];
  await ctx.editMessageText("Karibu Freelancer! Chagua huduma:", { reply_markup: { inline_keyboard: buttons } });
});

bot.action('back_home', async (ctx) => {
  const userId = ctx.from.id;
  const role = ADMINS[userId];

  const buttons = [
    [Markup.button.callback("👔 Mimi ni Mteja", "client_menu")],
    [Markup.button.callback("💻 Mimi ni Freelancer", "freelancer_menu")]
  ];

  if (role) {
    buttons.push([Markup.button.callback(`🛡️ GigLink Ops (${role})`, "admin_menu")]);
  }

  const welcome_text = "**Karibu GigLink!** Mimi ni GigLink AI, Concierge wako Mkuu wa Soko.\n\nUnatafuta kuajiri mtaalamu, au wewe ni freelancer unayetafuta kazi?";
  
  await ctx.editMessageText(welcome_text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
});

bot.action('post_job', async (ctx) => {
  await ctx.answerCbQuery("Job Wizard...");
  
  ctx.session = ctx.session || {};
  ctx.session.action = 'posting_job';
  ctx.session.step = 'title';
  
  await ctx.reply("Weka **Kichwa cha kazi (Job Title)** unayotaka kuajiri mtu (Mfano: Nahitaji Logo Designer):", { parse_mode: 'Markdown' });
});

bot.action('smart_match', async (ctx) => {
  await ctx.answerCbQuery("Smart Matching...");
  const msg = "**Smart Matching Engine** 🤝\n\nTunatumia vigezo hivi kupata Freelancer bora:\n• Ustadi: 40%\n• Historia ya Kazi: 25%\n• Bei/Bajeti: 20%\n• Muda wa Majibu: 15%";
  await ctx.replyWithMarkdown(msg);
});

bot.action('proposal_help', async (ctx) => {
  await ctx.answerCbQuery("Proposal Coach...");
  const msg = "**Proposal Coach & Pricing Advice** 📝\n\n• **Sauti:** Onyesha ujasiri na uelewa wa tatizo la mteja.\n• **Ushauri:** Kama bei yako iko chini mno ya soko, nitakuambia ukweli.\n\n⚠️ *KAMWE usishauri malipo nje ya jukwaa letu, na usitoe taarifa binafsi!*";
  await ctx.replyWithMarkdown(msg);
});

bot.action('create_gig', async (ctx) => {
  await ctx.answerCbQuery("Tengeneza Gig...");
  
  // Anzisha session
  ctx.session = ctx.session || {};
  ctx.session.action = 'creating_gig';
  ctx.session.step = 'title';
  
  await ctx.reply("Tafadhali ingiza **Kichwa cha Gig** yako (Mfano: Nitatengeneza Website ya kisasa):", { parse_mode: 'Markdown' });
});

// Helper kupata au kutengeneza User
async function getOrCreateUser(telegramId) {
  let user = await prisma.user.findUnique({
    where: { telegramId: BigInt(telegramId) }
  });
  if (!user) {
    user = await prisma.user.create({
      data: {
        telegramId: BigInt(telegramId),
        role: 'FREELANCER'
      }
    });
  }
  return user;
}

// State Machine kwa ajili ya text inputs
bot.on('text', async (ctx) => {
  const text = ctx.message.text;
  const session = ctx.session || {};

  if (session.action === 'creating_gig') {
    if (session.step === 'title') {
      session.gigTitle = text;
      session.step = 'description';
      await ctx.reply("Safi! Sasa tupe **Maelezo ya kina (Description)** kuhusu Gig yako. Unaweza kuandika kwa kirefu nini utafanya:", { parse_mode: 'Markdown' });
    } 
    else if (session.step === 'description') {
      session.gigDescription = text;
      session.step = 'packages';
      await ctx.reply("Sawa! Sasa tuambie kuhusu **Vifurushi (Packages)** unavyotoa. Mfano: 'Basic ni 10k, Standard ni 20k'. Au kama ni package moja, elezea tu hapo:", { parse_mode: 'Markdown' });
    }
    else if (session.step === 'packages') {
      session.gigPackages = text;
      session.step = 'price';
      await ctx.reply("Safi. Sasa ingiza **Bei** ya kuanzia (Starting At) kwa TZS (Mfano: 50000):", { parse_mode: 'Markdown' });
    }
    else if (session.step === 'price') {
      const price = parseFloat(text);
      if (isNaN(price)) {
        return ctx.reply("❌ Tafadhali ingiza namba pekee kwa ajili ya bei (Mfano: 50000):");
      }
      session.gigPrice = price;
      session.step = 'deliveryTime';
      await ctx.reply("Sawa. Gig hii itachukua **Muda gani kukamilika?** (Mfano: Siku 3):", { parse_mode: 'Markdown' });
    }
    else if (session.step === 'deliveryTime') {
      session.gigDeliveryTime = text;
      
      // Hifadhi kwenye Database
      try {
        const user = await getOrCreateUser(ctx.from.id);
        
        const newGig = await prisma.gig.create({
          data: {
            title: session.gigTitle,
            description: session.gigDescription,
            packages: session.gigPackages,
            price: session.gigPrice,
            deliveryTime: session.gigDeliveryTime,
            freelancerId: user.id
          }
        });
        
        // Futa session baada ya kumaliza
        ctx.session = null;
        
        await ctx.reply(`🎉 **Gig yako imehifadhiwa kikamilifu kwenye Database!**\n\n**Kichwa:** ${newGig.title}\n**Maelezo:** ${newGig.description}\n**Vifurushi:** ${newGig.packages}\n**Bei:** TZS ${newGig.price}\n**Muda:** ${newGig.deliveryTime}\n\n*(ID ya Gig: ${newGig.id})*`, { parse_mode: 'Markdown' });
      } catch (error) {
        console.error(error);
        await ctx.reply("Samahani, kumetokea hitilafu wakati wa kuhifadhi Gig yako kwenye Database.");
      }
    }
  } else if (session.action === 'posting_job') {
    if (session.step === 'title') {
      session.jobTitle = text;
      session.step = 'budget';
      await ctx.reply("Sawa! Sasa weka **Bajeti** yako kwa TZS (Mfano: 150000):", { parse_mode: 'Markdown' });
    }
    else if (session.step === 'budget') {
      const budget = parseFloat(text);
      if (isNaN(budget)) {
        return ctx.reply("❌ Tafadhali ingiza namba pekee kwa ajili ya bajeti (Mfano: 150000):");
      }
      session.jobBudget = budget;
      session.step = 'deadline';
      await ctx.reply("Safi. Kazi hii ikamilike ndani ya **Siku ngapi**? (Ingiza namba tu, Mfano: 7):", { parse_mode: 'Markdown' });
    }
    else if (session.step === 'deadline') {
      const days = parseInt(text);
      if (isNaN(days)) {
        return ctx.reply("❌ Tafadhali ingiza namba ya siku (Mfano: 7):");
      }
      const deadlineDate = new Date();
      deadlineDate.setDate(deadlineDate.getDate() + days);
      session.jobDeadline = deadlineDate;
      
      try {
        const user = await getOrCreateUser(ctx.from.id);
        
        const newJob = await prisma.job.create({
          data: {
            title: session.jobTitle,
            budget: session.jobBudget,
            deadline: session.jobDeadline,
            clientId: user.id
          }
        });
        
        ctx.session = null;
        await ctx.reply(`🎉 **Kazi yako imepostiwa kikamilifu kwenye Database!**\n\n**Kichwa:** ${newJob.title}\n**Bajeti:** TZS ${newJob.budget}\n**Siku:** ${days}\n\n*(ID ya Job: ${newJob.id})*`, { parse_mode: 'Markdown' });
      } catch (error) {
        console.error(error);
        await ctx.reply("Samahani, kumetokea hitilafu wakati wa kuhifadhi Kazi yako kwenye Database.");
      }
    }
  } else if (text !== '/start') {
    // Meseji za kawaida (Kama sio wizard na sio /start)
    await ctx.reply("Sijaelewa. Tafadhali tumia menyu kwa kutuma /start");
  }
});

module.exports = { bot };
