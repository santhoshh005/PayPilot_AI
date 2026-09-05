import React from "react";
import { Bot, User, Scale, ShoppingBag, ArrowUpRight } from "lucide-react";
import { ChatMessage as ChatMessageType } from "../../types/chat.js";
import { Product } from "../../types/product.js";
import ProductRecommendationList from "./ProductRecommendationList.js";

interface ChatMessageProps {
  message: ChatMessageType;
  onSelectProduct: (product: Product) => void;
  onAddToCart?: (product: Product) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  onSelectProduct,
  onAddToCart,
}) => {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex items-start gap-3 my-4 ${
        isUser ? "flex-row-reverse" : "flex-row"
      } animate-fadeIn`}
    >
      {/* Avatar */}
      <div
        className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
          isUser
            ? "bg-slate-900 text-white"
            : "bg-blue-600 text-white shadow-blue-500/20"
        }`}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Bubble Content */}
      <div
        className={`max-w-[85%] sm:max-w-xl rounded-3xl p-4 sm:p-5 text-sm leading-relaxed shadow-sm ${
          isUser
            ? "bg-blue-600 text-white rounded-tr-none font-medium"
            : "bg-white text-slate-800 border border-slate-200 rounded-tl-none"
        }`}
      >
        {/* Text message */}
        <div className="whitespace-pre-wrap">{message.content}</div>

        {/* Side-by-side Comparison Section */}
        {message.comparison && message.comparison.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
              <Scale className="w-4 h-4 text-blue-600" />
              <span>Side-by-Side Comparison</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {message.comparison.map((prod) => (
                <div
                  key={prod.id}
                  className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 hover:border-blue-400 transition-all flex flex-col justify-between"
                >
                  <div
                    className="cursor-pointer"
                    onClick={() => onSelectProduct(prod)}
                  >
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wide block">
                      {prod.brand}
                    </span>
                    <h5 className="font-bold text-xs text-slate-900 truncate mt-0.5">
                      {prod.name}
                    </h5>
                    <div className="text-sm font-black text-slate-900 mt-1">
                      ₹{prod.price.toLocaleString("en-IN")}
                    </div>
                    <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                      <div>
                        ⭐ Rating:{" "}
                        <span className="font-semibold text-slate-900">
                          {prod.rating.toFixed(1)}/5
                        </span>
                      </div>
                      {prod.batteryHours !== undefined && (
                        <div>
                          🔋 Battery:{" "}
                          <span className="font-semibold text-slate-900">
                            {prod.batteryHours} Hours
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                    {onAddToCart && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddToCart(prod);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white font-bold text-[10px] transition-colors cursor-pointer border border-blue-200 hover:border-blue-600"
                        title={`Add ${prod.name} to cart`}
                      >
                        <ShoppingBag className="w-3 h-3" />
                        <span>Add to Cart</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onSelectProduct(prod)}
                      className="inline-flex items-center gap-0.5 font-semibold text-slate-600 hover:text-blue-600 cursor-pointer ml-auto"
                    >
                      <span>Details</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommended Products Carousel / Grid */}
        {message.products && message.products.length > 0 && (
          <ProductRecommendationList
            products={message.products}
            onSelectProduct={onSelectProduct}
            onAddToCart={onAddToCart}
          />
        )}
      </div>
    </div>
  );
};

export default ChatMessage;

