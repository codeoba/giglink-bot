// ── Badges & Levels Helper ────────────────────────────────────────────────────

/**
 * Rudisha kiwango cha Freelancer kulingana na kazi zilizokamilika.
 * @param {number} completedJobs
 * @returns {string}
 */
function getLevel(completedJobs) {
  if (completedJobs >= 50) return '💎 Elite';
  if (completedJobs >= 20) return '🥇 Pro';
  if (completedJobs >= 6)  return '🥈 Rising Star';
  return '🥉 Novice';
}

/**
 * Rudisha picha ya nyota kwa rating ya 1-5.
 * @param {number} rating
 * @returns {string}
 */
function getStars(rating) {
  const r = Math.round(Math.max(0, Math.min(5, rating || 0)));
  return '⭐'.repeat(r) + '☆'.repeat(5 - r);
}

/**
 * Rudisha Badge inayoendana na Streak Days za freelancer.
 * @param {number} streakDays
 * @returns {string}
 */
function getStreakBadge(streakDays) {
  if (streakDays >= 365) return '👑 Legendary (Miezi 12+)';
  if (streakDays >= 240) return '🌟 Elite Talent (Miezi 8+)';
  if (streakDays >= 150) return '🛡️ Pro Worker (Miezi 5+)';
  if (streakDays >= 90)  return '🔥 Consistent Performer (Miezi 3+)';
  if (streakDays >= 14)  return '🚀 Rising Star (Siku 14+)';
  return '🌱 Starter';
}

module.exports = { getLevel, getStars, getStreakBadge };
