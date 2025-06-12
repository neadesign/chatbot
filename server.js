// Neaspace Smart Backend (Node.js + Express)
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs');
const { OpenAI } = require('openai');
const cors = require('cors');

const app = express();
app.use(cors({ origin: 'https://neaspace.myweb.smoobu.com' }));
app.use(bodyParser.json());

// ✅ CONFIGURA QUESTI PARAMETRI
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || 'TOKEN_DEL_TUO_BOT';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '1654425542';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-...';
const KNOWLEDGE_PATH = './Neaspace_Knowledge_ONLY001.txt';

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// ✉️ Invio Telegram
async function notifyFrancesco(msg, email, bookingId) {
  const text = `❗️Domanda senza risposta certa:\n"${msg}"\n📩 Email: ${email || '-'}\n📘 Booking ID: ${bookingId || '-'}`;
  await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    chat_id: TELEGRAM_CHAT_ID,
    text,
  });
}

// 📩 Endpoint principale: /chat
app.post('/chat', async (req, res) => {
  try {
    const userMsg = req.body.message;
    const knowledgeText = fs.readFileSync(KNOWLEDGE_PATH, 'utf8');

    const systemPrompt = `
Rispondi solo usando le informazioni seguenti. Se anche solo in parte non sei sicuro, NON rispondere. Scrivi: “Non lo so con certezza. Ti metto in contatto con il team Neaspace.”

Ecco la knowledge base:
${knowledgeText}
    `.trim();

    const chatCompletion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMsg }
      ],
      temperature: 0.2
    });

    const reply = chatCompletion.choices[0].message.content.trim();

// Se GPT esprime incertezza o evasività, attiva il fallback
if (
  reply.toLowerCase().includes('non lo so') ||
  reply.toLowerCase().includes('ti metto in contatto') ||
  reply.toLowerCase().includes('non posso') ||
  reply.toLowerCase().includes('non posso fornire') ||
  reply.toLowerCase().includes('non è disponibile') ||
  reply.toLowerCase().includes('non siamo sicuri')
) {
  return res.json({
    status: 'fallback',
    reply: "Non ho trovato una risposta certa. Se vuoi, inserisci la tua email per ricevere assistenza diretta dal team Neaspace."
  });
}


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
