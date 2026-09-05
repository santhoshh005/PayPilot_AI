import { z } from "zod";

/**
 * Query schema for dashboard metrics
 */
export const dashboardQuerySchema = z.object({
  range: z.enum(["7d", "30d", "90d"]).default("30d").optional(),
});

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

/**
 * Top selling product DTO
 */
export interface TopProductDto {
  productId: string;
  productName: string;
  quantitySold: number;
  revenue: number; // in INR
}

/**
 * Daily sales aggregation DTO
 */
export interface DailySaleDto {
  date: string; // YYYY-MM-DD
  revenue: number; // in INR
  orders: number;
}

/**
 * Complete Dashboard Summary DTO
 */
export interface DashboardSummaryDto {
  range: "7d" | "30d" | "90d";
  totalOrders: number;
  paidOrders: number;
  pendingOrders: number;
  failedOrders: number;
  totalRevenue: number; // in INR
  averageOrderValue: number; // in INR
  totalItemsSold: number;
  topProducts: TopProductDto[];
  salesByDay: DailySaleDto[];
}
