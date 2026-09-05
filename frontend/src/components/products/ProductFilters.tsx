import React from "react";
import { Search, X, SlidersHorizontal, Battery } from "lucide-react";
import { CategoryInfo, ProductFilterParams } from "../../types/product.js";

interface ProductFiltersProps {
  categories: CategoryInfo[];
  filters: ProductFilterParams;
  onChange: (newFilters: ProductFilterParams) => void;
  onReset: () => void;
}

export const ProductFilters: React.FC<ProductFiltersProps> = ({
  categories,
  filters,
  onChange,
  onReset,
}) => {
  const activeCategory = filters.category || "";
  const activeSort = filters.sort || "rating_desc";
  const activeMaxPrice = filters.maxPrice;
  const activeMinBattery = filters.minBatteryHours;

  const quickPriceBuckets = [
    { label: "Under ₹2.5k", value: 2500 },
    { label: "Under ₹5k", value: 5000 },
    { label: "Under ₹25k", value: 25000 },
    { label: "Under ₹50k", value: 50000 },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-5">
      {/* Top Row: Search Input and Sort Dropdown */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={filters.search || ""}
            onChange={(e) => onChange({ ...filters, search: e.target.value, page: 1 })}
            aria-label="Search product catalog"
            placeholder="Search earbuds, Sony headphones, iPhone..."
            className="w-full pl-10 pr-10 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-400 bg-slate-50 focus:bg-white"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => onChange({ ...filters, search: "", page: 1 })}
              aria-label="Clear search input"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
            <span>Sort:</span>
          </div>
          <select
            value={activeSort}
            onChange={(e) =>
              onChange({
                ...filters,
                sort: e.target.value as ProductFilterParams["sort"],
                page: 1,
              })
            }
            aria-label="Sort products by"
            className="text-xs font-semibold rounded-xl border border-slate-200 px-3 py-2 bg-slate-50 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 cursor-pointer"
          >
            <option value="rating_desc">Highest Rated</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="name_asc">Name: A to Z</option>
          </select>
        </div>
      </div>

      {/* Category Pills */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
          Categories
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onChange({ ...filters, category: undefined, page: 1 })}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeCategory === ""
                ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/60"
            }`}
          >
            All Products
          </button>
          {categories.map((cat) => (
            <button
              key={cat.category}
              type="button"
              onClick={() =>
                onChange({
                  ...filters,
                  category: activeCategory === cat.category ? undefined : cat.category,
                  page: 1,
                })
              }
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeCategory === cat.category
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/60"
              }`}
            >
              {cat.category}
              <span className="ml-1.5 text-[10px] opacity-80 font-normal">
                ({cat.count})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Filters: Budget & Battery */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-100">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-500 mr-1">Budget:</span>
          {quickPriceBuckets.map((b) => (
            <button
              key={b.value}
              type="button"
              onClick={() =>
                onChange({
                  ...filters,
                  maxPrice: activeMaxPrice === b.value ? undefined : b.value,
                  page: 1,
                })
              }
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors border cursor-pointer ${
                activeMaxPrice === b.value
                  ? "bg-blue-50 text-blue-700 border-blue-300 shadow-xs"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {/* Quick 30h+ Battery Filter */}
          <button
            type="button"
            onClick={() =>
              onChange({
                ...filters,
                minBatteryHours: activeMinBattery === 30 ? undefined : 30,
                page: 1,
              })
            }
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs border transition-colors cursor-pointer ${
              activeMinBattery === 30
                ? "bg-blue-50 text-blue-700 border-blue-300 font-bold shadow-xs"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 font-medium"
            }`}
          >
            <Battery className="w-3.5 h-3.5 text-blue-600" />
            <span>30h+ Battery</span>
          </button>

          {/* Reset Filters */}
          {(filters.search ||
            filters.category ||
            filters.maxPrice ||
            filters.minBatteryHours ||
            filters.sort !== "rating_desc") && (
            <button
              type="button"
              onClick={onReset}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 underline underline-offset-2 cursor-pointer ml-2"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductFilters;

