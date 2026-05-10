import { GoogleGenAI } from "@google/genai";

export type ApiProvider = 'GEMINI' | 'GROQ' | 'JULES';

class ApiLayer {
  private keys: Record<ApiProvider, string[]> = {
    GEMINI: [],
    GROQ: [],
    JULES: []
  };

  private currentIndices: Record<ApiProvider, number> = {
    GEMINI: 0,
    GROQ: 0,
    JULES: 0
  };

  constructor() {
    this.loadKeysFromEnv();
  }

  // Load from environment variables
  private loadKeysFromEnv() {
    // Load Gemini Keys
    const geminiKeys: string[] = [];
    if (process.env.GEMINI_API_KEY) {
      geminiKeys.push(process.env.GEMINI_API_KEY);
    }
    for (let i = 1; i <= 9; i++) {
      const k = import.meta.env[`VITE_GEMINI_KEY_${i}`];
      if (k) geminiKeys.push(k);
    }
    
    // Load Groq Keys
    const groqKeys: string[] = [];
    for (let i = 1; i <= 4; i++) {
      const k = import.meta.env[`VITE_GROQ_KEY_${i}`];
      if (k) groqKeys.push(k);
    }

    // Load Jules Keys
    const julesKeys: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const k = import.meta.env[`VITE_JULES_KEY_${i}`];
      if (k) julesKeys.push(k);
    }

    this.keys.GEMINI = [...new Set(geminiKeys)]; // remove duplicates
    this.keys.GROQ = [...new Set(groqKeys)];
    this.keys.JULES = [...new Set(julesKeys)];
  }

  public getKeys(provider: ApiProvider): string[] {
    return this.keys[provider] || [];
  }

  // Get the next key using Round-Robin load balancing
  public getNextKey(provider: ApiProvider): string {
    const providerKeys = this.keys[provider];
    
    if (!providerKeys || providerKeys.length === 0) {
      if (provider === 'GEMINI' && process.env.GEMINI_API_KEY) {
        return process.env.GEMINI_API_KEY;
      }
      throw new Error(`No keys available for provider: ${provider}`);
    }

    const key = providerKeys[this.currentIndices[provider]];
    // Advance index
    this.currentIndices[provider] = (this.currentIndices[provider] + 1) % providerKeys.length;
    return key;
  }

  // Retrieve a fresh instance of the SDK for the next provider
  public getGeminiClient(): GoogleGenAI {
    const key = this.getNextKey('GEMINI');
    return new GoogleGenAI({ apiKey: key });
  }

  // Placeholder for Groq Client initialization
  public getGroqClient() {
    const key = this.getNextKey('GROQ');
    return { apiKey: key, provider: 'GROQ' };
  }

  // Placeholder for Jules Client initialization
  public getJulesClient() {
    const key = this.getNextKey('JULES');
    return { apiKey: key, provider: 'JULES' };
  }

  // Execute a request with automatic failover/rotation to the next key if it fails.
  public async executeWithRotation<T>(
    provider: ApiProvider, 
    action: (client: any) => Promise<T>
  ): Promise<T> {
    let lastError: any;
    const providerKeys = this.keys[provider];
    // Retry up to the number of keys we have, or at least once if using default env key
    const maxRetries = Math.max(1, providerKeys?.length || 1);

    for (let i = 0; i < maxRetries; i++) {
        let currentKeyIndex = this.currentIndices[provider];
        try {
            let client;
            if (provider === 'GEMINI') client = this.getGeminiClient();
            else if (provider === 'GROQ') client = this.getGroqClient();
            else if (provider === 'JULES') client = this.getJulesClient();

            return await action(client);
        } catch (error: any) {
            console.warn(`[ApiLayer] Query failed for ${provider} (Key Index: ${currentKeyIndex}). Rotating to next key. Error:`, error?.message || error);
            lastError = error;
            // The getNextKey inside get*Client already advanced the index, so the next loop iteration will use a fresh key.
        }
    }
    
    console.error(`[ApiLayer] All keys for ${provider} exhausted. Request failed.`);
    throw lastError;
  }
}

export const apiLayer = new ApiLayer();
