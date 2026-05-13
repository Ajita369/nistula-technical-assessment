const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { validateInboundMessage } = require("../schemas/messageSchema");
const { classifyQueryType } = require("../services/classificationService");
const { draftReply } = require("../services/claudeService");
const { computeConfidence, computeAction } = require("../utils/confidence");

const router = express.Router();

router.post("/message", async (req, res, next) => {
  try {
    const parsed = validateInboundMessage(req.body);
    const classification = classifyQueryType(parsed.message);

    const normalized = {
      message_id: uuidv4(),
      source: parsed.source,
      guest_name: parsed.guest_name,
      message_text: parsed.message,
      timestamp: parsed.timestamp,
      booking_ref: parsed.booking_ref,
      property_id: parsed.property_id,
      query_type: classification.queryType
    };

    const draftedReply = await draftReply(normalized);
    const confidenceScore = computeConfidence(
      classification.confidence,
      draftedReply,
      normalized.query_type
    );
    const action = computeAction(normalized.query_type, confidenceScore);

    res.json({
      message_id: normalized.message_id,
      query_type: normalized.query_type,
      drafted_reply: draftedReply,
      confidence_score: confidenceScore,
      action
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
