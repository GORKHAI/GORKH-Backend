# Personal Task Inbox

Task Inbox is a review queue for proposed actions. Tasks can be:

- proposed
- accepted
- scheduled
- done
- dismissed
- expired

The backend never executes tasks externally in v0.

## Ranking

Task ranking considers:

- urgency and due date
- priority
- task age
- source confidence and sensitivity

Stress load may later affect ranking only when the user has explicitly opted into stress support storage.
