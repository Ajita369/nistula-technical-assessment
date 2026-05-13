CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enumerations keep key fields consistent and readable.
CREATE TYPE source_channel_enum AS ENUM (
  'whatsapp',
  'booking_com',
  'airbnb',
  'instagram',
  'direct'
);

CREATE TYPE query_type_enum AS ENUM (
  'pre_sales_availability',
  'pre_sales_pricing',
  'post_sales_checkin',
  'special_request',
  'complaint',
  'general_enquiry'
);

CREATE TYPE message_direction_enum AS ENUM ('inbound', 'outbound');

CREATE TYPE handling_state_enum AS ENUM (
  'ai_drafted',
  'agent_edited',
  'auto_sent',
  'escalated'
);

-- One guest profile per person across all channels.
CREATE TABLE guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  primary_email TEXT,
  primary_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE guests IS 'Canonical guest profile shared across channels.';
COMMENT ON COLUMN guests.full_name IS 'Best-known name for display and communication.';

-- Maps channel-specific identities back to a single guest profile.
CREATE TABLE guest_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  channel source_channel_enum NOT NULL,
  external_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (channel, external_id)
);

COMMENT ON TABLE guest_identities IS 'External identifiers per channel mapped to a guest profile.';
COMMENT ON COLUMN guest_identities.external_id IS 'Channel-specific identifier (e.g., Airbnb profile ID).';

-- Reservation data is linked to guest and property references.
CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_ref TEXT NOT NULL UNIQUE,
  guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
  property_id TEXT NOT NULL,
  source_channel source_channel_enum,
  checkin_date DATE,
  checkout_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE reservations IS 'Reservation records tied to guests and properties.';
COMMENT ON COLUMN reservations.booking_ref IS 'External booking reference like NIS-2024-0891.';

-- Conversations group messages by guest and optional reservation.
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
  property_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE conversations IS 'Threads of messages tied to a guest and optional reservation.';

-- Central message table for all channels and directions.
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
  source_channel source_channel_enum NOT NULL,
  direction message_direction_enum NOT NULL,
  message_text TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE messages IS 'All inbound and outbound messages unified in one table.';
COMMENT ON COLUMN messages.sent_at IS 'Original timestamp from the channel or send time.';

-- AI metadata and handling state for inbound messages.
CREATE TABLE message_ai_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL UNIQUE REFERENCES messages(id) ON DELETE CASCADE,
  query_type query_type_enum NOT NULL,
  confidence_score NUMERIC(3, 2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  drafted_reply TEXT,
  handling_state handling_state_enum NOT NULL,
  model_name TEXT,
  ai_drafted_at TIMESTAMPTZ,
  agent_edited_at TIMESTAMPTZ,
  auto_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE message_ai_metadata IS 'AI classification results and message handling state.';
COMMENT ON COLUMN message_ai_metadata.handling_state IS 'Tracks whether AI drafted, agent edited, auto sent, or escalated.';

-- Useful indexes for query patterns.
CREATE INDEX idx_guest_identities_guest ON guest_identities (guest_id);
CREATE INDEX idx_reservations_guest ON reservations (guest_id);
CREATE INDEX idx_conversations_guest ON conversations (guest_id);
CREATE INDEX idx_conversations_reservation ON conversations (reservation_id);
CREATE INDEX idx_messages_conversation ON messages (conversation_id);
CREATE INDEX idx_messages_guest ON messages (guest_id);
CREATE INDEX idx_messages_channel_sent_at ON messages (source_channel, sent_at);
CREATE INDEX idx_message_ai_query_type ON message_ai_metadata (query_type);
CREATE INDEX idx_message_ai_state ON message_ai_metadata (handling_state);

-- Design decisions:
-- 1) guest_identities provides a durable mapping from multiple channels to a single guest profile.
-- 2) messages is the canonical store for all channels and directions; AI details live in message_ai_metadata.
-- 3) conversations link a guest and optional reservation, supporting pre-sales and post-sales threads.
-- 4) handling_state captures AI drafted, agent edited, auto sent, and escalated outcomes succinctly.
-- 5) gen_random_uuid() keeps IDs globally unique without coordination.
-- 6) Basic updated_at columns are included for app-managed auditing.
--
-- Hardest design decision:
-- Whether to store AI fields directly in messages or in a separate table. A separate message_ai_metadata table
-- keeps the core message schema clean and allows outbound/non-AI messages to avoid sparse columns, while still
-- enforcing a 1:1 relationship when AI metadata exists. This makes the model easier to extend for future AI
-- pipelines without bloating the primary messages table.
