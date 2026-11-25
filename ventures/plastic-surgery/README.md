# Plastic Surgery Clinic

Status: planning

## Build with the factories
- Website: `zf web build specs/sites/aesthetic-clinic.toml`
- Patient app: `zf app build specs/apps/aesthetic-clinic-app.toml`

## Business plan checklist
- [ ] Jurisdiction and licensing (e.g. CQC in the UK, DHA in Dubai, state medical boards in the US)
- [ ] Surgeon credentials and board certification; malpractice insurance
- [ ] Facility accreditation, anaesthesia and emergency transfer protocol
- [ ] Service menu and pricing; financing partners
- [ ] Patient journey: enquiry -> consultation -> cooling-off period -> surgery -> aftercare
- [ ] Marketing compliance: no outcome guarantees; before/after photos only with written consent
- [ ] Patient data handling (GDPR / HIPAA as applicable)
- [ ] Booking system / CRM integration (set `form_action` / `submit_url` in specs)
