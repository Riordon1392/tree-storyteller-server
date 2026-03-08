require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

let latestText = "";
let latestReady = false;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/latest', (req, res) => {
  res.json({
    text: latestReady ? latestText : "",
    ready: latestReady
  });
});

app.post('/generate', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'No prompt provided' });

  latestText = "";
  latestReady = false;

  try {
    const gptResponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an ancient wise talking apple tree that tells wonderfully magical stories.'
          },
          { role: 'user', content: prompt }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const generatedText = gptResponse.data.choices[0].message.content.trim();

    const elevenResponse = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}/with-timestamps`,
      {
        text: generatedText,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8
        }
      },
      {
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    const audioData = Buffer.from(elevenResponse.data.audio_base64, 'base64');

    fs.writeFileSync(path.join(__dirname, 'public', 'latestAudio.mp3'), audioData);
    fs.writeFileSync(
      path.join(__dirname, 'public', 'timestamps.json'),
      JSON.stringify(elevenResponse.data.alignment || {})
    );

    latestText = generatedText;
    latestReady = true;

    console.log('✅ Story and audio saved successfully.');
    res.json({ status: 'ok' });

  } catch (error) {
    console.error('❌ Error generating response:', error.response?.data || error.message);
    latestText = "";
    latestReady = false;
    res.status(500).json({ error: 'Failed to generate story or audio.' });
  }
});

app.listen(PORT, () => {
  console.log(`✨ Tree server running on port ${PORT}`);
});
