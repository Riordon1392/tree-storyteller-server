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
app.use(express.static(path.join(__dirname, '../web')));

let latestText = "";

app.post('/generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'No prompt provided' });
    }

    // New and better system message
    const gptResponse = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o',
      messages: [
        { 
          role: 'system', 
          content: 'You are the spirit of the Magic Mirror. When the user speaks, you do not repeat their words. Instead, you reply with your own cryptic insight, mysterious wisdom, prophecy, story, or riddle. You speak as an ancient guide, interpreting their words as omens or signs. You never copy the user\'s words, and you never just reformulate them. Always create a new and meaningful answer inspired by the user\'s speech.'
        },
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

    // ElevenLabs /with-timestamps
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

    const audioBase64 = elevenResponse.data.audio_base64;
    const alignmentData = elevenResponse.data.alignment;

    const audioBuffer = Buffer.from(audioBase64, 'base64');
    fs.writeFileSync(path.join(__dirname, '../web/latestAudio.mp3'), audioBuffer);
    fs.writeFileSync(path.join(__dirname, '../web/timestamps.json'), JSON.stringify(alignmentData));

    res.json({ status: 'ok' });

  } catch (error) {
    console.error('❌ Error during generation:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to generate response.' });
  }
});

app.get('/latest', (req, res) => {
  if (!latestText) {
    return res.status(404).json({ error: "No text available yet." });
  }
  res.json({ text: latestText });
});

app.listen(PORT, () => {
  console.log(`✨ Magic Mirror server running with deep wisdom at http://localhost:${PORT}`);
});
