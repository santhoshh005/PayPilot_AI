import { Router } from "express";
import chatController from "../controllers/chatController.js";
import { validate } from "../middleware/validate.js";
import { chatMessageBodySchema } from "../schemas/chat.js";
import { sensitiveLimiter } from "../middleware/rateLimiter.js";
import { env } from "../config/env.js";

const router = Router();

/**
 * POST /api/chat
 * Send user query to PayPilot AI shopping agent
 */
router.post(
  "/",
  ...(env.NODE_ENV !== "test" ? [sensitiveLimiter] : []),
  validate({ body: chatMessageBodySchema }),
  chatController.sendMessage
);

/**
 * GET /api/chat/history
 * Fetch conversation history
 */
router.get("/history", chatController.getHistory);

export default router;
