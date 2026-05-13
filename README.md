# Nistula Technical Assessment (Part 1)

## Overview
This project implements the Part 1 webhook backend for the Nistula assessment. It accepts inbound guest messages, normalizes them into a unified schema, classifies the query type, calls the Claude API to draft a reply, and returns a confidence score with an action decision.

## Setup
1. Install dependencies: `npm install`
2. Create a `.env` file based on `.env.example` and add your Claude API key.
3. Start the server: `npm run dev`

The server listens on `http://localhost:3000` by default.

## Endpoint
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

## Confidence scoring logic
- The classifier assigns a base confidence based on matched keywords.
- Very short AI replies reduce confidence.
- Complaint queries are capped at 0.50, forcing escalation.
- Action mapping:
  - `auto_send` if score > 0.85
  - `agent_review` if 0.60 to 0.85
  - `escalate` if < 0.60 or complaint

## Sample requests
Use the examples in `samples/requests.http` (three inputs including complaint and pricing/availability).

## Notes
- The Claude API key is read from `.env` only. Do not commit secrets.
- Property context is embedded in the prompt builder.
