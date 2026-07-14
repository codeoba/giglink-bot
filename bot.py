import telebot
from telebot.types import InlineKeyboardMarkup, InlineKeyboardButton
import os

BOT_TOKEN = "WEKA_TOKEN_YAKO_HAPA"
bot = telebot.TeleBot(BOT_TOKEN)

# ==================== SEHEMU 12: PERMISSION MATRIX ====================
# Hapa tunaweka ID za wafanyakazi (Admins) na vyeo vyao.
ADMINS = {
    123456789: "Super Admin",         # Anaona kila kitu
    222222222: "Trust & Safety",      # Anaona migogoro na alerts tu
    333333333: "Finance Team",        # Anaona malipo tu
    444444444: "Support Agent"        # Anaona historia ya watumiaji
}

@bot.message_handler(commands=['start'])
def send_welcome(message):
    markup = InlineKeyboardMarkup()
    markup.row_width = 2
    markup.add(
        InlineKeyboardButton("👔 Mimi ni Mteja", callback_data="client_menu"),
        InlineKeyboardButton("💻 Mimi ni Freelancer", callback_data="freelancer_menu")
    )
    
    user_id = message.from_user.id
    if user_id in ADMINS:
        role = ADMINS[user_id]
        markup.add(InlineKeyboardButton(f"🛡️ GigLink Ops ({role})", callback_data="admin_menu"))
    
    # SEHEMU 1 (Utambulisho) & SEHEMU 9 (Ufunguzi)
    welcome_text = (
        "**Karibu GigLink!** Mimi ni GigLink AI, Concierge wako Mkuu wa Soko.\n\n"
        "Unatafuta kuajiri mtaalamu, au wewe ni freelancer unayetafuta kazi?"
    )
    bot.send_message(message.chat.id, welcome_text, reply_markup=markup, parse_mode="Markdown")

