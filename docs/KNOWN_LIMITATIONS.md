# LSpot Restaurant Manager (LRM) — Known Limitations & Assumptions

## 1. Assumptions
1. **Default Tenant**: The system initializes with default tenant `The LSpot Restaurant` and primary branch `Manyama Main Branch` in Kalumbila District, Zambia.
2. **Local Currency**: Base currency is `ZMW` (Zambian Kwacha), formatted with two decimal places (e.g. `K 75.00`).
3. **Timezone**: `Africa/Lusaka` (UTC+2) for all business day cutoffs and kitchen operational shifts.
4. **ZRA Smart Invoice**: Actual ZRA fiscal registration requires official merchant credentials and cryptographic keys from the Zambia Revenue Authority. The system implements the official data model, compliant signature placeholders, and submission queues ready for live activation.
5. **WhatsApp Notifications**: Production automated messaging uses the official WhatsApp Business Cloud API. An editable adapter configuration interface allows manual WhatsApp share link generation (via `https://wa.me/`) when API credentials are pending.

## 2. Technical Safeguards
- Non-destructive updates: Database migrations are strictly additive.
- No auto-truncation or drop table scripts.
- Transactional locking on stock deduction during concurrent checkouts.
