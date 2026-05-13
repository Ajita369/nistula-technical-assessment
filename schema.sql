CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- Enumerations
-- Using ENUMs for constrained fields keeps the data self-documenting,
-- prevents invalid values at the database layer, and makes queries more readable.
-- ─────────────────────────────────────────────────────────────────────────────

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

-- Conversation lifecycle states as an ENUM (not freeform TEXT) so that
-- application code and queries can rely on a closed set of values.
CREATE TYPE conversation_status_enum AS ENUM (
  'open',
  'pending',
  'resolved',
  'escalated'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at trigger
-- A single reusable trigger function avoids repeating this logic per table.
-- Apply it to every table that carries an updated_at column.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- guests
-- One canonical record per real person across all channels.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE guests (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name   TEXT        NOT NULL,
  primary_email TEXT,
  primary_phone TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  guests            IS 'Canonical guest profile shared across all channels.';
COMMENT ON COLUMN guests.full_name  IS 'Best-known display name used in communications.';

CREATE TRIGGER trg_guests_updated_at
  BEFORE UPDATE ON guests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- guest_identities
-- Maps channel-specific external IDs back to one guest profile, enabling
-- a single guest to be recognised whether they write via WhatsApp or Airbnb.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE guest_identities (
  id          UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id    UUID                NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  channel     source_channel_enum NOT NULL,
  external_id TEXT                NOT NULL,
  created_at  TIMESTAMPTZ         NOT NULL DEFAULT now(),
  UNIQUE (channel, external_id)
);

COMMENT ON TABLE  guest_identities             IS 'External identifiers per channel mapped to a single guest profile.';
COMMENT ON COLUMN guest_identities.external_id IS 'Channel-specific ID (e.g. Airbnb profile ID, WhatsApp number).';

-- ─────────────────────────────────────────────────────────────────────────────
-- reservations
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE reservations (
  id              UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_ref     TEXT                NOT NULL UNIQUE,
  guest_id        UUID                REFERENCES guests(id) ON DELETE SET NULL,
  property_id     TEXT                NOT NULL,
  source_channel  source_channel_enum,
  checkin_date    DATE,
  checkout_date   DATE,
  num_guests      SMALLINT,
  created_at      TIMESTAMPTZ         NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ         NOT NULL DEFAULT now()
);

COMMENT ON TABLE  reservations             IS 'Reservation records tied to guests and properties.';
COMMENT ON COLUMN reservations.booking_ref IS 'External booking reference, e.g. NIS-2024-0891.';
COMMENT ON COLUMN reservations.num_guests  IS 'Total guest count — used to calculate per-guest pricing.';

CREATE TRIGGER trg_reservations_updated_at
  BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- conversations
-- Groups messages into threads per guest, optionally tied to a reservation.
-- Pre-sales enquiries have no reservation_id; post-sales threads do.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE conversations (
  id              UUID                        PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id        UUID                        NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  reservation_id  UUID                        REFERENCES reservations(id) ON DELETE SET NULL,
  property_id     TEXT                        NOT NULL,
  status          conversation_status_enum    NOT NULL DEFAULT 'open',
  created_at      TIMESTAMPTZ                 NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ                 NOT NULL DEFAULT now()
);

COMMENT ON TABLE  conversations        IS 'Message threads linked to a guest and optional reservation.';
COMMENT ON COLUMN conversations.status IS 'Lifecycle state: open → pending → resolved or escalated.';

CREATE TRIGGER trg_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- messages
-- Central store for every inbound and outbound message across all channels.
-- AI metadata is kept in a separate table to avoid sparse columns on outbound
-- and non-AI messages.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE messages (
  id              UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID                    NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  guest_id        UUID                    NOT NULL REFERENCES guests(id)        ON DELETE CASCADE,
  reservation_id  UUID                    REFERENCES reservations(id)           ON DELETE SET NULL,
  source_channel  source_channel_enum     NOT NULL,
  direction       message_direction_enum  NOT NULL,
  message_text    TEXT                    NOT NULL,
  sent_at         TIMESTAMPTZ             NOT NULL,
  created_at      TIMESTAMPTZ             NOT NULL DEFAULT now()
);

COMMENT ON TABLE  messages          IS 'All inbound and outbound messages unified in one table.';
COMMENT ON COLUMN messages.sent_at  IS 'Original channel timestamp or the time the outbound message was dispatched.';

-- ─────────────────────────────────────────────────────────────────────────────
-- message_ai_metadata
-- Stores AI classification results and the full lifecycle of the drafted reply.
-- Separated from messages so the core table stays lean and non-AI outbound
-- messages carry no null overhead.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE message_ai_metadata (
  id               UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id       UUID                  NOT NULL UNIQUE REFERENCES messages(id) ON DELETE CASCADE,
  query_type       query_type_enum       NOT NULL,
  confidence_score NUMERIC(3,2)          NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  drafted_reply    TEXT,
  handling_state   handling_state_enum   NOT NULL,
  model_name       TEXT,
  ai_drafted_at    TIMESTAMPTZ,
  agent_edited_at  TIMESTAMPTZ,
  auto_sent_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ           NOT NULL DEFAULT now()
);

COMMENT ON TABLE  message_ai_metadata                 IS 'AI classification, drafted reply, and handling lifecycle per inbound message.';
COMMENT ON COLUMN message_ai_metadata.handling_state  IS 'Tracks whether the reply was auto-sent, agent-edited, or escalated.';
COMMENT ON COLUMN message_ai_metadata.model_name      IS 'Claude model version used, e.g. claude-sonnet-4-20250514.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX idx_guest_identities_guest      ON guest_identities     (guest_id);
CREATE INDEX idx_reservations_guest          ON reservations         (guest_id);
CREATE INDEX idx_conversations_guest         ON conversations        (guest_id);
CREATE INDEX idx_conversations_reservation   ON conversations        (reservation_id);
CREATE INDEX idx_messages_conversation       ON messages             (conversation_id);
CREATE INDEX idx_messages_guest              ON messages             (guest_id);
CREATE INDEX idx_messages_channel_sent_at    ON messages             (source_channel, sent_at);
CREATE INDEX idx_message_ai_query_type       ON message_ai_metadata  (query_type);
CREATE INDEX idx_message_ai_state            ON message_ai_metadata  (handling_state);

-- ─────────────────────────────────────────────────────────────────────────────
-- Design decisions
-- ─────────────────────────────────────────────────────────────────────────────
--
-- 1) guest_identities decouples external channel IDs from the canonical guest
--    profile. One WhatsApp number + one Airbnb account can map to the same guest
--    without duplicating profile data.
--
-- 2) messages is the single source of truth for all directions and channels.
--    AI details live in message_ai_metadata (1:1, optional) so outbound or
--    human-written messages carry zero null overhead.
--
-- 3) conversations support both pre-sales threads (no reservation_id) and
--    post-sales threads (reservation_id set). The status enum enforces a clean
--    lifecycle: open → pending → resolved / escalated.
--
-- 4) updated_at is maintained automatically via a shared trigger function,
--    preventing the app from having to remember to update the column manually.
--
-- 5) gen_random_uuid() from pgcrypto produces globally unique IDs without
--    a sequence or coordination overhead.
--
-- Hardest design decision:
-- Whether to store AI fields directly in messages or in a separate table.
-- Merging them would be simpler to query, but it would add ~8 nullable columns
-- to every outbound and human-written message that will never use them. A
-- separate message_ai_metadata table keeps the core schema lean and lets the
-- AI pipeline evolve independently (e.g. storing multiple draft versions,
-- adding a review_notes column) without altering the primary messages table.
-- The 1:UNIQUE constraint guarantees integrity while the JOIN overhead is
-- negligible given the indexed FK.