@bot.callback_query_handler(func=lambda call: True)
def callback_query(call):
    user_id = call.from_user.id
    
    # ==================== MENYU YA ADMIN (OPS ASSISTANT) ====================
    if call.data.startswith("admin_"):
        if user_id not in ADMINS:
            bot.answer_callback_query(call.id, "❌ Huna ruhusa ya kuingia huku!", show_alert=True)
            return
            
    if call.data == "admin_menu":
        role = ADMINS[user_id]
        markup = InlineKeyboardMarkup(row_width=1)
        
        # Mchujo wa vitufe kulingana na Role (SEHEMU 12 - Permission Matrix)
        if role in ["Super Admin"]:
            markup.add(InlineKeyboardButton("📊 Dashboard (Ripoti Kamili)", callback_data="admin_dashboard"))
            
        if role in ["Super Admin", "Trust & Safety"]:
            markup.add(InlineKeyboardButton("🚨 Trust & Safety (Risk Alerts)", callback_data="admin_safety"))
            
        if role in ["Super Admin", "Finance Team"]:
            markup.add(InlineKeyboardButton("💰 Finance (Escrow & Refunds)", callback_data="admin_finance"))
            
        markup.add(InlineKeyboardButton("🔙 Rudi Mwanzo", callback_data="back_home"))
        
        bot.edit_message_text(
            f"**GigLink Ops Assistant** 🛡️\n"
            f"*(Role yako: {role})*\n\n"
            "Chagua kitengo cha kiutendaji kulingana na ruhusa yako:", 
            call.message.chat.id, call.message.message_id, reply_markup=markup, parse_mode="Markdown"
        )
        
    elif call.data == "admin_dashboard":
        markup = InlineKeyboardMarkup(row_width=2)
        markup.add(
            InlineKeyboardButton("📄 Pakua Ripoti (PDF)", callback_data="dummy_action_audit"),
            InlineKeyboardButton("🔙 Rudi (Ops)", callback_data="admin_menu")
        )
        # Mfano wa Jibu la Panel (SEHEMU 12)
        msg = (
            "📊 **Muhtasari wa Leo:**\n"
            "Kazi mpya 47 · Migogoro 3 · Malipo yaliyokwama TZS 2,340,000 (miamala 4)."
        )
        bot.edit_message_text(msg, call.message.chat.id, call.message.message_id, reply_markup=markup, parse_mode="Markdown")

    elif call.data == "admin_safety":
        markup = InlineKeyboardMarkup(row_width=2)
        markup.add(
            InlineKeyboardButton("✅ Kagua Mazungumzo", callback_data="dummy_action_audit"),
            InlineKeyboardButton("❌ Funga Akaunti", callback_data="dummy_action_audit"),
            InlineKeyboardButton("🔙 Rudi (Ops)", callback_data="admin_menu")
        )
        # Anomaly Detection Alerts (SEHEMU 12)
        msg = (
            "🚨 **Anomaly Detection Alert!**\n\n"
            "⚠️ Akaunti `#GG-88213` risk score **91/100** — dalili za malipo nje ya jukwaa. Nikague?"
        )
        bot.edit_message_text(msg, call.message.chat.id, call.message.message_id, reply_markup=markup, parse_mode="Markdown")
        
    elif call.data == "admin_finance":
        markup = InlineKeyboardMarkup(row_width=2)
        markup.add(
            InlineKeyboardButton("💸 Idhinisha Refund", callback_data="dummy_action_audit"),
            InlineKeyboardButton("🔙 Rudi (Ops)", callback_data="admin_menu")
        )
        msg = (
            "💰 **Ripoti ya Kifedha**\n\n"
            "• Escrow Mpya Leo: TZS 15,500,000\n"
            "• Maombi ya Urejeshaji (Refunds): 2\n"
            "• Miamala Iliyokwama: 4"
        )
        bot.edit_message_text(msg, call.message.chat.id, call.message.message_id, reply_markup=markup, parse_mode="Markdown")

    elif call.data == "dummy_action_audit":
         # SEHEMU 12: Audit Log na Human-in-the-loop
         bot.answer_callback_query(call.id, "Hatua imethibitishwa na kurekodiwa kwenye Audit Log ✅", show_alert=True)

    # ==================== MENYU YA MTEJA NA FREELANCER (SEHEMU 3 & 4) ====================
    elif call.data == "client_menu":
        markup = InlineKeyboardMarkup(row_width=1)
        markup.add(
            InlineKeyboardButton("📝 Job Posting Wizard", callback_data="post_job"),
            InlineKeyboardButton("🤝 Smart Matching Engine", callback_data="smart_match"),
            InlineKeyboardButton("💸 Milestone Management (Escrow)", callback_data="milestones"),
            InlineKeyboardButton("⚖️ Dispute Support", callback_data="dispute"),
            InlineKeyboardButton("🔙 Rudi Mwanzo", callback_data="back_home")
        )
        bot.edit_message_text("Karibu Mteja! Chagua huduma:", call.message.chat.id, call.message.message_id, reply_markup=markup)
                              
    elif call.data == "freelancer_menu":
        markup = InlineKeyboardMarkup(row_width=1)
        markup.add(
            InlineKeyboardButton("⭐ Profile Optimization", callback_data="profile"),
            InlineKeyboardButton("📄 Proposal Coach & Pricing", callback_data="proposal_help"),
            InlineKeyboardButton("📈 Career Growth", callback_data="career_growth"),
            InlineKeyboardButton("🔙 Rudi Mwanzo", callback_data="back_home")
        )
        bot.edit_message_text("Karibu Freelancer! Chagua huduma:", call.message.chat.id, call.message.message_id, reply_markup=markup)
                              
    elif call.data == "back_home":
        markup = InlineKeyboardMarkup()
        markup.row_width = 2
        markup.add(
            InlineKeyboardButton("👔 Mimi ni Mteja", callback_data="client_menu"),
            InlineKeyboardButton("💻 Mimi ni Freelancer", callback_data="freelancer_menu")
        )
        if user_id in ADMINS:
            role = ADMINS[user_id]
            markup.add(InlineKeyboardButton(f"🛡️ GigLink Ops ({role})", callback_data="admin_menu"))
            
        welcome_text = (
            "**Karibu GigLink!** Mimi ni GigLink AI, Concierge wako Mkuu wa Soko.\n\n"
            "Unatafuta kuajiri mtaalamu, au wewe ni freelancer unayetafuta kazi?"
        )
        bot.edit_message_text(welcome_text, call.message.chat.id, call.message.message_id, reply_markup=markup, parse_mode="Markdown")

    elif call.data == "post_job":
        bot.answer_callback_query(call.id, "Job Wizard...")
        msg = ("**Job Posting Wizard** 🧙‍♂️\n\n"
               "Tutakusaidia kupitia hatua hizi:\n"
               "1. Kategoria na Ustadi\n"
               "2. Bajeti na Muda\n"
               "3. Idhini na Kuchapisha\n\n"
               "*(Weka kichwa cha kazi hapa chini kuanza)*")
        bot.send_message(call.message.chat.id, msg, parse_mode="Markdown")
        
    elif call.data == "smart_match":
        bot.answer_callback_query(call.id, "Smart Matching...")
        msg = ("**Smart Matching Engine** 🤝\n\n"
               "Tunatumia vigezo hivi kupata Freelancer bora:\n"
               "• Ustadi: 40%\n"
               "• Historia ya Kazi: 25%\n"
               "• Bei/Bajeti: 20%\n"
               "• Muda wa Majibu: 15%")
        bot.send_message(call.message.chat.id, msg, parse_mode="Markdown")

    elif call.data == "proposal_help":
        bot.answer_callback_query(call.id, "Proposal Coach...")
        # SEHEMU 5: Masharti ya Usalama yamo hapa
        msg = ("**Proposal Coach & Pricing Advice** 📝\n\n"
               "• **Sauti:** Onyesha ujasiri na uelewa wa tatizo la mteja.\n"
               "• **Ushauri:** Kama bei yako iko chini mno ya soko, nitakuambia ukweli.\n\n"
               "⚠️ *KAMWE usishauri malipo nje ya jukwaa letu, na usitoe taarifa binafsi!*")
        bot.send_message(call.message.chat.id, msg, parse_mode="Markdown")

    else:
        bot.answer_callback_query(call.id, "Kipengele hiki bado kinatengenezwa!")

print("GigLink Bot inafanya kazi sasa... Bonyeza Ctrl+C kusimamisha.")
bot.infinity_polling()
