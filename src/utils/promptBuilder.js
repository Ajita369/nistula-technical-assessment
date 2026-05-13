// Static property context injected into every Claude request via the system prompt.
// Keeping this in the system role (not the user message) gives Claude clearer
// separation between ground-truth facts and the guest's actual question.
const PROPERTY_CONTEXT = `Property: Villa B1, Assagao, North Goa
Bedrooms: 3 | Max guests: 6 | Private pool: Yes
Check-in: 2pm | Check-out: 11am
Base rate: INR 18,000 per night (up to 4 guests)
Extra guest: INR 2,000 per night per person
WiFi password: Nistula@2024
Caretaker: Available 8am to 10pm
Chef on call: Yes, pre-booking required
Availability April 20-24: Available
Cancellation: Free up to 7 days before check-in`;

/**
 * Returns the system-level prompt that shapes Claude's persona and knowledge.
 * This is passed as the top-level "system" field in the Claude API request,
 * not as a message turn, which is the correct way to inject static context.
 */
function buildSystemPrompt() {
  return `You are a warm, professional guest messaging assistant for Nistula, a luxury villa rental company in Goa.

Property context you must use for factual details:
${PROPERTY_CONTEXT}

Rules you must follow:
- Address the guest by their first name.
- Use only the property context above for specific facts (rates, passwords, times, availability).
- If the guest asks for something not covered by the context, politely say you will check and respond shortly.
- Keep replies concise (3-5 sentences) and conversational.
- Never include JSON, field labels, or meta-commentary in your reply.
- Plain text only — no markdown, no bullet points unless naturally appropriate.`;
}

/**
 * Returns the user-turn content describing the specific guest message.
 * This is what changes per request; the system prompt stays constant.
 */
function buildUserContent(normalized) {
  return `Please draft a reply to the following guest message.

Guest name: ${normalized.guest_name}
Channel: ${normalized.source}
Booking reference: ${normalized.booking_ref || "N/A (pre-booking enquiry)"}
Property: ${normalized.property_id || "Villa B1"}
Query type: ${normalized.query_type}
Guest message: "${normalized.message_text}"`;
}

module.exports = {
  buildSystemPrompt,
  buildUserContent
};
