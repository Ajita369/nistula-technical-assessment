const COMPLAINT_KEYWORDS = [
  "complaint",
  "refund",
  "unacceptable",
  "not happy",
  "angry",
  "issue",
  "problem",
  "broken",
  "not working",
  "no hot water",
  "dirty"
];

const POST_SALES_KEYWORDS = [
  "check in",
  "check-in",
  "check out",
  "checkout",
  "wifi",
  "password",
  "keys",
  "access",
  "late checkout"
];

const SPECIAL_REQUEST_KEYWORDS = [
  "early check-in",
  "late check-out",
  "airport transfer",
  "pickup",
  "drop",
  "chef",
  "special request",
  "decoration",
  "birthday",
  "anniversary"
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
  "discount"
];

const AVAILABILITY_KEYWORDS = [
  "available",
  "availability",
  "dates",
  "vacant"
];

function containsAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function classifyQueryType(messageText) {
  const text = messageText.toLowerCase();

  if (containsAny(text, COMPLAINT_KEYWORDS)) {
    return { queryType: "complaint", confidence: 0.9 };
  }

  if (containsAny(text, POST_SALES_KEYWORDS)) {
    return { queryType: "post_sales_checkin", confidence: 0.85 };
  }

  if (containsAny(text, SPECIAL_REQUEST_KEYWORDS)) {
    return { queryType: "special_request", confidence: 0.8 };
  }

  const availabilityMatch = containsAny(text, AVAILABILITY_KEYWORDS);
  const pricingMatch = containsAny(text, PRICING_KEYWORDS);

  if (availabilityMatch && pricingMatch) {
    return { queryType: "pre_sales_availability", confidence: 0.78 };
  }

  if (availabilityMatch) {
    return { queryType: "pre_sales_availability", confidence: 0.75 };
  }

  if (pricingMatch) {
    return { queryType: "pre_sales_pricing", confidence: 0.82 };
  }

  return { queryType: "general_enquiry", confidence: 0.6 };
}

module.exports = {
  classifyQueryType
};
