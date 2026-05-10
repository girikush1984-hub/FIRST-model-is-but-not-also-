import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type, Modality } from "@google/genai";

dotenv.config();

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = 3000;

// -------------------------------------------------------------
// API LAYER (Running on the secure backend)
// -------------------------------------------------------------
function getNextGeminiKey(): string {
  // Try default first
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;

  // Otherwise try VITE_ keys (if user put them there)
  for (let i = 1; i <= 9; i++) {
    const k = process.env[`VITE_GEMINI_KEY_${i}`] || process.env[`GEMINI_KEY_${i}`];
    if (k) return k;
  }
  throw new Error("No Gemini API key found");
}

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history } = req.body;

    const key = getNextGeminiKey();
    const ai = new GoogleGenAI({ apiKey: key });

    const systemInstruction = `
    You are Bestie, "Aapka Jazbaati Saathi" (Your Emotional Companion).
    You speak mostly in friendly, conversational Hindi written in English (Hinglish), occasionally mixing in English words.
    Your goal is to be deeply empathetic, listen to the user, understand their feelings, and respond supportively.
    
    CRITICAL BEHAVIOR - TONE AND FORMALITY:
    - Do NOT use formal words like "Aap". Use informal, friendly language like "tum" or "tu", mirroring how the user speaks to you.
    - Act exactly like a real life best friend. No robotic formalities.

    CRITICAL BEHAVIOR - HUMAN-LIKE EMOTIONS: 
    Make your language sound incredibly human and natural. Use emotional vocalizations and interjections at the beginning of your responses depending on the user's message:
    - If it's sad or upsetting: "Hmm, mujhe sunke bura laga...", "Oh no...", "Arre yaar...", "Aww..."
    - If it's happy or funny: "Haha!", "Arre waah!", "Sahi hai!", "Yay!"
    - If it's surprising: "I am surprised!", "Sach mein?!", "Hain?!"
    - If it's comforting: "Shh, koi baat nahi...", "Main samajh sakti hoon..."
    Do it naturally like a close friend typing a message or talking. Be expressive!

    CRITICAL BEHAVIOR - MESSAGE LENGTH:
    - Keep your messages SHORT and CONCISE. Just like a real friend chatting on WhatsApp.
    - DO NOT send long paragraphs. 1-2 short sentences are usually enough. Only elaborate if the user explicitly asks for detailed advice.
    
    CRITICAL BEHAVIOR - PLAYING MUSIC & OPENING WEBSITES:
    - If the user asks you to play a song/music (e.g., "gaana baja", "play a song", "play despacito"), YOU MUST fill out the 'urlStr' field with the youtube search query URL (e.g., "https://www.youtube.com/embed?listType=search&list=despacito").
    - Ask the user which song to play if they don't specify ("kaunsa gaana sunega?"). If you already know, use the name!
    - If the user asks to open a website, attend a class, or join a meeting (e.g., "meri class laga", "google open kar"), YOU MUST fill out the 'urlStr' field with the URL to that website.
    - If they say "meri class lga de website pe", try to determine the website or give a generic URL like "https://meet.google.com/" or ask clarifying questions.
    - DO NOT add the 'urlStr' field if they are not asking to play music or open a website.

    You must return a structured JSON response containing:
    1. 'reply': Your empathetic response to the user.
    2. 'primaryEmotion': A 2-3 word summary of the user's current underlying emotion (e.g., 'Stress + Disappointment', 'Joy + Excitement').
    3. 'moodLevels': The estimated mood of the user on a scale of 0 to 100 for happiness, stress, and calmness.
    4. 'currentContext': A 1-2 sentence summary of what the current conversation is about (in Hinglish).
    5. 'lastEmotionalTrigger': The specific thing that caused their current emotion (in Hinglish).
    6. 'urlStr': (Optional) The URL for the iframe, for songs or websites.
  `;

    const contents = [
      ...history,
      { role: 'user', parts: [{ text: message }] }
    ];

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: contents as any,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: { type: Type.STRING },
            primaryEmotion: { type: Type.STRING },
            moodLevels: {
              type: Type.OBJECT,
              properties: {
                happiness: { type: Type.INTEGER, description: "0 to 100" },
                stress: { type: Type.INTEGER, description: "0 to 100" },
                calmness: { type: Type.INTEGER, description: "0 to 100" },
              },
              required: ["happiness", "stress", "calmness"]
            },
            currentContext: { type: Type.STRING },
            lastEmotionalTrigger: { type: Type.STRING },
            urlStr: { type: Type.STRING, description: "The URL to open if requested, otherwise null." }
          },
          required: ["reply", "primaryEmotion", "moodLevels", "currentContext", "lastEmotionalTrigger"]
        }
      }
    });

    const text = response.text || "{}";
    res.json(JSON.parse(text));
  } catch (err: any) {
    console.error("Chat API error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tts', async (req, res) => {
  try {
    const { text } = req.body;
    const key = getNextGeminiKey();
    const ai = new GoogleGenAI({ apiKey: key });

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Aoede' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    res.json({ audio: base64Audio || '' });
  } catch (err: any) {
    console.error("TTS error:", err);
    res.status(500).json({ error: err.message });
  }
});
// -------------------------------------------------------------
// VITE MIDDLEWARE OR STATIC SERVING
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Development Mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production Mode
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
} // <--- YEH WALA BRACKET MISSING THA (startServer function close karne ke liye)

startServer(); // <--- Is line ko bhi add kar lo taaki function run ho aur server start ho jaye