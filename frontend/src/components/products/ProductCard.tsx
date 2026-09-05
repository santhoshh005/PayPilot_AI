import React from "react";
import { Star, Battery, CheckCircle2, XCircle, ArrowUpRight } from "lucide-react";
import { Product } from "../../types/product.js";

const DEFAULT_FALLBACK_IMAGE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='120' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'><rect width='18' height='18' x='3' y='3' rx='3'/><path d='m3 16 5-5c.9-.9 2.1-.9 3 0l7 7'/><path d='m14 14 1-1c.9-.9 2.1-.9 3 0l3 3'/><circle cx='9' cy='9' r='2'/></svg>";

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onSelect }) => {
  return (
    <div className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-blue-400 hover:shadow-lg transition-all duration-300 flex flex-col h-full">
      {/* Product Image */}
      <div
        className="relative aspect-[4/3] bg-slate-100 overflow-hidden cursor-pointer"
        onClick={() => onSelect(product)}
      >
        <img
          src={product.imageUrl}
          alt={product.name}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = DEFAULT_FALLBACK_IMAGE;
          }}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        <div className="absolute top-3 left-3">
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-white/95 backdrop-blur-sm text-slate-800 border border-slate-200 shadow-sm">
            {product.category}
          </span>
        </div>
        <div className="absolute top-3 right-3">
          {product.inStock ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
              <CheckCircle2 className="w-3 h-3" />
              In Stock
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 shadow-xs">
              <XCircle className="w-3 h-3" />
              Sold Out
            </span>
          )}
        </div>
      </div>

      {/* Product Info */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
              {product.brand}
            </span>
            <div className="flex items-center gap-1 text-amber-500 font-semibold text-xs bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>{product.rating.toFixed(1)}</span>
            </div>
          </div>

          <h3
            onClick={() => onSelect(product)}
            className="font-bold text-slate-900 text-base line-clamp-1 group-hover:text-blue-600 transition-colors cursor-pointer"
          >
            {product.name}
          </h3>

          <p className="text-xs text-slate-500 line-clamp-2 mt-1 mb-3">
            {product.description}
          </p>

          {/* Quick Specs Pill */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {product.batteryHours !== undefined && (
              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-semibold border border-blue-100">
                <Battery className="w-3 h-3" />
                {product.batteryHours}h Playback
              </span>
            )}
            {product.features && product.features.length > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium line-clamp-1 border border-slate-200/60">
                {product.features[0]}
              </span>
            )}
          </div>
        </div>

        {/* Price & Action */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">
              Price
            </span>
            <span className="text-lg font-black text-slate-900 tracking-tight">
              ₹{product.price.toLocaleString("en-IN")}
            </span>
          </div>

          <button
            onClick={() => onSelect(product)}
            aria-label={`View details for ${product.name}`}
            className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-blue-600 text-white text-xs font-semibold transition-colors shadow-sm cursor-pointer"
          >
            <span>Details</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;

