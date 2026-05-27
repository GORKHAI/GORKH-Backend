# Commitment Quality

Commitment extraction is conservative. It looks for explicit language such as:
- "I will..."
- "I need to..."
- "We agreed..."
- "Follow up next week..."
- "Waiting on..."
- "The bank asked for..."
- "The doctor said follow up..."

Commitments are proposed by default. Users can confirm, dismiss, or mark them done through review APIs.

Safety rules:
- No commitments are extracted from discarded or interrupted sessions.
- Bank, medical, and legal contexts are labeled as higher sensitivity.
- Medical/legal/financial commitments are review items only, not final advice.
- Waiting-on-others items are separated from user-owned tasks.
