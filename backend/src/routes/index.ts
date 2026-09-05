import { Router } from "express";
import healthRouter from "./health.js";
import sessionRouter from "./session.js";

import productRouter from "./products.js";
import chatRouter from "./chat.js";
import cartRouter from "./cart.js";
import checkoutRouter from "./checkout.js";
import paymentRouter from "./payment.js";
import ordersRouter from "./orders.js";
import dashboardRouter from "./dashboard.js";

const apiRouter = Router();

// Phase 0 & 2: Health check & Session resolution
apiRouter.use("/health", healthRouter);
apiRouter.use("/session", sessionRouter);

// Phase 3: Product Catalog
apiRouter.use("/products", productRouter);

// Phase 4: AI Agent Chat
apiRouter.use("/chat", chatRouter);

// Phase 5: Shopping Cart
apiRouter.use("/cart", cartRouter);

// Phase 6: Razorpay Order Creation / Checkout
apiRouter.use("/checkout", checkoutRouter);

// Phase 8 & 9: Razorpay Payment Verification & Webhook Handlers
apiRouter.use("/payment", paymentRouter);

// Phase 10: Order Management & History
apiRouter.use("/orders", ordersRouter);

// Phase 11: Growth Dashboard & Business Insights
apiRouter.use("/dashboard", dashboardRouter);

export default apiRouter;
