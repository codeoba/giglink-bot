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

module.exports = { getLevel, getStars };
