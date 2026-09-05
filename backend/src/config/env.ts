import { z } from "zod";
import dotenv from "dotenv";
import path from "path";

// Load .env from backend or root
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), "..", ".env") });

const envSchema = z.object({
  // Required runtime configuration
  PORT: z
    .string()
    .default("3001")
    .transform((val) => parseInt(val, 10)),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  FRONTEND_URL: z
    .string()
    .url("FRONTEND_URL must be a valid URL")
    .default("http://localhost:5173"),

  // Database connections (required for data persistence)
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required for database access"),
  DIRECT_URL: z
    .string()
    .min(1, "DIRECT_URL is required for migrations")
    .optional(),

  // Phase 4+ (AI Agent) credentials
  GEMINI_API_KEY: z
    .string()
    .optional()
    .default(""),
  GEMINI_MODEL: z
    .string()
    .default("gemini-2.5-flash"),

  // Phase 6+ (Razorpay Test Mode) credentials — optional now, validated in Phase 6
  RAZORPAY_KEY_ID: z
    .string()
    .optional()
    .default(""),
  RAZORPAY_KEY_SECRET: z
    .string()
    .optional()
    .default(""),
  RAZORPAY_WEBHOOK_SECRET: z
    .string()
    .optional()
    .default(""),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.format());
  throw new Error("Invalid environment configuration. Please check your .env file.");
}

export const env = parsed.data;

/**
 * Validates that Gemini API configuration is present when AI routes are engaged
 */
export function assertAiConfig(): { apiKey: string; model: string } {
  if (!env.GEMINI_API_KEY || env.GEMINI_API_KEY.trim() === "") {
    throw new Error("GEMINI_API_KEY is not configured in the environment.");
  }
  return { apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL };
}

/**
 * Validates that Razorpay credentials are present when Payment routes are engaged
 */
export function assertPaymentConfig(): { keyId: string; keySecret: string; webhookSecret: string } {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new Error("RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not configured in the environment.");
  }
  return {
    keyId: env.RAZORPAY_KEY_ID,
    keySecret: env.RAZORPAY_KEY_SECRET,
    webhookSecret: env.RAZORPAY_WEBHOOK_SECRET || "",
  };
}

/**
 * Validates that Razorpay Webhook Secret is present when Webhook routes are engaged
 */
export function assertWebhookConfig(): { webhookSecret: string } {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || secret.trim() === "") {
    throw new Error("RAZORPAY_WEBHOOK_SECRET is not configured in the environment.");
  }
  return { webhookSecret: secret.trim() };
}

export default env;
