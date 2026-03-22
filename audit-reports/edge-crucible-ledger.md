# Edge Crucible Ledger

Generated: 2026-03-21T13:03:16.331Z
## Seed Context

- workspace_id: 00000000-0000-0000-0000-000000000010
- admin_user_id: 00000000-0000-0000-0000-000000000001
- worker_user_id: 00000000-0000-0000-0000-000000000002
- client_id: 00000000-0000-0000-0000-00000000ca01
- participant_id: 00000000-0000-0000-0000-00000000aa01
- job_id: 00000000-0000-0000-0000-00000000dd01

Functions: 95
PASS: 0 | WARN: 72 | FAIL: 23

## Per-function verdict

### accept-invite — WARN
- happy: status=400 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=400 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### accounting-webhook — WARN
- happy: status=400 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=400 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### aegis-triage-router — WARN
- happy: status=400 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=400 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### agent-outrider-arbitrator — WARN
- happy: status=400 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=400 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### aggregate-coordination-billing — FAIL
- happy: status=500 timeout=false class=FAIL_500_ON_HAPPY mutations=0
- malformed: status=500 timeout=false class=FAIL_500_ON_MALFORMED mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### asset-service-reminder — FAIL
- happy: status=500 timeout=false class=FAIL_500_ON_HAPPY mutations=0
- malformed: status=500 timeout=false class=FAIL_500_ON_MALFORMED mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### automation-worker — WARN
- happy: status=400 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=400 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### calculate-dynamic-yield — WARN
- happy: status=200 timeout=false class=PASS mutations=0
- malformed: status=200 timeout=false class=WARN_ACCEPTED_MALFORMED mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### calculate-travel-financials — WARN
- happy: status=401 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=401 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### care-dashboard-snapshot — WARN
- happy: status=401 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=401 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### catalog-nightly-sync — FAIL
- happy: status=500 timeout=false class=FAIL_500_ON_HAPPY mutations=0
- malformed: status=500 timeout=false class=FAIL_500_ON_MALFORMED mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### color-math — WARN
- happy: status=400 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=400 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### contextual-sop-match — WARN
- happy: status=400 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=400 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### convoy-daily-health-check — FAIL
- happy: status=500 timeout=false class=FAIL_500_ON_HAPPY mutations=0
- malformed: status=500 timeout=false class=FAIL_500_ON_MALFORMED mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### convoy-defect-escalation — WARN
- happy: status=400 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=400 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### create-checkout — WARN
- happy: status=400 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=400 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### create-terminal-intent — WARN
- happy: status=401 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=401 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### dispatch-arrival-sms — FAIL
- happy: status=500 timeout=false class=FAIL_500_ON_HAPPY mutations=0
- malformed: status=500 timeout=false class=FAIL_500_ON_MALFORMED mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### dispatch-invoices — FAIL
- happy: status=500 timeout=false class=FAIL_500_ON_HAPPY mutations=0
- malformed: status=500 timeout=false class=FAIL_500_ON_MALFORMED mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### distribute-policy — WARN
- happy: status=401 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=401 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### evaluate-halcyon-state — WARN
- happy: status=200 timeout=false class=PASS mutations=0
- malformed: status=200 timeout=false class=WARN_ACCEPTED_MALFORMED mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### execute-drop-and-cover — WARN
- happy: status=400 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=400 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### execute-workflow — WARN
- happy: status=401 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=401 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### fetch-participant-dossier — WARN
- happy: status=401 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=401 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### generate-pdf — WARN
- happy: status=404 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=404 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### generate-plan-report — WARN
- happy: status=401 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=401 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### generate-proda-payload — WARN
- happy: status=400 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=400 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### generate-sil-roc-excel — WARN
- happy: status=401 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=401 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### generate-swms-pdf — WARN
- happy: status=400 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=400 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### get-participant-timeline — WARN
- happy: status=401 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=401 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### inbound-email-webhook — WARN
- happy: status=400 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=400 timeout=false class=PASS mutations=0
- unauthorized: status=n/a timeout=false class=SKIPPED mutations=0
### inbound-supplier-invoice — WARN
- happy: status=400 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=400 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### ingest-regulation — WARN
- happy: status=400 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=400 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### ingest-telemetry — FAIL
- happy: status=500 timeout=false class=FAIL_500_ON_HAPPY mutations=0
- malformed: status=500 timeout=false class=FAIL_500_ON_MALFORMED mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### invite-member — WARN
- happy: status=400 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=400 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### live-price-check — WARN
- happy: status=400 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=400 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### log-wallet-transaction — WARN
- happy: status=401 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=401 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### oracle-claim-predict — WARN
- happy: status=400 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=400 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### outrider-en-route-notify — FAIL
- happy: status=500 timeout=false class=FAIL_500_ON_HAPPY mutations=0
- malformed: status=400 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### pace-check-budget — WARN
- happy: status=400 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=400 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### pace-submit-claim — WARN
- happy: status=400 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=400 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### panopticon-text-to-sql — WARN
- happy: status=400 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=400 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### payroll-evaluator — WARN
- happy: status=400 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=400 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### pending-critical-policies — WARN
- happy: status=401 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=401 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### polar-webhook — FAIL
- happy: status=500 timeout=false class=FAIL_500_ON_HAPPY mutations=0
- malformed: status=500 timeout=false class=FAIL_500_ON_MALFORMED mutations=0
- unauthorized: status=n/a timeout=false class=SKIPPED mutations=0
### portal-link — WARN
- happy: status=401 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=401 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### process-inbound-invoice — WARN
- happy: status=400 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=400 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### process-integration-sync-queue — FAIL
- happy: status=500 timeout=false class=FAIL_500_ON_HAPPY mutations=0
- malformed: status=500 timeout=false class=FAIL_500_ON_MALFORMED mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### process-mail — FAIL
- happy: status=500 timeout=false class=FAIL_500_ON_HAPPY mutations=0
- malformed: status=500 timeout=false class=FAIL_500_ON_MALFORMED mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### process-outbound — FAIL
- happy: status=500 timeout=false class=FAIL_500_ON_HAPPY mutations=0
- malformed: status=500 timeout=false class=FAIL_500_ON_MALFORMED mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### process-payout — WARN
- happy: status=401 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=401 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### process-shift-note — WARN
- happy: status=400 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=400 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### process-sync-queue — WARN
- happy: status=401 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=401 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### process-telemetry-alert — WARN
- happy: status=200 timeout=false class=PASS mutations=0
- malformed: status=200 timeout=false class=WARN_ACCEPTED_MALFORMED mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### process-timesheet-math — WARN
- happy: status=400 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=400 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### process-transit — WARN
- happy: status=401 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=401 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### process-webhook-queue — FAIL
- happy: status=500 timeout=false class=FAIL_500_ON_HAPPY mutations=0
- malformed: status=500 timeout=false class=FAIL_500_ON_MALFORMED mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### proda-auth — WARN
- happy: status=404 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=404 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### provision-house-threads — WARN
- happy: status=200 timeout=false class=PASS mutations=0
- malformed: status=200 timeout=false class=WARN_ACCEPTED_MALFORMED mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### push-dispatcher — WARN
- happy: status=400 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=400 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### receipt-ocr — FAIL
- happy: status=500 timeout=false class=FAIL_500_ON_HAPPY mutations=0
- malformed: status=500 timeout=false class=FAIL_500_ON_MALFORMED mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### regulatory-rag-intercept — WARN
- happy: status=400 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=400 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### resend-webhook — WARN
- happy: status=400 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=400 timeout=false class=PASS mutations=0
- unauthorized: status=n/a timeout=false class=SKIPPED mutations=0
### revenuecat-webhook — FAIL
- happy: status=500 timeout=false class=FAIL_500_ON_HAPPY mutations=0
- malformed: status=500 timeout=false class=FAIL_500_ON_MALFORMED mutations=0
- unauthorized: status=n/a timeout=false class=SKIPPED mutations=0
### run-automations — FAIL
- happy: status=500 timeout=false class=FAIL_500_ON_HAPPY mutations=0
- malformed: status=500 timeout=false class=FAIL_500_ON_MALFORMED mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### schads-interpreter — WARN
- happy: status=401 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=401 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### semantic-voice-router — FAIL
- happy: status=500 timeout=false class=FAIL_500_ON_HAPPY mutations=0
- malformed: status=500 timeout=false class=FAIL_500_ON_MALFORMED mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### send-push — WARN
- happy: status=400 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=400 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### sentinel-scan — WARN
- happy: status=400 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=400 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### sirs-sanitizer — WARN
- happy: status=400 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=400 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### smart-roster-match — WARN
- happy: status=404 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=404 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### start-report-aggregation — WARN
- happy: status=401 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=401 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### stripe-connect-onboard — WARN
- happy: status=401 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=401 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### stripe-webhook — WARN
- happy: status=400 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=400 timeout=false class=PASS mutations=0
- unauthorized: status=n/a timeout=false class=SKIPPED mutations=0
### submit-internal-feedback — WARN
- happy: status=400 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=400 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### submit-leave-request — WARN
- happy: status=400 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=400 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### sync-chat-memberships — WARN
- happy: status=200 timeout=false class=PASS mutations=0
- malformed: status=200 timeout=false class=WARN_ACCEPTED_MALFORMED mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### sync-engine — FAIL
- happy: status=500 timeout=false class=FAIL_500_ON_HAPPY mutations=0
- malformed: status=500 timeout=false class=FAIL_500_ON_MALFORMED mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### sync-leave-balances — FAIL
- happy: status=500 timeout=false class=FAIL_500_ON_HAPPY mutations=0
- malformed: status=500 timeout=false class=FAIL_500_ON_MALFORMED mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### sync-ndis-catalogue — WARN
- happy: status=400 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=400 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### sync-outbound — FAIL
- happy: status=500 timeout=false class=FAIL_500_ON_HAPPY mutations=0
- malformed: status=500 timeout=false class=FAIL_500_ON_MALFORMED mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### sync-polar-status — FAIL
- happy: status=503 timeout=false class=FAIL_500_ON_HAPPY mutations=0
- malformed: status=503 timeout=false class=FAIL_500_ON_MALFORMED mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### synthesize-plan-review — WARN
- happy: status=400 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=400 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### terminal-token — WARN
- happy: status=401 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=401 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### trigger-daily-emails — FAIL
- happy: status=500 timeout=false class=FAIL_500_ON_HAPPY mutations=0
- malformed: status=500 timeout=false class=FAIL_500_ON_MALFORMED mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### trust-engine — WARN
- happy: status=400 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=400 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### twilio-llm-negotiator — WARN
- happy: status=400 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=400 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### twilio-voice-inbound — WARN
- happy: status=200 timeout=false class=PASS mutations=0
- malformed: status=200 timeout=false class=WARN_ACCEPTED_MALFORMED mutations=0
- unauthorized: status=n/a timeout=false class=SKIPPED mutations=0
### twilio-voice-status — WARN
- happy: status=200 timeout=false class=PASS mutations=0
- malformed: status=200 timeout=false class=WARN_ACCEPTED_MALFORMED mutations=0
- unauthorized: status=n/a timeout=false class=SKIPPED mutations=0
### twilio-webhook — WARN
- happy: status=400 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=400 timeout=false class=PASS mutations=0
- unauthorized: status=n/a timeout=false class=SKIPPED mutations=0
### update-member-role — WARN
- happy: status=400 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=400 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### validate-schedule — WARN
- happy: status=401 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=401 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### verify-s8-witness — WARN
- happy: status=400 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=400 timeout=false class=PASS mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### vision-hazard-analyzer — FAIL
- happy: status=500 timeout=false class=FAIL_500_ON_HAPPY mutations=0
- malformed: status=500 timeout=false class=FAIL_500_ON_MALFORMED mutations=0
- unauthorized: status=401 timeout=false class=PASS mutations=0
### webhooks-ingest — WARN
- happy: status=400 timeout=false class=WARN_NON_2XX_HAPPY mutations=0
- malformed: status=400 timeout=false class=PASS mutations=0
- unauthorized: status=n/a timeout=false class=SKIPPED mutations=0
