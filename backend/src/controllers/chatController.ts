import { Request, Response, NextFunction } from "express";
import agentService, { AgentChatResponse } from "../services/agentService.js";
import prisma from "../lib/prisma.js";
import { ChatMessageBody } from "../schemas/chat.js";
import { ApiResponse } from "../types/index.js";
import { NotFoundError } from "../utils/errors.js";

export class ChatController {
  /**
   * POST /api/chat
   * Process a natural language shopping message via the AI Agent
   */
  async sendMessage(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { message, conversationId } = req.body as ChatMessageBody;
      const sessionId = req.sessionId;

      const result = await agentService.processMessage(
        sessionId,
        message,
        conversationId
      );

      const response: ApiResponse<AgentChatResponse> = {
        success: true,
        data: result,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/chat/history
   * Retrieve message history for the active conversation
   */
  async getHistory(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const sessionId = req.sessionId;
      const conversationId = req.query.conversationId as string | undefined;

      const conversation = conversationId
        ? await prisma.conversation.findFirst({
            where: { id: conversationId, sessionId },
            include: {
              messages: {
                orderBy: { createdAt: "asc" },
              },
            },
          })
        : await prisma.conversation.findFirst({
            where: { sessionId },
            orderBy: { createdAt: "desc" },
            include: {
              messages: {
                orderBy: { createdAt: "asc" },
              },
            },
          });

      if (!conversation) {
        res.status(200).json({
          success: true,
          data: {
            conversationId: null,
            messages: [],
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          conversationId: conversation.id,
          messages: conversation.messages,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const chatController = new ChatController();
export default chatController;
