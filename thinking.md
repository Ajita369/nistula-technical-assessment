# Part 3 - 3am Incident Response

## Question A - Immediate Response
**Message to guest:**
"Hi there, I am really sorry about the hot water issue and how stressful this is before your breakfast plans. I am alerting our on-call caretaker and maintenance now and will confirm an ETA within 10 minutes. We will prioritize restoring hot water as quickly as possible. If this cannot be resolved promptly, I will work with management on suitable compensation and options. I will keep you updated shortly."

**Why this wording:** It acknowledges the frustration, commits to immediate action, and sets a clear next update time. It avoids overpromising while showing accountability and a path to resolution.

## Question B - System Design Response
- Classify as complaint and high priority; open an incident tied to the reservation and property.
- Trigger alerts to on-call maintenance and the property manager (SMS, push, and email), with a phone escalation if unacknowledged.
- Log the full message, AI draft, classification, confidence, and every status change.
- Create a work order with a timer; the guest receives an update when the issue is accepted and when a technician is dispatched.
- If no human response within 30 minutes, auto-escalate to a backup on-call list, notify leadership, and send the guest a follow-up apology with a concrete next action (alternate room or partial refund review).

## Question C - Learning and Prevention
- Detect the recurring hot-water complaints via a property-level alert rule (e.g., 3 similar complaints in 60 days).
- Automatically open a root-cause investigation ticket, assign engineering or maintenance leadership, and flag the property as at-risk.
- Schedule preventive maintenance checks before arrivals and add a pre-check checklist item for hot water.
- Track resolution quality and recurrence; if the issue persists, pause new bookings for the property until verified fixed.
- Use the pattern to update AI triage rules so repeat issues are escalated faster and compensation workflows are pre-approved.
