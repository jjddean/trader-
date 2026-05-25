# Top UK Open Banking Partners for Freightcode

To execute the "Technical Service Provider" loophole described in the FCA application, Freightcode cannot touch the payment funds. Instead, we must partner with a fully FCA-regulated **Payment Initiation Service Provider (PISP)**. 

When a user clicks "Pay HMRC Duty £4,500" in Freightcode, our software simply tells the Partner API how much to charge and who to send it to. The Partner handles the money, assumes the regulatory liability, and deposits it with HMRC.

Here are the top UK partners to consider for B2B Customs payments:

---

## 1. TrueLayer
**Best For:** Developer experience and instant B2B bank transfers.
- **Why they fit Freightcode:** TrueLayer is the European leader in Open Banking. They specialise in "Pay by Bank" (instant account-to-account transfers). Because customs duties can be extremely high (e.g., £20,000+), traditional credit card networks take massive percentage fees. TrueLayer bypasses cards entirely, allowing the SME importer to authorise a direct, instant bank payment to HMRC for pennies per transaction.
- **Regulatory Status:** Fully FCA Authorised. They act as the regulated entity, and you are simply their software client.
- **API Quality:** World-class documentation specifically designed for SaaS apps to embed payment flows.

## 2. GoCardless
**Best For:** Recurring payments or predictable monthly billing.
- **Why they fit Freightcode:** GoCardless traditionally dominated Direct Debit but recently acquired an Open Banking startup (Nordigen). They now offer "Instant Bank Pay" alongside Direct Debit. If you eventually want to offer SMEs a line of credit or spread their Duty Payments across 3 months directly from their bank accounts, their dual API is very powerful.
- **Regulatory Status:** Fully FCA Authorised. Huge international footprint.

## 3. Stripe (with Open Banking via Financial Connections)
**Best For:** An all-in-one solution for SaaS billing and B2B payments.
- **Why they fit Freightcode:** Stripe is the easiest API to integrate. You can use Stripe to charge your users the monthly £49 SaaS fee, and *also* use their new "Financial Connections" and "Pay by Bank" APIs to route the massive HMRC duty payments. 
- **Regulatory Status:** Stripe Payments UK Ltd is fully regulated by the FCA. By using "Stripe Connect", you can route money directly from the Importer to HMRC without you ever being legally "in possession" of the funds. They are the ultimate "Technical Service Provider" partner.

## 4. Modulr
**Best For:** Complex B2B FinTech features (Digital Wallets, Escrow).
- **Why they fit Freightcode:** Modulr isn't just a payment gateway; they are a Banking-as-a-Service (BaaS) provider. With Modulr, you could actually give every single Freightcode user their own unique "Customs Payment Bank Account" (with a real UK sort code and account number). The importer deposits £50k into their Freightcode wallet, and your SaaS automatically pays HMRC duties out of that wallet via Modulr's API as declarations are cleared.
- **Regulatory Status:** FCA-authorised Electronic Money Institution (EMI).

---

### Recommendation:
For Phase 5 of Freightcode's development, **Stripe Connect** or **TrueLayer** are the absolute best starting points. 

If you want the absolute lowest transaction fees for highly expensive B2B duty payments, go with **TrueLayer**. If you want a quick, easy, all-in-one API that handles both your SaaS subscriptions and the duty payment routing, go with **Stripe Connect**.
