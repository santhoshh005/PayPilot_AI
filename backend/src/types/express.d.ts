import { Session } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      sessionId: string;
      sessionRecord?: Session;
      rawBody?: Buffer;
    }
  }
}

export {};
