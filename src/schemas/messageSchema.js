const { z } = require("zod");

const allowedSources = ["whatsapp", "booking_com", "airbnb", "instagram", "direct"];

const inboundMessageSchema = z.object({
  source: z.enum(allowedSources),
  guest_name: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(2000),
  timestamp: z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "timestamp must be ISO-8601"
  }),
  // Optional: pre-sales guests contacting before a booking won't have these
  booking_ref: z.string().trim().min(1).max(64).optional(),
  property_id: z.string().trim().min(1).max(64).optional()
});

function validateInboundMessage(payload) {
  return inboundMessageSchema.parse(payload);
}

module.exports = {
  allowedSources,
  validateInboundMessage
};
