# Part 3 — 3am Incident Response

## Question A — Immediate Response

**Message sent to guest:**

> Hi, I'm really sorry about the hot water — I can only imagine how stressful this is with breakfast guests arriving in a few hours. I've alerted our on-call caretaker right now and they've been asked to attend as a matter of urgency. I'll have a confirmed update for you within 10 minutes. If this cannot be resolved quickly, I will personally make sure management addresses your refund request. Please stay warm — I'm on this.

**Why this wording:** The reply leads with genuine empathy before anything else — at 3am a guest needs to feel heard, not handled. It commits to a specific, concrete next step (caretaker alerted, 10-minute update window) which reduces anxiety and shows accountability. The refund request is explicitly acknowledged rather than deflected, and "I will personally make sure" gives a human face to what is otherwise an automated system.

---

## Question B — System Design

When this message arrives, the platform does the following automatically:

1. **Classify and flag.** The message is classified as `complaint` with `action: escalate`. An incident record is opened, linked to the reservation, the property, and the guest profile.

2. **Notify on-call staff immediately.** SMS and WhatsApp alerts fire to the on-call caretaker and property manager. If either alert is unacknowledged within 5 minutes, the system calls their phone. A backup contact list is queued for 15 minutes in.

3. **Log everything with timestamps.** The full message, AI draft, classification, confidence score, and every subsequent status change (alert sent, acknowledged, technician dispatched) are written to the database. This is the audit trail for any refund or dispute.

4. **Create a maintenance work order.** A ticket is raised for "hot water — urgent" with a 1-hour resolution SLA. The guest receives a status update when the caretaker accepts the job and again when they arrive.

5. **30-minute escalation rule.** If no human has acknowledged the incident within 30 minutes, the system auto-escalates to the regional operations lead, notifies leadership, and sends the guest a follow-up: an apology, confirmation the team is en route, and a written commitment that management will contact them about the refund by 9am.

---

## Question C — Learning and Prevention

The system runs a nightly pattern-detection query. When the same complaint category (here: `hot_water`) at the same property appears 3 or more times within a rolling 60-day window, the following triggers automatically:

- A **root-cause investigation ticket** is opened and assigned to the property manager and maintenance lead, with a mandatory sign-off deadline.
- The property is **flagged as at-risk** in the internal dashboard, visible to reservations and operations teams.
- A **pre-arrival checklist item** — "Verify hot water pressure and temperature" — is added to every future check-in for that property, firing 48 hours before each arrival.
- The **supplier/maintenance contract** for that property is surfaced for management review, prompting an assessment of whether the underlying issue is a recurring hardware fault.

If a fourth complaint of the same type occurs before the investigation is closed, the system automatically **pauses new bookings** on the property and flags it for a verification walkthrough before reopening. This turns reactive complaint handling into a proactive quality gate: the system learns from patterns so guests stop being the ones who discover the problem.
