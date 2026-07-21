#!/bin/bash
# GoViral site QA gate. Run from goviral-website/. Exit 0 = shippable, 1 = violations.
# Checks Akshat's hard rules: em dashes, link integrity, JSON-LD validity,
# platform-locked proof, Calendly mapping, squeeze-page purity, sitemap integrity.
cd "$(dirname "$0")" || exit 1
python3 - <<'PYEOF'
import re, json, os, sys, glob, html

fails, warns = [], []
pages = sorted(glob.glob("*.html"))

# 1. Em dashes: zero tolerance in copy files
for f in pages + glob.glob("css/*.css") + glob.glob("js/*.js"):
    for i, line in enumerate(open(f, encoding="utf-8"), 1):
        if "—" in line:
            fails.append(f"EM DASH: {f}:{i}")

# 2. Internal link and asset integrity
def resolve(target):
    t = target.split("#")[0].split("?")[0]
    if not t or t.startswith(("http", "mailto:", "tel:", "data:", "//", "javascript:")):
        return None
    t = t.lstrip("/") or "index.html"
    return t

for f in pages:
    s = open(f, encoding="utf-8").read()
    for m in re.finditer(r'(?:href|src)=["\']([^"\']+)["\']', s):
        t = resolve(m.group(1))
        if t is None:
            continue
        if not (os.path.exists(t) or os.path.exists(t + ".html")):
            fails.append(f"BROKEN LINK: {f} -> {m.group(1)}")

# 3. JSON-LD must parse
for f in pages:
    s = open(f, encoding="utf-8").read()
    for i, m in enumerate(re.finditer(r'<script[^>]*application/ld\+json[^>]*>([\s\S]*?)</script>', s), 1):
        try:
            json.loads(m.group(1))
        except Exception as e:
            fails.append(f"JSON-LD INVALID: {f} block {i}: {e}")

# 4. Platform-locked proof: LP pages may only show their own platform's case studies
locks = {"google": ["google-ads.html", "google-ads-confirmed.html", "google-ads-audit-ecom.html", "google-ads-audit-leadgen.html"],
         "meta": ["meta-ads.html", "meta-ads-confirmed.html"],
         "seo": ["seo-autopilot.html", "seo-autopilot-confirmed.html"]}
for platform, files in locks.items():
    for f in files:
        if not os.path.exists(f):
            continue
        s = open(f, encoding="utf-8").read()
        for m in re.finditer(r'assets/case-studies/([^"\')\s]+)', s):
            if not m.group(1).startswith(platform + "-"):
                fails.append(f"PROOF LEAK: {f} references non-{platform} asset {m.group(1)}")

# 5. Calendly mapping (per Akshat, 2026-07-03)
assigned = {"google-ads.html": "buildbraand/google-ad-audit",
            "google-ads-audit-ecom.html": "buildbraand/google-ad-audit",
            "google-ads-audit-leadgen.html": "buildbraand/google-ad-audit",
            "meta-ads.html": "buildbraand/ads-strategy-call",
            "seo-autopilot.html": "buildbraand/goviral-ads-strategy-meet-clone"}
default = "buildbraand/goviral-ads-strategy-meet"
for f in pages:
    s = open(f, encoding="utf-8").read()
    links = set(re.findall(r'calendly\.com/([\w\-/]+)', s))
    if f in assigned:
        bad = links - {assigned[f]}
        if bad:
            fails.append(f"CALENDLY MAP: {f} must only use {assigned[f]}, found {sorted(bad)}")
        if not links:
            fails.append(f"CALENDLY MAP: {f} has no Calendly CTA at all")
    else:
        allowed = {default} | ({assigned.get(f.replace('-confirmed',''),'')} if '-confirmed' in f else set())
        bad = links - allowed - {''}
        if bad:
            warns.append(f"CALENDLY: {f} uses non-default link(s) {sorted(bad)}")

# 6. Squeeze pages: no navigation, no lead forms
for f in ["google-ads.html", "google-ads-audit-ecom.html", "google-ads-audit-leadgen.html", "meta-ads.html", "seo-autopilot.html"]:
    s = open(f, encoding="utf-8").read()
    if re.search(r'<nav[\s>]', s):
        fails.append(f"SQUEEZE PURITY: {f} contains a <nav> element")
    if 'data-lead-form' in s:
        fails.append(f"SQUEEZE PURITY: {f} contains a lead form (Calendly only)")

# 7. Sitemap URLs must map to real files
if os.path.exists("sitemap.xml"):
    s = open("sitemap.xml", encoding="utf-8").read()
    for m in re.finditer(r'<loc>\s*https?://[^/<]+(/[^<\s]*)\s*</loc>', s):
        t = resolve(m.group(1))
        if t and not (os.path.exists(t) or os.path.exists(t + ".html")):
            fails.append(f"SITEMAP: {m.group(1)} has no matching file")

print(f"Checked {len(pages)} pages.")
for w in warns: print("WARN ", w)
for x in fails: print("FAIL ", x)
if fails:
    print(f"\nRESULT: {len(fails)} failure(s), {len(warns)} warning(s). NOT shippable.")
    sys.exit(1)
print(f"\nRESULT: all checks passed ({len(warns)} warning(s)). Shippable.")
PYEOF
