# Task Ranking Policy

Task Inbox v1 ranks proposed and accepted tasks using:
- due date urgency
- task priority
- commitment confidence and source risk
- actionability
- freshness
- dependency/blocker state
- repeated dismissal feedback
- stress/load only when stress support is opted in

Tasks remain proposed until accepted. GORKH does not execute external actions, send messages, schedule meetings, or submit forms.

Ranking explanations are returned with `/daily/tasks` so users can inspect why an item is near the top. Waiting or blocked items are still visible but receive a dependency penalty until the user can act.
