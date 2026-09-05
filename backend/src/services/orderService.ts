import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma.js";
import {
  ListOrdersQuery,
  OrderListResult,
  OrderSummaryDto,
  OrderDetailDto,
  ConciseOrderItemDto,
} from "../schemas/order.js";
import { NotFoundError } from "../utils/errors.js";

export class OrderService {
  /**
   * Helper to format OrderItem entities with product snapshots into clean DTOs
   */
  private formatOrderItems(
    items: Array<{
      id: string;
      productId: string;
      quantity: number;
      price: Prisma.Decimal;
      product: {
        id: string;
        name: string;
        brand: string;
        category: string;
        imageUrl: string;
      };
    }>
  ): ConciseOrderItemDto[] {
    return items.map((item) => {
      const priceNum = Number(item.price);
      return {
        id: item.id,
        productId: item.productId,
        name: item.product.name,
        productName: item.product.name,
        brand: item.product.brand,
        category: item.product.category,
        imageUrl: item.product.imageUrl,
        quantity: item.quantity,
        price: priceNum,
        subtotal: priceNum * item.quantity,
      };
    });
  }

  /**
   * Retrieves paginated orders belonging strictly to the authorized session.
   * Orders are returned newest first (createdAt: desc).
   */
  async listOrders(
    sessionId: string,
    query: ListOrdersQuery
  ): Promise<OrderListResult> {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {
      sessionId,
      ...(query.status ? { status: query.status } : {}),
    };

    // Execute count and paginated query in parallel
    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  brand: true,
                  category: true,
                  imageUrl: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    const formattedOrders: OrderSummaryDto[] = orders.map((order) => {
      const items = this.formatOrderItems(order.items);
      const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

      return {
        id: order.id,
        razorpayOrderId: order.razorpayOrderId,
        razorpayPaymentId: order.razorpayPaymentId,
        status: order.status,
        totalAmount: Number(order.totalAmount),
        currency: "INR",
        itemCount,
        createdAt: order.createdAt.toISOString(),
        paidAt: order.paidAt ? order.paidAt.toISOString() : null,
        items,
      };
    });

    return {
      orders: formattedOrders,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Retrieves single order details strictly verifying session ownership.
   * Throws NotFoundError (404) if order does not exist or belongs to another session.
   */
  async getOrderById(
    sessionId: string,
    orderId: string
  ): Promise<OrderDetailDto> {
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        sessionId,
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                brand: true,
                category: true,
                imageUrl: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundError(
        "Order not found or does not belong to the current session."
      );
    }

    const items = this.formatOrderItems(order.items);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    return {
      id: order.id,
      status: order.status,
      totalAmount: Number(order.totalAmount),
      currency: "INR",
      itemCount,
      razorpayOrderId: order.razorpayOrderId,
      razorpayPaymentId: order.razorpayPaymentId,
      paidAt: order.paidAt ? order.paidAt.toISOString() : null,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      items,
    };
  }
}

export const orderService = new OrderService();
export default orderService;
