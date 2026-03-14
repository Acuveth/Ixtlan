import { createContext, useContext, useState, type ReactNode } from 'react';
import type { ChatMessage } from '../types';

interface ChatState {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  chatInput: string;
  setChatInput: (v: string) => void;
  clearChat: () => void;
}

const ChatContext = createContext<ChatState | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');

  const clearChat = () => {
    setMessages([]);
    setChatInput('');
  };

  return (
    <ChatContext.Provider value={{ messages, setMessages, chatInput, setChatInput, clearChat }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat(): ChatState {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
