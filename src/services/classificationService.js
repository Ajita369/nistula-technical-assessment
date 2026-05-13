// Word-boundary matching prevents false positives such as "no problem" triggering
// the "problem" complaint keyword, or "issues" matching "issue".
function containsAny(text, keywords) {
  return keywords.some((keyword) => {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`).test(text);
  });
}

// Complaint: strong negative sentiment or explicit escalation signals.
// "issue" and "problem" are intentionally excluded — they are too generic and
// fire on phrases like "no problem" or "check-in issue" (which is post-sales, not a complaint).
const COMPLAINT_KEYWORDS = [
  "complaint",
  "refund",
  "unacceptable",
  "not happy",
  "angry",
  "disgusted",
  "dissatisfied",
  "terrible",
  "awful",
  "broken",
  "not working",
  "no hot water",
  "dirty",
  "unhappy",
  "outraged"
];

const POST_SALES_KEYWORDS = [
  "check in",
  "check-in",
  "check out",
  "check-out",
  "checkout",
  "wifi",
  "wi-fi",
  "password",
  "keys",
  "key",
  "access",
  "late checkout",
  "early checkin",
  "caretaker",
  "directions"
];

const SPECIAL_REQUEST_KEYWORDS = [
  "early check-in",
  "late check-out",
  "airport transfer",
  "airport pickup",
  "pickup",
  "drop",
  "cab",
  "taxi",
  "chef",
  "special request",
  "decoration",
  "birthday",
  "anniversary",
  "flowers",
  "cake",
  "romantic"
];

const PRICING_KEYWORDS = [
  "rate",
  "price",
  "pricing",
  "cost",
  "tariff",
  "quote",
  "per night",
  "per day",
  "discount",
  "how much",
  "charge",
  "charges",
  "budget",
  "fee",
  "fees"
];

const AVAILABILITY_KEYWORDS = [
  "available",
  "availability",
  "dates",
  "vacant",
  "book",
  "booking",
  "free"
];

const GENERAL_ENQUIRY_KEYWORDS = [
  "pet",
  "pets",
  "parking",
  "smoking",
  "pool hours",
  "gym",
  "breakfast",
  "restaurant",
  "food",
  "beach",
  "activities",
  "nearby",
  "allow",
  "policy",
  "rules"
];

function classifyQueryType(messageText) {
  const text = messageText.toLowerCase();

  // Complaints take highest priority — always escalate.
  if (containsAny(text, COMPLAINT_KEYWORDS)) {
    return { queryType: "complaint", confidence: 0.9 };
  }

  // Post-sales operational questions (check-in time, WiFi, keys).
  if (containsAny(text, POST_SALES_KEYWORDS)) {
    return { queryType: "post_sales_checkin", confidence: 0.85 };
  }

  // Special service requests (chef, transfers, decorations).
  if (containsAny(text, SPECIAL_REQUEST_KEYWORDS)) {
    return { queryType: "special_request", confidence: 0.82 };
  }

  const hasAvailability = containsAny(text, AVAILABILITY_KEYWORDS);
  const hasPricing = containsAny(text, PRICING_KEYWORDS);

  // Combined availability + pricing query — classify as availability (the
  // primary intent) but at slightly lower confidence due to the mixed signal.
  if (hasAvailability && hasPricing) {
    return { queryType: "pre_sales_availability", confidence: 0.78 };
  }

  if (hasAvailability) {
    return { queryType: "pre_sales_availability", confidence: 0.8 };
  }

  if (hasPricing) {
    return { queryType: "pre_sales_pricing", confidence: 0.82 };
  }

  // Explicit general enquiry keywords (pets, parking, policy).
  if (containsAny(text, GENERAL_ENQUIRY_KEYWORDS)) {
    return { queryType: "general_enquiry", confidence: 0.75 };
  }

  // Fallback — no strong signal; low confidence.
  return { queryType: "general_enquiry", confidence: 0.55 };
}

module.exports = {
  classifyQueryType
};
