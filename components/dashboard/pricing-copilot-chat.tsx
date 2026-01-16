'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  MessageSquare,
  Send,
  Sparkles,
  Bot,
  User,
  Lightbulb,
  RefreshCw,
} from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  suggestions?: string[];
}

const STARTER_QUESTIONS = [
  "What's my pricing health score?",
  "Which plan should I raise prices on?",
  "How do discounts affect my churn?",
  "Design a pricing experiment for me",
  "What's my biggest pricing opportunity?",
  "Summarize my pricing strategy",
];

export function PricingCopilotChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (question: string) => {
    if (!question.trim()) return;

    const userMessage: Message = { role: 'user', content: question };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/pricing/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          history: messages,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.content,
        suggestions: data.suggestions,
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'I apologize, but I encountered an error. Please try again.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage(suggestion);
  };

  const resetChat = () => {
    setMessages([]);
  };

  // Collapsed state - floating button
  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-2xl shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-105 transition-all duration-300 group"
      >
        <div className="relative">
          <Bot className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
        </div>
        <span className="font-medium">Ask Gertrude</span>
        <Sparkles className="w-4 h-4 opacity-75 group-hover:opacity-100 transition-opacity" />
      </button>
    );
  }

  return (
    <Card className="fixed bottom-6 right-6 z-50 w-[420px] h-[600px] flex flex-col bg-zinc-900/95 border-zinc-700 shadow-2xl shadow-purple-500/10 backdrop-blur-xl animate-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <CardHeader className="pb-3 border-b border-zinc-800 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-base">
            <div className="relative">
              <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30">
                <Bot className="w-5 h-5 text-purple-400" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-zinc-900" />
            </div>
            <div>
              <span className="text-white">Gertrude</span>
              <p className="text-xs text-zinc-500 font-normal">Your AI pricing advisor</p>
            </div>
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={resetChat}
              className="h-8 w-8 p-0 text-zinc-400 hover:text-white"
              title="New conversation"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(false)}
              className="h-8 w-8 p-0 text-zinc-400 hover:text-white"
            >
              ✕
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Messages */}
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 mb-4">
              <Sparkles className="w-8 h-8 text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Hi, I&apos;m Gertrude 👋
            </h3>
            <p className="text-sm text-zinc-400 mb-6">
              Ask me anything about pricing — I&apos;ll analyze your data, suggest optimizations, and design experiments.
            </p>
            <div className="grid grid-cols-2 gap-2 w-full">
              {STARTER_QUESTIONS.slice(0, 4).map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  className="text-left text-xs p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-600 hover:text-white transition-all duration-200"
                >
                  <Lightbulb className="w-3 h-3 text-amber-400 mb-1" />
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-purple-400" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-purple-600 text-white rounded-br-md'
                      : 'bg-zinc-800 text-zinc-100 rounded-bl-md'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                  
                  {/* Follow-up suggestions */}
                  {message.role === 'assistant' && message.suggestions && message.suggestions.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-zinc-700/50">
                      <p className="text-xs text-zinc-500 mb-2">Follow-up questions:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {message.suggestions.map((s, i) => (
                          <button
                            key={i}
                            onClick={() => handleSuggestionClick(s)}
                            className="text-xs px-2.5 py-1 rounded-full bg-zinc-700/50 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {message.role === 'user' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-zinc-700 flex items-center justify-center">
                    <User className="w-4 h-4 text-zinc-300" />
                  </div>
                )}
              </div>
            ))}
            
            {/* Loading indicator */}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-purple-400" />
                </div>
                <div className="bg-zinc-800 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Spinner className="w-4 h-4" />
                    <span className="text-sm">Gertrude is thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </CardContent>

      {/* Input */}
      <div className="flex-shrink-0 p-4 border-t border-zinc-800">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your pricing..."
            disabled={isLoading}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 disabled:opacity-50"
          />
          <Button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl px-4"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
        <p className="text-xs text-zinc-600 text-center mt-2">
          Gertrude is powered by GPT-4 · Your data stays private
        </p>
      </div>
    </Card>
  );
}

