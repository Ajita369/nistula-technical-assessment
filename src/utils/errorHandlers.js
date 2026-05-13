const { ZodError } = require("zod");
const { AppError } = require("./errors");
const logger = require("./logger");

function notFoundHandler(req, res, next) {
  res.status(404).json({
    error: "NotFound",
    message: `Route not found: ${req.method} ${req.path}`
  });
}

function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "ValidationError",
      details: err.errors.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message
      }))
    });
  }

  if (err instanceof AppError) {
    // Log 5xx errors server-side; 4xx are caller mistakes, not worth noise.
    if (err.statusCode >= 500) {
      logger.error(`[${err.code}] ${err.message}`);
    }
    return res.status(err.statusCode || 500).json({
      error: err.code || "AppError",
      message: err.message
    });
  }

  // Unexpected errors — always log with full stack.
  logger.error("Unhandled error", { message: err.message, stack: err.stack });
  return res.status(500).json({
    error: "InternalServerError",
    message: "An unexpected error occurred"
  });
}

module.exports = {
  notFoundHandler,
  errorHandler
};
