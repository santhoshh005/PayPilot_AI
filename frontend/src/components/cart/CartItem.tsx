import React from "react";
import { Plus, Minus, Trash2 } from "lucide-react";
import { CartItem as CartItemType } from "../../types/cart.js";

const DEFAULT_FALLBACK_IMAGE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'><rect width='18' height='18' x='3' y='3' rx='3'/><path d='m3 16 5-5c.9-.9 2.1-.9 3 0l7 7'/><path d='m14 14 1-1c.9-.9 2.1-.9 3 0l3 3'/><circle cx='9' cy='9' r='2'/></svg>";

interface CartItemProps {
  item: CartItemType;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
  isLoading?: boolean;
}

export const CartItem: React.FC<CartItemProps> = ({
  item,
  onUpdateQuantity,
  onRemove,
  isLoading = false,
}) => {
  const handleDecrement = () => {
    if (item.quantity > 1) {
      onUpdateQuantity(item.productId, item.quantity - 1);
    } else {
      onRemove(item.productId);
    }
  };

  const handleIncrement = () => {
    if (item.quantity < 10) {
      onUpdateQuantity(item.productId, item.quantity + 1);
    }
  };

  return (
    <div className="flex items-center gap-4 py-4 border-b border-slate-100 last:border-0 group">
      {/* Product Thumbnail */}
      <img
        src={item.imageUrl}
        alt={item.name}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src = DEFAULT_FALLBACK_IMAGE;
        }}
        className="w-16 h-16 rounded-2xl object-cover bg-slate-100 border border-slate-200 shrink-0"
      />

      {/* Details */}
      <div className="flex-1 min-w-0">
        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block">
          {item.brand}
        </span>
        <h4 className="text-sm font-bold text-slate-900 truncate">
          {item.name}
        </h4>
        <div className="text-xs text-slate-500 mt-0.5">
          ₹{item.price.toLocaleString("en-IN")} each
        </div>

        {/* Mobile Stepper */}
        <div className="flex sm:hidden items-center justify-between mt-2">
          <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50">
            <button
              onClick={handleDecrement}
              disabled={isLoading}
              aria-label={`Decrease quantity of ${item.name}`}
              className="p-1 hover:bg-slate-200 rounded-l-xl text-slate-600 disabled:opacity-40 cursor-pointer"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="px-2 text-xs font-bold text-slate-900">
              {item.quantity}
            </span>
            <button
              onClick={handleIncrement}
              disabled={isLoading || item.quantity >= 10}
              aria-label={`Increase quantity of ${item.name}`}
              className="p-1 hover:bg-slate-200 rounded-r-xl text-slate-600 disabled:opacity-40 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
          <span className="text-xs font-black text-slate-900">
            ₹{item.lineTotal.toLocaleString("en-IN")}
          </span>
        </div>
      </div>

      {/* Desktop Stepper & Line Total */}
      <div className="hidden sm:flex items-center gap-6">
        <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 shadow-xs">
          <button
            onClick={handleDecrement}
            disabled={isLoading}
            aria-label={item.quantity === 1 ? `Remove ${item.name}` : `Decrease quantity of ${item.name}`}
            className="p-1.5 hover:bg-slate-200 rounded-l-xl text-slate-600 disabled:opacity-40 transition-colors cursor-pointer"
            title={item.quantity === 1 ? "Remove item" : "Decrease quantity"}
          >
            {item.quantity === 1 ? (
              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
            ) : (
              <Minus className="w-3.5 h-3.5" />
            )}
          </button>
          <span className="px-3 text-xs font-bold text-slate-900 min-w-[2rem] text-center">
            {item.quantity}
          </span>
          <button
            onClick={handleIncrement}
            disabled={isLoading || item.quantity >= 10}
            aria-label={`Increase quantity of ${item.name}`}
            className="p-1.5 hover:bg-slate-200 rounded-r-xl text-slate-600 disabled:opacity-40 transition-colors cursor-pointer"
            title="Increase quantity"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="text-right min-w-[5rem]">
          <span className="text-sm font-black text-slate-900 block">
            ₹{item.lineTotal.toLocaleString("en-IN")}
          </span>
        </div>

        <button
          onClick={() => onRemove(item.productId)}
          disabled={isLoading}
          aria-label={`Remove ${item.name} from cart`}
          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
          title="Remove from cart"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default CartItem;

