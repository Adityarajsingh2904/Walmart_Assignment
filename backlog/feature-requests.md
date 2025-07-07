# Feature Requests and Bug Reports

This backlog aggregates user feedback from the Postgres `feedback` table and Zendesk support tickets.

## Sample SQL Queries

```sql
-- Count false-positive reports by alert type
SELECT alert_type, COUNT(*) AS false_positive_reports
FROM feedback
WHERE is_false_positive = true
GROUP BY alert_type
ORDER BY false_positive_reports DESC;

-- Extract recent comments for common pain points
SELECT comment
FROM feedback
WHERE comment IS NOT NULL
  AND comment <> ''
ORDER BY created_at DESC
LIMIT 50;
```

## False Positive Reports

| Alert Type | Reports |
|------------|---------|
| Phishing   | 42 |
| Malware    | 30 |
| DLP        | 15 |
| Other      | 8 |

Common pain point comments include:
- "Legitimate emails flagged as phishing."
- "Malware alerts triggered by business macros."
- "Alert volumes are difficult to manage."

## Zendesk Ticket Import

Download tickets from Zendesk and load them into Postgres:

```bash
curl -u <user:token> \
  -o zendesk_tickets.csv \
  https://example.zendesk.com/api/v2/incremental/tickets/csv?start_time=...
psql -c "\copy zendesk_tickets FROM 'zendesk_tickets.csv' CSV HEADER"
```

## Top Feature Requests and Bug Reports

| ID | Category | Description | Source | Reach | Impact | Confidence | Effort | RICE Score | Owner | Sprint |
|----|----------|-------------|--------|-------|--------|------------|--------|-----------:|-------|--------|
| 6 | Bug | Fix login redirect bug | Zendesk | 7 | 8 | 0.95 | 2 | 26.60 | Alice | 1 |
|10 | Bug | Dashboard loading bug | Feedback | 9 | 9 | 0.95 | 4 | 19.24 | Bob | 1 |
| 2 | Feature | Bulk dismiss false positives | Feedback | 7 | 7 | 0.90 | 3 | 14.70 | Carol | 2 |
| 1 | Feature | Custom notification filters | Feedback | 9 | 8 | 0.80 | 5 | 11.52 | Dave | 2 |
| 8 | Bug | Email parsing error | Zendesk | 6 | 7 | 0.80 | 3 | 11.20 | Alice | 2 |
| 5 | Feature | Export alerts to CSV | Zendesk | 8 | 6 | 0.80 | 4 |  9.60 | Bob | 3 |
| 9 | Feature | Slack notifications | Feedback | 7 | 7 | 0.85 | 5 |  8.33 | Carol | 3 |
| 7 | Feature | Dark mode UI theme | Zendesk | 5 | 5 | 0.90 | 3 |  7.50 | Dave | 4 |
| 3 | Bug | Improve scanning performance | Feedback | 8 | 9 | 0.80 | 8 |  7.20 | Bob | 4 |
| 4 | Feature | Granular role-based access control | Zendesk | 6 | 9 | 0.70 | 6 |  6.30 | Alice | 4 |

RICE Score = (Reach * Impact * Confidence) / Effort. Higher scores are prioritized for upcoming sprints.
