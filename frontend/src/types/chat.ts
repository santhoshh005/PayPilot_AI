import { Product } from "./product.js";
import { CartResponse } from "./cart.js";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  products?: Product[];
  comparison?: Product[];
  cart?: CartResponse;
  createdAt?: string;
}

export interface ChatApiResponse {
  message: string;
  conversationId: string;
  products?: Product[];
  comparison?: Product[];
  cart?: CartResponse;
  toolsExecuted?: string[];
}
