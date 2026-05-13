# Nistula Technical Assessment

A Node.js / Express webhook backend that receives guest messages from multiple
channels, normalises them into a unified schema, calls the Claude API to draft
a reply, and returns a confidence score and recommended action.

---

## Repository structure

```
.
├── src/
│   ├── server.js                  # Entry point — starts the HTTP server
│   ├── app.js                     # Express app, middleware, route mounting
│   ├── routes/
│   │   └── webhook.js             # POST /webhook/message handler
│   ├── schemas/
│   │   └── messageSchema.js       # Zod validation for inbound payloads
│   ├── services/
│   │   ├── classificationService.js  # Keyword-based query classifier
│   │   └── claudeService.js          # Claude API client
│   └── utils/
│       ├── confidence.js          # Confidence scoring and action mapping
│       ├── promptBuilder.js       # Builds system prompt + user content
│       ├── errorHandlers.js       # Express error and 404 middleware
│       ├── errors.js              # AppError class
│       └── logger.js              # Lightweight console logger
├── samples/
│   └── requests.http              # 6 test payloads (one per query type)
├── schema.sql                     # Part 2 — PostgreSQL schema
├── thinking.md                    # Part 3 — written answers
├── .env.example                   # Required env variables template
└── README.md
```

---

## Part 1 — Guest Message Handler

### How it works

```
POST /webhook/message
        │
        ▼
  Zod validation          ← rejects malformed or missing fields early
        │
        ▼
  Query classifier        ← keyword + word-boundary matching → query_type
        │
        ▼
  Normalise message       ← generate UUID, map fields to unified schema
        │
        ▼
  Claude API call         ← system prompt with property context + guest query
        │
        ▼
  Confidence scoring      ← combine classifier score, reply quality, query type
        │
        ▼
  Return JSON response    ← { message_id, query_type, drafted_reply,
                              confidence_score, action }
```

### Setup

**Requirements:** Node.js 18+

```bash
# 1. Install dependencies
npm install

# 2. Create your .env from the template
cp .env.example .env
# Then add your CLAUDE_API_KEY to .env

# 3. Start the dev server (auto-restarts on file changes)
npm run dev

# The server listens on http://localhost:3000
```

### Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3000` | Port the server listens on |
| `CLAUDE_API_KEY` | **Yes** | — | Anthropic API key |
| `CLAUDE_MODEL` | No | `claude-sonnet-4-20250514` | Claude model to use |
| `CLAUDE_API_URL` | No | `https://api.anthropic.com/v1/messages` | Claude API endpoint |

### API reference

#### `POST /webhook/message`

**Request payload**

```json
{
  "source": "whatsapp",
  "guest_name": "Rahul Sharma",
  "message": "Is the villa available from April 20 to 24? What is the rate for 2 adults?",
  "timestamp": "2026-05-05T10:30:00Z",
  "booking_ref": "NIS-2024-0891",
  "property_id": "villa-b1"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `source` | string | Yes | One of: `whatsapp`, `booking_com`, `airbnb`, `instagram`, `direct` |
| `guest_name` | string | Yes | 1–120 characters |
| `message` | string | Yes | 1–2000 characters |
| `timestamp` | string | Yes | ISO-8601 datetime |
| `booking_ref` | string | No | Omit for pre-booking enquiries |
| `property_id` | string | No | Omit for pre-booking enquiries |

**Response payload**

```json
{
  "message_id": "a1b2c3d4-...",
  "query_type": "pre_sales_availability",
  "drafted_reply": "Hi Rahul! Great news — Villa B1 is available from April 20 to 24...",
  "confidence_score": 0.82,
  "action": "agent_review"
}
```

**Error response (validation failure)**

```json
{
  "error": "ValidationError",
  "details": [
    { "field": "source", "message": "Invalid enum value" }
  ]
}
```

### Testing with curl

All 6 query types are covered in `samples/requests.http` (open in VS Code REST
Client) or run these curl commands directly:

**1. Availability + pricing enquiry**
```bash
curl -s -X POST http://localhost:3000/webhook/message \
  -H "Content-Type: application/json" \
  -d '{
    "source": "whatsapp",
    "guest_name": "Rahul Sharma",
    "message": "Is the villa available from April 20 to 24? What is the rate for 2 adults?",
    "timestamp": "2026-05-05T10:30:00Z",
    "booking_ref": "NIS-2024-0891",
    "property_id": "villa-b1"
  }' | jq .
```

**2. Post-sales check-in question**
```bash
curl -s -X POST http://localhost:3000/webhook/message \
  -H "Content-Type: application/json" \
  -d '{
    "source": "airbnb",
    "guest_name": "Neha Gupta",
    "message": "We arrive late tonight. What is the WiFi password and check-in time?",
    "timestamp": "2026-05-06T19:45:00Z",
    "booking_ref": "NIS-2024-1033",
    "property_id": "villa-b1"
  }' | jq .
```

**3. Complaint (always escalated)**
```bash
curl -s -X POST http://localhost:3000/webhook/message \
  -H "Content-Type: application/json" \
  -d '{
    "source": "instagram",
    "guest_name": "Amit Mehta",
    "message": "The AC is not working and this is unacceptable. I want a refund for tonight.",
    "timestamp": "2026-05-07T03:10:00Z",
    "booking_ref": "NIS-2024-1108",
    "property_id": "villa-b1"
  }' | jq .
```

---

### Confidence scoring logic

The final `confidence_score` is a float between `0.00` and `1.00` computed in
two steps and then used to determine `action`.

#### Step 1 — Classifier base score

The keyword classifier assigns a base confidence depending on how strongly the
message matches a category:

| Query type matched | Base confidence |
|---|---|
| `complaint` | 0.90 |
| `post_sales_checkin` | 0.85 |
| `special_request` | 0.82 |
| `pre_sales_pricing` | 0.82 |
| `pre_sales_availability` (single signal) | 0.80 |
| `pre_sales_availability` (availability + pricing) | 0.78 — mixed signal |
| `general_enquiry` (keyword match) | 0.75 |
| `general_enquiry` (fallback, no match) | 0.55 |

Word-boundary matching (regex `\b`) is used to prevent false positives — for
example, "no problem" will not trigger the `problem` keyword.

#### Step 2 — Adjustments

- **Short AI reply** (< 20 characters): `−0.10` — indicates the model may have
  refused or returned a non-answer.
- **Complaint type**: score is hard-capped at `0.50` regardless of classifier
  confidence. Complaints must always be reviewed by a human; auto-sending is
  never appropriate.

#### Step 3 — Action mapping

| Score | Action | Meaning |
|---|---|---|
| > 0.85 | `auto_send` | High confidence — reply can be sent automatically |
| 0.60 – 0.85 | `agent_review` | Reasonable draft, but a human should check |
| < 0.60 or `complaint` | `escalate` | Human must handle; AI reply is a draft only |

---

## Part 2 — Database Schema

See [`schema.sql`](./schema.sql).

**Tables:**
- `guests` — canonical guest profile per real person
- `guest_identities` — maps per-channel external IDs to one guest
- `reservations` — booking records linked to guests and properties
- `conversations` — message threads per guest, optionally tied to a reservation
- `messages` — every inbound and outbound message across all channels
- `message_ai_metadata` — AI classification, confidence score, and reply lifecycle

Design decisions and the hardest trade-off (AI metadata table vs. inline
columns) are documented in comments at the bottom of `schema.sql`.

---

## Part 3 — Thinking Questions

See [`thinking.md`](./thinking.md) for answers to the 3am incident scenario.
