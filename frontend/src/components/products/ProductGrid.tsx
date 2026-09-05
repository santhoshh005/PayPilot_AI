import React from "react";
import { PackageSearch, AlertCircle, RefreshCcw } from "lucide-react";
import { Product } from "../../types/product.js";
import ProductCard from "./ProductCard.js";

interface ProductGridProps {
  products: Product[];
  isLoading: boolean;
  error: string | null;
  onSelectProduct: (product: Product) => void;
  onRetry: () => void;
}

export const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  isLoading,
  error,
  onSelectProduct,
  onRetry,
}) => {
  // 1. Loading Skeleton Grid
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs animate-pulse flex flex-col h-[380px]"
          >
            <div className="aspect-[4/3] bg-slate-200/80" />
            <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <div className="h-3 bg-slate-200 rounded w-1/4" />
                  <div className="h-3 bg-slate-200 rounded w-1/6" />
                </div>
                <div className="h-5 bg-slate-200 rounded w-3/4" />
                <div className="h-3 bg-slate-100 rounded w-full" />
                <div className="h-3 bg-slate-100 rounded w-2/3" />
              </div>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="h-6 bg-slate-200 rounded w-1/3" />
                <div className="h-8 bg-slate-200 rounded-xl w-1/4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // 2. Error State
  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-3xl p-10 text-center max-w-lg mx-auto my-12 shadow-xs">
        <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="font-bold text-slate-900 text-lg mb-1">Failed to load products</h3>
        <p className="text-xs sm:text-sm text-slate-600 mb-6 max-w-sm mx-auto">{error}</p>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
        >
          <RefreshCcw className="w-3.5 h-3.5" />
          <span>Try Again</span>
        </button>
      </div>
    );
  }

  // 3. Empty State
  if (products.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center max-w-lg mx-auto my-12 shadow-sm space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
          <PackageSearch className="w-8 h-8" />
        </div>
        <h3 className="font-bold text-slate-900 text-lg">No products match your criteria</h3>
        <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
          We couldn't find any items matching your active search or filters. Try relaxing your budget or choosing another category.
        </p>
      </div>
    );
  }

  // 4. Products Grid
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onSelect={onSelectProduct}
        />
      ))}
    </div>
  );
};

export default ProductGrid;

