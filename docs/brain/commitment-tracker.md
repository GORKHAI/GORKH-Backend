# Commitment Tracker

The commitment tracker detects explicit statements such as:

- "I will..."
- "I'll..."
- "We agreed..."
- "Send by Friday..."
- "Follow up next week..."
- "The doctor said follow up..."
- "The bank asked for..."
- "Client asked me to..."
- "I need to..."

All extracted commitments start as `proposed`.

## Privacy Rules

- Saved sessions may produce proposed commitments.
- Discarded sessions do not.
- Interrupted sessions do not.
- Manual entries may produce proposed commitments immediately.

## High-Stakes Contexts

Doctor, bank, and legal contexts are treated as medium sensitivity when relevant. The system captures next steps and questions only; it does not decide treatment, legal strategy, or financial choices.
