---
title: Service Level Agreement (SLA)
product: freightcode®
version: 1.0
date: March 2026
---

# 1. Service Commitment
freightcode® is committed to providing a highly available, robust platform for processing customs declarations. We will use commercially reasonable efforts to make the core Services available with a Monthly Uptime Percentage of at least **99.9%** (the "Service Commitment").

# 2. SLA Definitions
- **"Downtime"** means a period during which the freightcode API or frontend application is entirely unreachable, resulting in a 5xx HTTP response code for all users.
- **"Monthly Uptime Percentage"** is calculated by subtracting from 100% the percentage of minutes during the month in which the Services were in a state of Downtime.
- **"Scheduled Maintenance"** means scheduled periods of Downtime. We will provide formal notice via email and the in-app dashboard at least 48 hours prior to any Scheduled Maintenance. Scheduled Maintenance does not factor into Downtime calculations.

# 3. Exclusions
The Service Commitment does not apply to any unavailability, suspension, or termination of freightcode performance issues:
1. That result from **HM Revenue & Customs (HMRC)** API outages, routine maintenance, or latency issues within the UK Government Gateway.
2. That result from third-party Open Banking provider outages (e.g., TrueLayer, Stripe).
3. Caused by factors outside of our reasonable control, including any force majeure event or internet access issues.
4. That result from any actions or inactions of you or any third party, including failure to input required API keys or correctly format commercial invoices prior to AI extraction.

# 4. Service Credits
If freightcode fails to meet the Service Commitment in a given month, Pro tier subscribers are eligible to receive a Service Credit:
- **< 99.9% but >= 99.0% Uptime:** 10% of the monthly subscription fee.
- **< 99.0% Uptime:** 25% of the monthly subscription fee.

To receive a Service Credit, you must submit a claim by emailing `support@freightcode.com` within 30 days of the incident, providing logs representing the time and duration of the outage.
