export interface ChatState {
  history: { role: 'user' | 'model', parts: { text: string }[] }[];
  contextSnapshot: {
    currentContext: string;
    lastEmotionalTrigger: string;
  };
  moodLevels: {
    happiness: number;
    stress: number;
    calmness: number;
  };
  analyzingEmotion: string;
}

export interface EmpathyResponse {
  reply: string;
  primaryEmotion: string;
  moodLevels: {
    happiness: number;
    stress: number;
    calmness: number;
  };
  currentContext: string;
  lastEmotionalTrigger: string;
  urlStr?: string;
}

export async function generateEmpatheticResponse(
  message: string, 
  history: ChatState['history']
): Promise<EmpathyResponse> {
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history })
    });
    if (!res.ok) throw new Error('API Error');
    return await res.json();
  } catch (e) {
    console.error("Failed to parse response:", e);
    return {
      reply: "Main samajh nahi paayi, kya aap fir se bata sakte hain?",
      primaryEmotion: "Confused",
      moodLevels: { happiness: 50, stress: 50, calmness: 50 },
      currentContext: "Trying to understand.",
      lastEmotionalTrigger: "Miscommunication."
    };
  }
}

export async function generateSpeech(text: string): Promise<string> {
  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (!res.ok) throw new Error('API Error');
    const data = await res.json();
    return data.audio || '';
  } catch (err) {
    console.error("TTS failed", err);
    return '';
  }
}

export async function playBase64Audio(base64Audio: string) {
  if (!base64Audio) return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const audioContext = new AudioContextClass();
    const binaryString = window.atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    const numChannels = 1;
    const sampleRate = 24000;
    
    const float32Data = new Float32Array(bytes.length / 2);
    const dataView = new DataView(bytes.buffer);
    
    for (let i = 0; i < float32Data.length; i++) {
        float32Data[i] = dataView.getInt16(i * 2, true) / 32768.0;
    }
    
    const audioBuffer = audioContext.createBuffer(numChannels, float32Data.length, sampleRate);
    audioBuffer.getChannelData(0).set(float32Data);
    
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.start(0);
  } catch (err) {
    console.error("Audio playback error:", err);
  }
}

