/**
 * Standard successful API response envelope
 */
export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

/**
 * Standard error API response envelope
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Health check status response
 */
export interface HealthStatus {
  status: "ok" | "degraded" | "error";
  service: string;
  timestamp: string;
  uptime: number;
  environment: string;
  database: "connected" | "disconnected";
}
