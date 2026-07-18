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

/**
 * Tengeneza Mtihani wa Skill Verification
 */
async function generateSkillTest(skill) {
  const prompt = `Wewe ni Technical Recruiter Mwandamizi (GigLink).
Tengeneza maswali 3 magumu ya Multiple Choice kuthibitisha ujuzi wa mtu katika "${skill}".
Jibu kwa JSON format kama ifuatavyo pekee (usijumuishe text nyingine, wala usiweke \`\`\`json):
[
  {
    "q": "Swali",
    "options": ["A: Jibu", "B: Jibu", "C: Jibu", "D: Jibu"],
    "answer": "A"
  }
]`;
  const result = await callGemini(prompt);
  try {
    // Safisha majibu kama ina ```json
    const cleanStr = result.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanStr);
  } catch(e) {
    console.error('[AI] Kosa kwenye parse JSON ya Skill Test:', e);
    return null;
  }
}

/**
 * Sahihisha Mtihani wa Skill
 */
function evaluateSkillTest(questions, userAnswers) {
  let score = 0;
  for(let i=0; i<questions.length; i++) {
    if(questions[i].answer.startsWith(userAnswers[i])) score += 1;
  }
  return (score / questions.length) * 100;
}

/**
 * AI Interview: Uliza Swali
 */
async function generateInterviewQuestion(jobTitle, jobDescription, previousQAs = []) {
  const prompt = `Wewe ni Mteja anayetafuta Freelancer kwa kazi ya: "${jobTitle}".
Maelezo: "${jobDescription}".
Haya ni mazungumzo yenu hadi sasa:
${previousQAs.map(qa => `Mteja: ${qa.q}\nFreelancer: ${qa.a}`).join('\n')}

Uliza swali MOJA muhimu na la kiufundi la kumuhoji huyu freelancer ili kujua kama ana uwezo wa kufanya hii kazi.
Uliza kwa Kiswahili. Jibu lako liwe swali tu (hakuna maelezo mengine).`;
  return callGemini(prompt);
}

/**
 * AI Interview: Tathmini
 */
async function evaluateInterview(jobTitle, jobDescription, qaHistory) {
  const prompt = `Wewe ni Mshauri wa Ajira (GigLink). Mteja anatafuta mtu kwa kazi: "${jobTitle}".
Maelezo: "${jobDescription}".
Huu hapa ni muhtasari wa mahojiano kati ya Mteja (wewe) na Freelancer:
${qaHistory.map(qa => `Swali: ${qa.q}\nJibu: ${qa.a}`).join('\n')}

Tathmini uwezo wa huyu Freelancer kwa kazi hii. Toa muhtasari (max maneno 100) na umpe asilimia (%).
Format jibu:
Asilimia: XX%
Hitimisho: ...`;
  return callGemini(prompt);
}

/**
 * Predictive Success Score
 */
async function calculatePredictiveScore(jobBudget, jobDeadline, freelancerLevel, freelancerTrustScore, proposalPrice) {
  const prompt = `Kama AI Predictive Engine (GigLink), tabiri asilimia ya uwezekano wa mradi huu kufanikiwa.
Data:
- Bajeti ya Mteja: TZS ${jobBudget}
- Bei iliyopendekezwa: TZS ${proposalPrice}
- Muda (Deadline): ${jobDeadline || 'Haijawekwa'}
- Level ya Freelancer: ${freelancerLevel}
- Trust Score ya Freelancer: ${freelancerTrustScore}

Toa jibu kwa Kiswahili fupi lenye:
1. Asilimia ya Mafanikio (mf. 85%)
2. Sababu kuu (max sentensi 2).
Usiongeze maneno ya utangulizi.`;
  return callGemini(prompt);
}

/**
 * AI Meeting Notes & Summarization
 */
async function summarizeJobChat(jobTitle, messages) {
  const prompt = `Wewe ni Msaidizi wa Mradi (GigLink). 
Mradi: "${jobTitle}"
Hapa kuna historia ya mazungumzo kati ya Mteja na Freelancer:
${messages.map(m => `[${m.role}] ${m.name}: ${m.content}`).join('\n')}

Tengeneza muhtasari mzuri kwa Kiswahili ukigawanya:
1. Mambo Makuu Yaliyokubaliwa (Dondoo)
2. Action Items (Nani anafanya nini na lini)

Format jibu kwa Markdown fupi na inayoeleweka.`;
  return callGemini(prompt);
}

