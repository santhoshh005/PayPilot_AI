import React, { useState, useEffect } from "react";
import {
  X,
  Star,
  CheckCircle2,
  XCircle,
  Battery,
  ShoppingBag,
  ShieldCheck,
  Zap,
  Plus,
  Minus,
  Check,
} from "lucide-react";
import { Product } from "../../types/product.js";

const DEFAULT_FALLBACK_IMAGE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='120' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'><rect width='18' height='18' x='3' y='3' rx='3'/><path d='m3 16 5-5c.9-.9 2.1-.9 3 0l7 7'/><path d='m14 14 1-1c.9-.9 2.1-.9 3 0l3 3'/><circle cx='9' cy='9' r='2'/></svg>";

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  onAddToCart?: (product: Product, quantity?: number) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  onAddToCart,
}) => {
  const [quantity, setQuantity] = useState(1);
  const [isAdded, setIsAdded] = useState(false);

  // Reset quantity when selected product changes
  useEffect(() => {
    setQuantity(1);
    setIsAdded(false);
  }, [product?.id]);

  // Keyboard Escape listener & body scroll lock
  useEffect(() => {
    if (!product) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [product, onClose]);

  if (!product) return null;

  const handleAddToCart = () => {
    if (onAddToCart && product.inStock) {
      onAddToCart(product, quantity);
      setIsAdded(true);
      setTimeout(() => setIsAdded(false), 2000);
    }
  };

  const lineTotal = product.price * quantity;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-modal-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close product details modal"
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200 shadow-sm flex items-center justify-center transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Content */}
        <div className="max-h-[85vh] overflow-y-auto">
          {/* Hero Image Section */}
          <div className="relative aspect-[16/9] bg-slate-100">
            <img
              src={product.imageUrl}
              alt={product.name}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = DEFAULT_FALLBACK_IMAGE;
              }}
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-4 left-4 flex gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/95 text-slate-800 border border-slate-200 shadow-sm">
                {product.category}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-600 text-white shadow-sm">
                {product.brand}
              </span>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {/* Header: Title & Rating & Stock */}
            <div>
              <div className="flex items-center justify-between gap-4 mb-2">
                <div className="flex items-center gap-1.5 text-amber-500 font-bold text-sm bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span>{product.rating.toFixed(1)} / 5.0 Rating</span>
                </div>

                <div>
                  {product.inStock ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      In Stock & Ready to Ship
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                      <XCircle className="w-3.5 h-3.5" />
                      Currently Out of Stock
                    </span>
                  )}
                </div>
              </div>

              <h2
                id="product-modal-title"
                className="text-2xl font-extrabold text-slate-900 tracking-tight"
              >
                {product.name}
              </h2>

              <div className="mt-3 flex items-baseline gap-3">
                <span className="text-3xl font-black text-slate-900 tracking-tight">
                  ₹{product.price.toLocaleString("en-IN")}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  Inclusive of all taxes
                </span>
              </div>
            </div>

            {/* Description */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Overview
              </h4>
              <p className="text-sm text-slate-700 leading-relaxed">
                {product.description}
              </p>
            </div>

            {/* Feature Highlights */}
            {product.features && product.features.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-blue-600" />
                  <span>Key Highlights</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {product.features.map((feature, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-800"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Specifications Grid */}
            {product.specs && Object.keys(product.specs).length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>Technical Specifications</span>
                </h4>
                <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 text-xs">
                  {Object.entries(product.specs).map(([key, value]) => (
                    <div
                      key={key}
                      className="grid grid-cols-2 p-3 bg-white hover:bg-slate-50 transition-colors"
                    >
                      <span className="font-semibold text-slate-600 capitalize">
                        {key.replace(/([A-Z])/g, " $1")}
                      </span>
                      <span className="text-slate-900 font-medium">
                        {typeof value === "object"
                          ? JSON.stringify(value)
                          : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Battery Highlight Banner (if applicable) */}
            {product.batteryHours !== undefined && (
              <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <Battery className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-blue-900 block">
                    High Endurance Battery
                  </span>
                  <span className="text-xs text-blue-700">
                    Provides approximately {product.batteryHours} hours of continuous playback.
                  </span>
                </div>
              </div>
            )}

            {/* Action Footer with Quantity Selector */}
            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs text-slate-400 block font-bold uppercase tracking-wider">
                  Total
                </span>
                <span className="text-2xl font-black text-slate-900">
                  ₹{lineTotal.toLocaleString("en-IN")}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {/* Quantity Stepper */}
                {product.inStock && (
                  <div className="flex items-center border border-slate-200 rounded-2xl bg-slate-50 p-1">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                      aria-label="Decrease quantity"
                      className="p-2 rounded-xl text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-3 text-xs font-bold text-slate-900 min-w-[2rem] text-center">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                      disabled={quantity >= 10}
                      aria-label="Increase quantity"
                      className="p-2 rounded-xl text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={!product.inStock}
                  className={`inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-xs transition-all shadow-sm cursor-pointer disabled:cursor-not-allowed ${
                    isAdded
                      ? "bg-emerald-600 text-white"
                      : "bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white disabled:text-slate-400"
                  }`}
                >
                  {isAdded ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Added to Cart!</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-4 h-4" />
                      <span>{product.inStock ? `Add ${quantity} to Cart` : "Out of Stock"}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailModal;

