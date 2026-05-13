function clampScore(value) {
  return Math.max(0, Math.min(1, value));
}

function computeConfidence(classificationConfidence, draftedReply, queryType) {
  let score = classificationConfidence;

  if (!draftedReply || draftedReply.trim().length < 20) {
    score -= 0.1;
  }

  if (queryType === "complaint") {
    score = Math.min(score, 0.5);
  }

  return Math.round(clampScore(score) * 100) / 100;
}

function computeAction(queryType, confidenceScore) {
  if (queryType === "complaint" || confidenceScore < 0.6) {
    return "escalate";
  }

  if (confidenceScore > 0.85) {
    return "auto_send";
  }

  return "agent_review";
}

module.exports = {
  computeConfidence,
  computeAction
};