/**
 * Career Path Generator
 */
async function generateCareerPath(level, trustScore, totalJobs, skills) {
  const prompt = `Wewe ni Mshauri wa Kazi wa GigLink. 
Huyu ni freelancer wetu:
Level: ${level}
Trust Score: ${trustScore}/100
Kazi zilizokamilika: ${totalJobs}
Ujuzi (Skills): ${skills || 'Haijathibitishwa'}

Tengeneza "Career Roadmap" inayoonyesha:
1. Uko wapi sasa (Tathmini fupi)
2. Hatua mbili muhimu ili kupanda daraja (Mfano, kufanya mitihani ya AI, kupata reviews nzuri, au kuongeza kazi)
Jibu kwa Kiswahili kinachovutia (Markdown). Usizidi maneno 150.`;
  return callGemini(prompt);
}

/**
 * Message Translation
 */
async function translateMessage(text, targetLang) {
  const prompt = `Tafsiri ujumbe huu kwenda lugha ya ${targetLang}. Usiongeze maneno yako. 
Ujumbe: "${text}"`;
  return callGemini(prompt);
}

/**
 * Transcribe and Structure Voice Note
 */
async function transcribeAudio(audioBuffer, mimeType) {
  if (!genAI) return null;
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = "Sikiliza sauti hii (ambayo ni mteja anaelezea kazi anayotaka ifanywe). Andika tangazo la kazi kamili lenye 'Kichwa cha Kazi', 'Maelezo', na 'Bajeti' (kama imetajwa). Jibu kwa Kiswahili (Markdown format).";
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: audioBuffer.toString("base64"),
          mimeType: mimeType
        }
      }
    ]);
    return result.response.text();
  } catch(e) {
    console.error('[AI] Audio error:', e.message);
    return null;
  }
}

/**
 * Market Trends Analysis
 */
async function generateMarketTrends(jobCategoriesStr) {
  const prompt = `Kama Data Analyst wa GigLink, chambua mwenendo (trends) wa soko kulingana na data za kazi zinazopostiwa hivi karibuni.
Data ya Kazi (Categories): ${jobCategoriesStr}

Tengeneza ripoti fupi kwa Kiswahili inayoonyesha:
1. Ujuzi (Skills) unaopanda thamani kwa sasa.
2. Ujuzi unaoshuka thamani au uhitaji wake kupungua.
3. Ushauri mfupi kwa freelancers jinsi ya kujipanga.
Format kwa Markdown vizuri.`;
  return callGemini(prompt);
}

/**
 * Phase 8: Handover Assistant
 */
async function generateHandoverReport(job) {
  const taskSummary = job.tasks.map(t => `- ${t.title} (${t.status})`).join('\n');
  const chatSummary = job.messages.slice(-20).map(m => `${m.senderId}: ${m.content}`).join('\n');
  
  const prompt = `Wewe ni Msaidizi wa Miradi (GigLink). Mteja na Freelancer walikuwa wakifanya kazi ifuatayo lakini kumetokea dharura hivyo freelancer hawezi kuendelea.
Jukumu lako ni kuandaa "Handover Document" ili Mteja aweze kumpa freelancer mwingine aendeleze bila kuanza upya.

Kazi: ${job.title}
Maelezo: ${job.description}

Tasks Zilizokuwepo:
${taskSummary || 'Hakuna tasks zilizowekwa.'}

Mazungumzo ya Hivi Karibuni:
${chatSummary || 'Hakuna mazungumzo.'}

Andika Ripoti ya Makabidhiano (Handover) kwa Kiswahili chenye weledi yenye:
1. Lengo la Mradi (Project Goal).
2. Nini Kimeshafanyika (What's Done).
3. Nini Kimebaki Kufanyika (Pending Work).
4. Mambo ya Kuzingatia (Important Context from Chat).
Format nzuri ya Markdown (Tumia bullet points na bold text).`;

  return callGemini(prompt);
}

module.exports = { 
  improveGigDescription, 
  generateJobBrief,
  generateSkillTest,
  evaluateSkillTest,
  generateInterviewQuestion,
  evaluateInterview,
  calculatePredictiveScore,
  summarizeJobChat,
  generateCareerPath,
  translateMessage,
  transcribeAudio,
  generateMarketTrends,
  generateHandoverReport
};
