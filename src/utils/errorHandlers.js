const { ZodError } = require("zod");
const { AppError } = require("./errors");

function notFoundHandler(req, res, next) {
  res.status(404).json({
    error: "NotFound",
    message: "Route not found"
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
    return res.status(err.statusCode || 500).json({
      error: err.code || "AppError",
      message: err.message
    });
  }

  console.error(err);
  return res.status(500).json({
    error: "InternalServerError",
    message: "Unexpected error"
  });
}

module.exports = {
  notFoundHandler,
  errorHandler
};
