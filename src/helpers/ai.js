// ── Gemini AI Helper ──────────────────────────────────────────────────────────
// Pata API Key BURE: https://aistudio.google.com
// Weka kwenye .env: GEMINI_API_KEY=your_key_here
// Kisha run: npm install @google/generative-ai

let genAI = null;

function initAI() {
  if (genAI) return; // tayari imeanzishwa
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[AI] GEMINI_API_KEY haijapatikana. AI haitafanya kazi. Weka kwenye .env yako.');
    return;
  }
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.log('[AI] Gemini AI imeanzishwa kikamilifu ✅');
  } catch (e) {
    console.warn('[AI] @google/generative-ai haipo. Run: npm install @google/generative-ai');
  }
}

initAI();

async function callGemini(prompt) {
  if (!genAI) return null;
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (err) {
    console.error('[AI] Gemini error:', err.message);
    return null;
  }
}

/**
 * Boresha maelezo ya Gig kwa kutumia AI.
 */
async function improveGigDescription(title, description) {
  const prompt = `Wewe ni mshauri mkuu wa freelance marketplace Afrika Mashariki (GigLink).

Boresha maelezo haya ya Gig kwa Kiswahili (Markdown format):
Kichwa: ${title}
Maelezo ya mwanzo: ${description}

Tengeneza maelezo mazuri, ya kitaalamu, yenye ushawishi, na yenye keywords muhimu za SEO.
Jibu kwa Markdown. Usiongeze zaidi ya maneno 150. Hakuna utangulizi - anza moja kwa moja.`;
  return callGemini(prompt);
}

/**
 * Tengeneza Job Brief kamili kutoka kwa maelezo mafupi.
 */
async function generateJobBrief(shortDescription) {
  const prompt = `Wewe ni mshauri mkuu wa freelance marketplace Afrika Mashariki (GigLink).

Tengeneza Job Brief kamili kwa Kiswahili kutoka kwa maelezo haya mafupi:
"${shortDescription}"

Jibu kwa Markdown (usiongeze zaidi ya maneno 150):
- **Kichwa cha Kazi:** ...
- **Maelezo:** ...
- **Skills Zinazohitajika:** ...
- **Matokeo Yanayotarajiwa:** ...

Hakuna utangulizi - anza moja kwa moja.`;
  return callGemini(prompt);
}

module.exports = { improveGigDescription, generateJobBrief };
