# Reminder Channel Model

Task Inbox now records reminder intent without sending any external notification.

Fields:

- `remindAt`
- `reminderChannel`
- `reminderStatus`

Channels:

- `none`
- `in_app`
- `mobile_push_future`
- `email_future`

Statuses:

- `none`
- `scheduled`
- `ready`
- `dismissed`

No push provider and no email provider are implemented in this milestone. Mobile sync exposes reminder-ready task fields so iOS can render and acknowledge reminder intent later.
