const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Checks and updates the user's streak.
 * Called whenever a user interacts with the bot.
 */
async function updateStreak(userId) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;

    const now = new Date();
    const lastActive = user.lastActiveAt;
    
    let newStreak = user.streakDays;
    let earnedBadge = null;

    if (!lastActive) {
      // First time interaction
      newStreak = 1;
    } else {
      const msPerDay = 1000 * 60 * 60 * 24;
      const daysDiff = (now - lastActive) / msPerDay;

      if (daysDiff > 2) {
        // Streak broken
        newStreak = 1;
      } else if (daysDiff > 1) {
        // Next day interaction, increment streak
        newStreak += 1;
      }
      // If daysDiff < 1, it's the same day, do nothing to streak count
    }

    // Check milestones (5 Levels - Updated strictness)
    if (newStreak === 7 && user.streakDays < 7) {
      earnedBadge = '🚀 Starter Streak (Siku 7)';
    } else if (newStreak === 30 && user.streakDays < 30) {
      earnedBadge = '🔥 Active Freelancer (Mwezi 1)';
    } else if (newStreak === 90 && user.streakDays < 90) {
      earnedBadge = '🌟 Consistent Performer (Miezi 3)';
    } else if (newStreak === 150 && user.streakDays < 150) {
      earnedBadge = '💎 Pro Worker (Miezi 5)';
    } else if (newStreak === 365 && user.streakDays < 365) {
      earnedBadge = '👑 Legendary GigLinker (Mwaka 1)';
    }

    // Update user
    await prisma.user.update({
      where: { id: userId },
      data: {
        streakDays: newStreak,
        lastActiveAt: now
      }
    });

    return { newStreak, earnedBadge };
  } catch (error) {
    console.error('Error updating streak:', error);
    return null;
  }
}

/**
 * Leaderboard function by category or general.
 */
async function getLeaderboard(category = null) {
  try {
    // We base leaderboard on trustScore and total income or completed jobs
    let users = await prisma.user.findMany({
      where: { role: 'FREELANCER' },
      orderBy: { trustScore: 'desc' },
      take: 10,
      include: { badges: true }
    });

    if (category) {
      // Very basic filtering: if user has a badge matching category or similar
      // In a real app, we'd query by job completion category.
      users = users.filter(u => u.badges.some(b => b.skillName.toLowerCase().includes(category.toLowerCase())));
    }

    return users;
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    return [];
  }
}

module.exports = {
  updateStreak,
  getLeaderboard
};
