#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
phishing_detector.py

Advanced heuristic phishing detector.
Prompts for a website URL, fetches it, and reports:
- Verdict (Phishing / Suspicious / Likely safe)
- Overall risk score (0-100)
- Detailed threats with severities and "sources" (e.g., form actions, external scripts)
- Helpful context (WHOIS domain age, TLS certificate info, DNS/resolve status)

This script auto-installs missing libraries (requests, bs4, tldextract, python-whois, idna).
"""

import sys
import subprocess
import importlib
import json
import re
import socket
import ssl
import datetime as dt
from datetime import timezone
from urllib.parse import urlparse, urljoin

# --- helper: ensure deps ---
def _pip_install(pkg: str):
    subprocess.check_call([sys.executable, "-m", "pip", "install", pkg])

def _ensure_import(pkg: str, import_name=None):
    try:
        return importlib.import_module(import_name or pkg)
    except ImportError:
        print(f"[setup] Installing missing dependency: {pkg} ...")
        _pip_install(pkg)
        return importlib.import_module(import_name or pkg)

requests = _ensure_import("requests")
bs4 = _ensure_import("bs4")
BeautifulSoup = bs4.BeautifulSoup

tldextract = _ensure_import("tldextract")
whois = _ensure_import("python-whois", "whois")
idna = _ensure_import("idna")

# --- constants ---
USER_AGENT = "Mozilla/5.0 (compatible; PhishGuard/1.0; +https://localhost:5000)"
HTTP_TIMEOUT = 12
DNS_TIMEOUT = 6
SSL_TIMEOUT = 8

# More specific suspicious TLDs (avoid common ones)
SUSPICIOUS_TLDS = set("""
zip kim top work country stream biz men loan mom gq cf tk ml ga surf fit ltda cam bar click link xyz rest review date online cam app pics quest ryuk
accountant bid cc club cricket date download faith ga ga gq gq link ltd men ml mom party press pw review science stream tk top win work xyz
""".split())

# LEGITIMATE TLDs that should never be flagged as suspicious
LEGITIMATE_TLDS = set("""
com org net edu gov mil io ai co uk us ca au nz de fr es it nl se no dk fi
ie at ch be lu pt gr hu pl cz sk si hr ba rs me al mk mt cy li is ee lv lt
""".split())

# Trusted domains that should never be flagged (including subdomains)
TRUSTED_DOMAINS = set("""
google.com facebook.com apple.com microsoft.com amazon.com netflix.com
twitter.com instagram.com linkedin.com github.com oracle.com whatsapp.com
signal.org telegram.org discord.com slack.com dropbox.com box.com
adobe.com salesforce.com ibm.com intel.com nvidia.com amd.com
paypal.com stripe.com visa.com mastercard.com americanexpress.com
wikipedia.org mozilla.org wordpress.org archive.org
berkeley.edu stanford.edu mit.edu harvard.edu yale.edu princeton.edu
columbia.edu upenn.edu cornell.edu brown.edu dartmouth.edu
ucla.edu ucsd.edu ucb.edu umich.edu uiuc.edu utexas.edu
""".split())

# Trusted domain patterns (regex patterns for subdomains of trusted domains)
TRUSTED_PATTERNS = [
    r"^[a-zA-Z0-9-]+\.oracle\.com$",
    r"^[a-zA-Z0-9-]+\.whatsapp\.com$",
    r"^[a-zA-Z0-9-]+\.google\.com$",
    r"^[a-zA-Z0-9-]+\.microsoft\.com$",
    r"^[a-zA-Z0-9-]+\.apple\.com$",
    r"^[a-zA-Z0-9-]+\.amazon\.com$",
    r"^[a-zA-Z0-9-]+\.github\.com$",
    r"^[a-zA-Z0-9-]+\.edu$",
    r"^[a-zA-Z0-9-]+\.[a-zA-Z0-9-]+\.edu$",
    r"^[a-zA-Z0-9-]+\.edu\.[a-zA-Z]{2,}$",  # edu.au, edu.uk, etc.
    r"^[a-zA-Z0-9-]+\.ac\.[a-zA-Z]{2,}$",   # ac.uk, ac.jp, etc.
    r"^[a-zA-Z0-9-]+\.gov$",
    r"^[a-zA-Z0-9-]+\.gov\.[a-zA-Z]{2,}$",  # gov.au, gov.uk, etc.
    r"^[a-zA-Z0-9-]+\.org$",
    r"^[a-zA-Z0-9-]+\.mil$",
]

# Reduced list of suspicious keywords - focused on phishing-specific terms
SUSPICIOUS_KEYWORDS = [
    "login-secure", "verify-account", "update-details", "secure-account", "bank-login", 
    "wallet-access", "pay-now", "password-reset", "support-ticket", "helpdesk-verify",
    "unlock-account", "billing-update", "confirm-details", "re-activate-now", 
    "gift-card", "free-offer", "prize-winner", "bonus-claim"
]

BRAND_HINTS = ["Apple", "Microsoft", "Google", "Facebook", "Instagram", "Amazon", "Netflix", "PayPal", "Adobe", "LinkedIn", "Bank"]

OBFUSCATION_HINTS = [
    r"\beval\s*\(", r"Function\s*\(", r"atob\s*\(", r"unescape\s*\(", r"fromCharCode\s*\(",
    r"document\.write\s*\(", r"\.replace\s*\(/.*?/", r"obfuscate", r"packer", r"window\["
]

REDIRECT_HINTS = [
    r"window\.location", r"location\.href", r"location\.replace", r"top\.location"
]

RIGHTCLICK_BLOCK_HINTS = [
    r"contextmenu", r"document\.oncontextmenu", r"return\s+false;"
]

# Adjusted weights for risk scoring (0-100 total typical) - FIXED WEIGHTS
WEIGHTS = {
    "ip_in_url": 8,
    "punycode": 5,
    "unicode_homoglyphs": 5,
    "too_many_subdomains": 2,
    "suspicious_tld": 4,
    "url_length": 2,
    "at_symbol": 5,
    "double_slash": 2,
    "many_hyphens": 2,
    "suspicious_keywords": 3,

    "no_https": 0,  # Reduced from 15
    "weak_tls": 0,
    "cert_short_validity": 0,
    "cert_expiring_soon": 0,

    "dns_missing": 6,
    "domain_too_new": 4,  # Reduced from 5

    "external_favicon": 2,
    "external_form_action": 8,
    "mailto_exfil": 5,
    "password_over_http": 10,
    "many_external_scripts": 3,
    "many_iframes": 2,
    "obfuscation": 4,
    "redirect_js": 2,
    "rightclick_block": 2,
    "brand_title_mismatch": 3,
}

def normalize_url(url: str) -> str:
    url = url.strip()
    if not re.match(r"^https?://", url, re.IGNORECASE):
        url = "http://" + url
    parsed = urlparse(url)
    cleaned = parsed._replace(fragment="").geturl()
    return cleaned

def domain_parts(url: str):
    ext = tldextract.extract(url)
    domain = f"{ext.domain}.{ext.suffix}" if ext.suffix else ext.domain
    subdomain = ext.subdomain
    return domain.lower(), subdomain.lower() if subdomain else ""

def is_trusted_domain(domain: str):
    """Check if domain is in trusted list or matches trusted patterns"""
    # Check exact match
    if domain in TRUSTED_DOMAINS:
        return True
    
    # Check if it's a subdomain of a trusted domain
    for trusted_domain in TRUSTED_DOMAINS:
        if domain.endswith('.' + trusted_domain):
            return True
    
    # Check against patterns
    for pattern in TRUSTED_PATTERNS:
        if re.match(pattern, domain, re.IGNORECASE):
            return True
    
    # Check for educational/academic domains
    if domain.endswith('.edu') or '.edu.' in domain or '.ac.' in domain:
        return True
        
    # Check for government domains
    if domain.endswith('.gov') or '.gov.' in domain:
        return True
        
    # Check for organizational domains
    if domain.endswith('.org'):
        return True
    
    return False

def is_legitimate_tld(tld: str):
    return tld in LEGITIMATE_TLDS

def is_ip(host: str) -> bool:
    try:
        socket.inet_aton(host)
        return True
    except OSError:
        pass
    try:
        socket.inet_pton(socket.AF_INET6, host)
        return True
    except OSError:
        return False

def contains_unicode_homoglyphs(host: str) -> bool:
    return any(ord(c) > 127 for c in host)

def get_dns_a(host: str):
    try:
        socket.setdefaulttimeout(DNS_TIMEOUT)
        return socket.gethostbyname_ex(host)
    except Exception:
        return None

def get_tls_cert(host: str, port: int = 443):
    try:
        context = ssl.create_default_context()
        with socket.create_connection((host, port), timeout=SSL_TIMEOUT) as sock:
            with context.wrap_socket(sock, server_hostname=host) as ssock:
                cert = ssock.getpeercert()
                return cert
    except Exception:
        return None

def parse_cert_dates(cert):
    def _parse(s):
        try:
            return dt.datetime.strptime(s, "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
        except Exception:
            return None
    not_before = _parse(cert.get("notBefore", "")) if cert else None
    not_after = _parse(cert.get("notAfter", "")) if cert else None
    return not_before, not_after

def _flatten_cert_name(name_obj):
    """
    ssl.getpeercert()['subject'] / ['issuer'] look like:
      ((('commonName','example.com'),), (('organizationName',"Let's Encrypt"),), ...)
    Convert robustly to a flat dict.
    """
    out = {}
    if not name_obj:
        return out
    try:
        for rdn in name_obj:           # rdn is a tuple of one or more (key, value)
            for kv in rdn:
                if isinstance(kv, (list, tuple)) and len(kv) == 2:
                    k, v = kv
                    out[str(k)] = str(v)
                else:
                    # Sometimes libraries return weird shapes; best-effort stringify
                    try:
                        k, v = map(str, kv)
                        out[k] = v
                    except Exception:
                        pass
    except Exception:
        # Fallback: best-effort string
        try:
            return {"raw": str(name_obj)}
        except Exception:
            return {}
    return out

def get_whois(domain: str):
    try:
        data = whois.whois(domain)
        return data
    except Exception:
        return None

def domain_age_days(w):
    def _to_dt(x):
        if isinstance(x, list):
            x = x[0]
        if isinstance(x, dt.datetime):
            return x
        try:
            return dt.datetime.fromisoformat(str(x))
        except Exception:
            return None
    if not w:
        return None
    created = _to_dt(getattr(w, "creation_date", None))
    if not created:
        return None
    if not created.tzinfo:
        created = created.replace(tzinfo=timezone.utc)
    now = dt.datetime.now(timezone.utc)
    return max(0, (now - created).days)

def fetch(url: str):
    headers = {"User-Agent": USER_AGENT, "Accept": "*/*"}
    try:
        resp = requests.get(url, headers=headers, timeout=HTTP_TIMEOUT, allow_redirects=True)
        return resp
    except Exception:
        return None

def try_https_upgrade(url: str):
    parsed = urlparse(url)
    if parsed.scheme == "http":
        return url.replace("http://", "https://", 1)
    return url

def _rel_contains_icon(rel_val):
    if rel_val is None:
        return False
    if isinstance(rel_val, (list, tuple)):
        s = " ".join(map(str, rel_val))
    else:
        s = str(rel_val)
    return "icon" in s.lower()

def collect_external_domains(soup: BeautifulSoup, base_domain: str):
    externals = set()
    for s in soup.find_all("script", src=True):
        d, _ = domain_parts(s['src'])
        if d and d != base_domain:
            externals.add(d)
    for i in soup.find_all("iframe", src=True):
        d, _ = domain_parts(i['src'])
        if d and d != base_domain:
            externals.add(d)
    for l in soup.find_all("link", href=True):
        d, _ = domain_parts(l['href'])
        if d and d != base_domain:
            externals.add(d)
    return externals

def looks_like_brand_mismatch(title: str, domain: str):
    title = (title or "").strip()
    if not title:
        return False
    title_brands = [b for b in BRAND_HINTS if b.lower() in title.lower()]
    if not title_brands:
        return False
    for b in title_brands:
        if b.lower() in domain.lower():
            return False
    return True

def analyze(url: str):
    findings = []
    score = 0
    normalized = normalize_url(url)
    parsed = urlparse(normalized)
    host = parsed.hostname or ""
    domain, subdomain = domain_parts(normalized)
    
    # Check if this is a trusted domain - if so, return safe immediately
    if is_trusted_domain(domain):
        return {
            "input_url": url,
            "normalized_url": normalized,
            "host": host,
            "domain": domain,
            "tld": domain.split('.')[-1],
            "verdict": "Likely safe",
            "risk_score": 0,
            "threats": [],
            "context": {
                "dns_resolve": True,
                "domain_age_days": None,
                "uses_https": parsed.scheme.lower() == "https",
                "trusted_domain": True
            },
            "sources": {}
        }

    # --- URL-based checks ---
    if is_ip(host):
        findings.append(("MEDIUM", "IP address used in URL (often used to hide identity).", {"host": host}))
        score += WEIGHTS["ip_in_url"]

    if host.startswith("xn--") or ".xn--" in host:
        findings.append(("LOW", "Punycode (IDN) in hostname; potential homograph attack.", {"host": host}))
        score += WEIGHTS["punycode"]

    if contains_unicode_homoglyphs(host):
        findings.append(("LOW", "Non-ASCII characters in hostname; possible IDN homograph attempt.", {"host": host}))
        score += WEIGHTS["unicode_homoglyphs"]

    sub_count = len([p for p in host.split(".") if p]) - 2 if domain in host else host.count(".")
    if sub_count >= 6:  # Increased threshold from 5 to 6
        findings.append(("LOW", f"Many subdomains ({sub_count}).", {"host": host}))
        score += WEIGHTS["too_many_subdomains"]

    ext = tldextract.extract(normalized)
    tld = (ext.suffix or "").split(".")[-1].lower()
    
    # Only flag TLD if it's suspicious AND not legitimate
    if tld in SUSPICIOUS_TLDS and not is_legitimate_tld(tld):
        findings.append(("LOW", f"Suspicious TLD: .{tld}", {"tld": tld}))
        score += WEIGHTS["suspicious_tld"]

    if len(normalized) > 180:  # Increased threshold from 150 to 180
        findings.append(("LOW", f"Long URL ({len(normalized)} chars).", {"url": normalized[:100] + "..."}))
        score += WEIGHTS["url_length"]

    if "@" in normalized:
        findings.append(("MEDIUM", "Contains '@' in URL (userinfo part).", {}))
        score += WEIGHTS["at_symbol"]

    if "//" in normalized.split("://", 1)[1]:
        findings.append(("LOW", "Double slash in path (can be used for obfuscation).", {}))
        score += WEIGHTS["double_slash"]

    if host.count("-") >= 4:  # Increased threshold from 3 to 4
        findings.append(("LOW", "Many hyphens in hostname.", {"host": host}))
        score += WEIGHTS["many_hyphens"]

    for kw in SUSPICIOUS_KEYWORDS:
        if kw in normalized.lower():
            findings.append(("LOW", f"Suspicious keyword in URL: '{kw}'.", {"keyword": kw}))
            score += WEIGHTS["suspicious_keywords"]
            break

    # --- DNS & TLS ---
    dns = get_dns_a(host)
    if not dns:
        findings.append(("HIGH", "DNS resolution failed (domain may not exist).", {}))
        score += WEIGHTS["dns_missing"]
    else:
        # Check for brand mismatch in resolved hostnames
        resolved_hosts = dns[2]
        for resolved_host in resolved_hosts:
            if is_ip(resolved_host):
                continue
            resolved_domain, _ = domain_parts(resolved_host)
            if resolved_domain != domain:
                findings.append(("MEDIUM", f"Resolved host '{resolved_host}' doesn't match domain '{domain}'.", {}))
                score += 3  # Small penalty for mismatch

    cert = get_tls_cert(host)
    uses_https = parsed.scheme.lower() == "https"
    if not uses_https:
        findings.append(("HIGH", "No HTTPS (plain HTTP).", {}))
        score += WEIGHTS["no_https"]
    else:
        if not cert:
            findings.append(("HIGH", "HTTPS certificate invalid or untrusted.", {}))
            score += WEIGHTS["weak_tls"]
        else:
            not_before, not_after = parse_cert_dates(cert)
            if not_before and not_after:
                now = dt.datetime.now(timezone.utc)
                total_days = (not_after - not_before).days
                if total_days < 30:
                    findings.append(("LOW", f"Certificate has short validity ({total_days} days).", {}))
                    score += WEIGHTS["cert_short_validity"]
                if (not_after - now).days < 7:
                    findings.append(("MEDIUM", "Certificate expiring soon.", {}))
                    score += WEIGHTS["cert_expiring_soon"]

    # --- WHOIS ---
    whois_data = get_whois(domain)
    age_days = domain_age_days(whois_data)
    if age_days is not None and age_days < 30:  # Increased threshold from 15 to 30 days
        findings.append(("MEDIUM", f"Domain is new ({age_days} days old).", {"age_days": age_days}))
        score += WEIGHTS["domain_too_new"]

    # --- HTML content analysis ---
    resp = fetch(normalized)
    if not resp:
        # If HTTP fails, try HTTPS upgrade
        https_url = try_https_upgrade(normalized)
        if https_url != normalized:
            resp = fetch(https_url)
            if resp:
                normalized = https_url
                parsed = urlparse(normalized)
                uses_https = True

    sources = {
        "external_domains": [],
        "form_actions": [],
        "mailto_links": [],
        "obfuscated_scripts": [],
        "redirect_scripts": [],
        "rightclick_block": False,
        "title": None,
        "favicon_external": False
    }

    if resp and resp.status_code == 200:
        try:
            soup = BeautifulSoup(resp.text, "html.parser")
        except Exception:
            soup = None

        if soup:
            sources["title"] = soup.title.string if soup.title else None

            # Check for brand mismatch in title
            if sources["title"] and looks_like_brand_mismatch(sources["title"], domain):
                findings.append(("MEDIUM", "Title contains brand name not matching domain.", {"title": sources["title"]}))
                score += WEIGHTS["brand_title_mismatch"]

            # Favicon
            favicon = soup.find("link", rel=_rel_contains_icon)
            if favicon and favicon.get("href"):
                favicon_domain, _ = domain_parts(favicon["href"])
                if favicon_domain and favicon_domain != domain:
                    findings.append(("LOW", "Favicon loaded from external domain.", {"external_domain": favicon_domain}))
                    score += WEIGHTS["external_favicon"]
                    sources["favicon_external"] = True

            # Forms
            for form in soup.find_all("form", action=True):
                action = form["action"]
                action_domain, _ = domain_parts(action)
                if action_domain and action_domain != domain:
                    findings.append(("HIGH", f"Form submits to external domain: {action_domain}", {"action": action}))
                    score += WEIGHTS["external_form_action"]
                    sources["form_actions"].append(action)

            # Mailto links for potential exfiltration
            for link in soup.find_all("a", href=True):
                href = link["href"]
                if href.startswith("mailto:") and "?" in href:
                    findings.append(("MEDIUM", "Mailto link with parameters (potential data exfiltration).", {"href": href}))
                    score += WEIGHTS["mailto_exfil"]
                    sources["mailto_links"].append(href)

            # Password fields over HTTP
            if not uses_https:
                password_fields = soup.find_all("input", type="password")
                if password_fields:
                    findings.append(("HIGH", "Password field(s) found on HTTP page.", {"count": len(password_fields)}))
                    score += WEIGHTS["password_over_http"]

            # External scripts and iframes
            externals = collect_external_domains(soup, domain)
            sources["external_domains"] = list(externals)
            if len(externals) > 8:  # Increased threshold from 5 to 8
                findings.append(("LOW", f"Many external domains loaded ({len(externals)}).", {"domains": list(externals)}))
                score += WEIGHTS["many_external_scripts"]

            iframes = soup.find_all("iframe")
            if len(iframes) > 5:  # Increased threshold from 3 to 5
                findings.append(("LOW", f"Many iframes ({len(iframes)}).", {}))
                score += WEIGHTS["many_iframes"]

            # Script content analysis
            for script in soup.find_all("script"):
                content = script.string
                if not content:
                    continue
                content = content.strip()
                if not content:
                    continue

                # Obfuscation
                for hint in OBFUSCATION_HINTS:
                    if re.search(hint, content, re.IGNORECASE):
                        findings.append(("MEDIUM", "Script contains obfuscation patterns.", {}))
                        score += WEIGHTS["obfuscation"]
                        sources["obfuscated_scripts"].append(content[:100] + "..." if len(content) > 100 else content)
                        break

                # Redirects
                for hint in REDIRECT_HINTS:
                    if re.search(hint, content, re.IGNORECASE):
                        findings.append(("LOW", "Script contains redirect logic.", {}))
                        score += WEIGHTS["redirect_js"]
                        sources["redirect_scripts"].append(content[:100] + "..." if len(content) > 100 else content)
                        break

                # Right-click block
                for hint in RIGHTCLICK_BLOCK_HINTS:
                    if re.search(hint, content, re.IGNORECASE):
                        findings.append(("LOW", "Script blocks right-click (common in phishing).", {}))
                        score += WEIGHTS["rightclick_block"]
                        sources["rightclick_block"] = True
                        break

    # --- Final scoring and verdict ---
    # Adjusted thresholds to reduce false positives
    if score >= 35:  # Increased from 25 to 35
        verdict = "Phishing"
    elif score >= 20:  # Increased from 15 to 20
        verdict = "Suspicious"
    else:
        verdict = "Likely safe"

    context = {
        "dns_resolve": bool(dns),
        "domain_age_days": age_days,
        "uses_https": uses_https,
        "trusted_domain": False
    }

    return {
        "input_url": url,
        "normalized_url": normalized,
        "host": host,
        "domain": domain,
        "tld": tld,
        "verdict": verdict,
        "risk_score": score,
        "threats": findings,
        "context": context,
        "sources": sources
    }

def print_report(report):
    print("\n" + "="*60)
    print("PHISHING DETECTION REPORT")
    print("="*60)
    print(f"Input URL:    {report['input_url']}")
    print(f"Normalized:   {report['normalized_url']}")
    print(f"Domain:       {report['domain']}")
    print(f"TLD:          {report['tld']}")
    print(f"Verdict:      {report['verdict']}")
    print(f"Risk Score:   {report['risk_score']}/100")
    print()

    if report['context']['trusted_domain']:
        print("ℹ️  This domain is in the trusted list and is considered safe.")
        return

    print("CONTEXT:")
    print(f"  - DNS Resolve:    {'✓' if report['context']['dns_resolve'] else '✗'}")
    print(f"  - Uses HTTPS:     {'✓' if report['context']['uses_https'] else '✗'}")
    if report['context']['domain_age_days'] is not None:
        print(f"  - Domain Age:     {report['context']['domain_age_days']} days")
    print()

    if not report['threats']:
        print("No threats detected.")
        return

    print("DETECTED THREATS:")
    for severity, desc, data in report['threats']:
        print(f"  [{severity}] {desc}")
        if data:
            for k, v in data.items():
                print(f"      {k}: {v}")
    print()

    sources = report['sources']
    if sources.get('external_domains'):
        print("External domains loaded:")
        for d in sources['external_domains']:
            print(f"  - {d}")
        print()

    if sources.get('form_actions'):
        print("Form actions to external domains:")
        for a in sources['form_actions']:
            print(f"  - {a}")
        print()

    if sources.get('mailto_links'):
        print("Suspicious mailto links:")
        for m in sources['mailto_links']:
            print(f"  - {m}")
        print()

def main():
    if len(sys.argv) > 1:
        url = sys.argv[1]
    else:
        url = input("Enter URL to check: ")
    print(f"Analyzing: {url} ...")
    report = analyze(url)
    print_report(report)

if __name__ == "__main__":
    main()