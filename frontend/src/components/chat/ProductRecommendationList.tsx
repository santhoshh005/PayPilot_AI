import React from "react";
import { Star, Battery, ArrowUpRight, CheckCircle2, ShoppingBag } from "lucide-react";
import { Product } from "../../types/product.js";

const DEFAULT_FALLBACK_IMAGE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'><rect width='18' height='18' x='3' y='3' rx='3'/><path d='m3 16 5-5c.9-.9 2.1-.9 3 0l7 7'/><path d='m14 14 1-1c.9-.9 2.1-.9 3 0l3 3'/><circle cx='9' cy='9' r='2'/></svg>";

interface ProductRecommendationListProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
  onAddToCart?: (product: Product) => void;
}

export const ProductRecommendationList: React.FC<ProductRecommendationListProps> = ({
  products,
  onSelectProduct,
  onAddToCart,
}) => {
  if (!products || products.length === 0) return null;

  return (
    <div className="mt-3.5 pt-3 border-t border-slate-100">
      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2.5">
        Recommended Matches ({products.length})
      </span>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {products.map((product) => (
          <div
            key={product.id}
            className="group bg-slate-50 hover:bg-white border border-slate-200 hover:border-blue-400 rounded-2xl p-3.5 transition-all shadow-sm flex flex-col justify-between"
          >
            <div
              className="flex gap-3 items-start cursor-pointer"
              onClick={() => onSelectProduct(product)}
            >
              <img
                src={product.imageUrl}
                alt={product.name}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = DEFAULT_FALLBACK_IMAGE;
                }}
                className="w-16 h-16 rounded-xl object-cover bg-slate-100 shrink-0 border border-slate-200"
                loading="lazy"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">
                    {product.brand}
                  </span>
                  <div className="flex items-center gap-0.5 text-amber-500 font-semibold text-[11px]">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <span>{product.rating.toFixed(1)}</span>
                  </div>
                </div>

                <h4 className="font-bold text-xs text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                  {product.name}
                </h4>

                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-black text-slate-900">
                    ₹{product.price.toLocaleString("en-IN")}
                  </span>
                  {product.batteryHours !== undefined && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-blue-100/70 text-blue-700 font-semibold">
                      <Battery className="w-2.5 h-2.5" />
                      {product.batteryHours}h
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
              <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                <CheckCircle2 className="w-3 h-3" />
                In Stock
              </span>
              <div className="flex items-center gap-2">
                {onAddToCart && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddToCart(product);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white font-bold text-[10px] transition-colors cursor-pointer border border-blue-200 hover:border-blue-600"
                    title={`Add ${product.name} to cart`}
                  >
                    <ShoppingBag className="w-2.5 h-2.5" />
                    <span>Add</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onSelectProduct(product)}
                  className="inline-flex items-center gap-0.5 font-semibold text-slate-600 hover:text-blue-600 cursor-pointer"
                >
                  <span>Details</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductRecommendationList;

