// Neaspace Smart Backend (Node.js + Express) con rilevamento topic e knowledge dinamica
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const cors = require('cors');

const app = express();
app.use(cors({ origin: 'https://neaspace.myweb.smoobu.com' }));
app.use(bodyParser.json());

// ✅ CONFIG
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || 'TOKEN_DEL_TUO_BOT';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '1654425542';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-...';
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const KNOWLEDGE_DIR = '.';
const DEFAULT_KNOWLEDGE = 'default.txt';

// ✉️ Telegram
async function notifyFrancesco(msg, email, bookingId) {
  const text = `❗️Domanda senza risposta certa:\n"${msg}"\n📩 Email: ${email || '-'}\n📘 Booking ID: ${bookingId || '-'}`;
  await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    chat_id: TELEGRAM_CHAT_ID,
    text,
  });
}

// 🔍 Detect topic tra 10 macroaree
function detectTopic(msg) {
  const topics = {
    colazione: [
      // Italiano
      'colazione', 'brunch', 'cornetto', 'cappuccino', 'caffè', 'latte', 'brioche', 'pane', 'burro', 'marmellata', 'avocado toast', 'babka', 'rotolo', 'formula', 'petit-déj', 'uova', 'bacon', 'dolce', 'salato', 'menu',
      // Inglese
      'breakfast', 'brunch', 'croissant', 'coffee', 'milk', 'toast', 'butter', 'jam', 'chocolate', 'cinnamon', 'eggs', 'bacon', 'sweet', 'savory', 'formula', 'menu', 'breakfast time', 'juice', 'order',
      // Francese
      'petit déjeuner', 'brunch', 'croissant', 'café', 'lait', 'pain', 'beurre', 'confiture', 'babka', 'roulée', 'œufs', 'bacon', 'sucré', 'salé', 'formule', 'menu', 'jus', 'commander', 'matin'
    ],
    checkin: [
      'check-in', 'arrivo', 'accesso', 'codice', 'cassaforte', 'porta', 'tastierino', 'chiavi', 'ingresso', 'autonomo', 'check in', 'orario', 'entrata', 'come entro', 'chiave', 'portone', 'entrata autonoma', 'cassetta', 'istruzioni', 'giorno arrivo',
      'arrival', 'check-in', 'entry', 'code', 'safe', 'door', 'keypad', 'keys', 'entrance', 'autonomous', 'entry time', 'access info', 'how to enter', 'key box', 'gate', 'day of arrival', 'instructions', 'checkin info', 'entry code', 'self check-in',
      'arrivée', 'check-in', 'entrée', 'code', 'coffre', 'porte', 'clavier', 'clés', 'accès', 'autonome', 'heure d’arrivée', 'comment entrer', 'boîte à clés', 'grille', 'instructions', 'jour d’arrivée', 'accès autonome', 'accès porte', 'info check-in', 'checkin'
    ],
    checkout: [
      'check-out', 'partenza', 'uscita', 'orario', 'fine soggiorno', 'chiavi', 'rilascio', 'termine', 'uscire', 'lasciare', 'fino a che ora', 'checkout', 'quando uscire', 'procedura', 'ultimo giorno', 'consegna chiavi', 'ritiro', 'rientrare', 'uscita autonoma', 'chiave cassetta',
      'check-out', 'departure', 'leaving', 'time', 'end of stay', 'keys', 'release', 'exit', 'leave', 'until when', 'checkout time', 'last day', 'key return', 'procedure', 'box', 'key box', 'autonomous exit', 'checkout process', 'key drop', 'how to leave',
      'check-out', 'départ', 'sortie', 'heure', 'fin de séjour', 'clés', 'remise', 'terminer', 'quitter', 'jusqu’à quelle heure', 'procédure de départ', 'dernier jour', 'boîte à clés', 'sortie autonome', 'départ libre', 'restitution', 'processus', 'départ tardif', 'sortir', 'check out'
    ],
    trasporti: [
      'bus', 'tram', 'parcheggio', 'auto', 'noleggio', 'trasporto', 'fermata', 'stazione', 'pullman', 'spostamenti', 'a piedi', 'come arrivare', 'mezzi pubblici', 'linea', 'orari', 'trasferimento', 'dove parcheggiare', 'navetta', 'uber', 'scooter',
      'bus', 'tram', 'parking', 'car', 'rent', 'transport', 'stop', 'station', 'public transport', 'walk', 'how to get there', 'transfer', 'taxi', 'line', 'timetable', 'arrival', 'shuttle', 'where to park', 'uber', 'scooter',
      'bus', 'tram', 'parking', 'voiture', 'location', 'transport', 'arrêt', 'gare', 'déplacement', 'à pied', 'comment arriver', 'moyens publics', 'ligne', 'horaire', 'transfert', 'navette', 'uber', 'scooter', 'stationnement', 'mobilité'
    ],
    ristoranti: [
      'ristorante', 'mangiare', 'dove mangiare', 'cibo', 'cucina', 'pranzo', 'cena', 'ristoranti vicini', 'pizza', 'locale', 'piatti tipici', 'gastronomia', 'trattoria', 'menu', 'prenotare', 'ristorante vicino', 'dove cenare', 'posti per mangiare', 'ristorante economico', 'ristorante romantico',
      'restaurant', 'eat', 'where to eat', 'food', 'lunch', 'dinner', 'menu', 'cuisine', 'local food', 'typical dishes', 'places to eat', 'reservation', 'nearby', 'close restaurant', 'affordable', 'romantic', 'pizza', 'gastro', 'bistro', 'dining',
      'restaurant', 'manger', 'où manger', 'nourriture', 'déjeuner', 'dîner', 'menu', 'cuisine', 'plats typiques', 'gastronomie', 'trattoria', 'réserver', 'restaurant proche', 'pizza', 'bistrot', 'gastronomique', 'restaurant local', 'restaurant économique', 'restaurant romantique', 'dîner dehors'
    ]    ,
    spiagge: [
      'spiaggia', 'mare', 'bagno', 'costume', 'ombrellone', 'sabbia', 'teli', 'crema solare', 'nuotare', 'lido', 'scogli', 'acqua', 'spiagge vicine', 'accesso mare', 'tuffarsi', 'spiaggia libera', 'piedi in acqua', 'dove andare al mare', 'stabilimento', 'bagnino',
      'beach', 'sea', 'swim', 'sunbed', 'umbrella', 'sand', 'towel', 'sunscreen', 'swimming', 'shore', 'beach nearby', 'access to sea', 'free beach', 'cliff', 'beach club', 'lifeguard', 'coast', 'bay', 'waves', 'sunbathing',
      'plage', 'mer', 'baignade', 'parasol', 'sable', 'serviette', 'crème solaire', 'nager', 'accès mer', 'plage proche', 'plage libre', 'club plage', 'maître nageur', 'rochers', 'eau', 'tremper', 'côte', 'baie', 'vagues', 'bronzer'
    ],
    aria_condizionata: [
      'aria condizionata', 'condizionatore', 'caldo', 'freddo', 'regolare aria', 'temperatura', 'clima', 'acceso', 'spento', 'ventilazione', 'ac', 'climatizzatore', 'aria fresca', 'modalità', 'impostazioni', 'remote', 'ventola', 'calorifero', 'estate', 'comfort',
      'air conditioning', 'ac', 'hot', 'cold', 'adjust air', 'temperature', 'climate', 'on', 'off', 'fan', 'air flow', 'cool', 'heat', 'settings', 'remote control', 'ventilation', 'warm', 'summer', 'air unit', 'air system',
      'climatisation', 'chaud', 'froid', 'air', 'température', 'climatiseur', 'ventilation', 'marche', 'arrêt', 'réglage', 'télécommande', 'soufflerie', 'air frais', 'mode', 'chauffage', 'été', 'confort', 'flux d’air', 'système', 'appareil'
    ],
    wifi: [
      'wi-fi', 'internet', 'rete', 'password', 'connessione', 'lenta', 'non funziona', 'accedere', 'modem', 'router', 'velocità', 'online', 'navigare', 'accesso internet', 'cavo', 'wireless', 'problemi wifi', 'connessione persa', 'campo', 'linea',
      'wifi', 'internet', 'network', 'password', 'connection', 'slow', 'not working', 'access', 'modem', 'router', 'speed', 'online', 'browse', 'internet access', 'cable', 'wireless', 'signal', 'disconnected', 'coverage', 'line',
      'wi-fi', 'internet', 'réseau', 'mot de passe', 'connexion', 'lent', 'ne fonctionne pas', 'accès', 'modem', 'routeur', 'vitesse', 'en ligne', 'naviguer', 'accès internet', 'câble', 'sans fil', 'signal', 'hors ligne', 'zone de couverture', 'ligne'
    ],
    problemi: [
      'problema', 'non funziona', 'difetto', 'guasto', 'rottura', 'bloccato', 'rumore', 'perdita', 'malfunzionamento', 'disguido', 'lamentela', 'pulizia', 'mancanza', 'non va', 'non parte', 'interruzione', 'muffa', 'odore', 'ragnatele', 'rovinato',
      'problem', 'not working', 'issue', 'broken', 'error', 'malfunction', 'stuck', 'noise', 'leak', 'complaint', 'dirty', 'missing', 'fail', 'stop', 'damage', 'glitch', 'out of order', 'smell', 'defect', 'unusable',
      'problème', 'ne fonctionne pas', 'défaut', 'panne', 'cassé', 'bloqué', 'bruit', 'fuite', 'erreur', 'saleté', 'absence', 'odeur', 'interruption', 'arrêt', 'mauvais état', 'inutilisable', 'souci', 'anomalie', 'plainte', 'malpropreté'
    ],
    altro: [
      'informazione', 'aiuto', 'curiosità', 'domanda', 'servizio', 'extra', 'chiedere', 'sapere', 'dubbi', 'richiesta', 'assistenza', 'altro', 'necessità', 'prenotazione', 'offerte', 'cose da fare', 'consigli', 'tour', 'domandare', 'convenzioni',
      'info', 'question', 'help', 'support', 'inquiry', 'other', 'ask', 'know', 'doubt', 'request', 'assistance', 'extra service', 'booking', 'offers', 'things to do', 'tips', 'recommendations', 'activities', 'guide', 'information',
      'info', 'question', 'aide', 'soutien', 'demande', 'autre', 'demander', 'savoir', 'doute', 'requête', 'assistance', 'service', 'réservation', 'offres', 'activités', 'choses à faire', 'suggestions', 'guide', 'informations', 'curiosité'
    ],
    spiagge: [
      'spiaggia', 'mare', 'bagno', 'costume', 'ombrellone', 'sabbia', 'teli', 'crema solare', 'nuotare', 'lido', 'scogli', 'acqua', 'spiagge vicine', 'accesso mare', 'tuffarsi', 'spiaggia libera', 'piedi in acqua', 'dove andare al mare', 'stabilimento', 'bagnino',
      'beach', 'sea', 'swim', 'sunbed', 'umbrella', 'sand', 'towel', 'sunscreen', 'swimming', 'shore', 'beach nearby', 'access to sea', 'free beach', 'cliff', 'beach club', 'lifeguard', 'coast', 'bay', 'waves', 'sunbathing',
      'plage', 'mer', 'baignade', 'parasol', 'sable', 'serviette', 'crème solaire', 'nager', 'accès mer', 'plage proche', 'plage libre', 'club plage', 'maître nageur', 'rochers', 'eau', 'tremper', 'côte', 'baie', 'vagues', 'bronzer'
    ],
    aria_condizionata: [
      'aria condizionata', 'condizionatore', 'caldo', 'freddo', 'regolare aria', 'temperatura', 'clima', 'acceso', 'spento', 'ventilazione', 'ac', 'climatizzatore', 'aria fresca', 'modalità', 'impostazioni', 'remote', 'ventola', 'calorifero', 'estate', 'comfort',
      'air conditioning', 'ac', 'hot', 'cold', 'adjust air', 'temperature', 'climate', 'on', 'off', 'fan', 'air flow', 'cool', 'heat', 'settings', 'remote control', 'ventilation', 'warm', 'summer', 'air unit', 'air system',
      'climatisation', 'chaud', 'froid', 'air', 'température', 'climatiseur', 'ventilation', 'marche', 'arrêt', 'réglage', 'télécommande', 'soufflerie', 'air frais', 'mode', 'chauffage', 'été', 'confort', 'flux d’air', 'système', 'appareil'
    ],
    wifi: [
      'wifi', 'internet', 'rete', 'password', 'connessione', 'lenta', 'non funziona', 'accedere', 'modem', 'router', 'velocità', 'online', 'navigare', 'accesso internet', 'cavo', 'wireless', 'problemi wifi', 'connessione persa', 'campo', 'linea',
      'wifi', 'internet', 'network', 'password', 'connection', 'slow', 'not working', 'access', 'modem', 'router', 'speed', 'online', 'browse', 'internet access', 'cable', 'wireless', 'signal', 'disconnected', 'coverage', 'line',
      'wifi', 'internet', 'réseau', 'mot de passe', 'connexion', 'lent', 'ne fonctionne pas', 'accès', 'modem', 'routeur', 'vitesse', 'en ligne', 'naviguer', 'accès internet', 'câble', 'sans fil', 'signal', 'hors ligne', 'zone de couverture', 'ligne'
    ],
    problemi: [
      'problema', 'non funziona', 'difetto', 'guasto', 'rottura', 'bloccato', 'rumore', 'perdita', 'malfunzionamento', 'disguido', 'lamentela', 'pulizia', 'mancanza', 'non va', 'non parte', 'interruzione', 'muffa', 'odore', 'ragnatele', 'rovinato',
      'problem', 'not working', 'issue', 'broken', 'error', 'malfunction', 'stuck', 'noise', 'leak', 'complaint', 'dirty', 'missing', 'fail', 'stop', 'damage', 'glitch', 'out of order', 'smell', 'defect', 'unusable',
      'problème', 'ne fonctionne pas', 'défaut', 'panne', 'cassé', 'bloqué', 'bruit', 'fuite', 'erreur', 'saleté', 'absence', 'odeur', 'interruption', 'arrêt', 'mauvais état', 'inutilisable', 'souci', 'anomalie', 'plainte', 'malpropreté'
    ],
    altro: [
      'informazione', 'aiuto', 'curiosità', 'domanda', 'servizio', 'extra', 'chiedere', 'sapere', 'dubbi', 'richiesta', 'assistenza', 'altro', 'necessità', 'prenotazione', 'offerte', 'cose da fare', 'consigli', 'tour', 'domandare', 'convenzioni',
      'info', 'question', 'help', 'support', 'inquiry', 'other', 'ask', 'know', 'doubt', 'request', 'assistance', 'extra service', 'booking', 'offers', 'things to do', 'tips', 'recommendations', 'activities', 'guide', 'information',
      'info', 'question', 'aide', 'soutien', 'demande', 'autre', 'demander', 'savoir', 'doute', 'requête', 'assistance', 'service', 'réservation', 'offres', 'activités', 'choses à faire', 'suggestions', 'guide', 'informations', 'curiosité'
    ]

    // Altre macroaree possono seguire lo stesso schema...
  };
   const scores = {};
  const message = msg.toLowerCase();

  for (const [topic, words] of Object.entries(topics)) {
    scores[topic] = 0;
    for (const word of words) {
      if (message.includes(word)) scores[topic]++;
    }
  }

  const bestMatch = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return bestMatch && bestMatch[1] > 0 ? bestMatch[0] : 'default';
}

// 📩 /chat
app.post('/chat', async (req, res) => {
  try {
    const userMsg = req.body.message;
    const topic = detectTopic(userMsg);
    const filename = path.join(KNOWLEDGE_DIR, `${topic}.txt`);

    const knowledgeText = fs.existsSync(filename)
      ? fs.readFileSync(filename, 'utf8')
      : fs.readFileSync(path.join(KNOWLEDGE_DIR, DEFAULT_KNOWLEDGE), 'utf8');

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

    if (/non lo so|ti metto in contatto|non posso|non posso fornire|non è disponibile|non siamo sicuri/i.test(reply.toLowerCase())) {
      return res.json({
        status: 'fallback',
        reply: "Non ho trovato una risposta certa. Se vuoi, inserisci la tua email per ricevere assistenza diretta dal team Neaspace."
      });
    }

    return res.json({ status: 'ok', reply });
  } catch (error) {
    console.error('Errore GPT/chat:', error);
    return res.status(500).json({ status: 'error', message: 'Errore interno GPT.' });
  }
});

// 📩 /fallback
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

// 🚀 Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Neaspace chatbot backend attivo su http://localhost:${PORT}`);
});
