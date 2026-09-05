export interface CartItem {
  productId: string;
  name: string;
  brand: string;
  price: number;
  quantity: number;
  lineTotal: number;
  imageUrl: string;
  inStock: boolean;
}

export interface CartResponse {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
}
