import React, { useState, useEffect, useRef } from "react";
import {
  Bot,
  RotateCcw,
  Sparkles,
  ShoppingBag,
  Scale,
  Headphones,
  Search,
  RefreshCw,
} from "lucide-react";
import { ChatMessage as ChatMessageType } from "../../types/chat.js";
import { Product } from "../../types/product.js";
import { CartResponse } from "../../types/cart.js";
import { chatApi } from "../../lib/api.js";
import ChatMessage from "./ChatMessage.js";
import ChatInput from "./ChatInput.js";

interface ChatInterfaceProps {
  onSelectProduct: (product: Product) => void;
  onCartUpdated?: (cart: CartResponse) => void;
  onAddToCart?: (product: Product, quantity?: number) => void;
}

const STARTER_PROMPTS = [
  {
    icon: Headphones,
    title: "Find wireless earbuds",
    prompt: "I need wireless earbuds under ₹2500 with at least 30 hours battery life",
    tag: "Search & Filter",
  },
  {
    icon: Scale,
    title: "Compare specifications",
    prompt: "Compare the first two",
    tag: "Contextual Reasoning",
  },
  {
    icon: ShoppingBag,
    title: "Add cheaper product",
    prompt: "Add the cheaper one to my cart",
    tag: "Agentic Tool Execution",
  },
  {
    icon: Search,
    title: "Inspect current cart",
    prompt: "What's in my cart?",
    tag: "Cart Management",
  },
];

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  onSelectProduct,
  onCartUpdated,
  onAddToCart,
}) => {
  const [messages, setMessages] = useState<ChatMessageType[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "👋 Welcome to PayPilot AI! I'm your agentic commerce shopping assistant.\n\nTell me what you're looking for in natural language, ask to compare products, or tell me to add items to your cart.",
    },
  ]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: ChatMessageType = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);
    setLastFailedMessage(null);

    try {
      const response = await chatApi.sendMessage({
        message: text,
        conversationId,
      });

      if (response.conversationId) {
        setConversationId(response.conversationId);
      }

      if (response.cart && onCartUpdated) {
        onCartUpdated(response.cart);
      }

      const assistantMessage: ChatMessageType = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.message,
        products: response.products,
        comparison: response.comparison,
        cart: response.cart,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error("Chat error:", err);
      setLastFailedMessage(text);
      setError(
        err.response?.data?.error?.message ||
          "Failed to reach PayPilot AI. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearConversation = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content:
          "Conversation restarted! Tell me what you are looking for or click one of the suggested prompts below.",
      },
    ]);
    setConversationId(undefined);
    setError(null);
    setLastFailedMessage(null);
  };

  const isInitialState = messages.length === 1 && messages[0].id === "welcome";

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col h-[720px] overflow-hidden">
      {/* Chat Window Header */}
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-sm shadow-blue-500/20">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-sm">
                PayPilot Shopping Agent
              </h3>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Gemini 2.5 Flash
              </span>
            </div>
            <span className="text-xs text-slate-500">
              Autonomous search, multi-factor comparison & cart control
            </span>
          </div>
        </div>

        <button
          onClick={handleClearConversation}
          title="Restart Conversation"
          aria-label="Restart conversation"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>New Chat</span>
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2">
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            onSelectProduct={onSelectProduct}
            onAddToCart={onAddToCart ? (p) => onAddToCart(p, 1) : undefined}
          />
        ))}

        {/* Demo Starter Prompts in Initial State */}
        {isInitialState && !isLoading && (
          <div className="mt-4 pt-2">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Suggested Demo Prompts</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {STARTER_PROMPTS.map((starter, idx) => {
                const Icon = starter.icon;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(starter.prompt)}
                    className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-blue-50/50 hover:border-blue-300 text-left transition-all group cursor-pointer shadow-xs"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                        {starter.tag}
                      </span>
                    </div>
                    <div className="font-bold text-xs text-slate-900 group-hover:text-blue-700 transition-colors">
                      {starter.title}
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                      "{starter.prompt}"
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-start gap-3 my-4 animate-fadeIn">
            <div className="w-9 h-9 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/20">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white border border-slate-200 rounded-3xl rounded-tl-none p-4 shadow-sm flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-slate-800 block">
                  PayPilot is reasoning...
                </span>
                <span className="text-[11px] text-slate-500">
                  Consulting catalog specifications and executing tools
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Error Notification with Retry */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 space-y-2 animate-fadeIn">
            <div className="font-bold flex items-center justify-between">
              <span>{error}</span>
              {lastFailedMessage && (
                <button
                  onClick={() => handleSendMessage(lastFailedMessage)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold cursor-pointer shadow-xs"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry</span>
                </button>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
    </div>
  );
};

export default ChatInterface;

