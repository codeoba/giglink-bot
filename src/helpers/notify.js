// ── Notification Helper ───────────────────────────────────────────────────────
// Inatuma arifa kwa mtumiaji kupitia Telegram na kuihifadhi kwenye DB.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * @param {import('telegraf').Telegraf} bot
 * @param {BigInt|string|number} telegramId  - Telegram ID ya mpokeaji
 * @param {string} message                   - Ujumbe wa Markdown
 * @param {string} type                      - INFO | PROPOSAL | PAYMENT | REVIEW | MESSAGE
 */
async function notify(bot, telegramId, message, type = 'INFO') {
  try {
    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(telegramId) } });
    if (user) {
      await prisma.notification.create({
        data: { content: message, type, userId: user.id }
      });
    }
    await bot.telegram.sendMessage(String(telegramId), message, { parse_mode: 'Markdown' });
  } catch (err) {
    // Kama mtumiaji amezuia bot, usimame bila crash
    if (!err.message?.includes('blocked') && !err.message?.includes('not found')) {
      console.error('Notification error:', err.message);
    }
  }
}

module.exports = { notify };
