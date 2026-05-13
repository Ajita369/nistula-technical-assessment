const axios = require("axios");
const { buildPrompt } = require("../utils/promptBuilder");
const { AppError } = require("../utils/errors");

const DEFAULT_API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-20250514";

async function draftReply(normalizedMessage) {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    throw new AppError("Claude API key is not configured", 500, "ConfigError");
  }

  const payload = {
    model: process.env.CLAUDE_MODEL || DEFAULT_MODEL,
    max_tokens: 300,
    temperature: 0.2,
    messages: [
      {
        role: "user",
        content: buildPrompt(normalizedMessage)
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
        timeout: 15000
      }
    );

    const textBlock = response.data?.content?.find(
      (block) => block.type === "text"
    );
    if (!textBlock?.text) {
      throw new AppError("Malformed Claude response", 502, "ClaudeResponseError");
    }

    return textBlock.text.trim();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    const statusCode = error.response?.status || 502;
    throw new AppError("Claude API request failed", statusCode, "ClaudeApiError");
  }
}

module.exports = {
  draftReply
};
