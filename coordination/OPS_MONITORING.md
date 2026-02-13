# OPS_MONITORING

## Daily Operator Report
- Run:
  - `powershell -ExecutionPolicy Bypass -File scripts/ops/daily-metrics-report.ps1`
  - or `npm run ops:daily-report`
- Optional:
  - `-ApiBase http://127.0.0.1:3001`
  - `-FailOnWarning` to exit non-zero when thresholds are exceeded
- Auth:
  - If `OPS_METRICS_TOKEN` is configured on API, set the same token in the report environment.

## Metrics Source
- Endpoint: `GET /ops/metrics/summary`
- Data source: `AuditLog` aggregates for:
  - Last 24 hours
  - Last 7 days

## Metric Meanings
- `FREE_LIMIT_REACHED`: Free-tier monthly limit hits (quota pressure indicator).
- `FREE_OCR_DISABLED`: Free-tier blocked by kill switch.
- `PLUS_REQUIRED`: Requests that attempted Plus-only routes without active entitlement.
- `OCR_RUN success/fail`: OCR reliability and failure rate trend.
- `OCR pageUnitsTotal`: Total processed OCR page units (cost proxy).
- `consult links created/disabled`: Consultation sharing activity.
- `finalize enqueue success/fail`: Pipeline handoff reliability to worker queue.

## Suggested Thresholds (env-configurable)
- `OPS_ALERT_OCR_FAILURE_RATE_PCT` (default `15`)
- `OPS_ALERT_FREE_LIMIT_REACHED_24H` (default `25`)
- `OPS_ALERT_PLUS_REQUIRED_24H` (default `40`)
- `OPS_ALERT_ENQUEUE_FAILURE_RATE_PCT` (default `5`)

## Action Playbook
1. High OCR failure rate:
   - Check worker health and provider credentials.
   - Review recent `OCR_RUN` failure payload diagnostics.
2. FREE_LIMIT_REACHED spike:
   - Confirm expected demand pattern.
   - Tighten quotas if needed (`FREE_MONTHLY_PAGE_LIMIT`, `FREE_DAILY_UPLOAD_LIMIT`).
3. PLUS_REQUIRED spike:
   - Verify entitlement config (`CLEARCASE_PLUS_EMAILS`, `CLEARCASE_PLUS_SUBJECTS`).
   - Check for plan-state drift in QA or pilot cohort setup.
4. Enqueue failure increase:
   - Validate `AWS_REGION`/`SQS_QUEUE_URL`.
   - Check queue permissions and network reachability.
5. Emergency cost control:
   - Set `GLOBAL_FREE_OCR_ENABLED=false` and restart API.

