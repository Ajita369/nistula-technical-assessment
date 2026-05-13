# Nistula Technical Assessment

## Overview
This repository covers all three parts of the Nistula assessment:
- Part 1: Express webhook backend that normalizes messages, classifies the query, calls Claude, and returns confidence + action.
- Part 2: PostgreSQL schema for the unified messaging platform.
- Part 3: 3am incident response and system design thinking answers.

## Requirements
- Node.js 18+

## Setup
1. Install dependencies: `npm install`
2. Create a `.env` file based on `.env.example` and add your Claude API key.
3. Start the server: `npm run dev`

The server listens on `http://localhost:3000` by default.

## Environment variables
- `PORT` (default: 3000)
- `CLAUDE_API_KEY` (required)
- `CLAUDE_MODEL` (default: claude-sonnet-4-20250514)
- `CLAUDE_API_URL` (default: https://api.anthropic.com/v1/messages)

## API
`POST /webhook/message`

### Request payload
```json
{
  "source": "whatsapp|booking_com|airbnb|instagram|direct",
  "guest_name": "string",
  "message": "string",
  "timestamp": "ISO-8601 string",
  "booking_ref": "string",
  "property_id": "string"
}
```

### Response payload
```json
{
  "message_id": "uuid",
  "query_type": "pre_sales_availability",
  "drafted_reply": "...",
  "confidence_score": 0.91,
  "action": "auto_send"
}
```

## Testing (3 inputs)
Use the three requests in `samples/requests.http`:
- Availability + pricing
- Post-sales check-in
- Complaint

## Confidence scoring logic
- The classifier assigns a base confidence based on matched keywords.
- Very short AI replies reduce confidence.
- Complaint queries are capped at 0.50, forcing escalation.
- Action mapping:
  - `auto_send` if score > 0.85
  - `agent_review` if 0.60 to 0.85
  - `escalate` if < 0.60 or complaint


