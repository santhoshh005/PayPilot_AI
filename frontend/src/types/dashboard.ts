export type DashboardRange = "7d" | "30d" | "90d";

export interface TopProduct {
  productId: string;
  productName: string;
  quantitySold: number;
  revenue: number;
}

export interface DailySale {
  date: string;
  revenue: number;
  orders: number;
}

export interface DashboardSummary {
  range: DashboardRange;
  totalOrders: number;
  paidOrders: number;
  pendingOrders: number;
  failedOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  totalItemsSold: number;
  topProducts: TopProduct[];
  salesByDay: DailySale[];
}
