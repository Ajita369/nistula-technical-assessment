const axios = require("axios");
const { buildSystemPrompt, buildUserContent } = require("../utils/promptBuilder");
const { AppError } = require("../utils/errors");
const logger = require("../utils/logger");

const DEFAULT_API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-20250514";

async function draftReply(normalizedMessage) {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    throw new AppError("Claude API key is not configured", 500, "ConfigError");
  }

  const payload = {
    model: process.env.CLAUDE_MODEL || DEFAULT_MODEL,
    max_tokens: 400,
    // "system" is a top-level Claude API field — not a message role.
    // Using it correctly keeps the static property context out of the
    // conversation history and gives Claude cleaner instruction separation.
    system: buildSystemPrompt(),
    messages: [
      {
        role: "user",
        content: buildUserContent(normalizedMessage)
      }
    ]
  };

  try {
    const response = await axios.post(
      process.env.CLAUDE_API_URL || DEFAULT_API_URL,
      payload,
      {
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        },
        timeout: 20000
      }
    );

    const textBlock = response.data?.content?.find(
      (block) => block.type === "text"
    );
    if (!textBlock?.text) {
      throw new AppError("Malformed Claude response — no text block returned", 502, "ClaudeResponseError");
    }

    return textBlock.text.trim();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    // Log the upstream error detail for server-side debugging while returning
    // a generic message to the caller so internal errors are not leaked.
    const status = error.response?.status;
    const detail = error.response?.data?.error?.message || error.message;
    logger.error("Claude API error", { status, detail });

    const statusCode = status || 502;
    throw new AppError(
      `Claude API request failed: ${detail || "unknown error"}`,
      statusCode,
      "ClaudeApiError"
    );
  }
}

module.exports = {
  draftReply
};
