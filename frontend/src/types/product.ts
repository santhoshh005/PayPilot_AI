export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  description: string;
  imageUrl: string;
  specs: Record<string, unknown>;
  features: string[];
  rating: number;
  inStock: boolean;
  batteryHours?: number;
  createdAt: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ProductListResponse {
  items: Product[];
  pagination: PaginationMeta;
}

export interface CategoryInfo {
  category: string;
  count: number;
}

export interface ProductFilterParams {
  search?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  minBatteryHours?: number;
  inStock?: boolean;
  sort?: "price_asc" | "price_desc" | "rating_desc" | "name_asc";
  page?: number;
  limit?: number;
}
