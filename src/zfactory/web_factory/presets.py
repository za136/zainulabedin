"""Industry presets: palette, tone and default sections. A spec can override any of it."""

MEDICAL_DISCLAIMER = ("Information on this site is general and not medical advice. Results vary by "
                      "individual. All procedures are performed after an in-person consultation with "
                      "a qualified, licensed practitioner.")

PRESETS = {
    "aesthetic-clinic": {
        "palette": {"bg": "#faf7f4", "fg": "#2b2724", "accent": "#b08968", "muted": "#e9e1d9"},
        "tagline": "Natural results, expert care.",
        "services": [
            {"name": "Rhinoplasty", "summary": "Refine nasal shape and improve breathing."},
            {"name": "Breast Augmentation", "summary": "Tailored enhancement with a personal plan."},
            {"name": "Liposuction", "summary": "Contour stubborn areas of fat."},
            {"name": "Facelift", "summary": "Restore a rested, youthful look."},
            {"name": "Blepharoplasty", "summary": "Eyelid surgery for a refreshed appearance."},
            {"name": "Non-surgical Injectables", "summary": "Botox and fillers by trained clinicians."},
        ],
        "cta": "Book a consultation",
        "disclaimer": MEDICAL_DISCLAIMER,
    },
    "facials-spa": {
        "palette": {"bg": "#f6faf8", "fg": "#1f2a26", "accent": "#5e9c84", "muted": "#dcebe4"},
        "tagline": "Skin that feels as good as it looks.",
        "services": [
            {"name": "Signature Facial", "summary": "Cleanse, exfoliate, extract, hydrate. 60 min."},
            {"name": "HydraFacial", "summary": "Deep cleanse and hydration with no downtime."},
            {"name": "Chemical Peel", "summary": "Even tone and texture."},
            {"name": "Microneedling", "summary": "Stimulate collagen for smoother skin."},
            {"name": "LED Therapy", "summary": "Calm redness and support healing."},
            {"name": "Acne Clinic", "summary": "Targeted treatment plans for clear skin."},
        ],
        "cta": "Book a facial",
        "disclaimer": "Treatments are cosmetic. Please tell your therapist about any skin conditions, "
                      "medications or allergies before your appointment.",
    },
    "film-studio": {
        "palette": {"bg": "#0e0e10", "fg": "#f2f2f2", "accent": "#e0b341", "muted": "#1c1c21"},
        "tagline": "Stories made for the big screen.",
        "services": [
            {"name": "Feature Films", "summary": "Development through distribution."},
            {"name": "Commercials", "summary": "Cinematic brand storytelling."},
            {"name": "Music Videos", "summary": "Bold visuals for artists."},
            {"name": "Post-production", "summary": "Edit, color, VFX and sound."},
        ],
        "cta": "Start a project",
        "disclaimer": "",
    },
    "saas": {
        "palette": {"bg": "#ffffff", "fg": "#14171f", "accent": "#4f46e5", "muted": "#eef0f6"},
        "tagline": "Ship faster with less effort.",
        "services": [
            {"name": "Automation", "summary": "Remove repetitive work."},
            {"name": "Analytics", "summary": "See what matters in real time."},
            {"name": "Integrations", "summary": "Connect the tools you already use."},
        ],
        "cta": "Get started",
        "disclaimer": "",
    },
}
