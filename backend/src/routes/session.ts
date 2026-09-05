import { Router, Request, Response } from "express";
import { ApiResponse } from "../types/index.js";

const router = Router();

/**
 * GET /api/session
 * Inspect or initialize the anonymous session.
 */
router.get("/", (req: Request, res: Response) => {
  const responseData: ApiResponse<{
    sessionId: string;
    createdAt?: Date;
  }> = {
    success: true,
    data: {
      sessionId: req.sessionId,
      createdAt: req.sessionRecord?.createdAt,
    },
  };

  res.status(200).json(responseData);
});

export default router;
