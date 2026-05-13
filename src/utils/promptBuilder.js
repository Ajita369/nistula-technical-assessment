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

function buildPrompt(normalized) {
  return `You are a guest messaging assistant for Nistula. Draft a helpful, polite reply in plain text.

Context:
${PROPERTY_CONTEXT}

Guest message details:
- Guest name: ${normalized.guest_name}
- Source: ${normalized.source}
- Booking reference: ${normalized.booking_ref}
- Property ID: ${normalized.property_id}
- Query type: ${normalized.query_type}
- Message: ${normalized.message_text}

Instructions:
- Use only the context above for factual details.
- If the message asks for anything outside context, say you will check and get back.
- Keep the reply concise and professional.
- Do not include JSON or labels in the reply.`;
}

module.exports = {
  buildPrompt
};
