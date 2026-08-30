                ┌──────────────┐
                │   Frontend   │
                └──────┬───────┘
                       │ username
                       ▼
                ┌──────────────┐
                │ Express API  │
                └──────┬───────┘
                       ▼
                ┌──────────────┐
                │ Lead Service │
                └──────┬───────┘
                       │
                MongoDB lookup
                 ┌─────┴─────┐
                 │           │
              EXISTS       NEW
                 │           │
                 ▼           ▼
              MongoDB     LinkedIn
                              │
                              ▼
                           Parser
                              │
                              ▼
                           MongoDB
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
                  return              store