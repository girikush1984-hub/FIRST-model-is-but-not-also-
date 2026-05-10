import { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, doc, setDoc, updateDoc, getDoc, getDocs, onSnapshot, query, orderBy, serverTimestamp, Timestamp } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: string; // ISO string
  urlStr?: string;
}

export function useChatSession() {
  const [user, setUser] = useState<User | null>(null);
  const [sessionInfo, setSessionInfo] = useState<{ id: string } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (currUser) => {
      setUser(currUser);
      if (currUser) {
        // try to find latest session or create one
        loadOrCreateSession(currUser);
      } else {
        setMessages([{
          id: 'msg-1',
          text: 'Hlo mitr! Aaj kaisa feel kar raha hai?',
          sender: 'bot',
          timestamp: new Date().toISOString()
        }]);
        setSessionInfo(null);
        setLoading(false);
      }
    });
    return () => unsubAuth();
  }, []);

  const loadOrCreateSession = async (user: User) => {
    try {
      const q = query(collection(db, 'user_conversations'), orderBy('updatedAt', 'desc'));
      const qSnap = await getDocs(q);
      
      let sessionId = null;
      if (!qSnap.empty) {
        // Assuming we just use the latest for now
        sessionId = qSnap.docs[0].id;
      } else {
        // create new
        sessionId = `sess_${Date.now()}_${Math.floor(Math.random()*1000)}`;
        await setDoc(doc(db, 'user_conversations', sessionId), {
          userId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      setSessionInfo({ id: sessionId });

      // Subscribe to messages
      const msgsQuery = query(collection(db, 'user_conversations', sessionId, 'messages'), orderBy('timestamp', 'asc'));
      onSnapshot(msgsQuery, (snapshot) => {
        const msgs = snapshot.docs.map(d => {
           let ts = new Date().toISOString();
           const data = d.data();
           if (data.timestamp instanceof Timestamp) {
               ts = data.timestamp.toDate().toISOString();
           }
           return {
               id: d.id,
               text: data.text,
               sender: data.sender,
               timestamp: ts,
               urlStr: data.urlStr
           };
        });
        setMessages(msgs);
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `user_conversations/${sessionId}/messages`);
      });

    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'user_conversations');
    }
  }

  const sendMessage = async (text: string, sender: 'user'|'bot', urlStr?: string) => {
    const timestamp = new Date().toISOString();
    
    if (!user || !sessionInfo) {
      // Local only
      setMessages(prev => [...prev, {
        id: `local_${Date.now()}`,
        text,
        sender,
        timestamp,
        urlStr
      }]);
      return;
    }

    try {
      const msgId = `msg_${Date.now()}_${Math.floor(Math.random()*10000)}`;
      const payload: any = {
        text,
        sender,
        timestamp: serverTimestamp()
      };
      if (urlStr) {
        payload.urlStr = urlStr;
      }
      
      await setDoc(doc(db, 'user_conversations', sessionInfo.id, 'messages', msgId), payload);
      await updateDoc(doc(db, 'user_conversations', sessionInfo.id), {
        updatedAt: serverTimestamp()
      });
    } catch(err) {
      handleFirestoreError(err, OperationType.CREATE, `user_conversations/${sessionInfo.id}/messages`);
    }
  }
  
  return {
    user,
    loading,
    messages,
    sendMessage
  };
}
