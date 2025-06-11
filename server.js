// Neaspace Smart Backend (Node.js + Express)
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { OpenAI } = require('openai');
const similarity = require('compute-cosine-similarity'); // o usa altro metodo se preferisci

const app = express();
app.use(bodyParser.json());

// ✅ CONFIGURA QUESTI PARAMETRI
const TELEGRAM_TOKEN = 'TOKEN_DEL_TUO_BOT';
const TELEGRAM_CHAT_ID = '1654425542';
const OPENAI_API_KEY = 'sk-...';
const KNOWLEDGE_BASE = require('./knowledge_base.json'); // array con { embedding: [...], text: "..." }
const MATCH_THRESHOLD = 0.75;

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// 🔍 Funzione per cercare il miglior match semantico
function findBestMatch(userVector) {
  let bestScore = 0;
  let bestContext = null;
  for (const item of KNOWLEDGE_BASE) {
    const score = similarity(userVector, item.embedding);
    if (score > bestScore) {
      bestScore = score;
      bestContext = item.text;
    }
  }
  return { score: bestScore, context: bestContext };
}

// ✉️ Invio Telegram
async function notifyFrancesco(msg, email, bookingId) {
  const text = `❗️Domanda senza match:
"${msg}"
📩 Email: ${email || '-'}
📘 Booking ID: ${bookingId || '-'}`;
  await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    chat_id: TELEGRAM_CHAT_ID,
    text,
  });
}

// 📩 Endpoint principale: /chat
app.post('/chat', async (req, res) => {
  const userMsg = req.body.message;
  const embeddingResp = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: userMsg
  });
  const userVector = embeddingResp.data[0].embedding;
  const { score, context } = findBestMatch(userVector);

  if (score >= MATCH_THRESHOLD) {
    const chatCompletion = await openai.chat.completions.create({
      model: 'gpt-4-1106-preview',
      messages: [
        { role: 'system', content: 'Rispondi solo sulla base della knowledge base. Se non sai, non inventare.' },
        { role: 'user', content: `${userMsg}\n\nContesto: ${context}` }
      ]
    });
    return res.json({ status: 'ok', reply: chatCompletion.choices[0].message.content });
  } else {
    return res.json({ status: 'fallback' });
  }
});

// 📩 Endpoint fallback: /fallback
app.post('/fallback', async (req, res) => {
  const { message, email, bookingId } = req.body;
  await notifyFrancesco(message, email, bookingId);
  res.json({ status: 'sent' });
});

// 🚀 Avvio
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Neaspace chatbot backend attivo su http://localhost:${PORT}`);
});
