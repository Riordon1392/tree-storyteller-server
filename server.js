// magic_mirror_final/server/server.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let latestText = "";

app.post('/generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'No prompt provided' });

    const gptResponse = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are an old wise talking tree that tells wonderfully magical stories.' },
        { role: 'user', content: prompt }
      ]
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const generatedText = gptResponse.data.choices[0].message.content.trim();
    latestText = generatedText;

    const elevenResponse = await axios.post(`https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}/with-timestamps`, {
      text: generatedText,
      model_id: 'eleven_monolingual_v1',
      voice_settings: { stability: 0.5, similarity_boost: 0.8 }
    }, {
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    const audioData = Buffer.from(elevenResponse.data.audio_base64, 'base64');
    fs.writeFileSync(path.join(__dirname, 'public/latestAudio.mp3'), audioData);

    const timestampsData = elevenResponse.data.alignment;
    fs.writeFileSync(path.join(__dirname, 'public/timestamps.json'), JSON.stringify(timestampsData));

    console.log('✅ Audio and timestamps saved.');
    res.json({ status: 'ok' });

  } catch (error) {
    console.error('❌ Server error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to generate audio and timestamps.' });
  }
});

app.get('/latest', (req, res) => {
  if (!latestText) return res.status(404).json({ error: 'No text available.' });
  res.json({ text: latestText });
});

app.listen(PORT, () => {
  console.log(`✨ Magic Mirror server running at http://localhost:${PORT}`);
});
