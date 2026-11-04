import type { NextFunction, Request, Response } from "express";

export class AppError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: "Not found" });
}

function isPgError(err: unknown): err is { code?: string; detail?: string; hint?: string; message?: string } {
  return typeof err === "object" && err !== null && "code" in err;
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: err.message,
      details: err.details,
    });
  }

  if (isPgError(err)) {
    const code = err.code;
    const message = err.message ?? "Database error";

    if (code === "23505") {
      return res.status(409).json({
        error: message,
        details: err.detail,
      });
    }

    if (code === "23503" || code === "23514" || code === "22P02" || code === "P0001") {
      return res.status(400).json({
        error: message,
        details: err.detail,
        hint: err.hint,
      });
    }
  }

  console.error(err);
  return res.status(500).json({ error: "Internal server error" });
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
