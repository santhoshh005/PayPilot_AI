import { z } from "zod";

/**
 * Zod validation schema for POST /api/chat request body
 */
export const chatMessageBodySchema = z.object({
  message: z
    .string({
      required_error: "Message is required",
      invalid_type_error: "Message must be a string",
    })
    .trim()
    .min(1, "Message cannot be empty")
    .max(1000, "Message cannot exceed 1000 characters"),
  conversationId: z
    .string()
    .uuid("conversationId must be a valid UUID")
    .optional(),
});

export type ChatMessageBody = z.infer<typeof chatMessageBodySchema>;
