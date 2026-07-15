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
  const msg = "**Job Posting Wizard** 🧙‍♂️\n\nTutakusaidia kupitia hatua hizi:\n1. Kategoria na Ustadi\n2. Bajeti na Muda\n3. Idhini na Kuchapisha\n\n*(Weka kichwa cha kazi hapa chini kuanza)*";
  await ctx.replyWithMarkdown(msg);
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
      session.step = 'price';
      await ctx.reply("Safi. Sasa ingiza **Bei** ya kuanzia kwa TZS (Mfano: 50000):", { parse_mode: 'Markdown' });
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
            price: session.gigPrice,
            deliveryTime: session.gigDeliveryTime,
            freelancerId: user.id
          }
        });
        
        // Futa session baada ya kumaliza
        ctx.session = null;
        
        await ctx.reply(`🎉 **Gig yako imehifadhiwa kikamilifu kwenye Database!**\n\n**Kichwa:** ${newGig.title}\n**Bei:** TZS ${newGig.price}\n**Muda:** ${newGig.deliveryTime}\n\n*(ID ya Gig: ${newGig.id})*`, { parse_mode: 'Markdown' });
      } catch (error) {
        console.error(error);
        await ctx.reply("Samahani, kumetokea hitilafu wakati wa kuhifadhi Gig yako kwenye Database.");
      }
    }
  } else if (text !== '/start') {
    // Meseji za kawaida (Kama sio wizard na sio /start)
    await ctx.reply("Sijaelewa. Tafadhali tumia menyu kwa kutuma /start");
  }
});

module.exports = { bot };
