// Neaspace Smart Backend (Node.js + Express)
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { OpenAI } = require('openai');
const similarity = require('compute-cosine-similarity');
const cors = require('cors');

const app = express();
app.use(cors({ origin: 'https://neaspace.myweb.smoobu.com' }));
app.use(bodyParser.json());

// ✅ CONFIGURA QUESTI PARAMETRI
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || 'TOKEN_DEL_TUO_BOT';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '1654425542';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-...';
const KNOWLEDGE_BASE = require('./knowledge_base.json');
const MATCH_THRESHOLD = 0.85;

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// 🔍 Funzione per cercare il miglior match semantico
function findBestMatch(userVector) {
  let bestScore = 0;
  let bestContext = null;

  for (const item of KNOWLEDGE_BASE) {
    if (item.embedding.length !== userVector.length) continue;
    const score = similarity(userVector, item.embedding);

    // 🔍 DEBUG: stampa lo score e il testo abbreviato
    console.log(`Score: ${score.toFixed(4)} | Text: ${item.text.slice(0, 80)}...`);

    if (score > bestScore) {
      bestScore = score;
      bestContext = item.text;
    }
  }

  return { score: bestScore, context: bestContext };
}
// ✉️ Invio Telegram
async function notifyFrancesco(msg, email, bookingId) {
  const text = `❗️Domanda senza match:\n"${msg}"\n📩 Email: ${email || '-'}\n📘 Booking ID: ${bookingId || '-'}`;
  await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    chat_id: TELEGRAM_CHAT_ID,
    text,
  });
}

// 📩 Endpoint principale: /chat
app.post('/chat', async (req, res) => {
  try {
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
      return res.json({
  status: 'fallback',
  reply: "Non ho trovato una risposta diretta nella knowledge base. Se vuoi, inserisci la tua email per ricevere una risposta personalizzata da Francesco."
});
    }
  } catch (error) {
    console.error('Errore GPT/chat:', error);
    return res.status(500).json({ status: 'error', message: 'Errore interno GPT.' });
  }
});

// 📩 Endpoint fallback: /fallback
app.post('/fallback', async (req, res) => {
  const { message, email, bookingId } = req.body;
  try {
    await notifyFrancesco(message, email, bookingId);
    res.json({ status: 'sent' });
  } catch (err) {
    console.error('Errore Telegram:', err);
    res.status(500).json({ status: 'error', message: 'Errore Telegram' });
  }
});

// 🚀 Avvio
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Neaspace chatbot backend attivo su http://localhost:${PORT}`);
});
