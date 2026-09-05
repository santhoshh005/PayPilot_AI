import prisma from "../lib/prisma.js";
import {
  DashboardSummaryDto,
  TopProductDto,
  DailySaleDto,
} from "../schemas/dashboard.js";

export class DashboardService {
  /**
   * Aggregates growth metrics and business analytics across orders and order items.
   * Scoped to the specified time range ("7d", "30d", or "90d").
   */
  async getSummary(range: "7d" | "30d" | "90d" = "30d"): Promise<DashboardSummaryDto> {
    const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;

    // Deterministic start date at 00:00:00 UTC
    const now = new Date();
    const startDate = new Date(now);
    startDate.setUTCDate(startDate.getUTCDate() - (days - 1));
    startDate.setUTCHours(0, 0, 0, 0);

    // 1. Fetch Order Counts partitioned by Status
    const [totalOrders, paidOrdersCount, pendingOrders, failedOrders] =
      await Promise.all([
        prisma.order.count({
          where: { createdAt: { gte: startDate } },
        }),
        prisma.order.count({
          where: { createdAt: { gte: startDate }, status: "PAID" },
        }),
        prisma.order.count({
          where: { createdAt: { gte: startDate }, status: "PENDING" },
        }),
        prisma.order.count({
          where: { createdAt: { gte: startDate }, status: "FAILED" },
        }),
      ]);

    // 2. Fetch PAID orders with historical snapshot OrderItems
    const paidOrders = await prisma.order.findMany({
      where: {
        createdAt: { gte: startDate },
        status: "PAID",
      },
      select: {
        id: true,
        createdAt: true,
        paidAt: true,
        items: {
          select: {
            productId: true,
            quantity: true,
            price: true,
            product: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // 3. Initialize daily sales buckets for every day in range
    const salesMap = new Map<string, { revenuePaise: number; orders: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setUTCDate(d.getUTCDate() + i);
      const dateKey = d.toISOString().slice(0, 10);
      salesMap.set(dateKey, { revenuePaise: 0, orders: 0 });
    }

    // 4. Calculate total revenue, items sold, top products, and daily sales
    let totalRevenuePaise = 0;
    let totalItemsSold = 0;
    const productStats = new Map<
      string,
      { productId: string; productName: string; quantitySold: number; revenuePaise: number }
    >();

    for (const order of paidOrders) {
      let orderRevenuePaise = 0;

      for (const item of order.items) {
        const itemPricePaise = Math.round(Number(item.price) * 100);
        const itemTotalPaise = itemPricePaise * item.quantity;

        orderRevenuePaise += itemTotalPaise;
        totalRevenuePaise += itemTotalPaise;
        totalItemsSold += item.quantity;

        // Top products accumulation
        const existing = productStats.get(item.productId);
        if (existing) {
          existing.quantitySold += item.quantity;
          existing.revenuePaise += itemTotalPaise;
        } else {
          productStats.set(item.productId, {
            productId: item.productId,
            productName: item.product?.name || "Product",
            quantitySold: item.quantity,
            revenuePaise: itemTotalPaise,
          });
        }
      }

      // Group into daily sales bucket
      const dateKey = (order.paidAt || order.createdAt).toISOString().slice(0, 10);
      if (salesMap.has(dateKey)) {
        const bucket = salesMap.get(dateKey)!;
        bucket.revenuePaise += orderRevenuePaise;
        bucket.orders += 1;
      }
    }

    // 5. Format Top 5 Products by Quantity Sold
    const topProducts: TopProductDto[] = Array.from(productStats.values())
      .sort((a, b) => b.quantitySold - a.quantitySold || b.revenuePaise - a.revenuePaise)
      .slice(0, 5)
      .map((p) => ({
        productId: p.productId,
        productName: p.productName,
        quantitySold: p.quantitySold,
        revenue: Math.round(p.revenuePaise) / 100,
      }));

    // 6. Format Sales by Day chronologically
    const salesByDay: DailySaleDto[] = Array.from(salesMap.entries())
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, data]) => ({
        date,
        revenue: Math.round(data.revenuePaise) / 100,
        orders: data.orders,
      }));

    const totalRevenue = Math.round(totalRevenuePaise) / 100;
    const averageOrderValue =
      paidOrdersCount > 0
        ? Math.round((totalRevenuePaise / paidOrdersCount)) / 100
        : 0;

    return {
      range,
      totalOrders,
      paidOrders: paidOrdersCount,
      pendingOrders,
      failedOrders,
      totalRevenue,
      averageOrderValue,
      totalItemsSold,
      topProducts,
      salesByDay,
    };
  }
}

export const dashboardService = new DashboardService();
export default dashboardService;
