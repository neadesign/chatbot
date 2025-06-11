// genera_embedding.js
const fs = require('fs');
const readline = require('readline');
const { OpenAI } = require('openai');

// 🔐 Prende la chiave dall'env var
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 📄 Legge tutte le righe dal file knowledge_source.txt
async function generateEmbeddings() {
  const fileStream = fs.createReadStream('knowledge_source.txt');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const results = [];

  for await (const line of rl) {
    const cleanLine = line.trim();
    if (cleanLine.length === 0) continue;

    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: cleanLine,
      });

      results.push({
        text: cleanLine,
        embedding: response.data[0].embedding,
      });

      console.log(`✅ Embedding generato per: "${cleanLine}"`);
    } catch (err) {
      console.error(`❌ Errore per: "${cleanLine}"`, err.message);
    }
  }

  fs.writeFileSync('knowledge_base.json', JSON.stringify(results, null, 2));
  console.log('📦 knowledge_base.json generato con successo!');
}

generateEmbeddings();
