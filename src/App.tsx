/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { generateEmpatheticResponse, ChatState, generateSpeech, playBase64Audio } from './services/aiService';
import { useChatSession } from './hooks/useChatSession';
import { auth } from './firebase';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: string;
}

export default function App() {
  const [inputText, setInputText] = useState('');
  const { user, messages, loading, sendMessage } = useChatSession();

  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatState['history']>([]);
  
  const [showMemory, setShowMemory] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [appState, setAppState] = useState({
    analyzingEmotion: 'Waiting...',
    moodLevels: { happiness: 50, stress: 10, calmness: 80 },
    contextSnapshot: {
      currentContext: 'Starting a new conversation.',
      lastEmotionalTrigger: 'None yet.'
    }
  });

  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Sync historical messages to chatHistory for AI context
  useEffect(() => {
    if (messages.length > 0 && chatHistory.length === 0) {
      const historyArr: ChatState['history'] = messages.map(m => ({
        role: m.sender === 'bot' ? 'model' : 'user',
        parts: [{ text: m.text }]
      }));
      setChatHistory(historyArr);
    }
  }, [messages, chatHistory.length]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Login failed", err);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userText = inputText.trim();
    setInputText('');
    setIsLoading(true);

    await sendMessage(userText, 'user');

    try {
      const response = await generateEmpatheticResponse(userText, chatHistory);
      
      await sendMessage(response.reply, 'bot', response.urlStr);

      setChatHistory(prev => [
        ...prev, 
        { role: 'user', parts: [{ text: userText }] },
        { role: 'model', parts: [{ text: response.reply }] }
      ]);

      setAppState({
        analyzingEmotion: response.primaryEmotion,
        moodLevels: response.moodLevels,
        contextSnapshot: {
          currentContext: response.currentContext,
          lastEmotionalTrigger: response.lastEmotionalTrigger
        }
      });
      
      if (isVoiceEnabled) {
        generateSpeech(response.reply).then((base64Audio) => {
          if (base64Audio) {
            playBase64Audio(base64Audio);
          }
        });
      }
    } catch (error) {
      console.error(error);
      const errorMsg = 'Maaf karna, abhi main theek se connect nahi kar paa rahi hoon. Kya aap dobara bata sakte hain?';
      await sendMessage(errorMsg, 'bot');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="w-full h-screen bg-[#020205] text-white font-sans overflow-hidden flex flex-col">
      {/* Header Navigation */}
      <nav className="h-16 flex items-center justify-between px-8 bg-black/40 backdrop-blur-md border-b border-cyan-500/20 shrink-0 shadow-[0_4px_30px_rgba(0,255,255,0.05)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.5)] border border-cyan-400/30">
            <img src="https://nekos.best/api/v2/neko/562912a2-50a9-4f87-a7fa-8802b8ef7579.png" alt="Bestie" className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold tracking-wide text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]">Bestie</span>
            <span className="text-[10px] uppercase text-blue-400 tracking-widest leading-none">Aapka Jazbaati Saathi</span>
          </div>
        </div>
        <div className="flex items-center gap-3 md:gap-6">
          {user ? (
            <button 
              onClick={() => signOut(auth)}
              className="px-3 py-1.5 rounded-full border border-cyan-400/20 text-xs font-medium bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-200 transition-colors shadow-[0_0_10px_rgba(34,211,238,0.1)]"
            >
              Sign Out
            </button>
          ) : (
            <button 
              onClick={handleLogin}
              className="px-3 py-1.5 rounded-full border border-pink-400/20 text-xs font-medium bg-pink-500/10 hover:bg-pink-500/20 text-pink-200 transition-colors shadow-[0_0_10px_rgba(236,72,153,0.1)] flex gap-2 items-center"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/></svg>
              Login to Save Chats
            </button>
          )}
          <button 
            onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors shadow-[0_0_10px_rgba(34,211,238,0.1)] ${
              isVoiceEnabled 
              ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/30 shadow-[0_0_15px_rgba(34,211,238,0.3)]' 
              : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
            }`}
          >
            {isVoiceEnabled ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/></svg>
            ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z m11.414-7l-4 4m0-4l4 4"/></svg>
            )}
            <span className="hidden sm:inline">{isVoiceEnabled ? 'Voice On' : 'Voice Off'}</span>
          </button>
          
          <button 
            onClick={() => setShowMemory(true)}
            className="flex items-center gap-2 bg-blue-500/10 hover:bg-blue-500/20 transition-colors px-3 sm:px-4 py-1.5 rounded-full border border-blue-400/30 text-xs font-medium text-cyan-100 hover:shadow-[0_0_15px_rgba(59,130,246,0.4)]"
          >
            <svg className="w-4 h-4 text-cyan-400 drop-shadow-[0_0_3px_rgba(34,211,238,0.8)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/></svg>
            <span className="hidden sm:inline">Memory</span>
          </button>
          
          <div className="hidden lg:flex items-center gap-2 bg-blue-900/40 px-3 py-1.5 rounded-full border border-blue-400/30 shadow-[0_0_10px_rgba(59,130,246,0.3)]">
            <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_5px_rgba(34,211,238,1)] animate-pulse"></div>
            <span className="text-xs font-medium text-cyan-100">Deep Connection Active</span>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex overflow-hidden p-6 max-w-5xl mx-auto w-full relative">
        {/* Memory Overlay */}
        {showMemory && (
          <div className="absolute inset-x-6 top-6 z-50 bg-[#020617]/90 backdrop-blur-3xl border border-cyan-500/30 rounded-3xl p-6 shadow-[0_10px_50px_rgba(0,255,255,0.15)] flex flex-col gap-6 md:flex-row">
            <button 
              onClick={() => setShowMemory(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-cyan-900/30 flex items-center justify-center hover:bg-cyan-800/50 transition-colors border border-cyan-500/30 text-cyan-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
            <div className="flex-1 flex flex-col gap-4">
              <h3 className="text-sm font-semibold uppercase text-cyan-400/80 tracking-wider">Aapki Mood History</h3>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-blue-200 w-20">Happiness</span>
                  <div className="flex-1 h-1.5 bg-blue-900/50 rounded-full overflow-hidden drop-shadow-[0_0_5px_rgba(0,0,0,1)]">
                    <div className="h-full bg-cyan-400 rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(34,211,238,0.8)]" style={{ width: `${appState.moodLevels.happiness}%` }}></div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-blue-200 w-20">Stress Level</span>
                  <div className="flex-1 h-1.5 bg-blue-900/50 rounded-full overflow-hidden drop-shadow-[0_0_5px_rgba(0,0,0,1)]">
                    <div className="h-full bg-blue-500 rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(59,130,246,0.8)]" style={{ width: `${appState.moodLevels.stress}%` }}></div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-blue-200 w-20">Calmness</span>
                  <div className="flex-1 h-1.5 bg-blue-900/50 rounded-full overflow-hidden drop-shadow-[0_0_5px_rgba(0,0,0,1)]">
                    <div className="h-full bg-teal-400 rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(45,212,191,0.8)]" style={{ width: `${appState.moodLevels.calmness}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 flex flex-col gap-4 border-t border-cyan-500/20 pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-6">
              <h3 className="text-sm font-semibold uppercase text-cyan-400/80 tracking-wider">Context Snapshot</h3>
              <div className="space-y-4">
                <div className="p-3 bg-blue-900/20 rounded-2xl border border-blue-500/30 shadow-[inset_0_0_10px_rgba(59,130,246,0.1)]">
                  <p className="text-[11px] text-blue-300 mb-1 font-bold">CURRENT CONTEXT</p>
                  <p className="text-xs leading-relaxed text-blue-50">{appState.contextSnapshot.currentContext}</p>
                </div>
                <div className="p-3 bg-cyan-900/20 rounded-2xl border border-cyan-500/30 shadow-[inset_0_0_10px_rgba(34,211,238,0.1)]">
                  <p className="text-[11px] text-cyan-300 mb-1 font-bold">LAST EMOTIONAL TRIGGER</p>
                  <p className="text-xs text-cyan-50">{appState.contextSnapshot.lastEmotionalTrigger}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Chat Area */}
        <section className="flex-1 flex flex-col bg-[#050b1a]/80 backdrop-blur-2xl border border-cyan-500/20 rounded-[40px] overflow-hidden relative shadow-[0_0_40px_rgba(0,150,255,0.05)]">
          <div ref={chatContainerRef} className="flex-1 p-4 md:p-8 flex flex-col gap-6 overflow-y-auto mt-4 px-4 pb-20">
            {messages.map((msg) => (
              msg.sender === 'user' ? (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[85%] md:max-w-[70%] bg-blue-900/30 border border-blue-400/30 p-4 rounded-t-[24px] rounded-bl-[24px] shadow-[0_4px_20px_rgba(59,130,246,0.15)]">
                    <p className="text-sm leading-relaxed text-blue-50">{msg.text}</p>
                    <span className="text-[10px] text-blue-300/60 block mt-2 text-right">{msg.timestamp}</span>
                  </div>
                </div>
              ) : (
                <div key={msg.id} className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-cyan-900/50 flex items-center justify-center shrink-0 border border-cyan-400/40 shadow-[0_0_15px_rgba(34,211,238,0.2)] overflow-hidden">
                    <img src="https://nekos.best/api/v2/neko/562912a2-50a9-4f87-a7fa-8802b8ef7579.png" alt="Bestie" className="w-full h-full object-cover" />
                  </div>
                  <div className="max-w-[85%] md:max-w-[70%] bg-[#0a152e]/80 border border-cyan-500/20 p-4 rounded-t-[24px] rounded-br-[24px] shadow-[0_4px_20px_rgba(34,211,238,0.1)] backdrop-blur-sm">
                    <p className="text-sm leading-relaxed text-cyan-50">{msg.text}</p>
                    {msg.urlStr && (
                      <div className="mt-4 flex flex-col gap-2">
                        <div className="rounded-xl overflow-hidden border border-cyan-500/30">
                          <iframe 
                            width="100%" 
                            height="400" 
                            src={msg.urlStr} 
                            frameBorder="0" 
                            allowFullScreen
                            className="w-full bg-black/50"
                          ></iframe>
                        </div>
                        <a href={msg.urlStr} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-400 hover:text-cyan-200 flex items-center gap-1 w-fit ml-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                          Open original link
                        </a>
                      </div>
                    )}
                    <span className="text-[10px] text-cyan-300/50 block mt-2">{msg.timestamp} &bull; <span className="text-cyan-400">Empathy Engine 2.0</span></span>
                  </div>
                </div>
              )
            ))}
            
            {isLoading && (
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-cyan-900/50 flex items-center justify-center shrink-0 border border-cyan-400/40 shadow-[0_0_15px_rgba(34,211,238,0.2)] overflow-hidden">
                  <img src="https://nekos.best/api/v2/neko/562912a2-50a9-4f87-a7fa-8802b8ef7579.png" alt="Bestie" className="w-full h-full object-cover" />
                </div>
                <div className="max-w-[85%] md:max-w-[70%] bg-[#0a152e]/80 border border-cyan-500/20 p-4 rounded-t-[24px] rounded-br-[24px] shadow-[0_4px_20px_rgba(34,211,238,0.1)] backdrop-blur-sm flex items-center gap-2">
                  <div className="w-2 h-2 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,1)] rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,1)] rounded-full animate-pulse delay-75"></div>
                  <div className="w-2 h-2 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,1)] rounded-full animate-pulse delay-150"></div>
                </div>
              </div>
            )}
          </div>

          {/* Feeling Status Bubble */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-max bg-blue-950/80 backdrop-blur-md px-4 py-1.5 rounded-full border border-cyan-500/30 shadow-[0_0_20px_rgba(34,211,238,0.2)] flex items-center gap-3 z-10">
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full shadow-[0_0_5px_rgba(34,211,238,1)] animate-pulse"></div>
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse delay-75"></div>
              <div className="w-1.5 h-1.5 bg-blue-700 rounded-full animate-pulse delay-150"></div>
            </div>
            <span className="text-[11px] font-medium tracking-tight text-cyan-200">ANALYZING: <span className="text-cyan-400 uppercase italic font-bold drop-shadow-[0_0_3px_rgba(34,211,238,0.5)]">{appState.analyzingEmotion}</span></span>
          </div>

          {/* Input Bar */}
          <div className="flex-col md:flex-row p-4 md:p-6 bg-[#020510]/95 border-t border-cyan-500/20 flex items-center md:gap-4 shrink-0 gap-3">
            <div className="flex gap-2 mr-auto md:mr-0 drop-shadow-md">
              <button onClick={() => setInputText(prev => prev + '😊')} className="w-8 h-8 rounded-full bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-yellow-500 flex items-center justify-center text-lg transition-all hover:scale-110 hover:shadow-[0_0_10px_rgba(250,204,21,0.3)]">😊</button>
              <button onClick={() => setInputText(prev => prev + '😔')} className="w-8 h-8 rounded-full bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-blue-400 flex items-center justify-center text-lg transition-all hover:scale-110 hover:shadow-[0_0_10px_rgba(96,165,250,0.3)]">😔</button>
              <button onClick={() => setInputText(prev => prev + '😠')} className="w-8 h-8 rounded-full bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-red-500 flex items-center justify-center text-lg transition-all hover:scale-110 hover:shadow-[0_0_10px_rgba(239,68,68,0.3)]">😠</button>
              <button onClick={() => setInputText(prev => prev + '😴')} className="w-8 h-8 rounded-full bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-purple-400 flex items-center justify-center text-lg transition-all hover:scale-110 hover:shadow-[0_0_10px_rgba(192,132,252,0.3)]">😴</button>
            </div>
            <div className="flex-1 w-full bg-[#0a152e] rounded-2xl border border-cyan-500/30 min-h-[48px] flex items-center px-4 overflow-hidden shadow-[inset_0_0_10px_rgba(34,211,238,0.05)] focus-within:border-cyan-400/60 focus-within:shadow-[0_0_15px_rgba(34,211,238,0.2)] transition-all">
              <input 
                type="text" 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Apne dil ki baat likhein..." 
                className="bg-transparent border-none outline-none flex-1 text-sm text-cyan-50 placeholder-cyan-500/50 truncate" 
                disabled={isLoading}
              />
              <div className="flex items-center gap-3 ml-2 shrink-0">
                <button 
                  onClick={handleSendMessage}
                  disabled={!inputText.trim() || isLoading}
                  className="w-8 h-8 shrink-0 rounded-lg bg-cyan-600 hover:bg-cyan-500 transition-colors flex items-center justify-center text-white pb-[2px] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_10px_rgba(8,145,178,0.6)]"
                >
                  <svg className="w-4 h-4 ml-1" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/></svg>
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Bottom Status Footer */}
      <footer className="h-8 px-8 bg-[#01030B] border-t border-cyan-900/40 flex items-center justify-between text-[10px] text-cyan-600 tracking-wider shrink-0 hidden sm:flex font-mono">
        <div className="flex gap-4">
          <span className="flex items-center gap-1"><div className="w-1 h-1 bg-cyan-500 rounded-full animate-pulse shadow-[0_0_5px_rgba(34,211,238,1)]"></div> SESSION_ID: BST-{Math.floor(Math.random() * 10000).toString().padStart(4, '0')}</span>
          <span>PING: {isLoading ? 'SYNC...' : Math.floor(Math.random() * 50 + 10) + 'ms'}</span>
        </div>
        <div className="flex gap-4">
          <span>ENCRYPTION: AES-256</span>
          <span className="text-cyan-400 drop-shadow-[0_0_2px_rgba(34,211,238,0.8)]">NEON_EMPATHY_CORE_ONLINE</span>
        </div>
      </footer>
    </div>
  );
}


