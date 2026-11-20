$ErrorActionPreference = 'Stop'

$Root = 'D:\WebStudio\OVIRA-LOCAL-DEV'
if (-not (Test-Path -LiteralPath $Root)) {
    Write-Error "Project root not found: $Root"
    exit 1
}

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$Timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$BackupDir = Join-Path $Root "backups\ai-workspace-$Timestamp"

$ArReviewsTitle = -join ([char[]]@(0x0622,0x0631,0x0627,0x0621,0x0020,0x0627,0x0644,0x0639,0x0645,0x0644,0x0627,0x0621))
$ArForbiddenPhrase = -join ([char[]]@(0x0628,0x0639,0x062F,0x0020,0x0627,0x0639,0x062A,0x0645,0x0627,0x062F,0x0647,0x0627))

function Write-SafeFile {
    param(
        [string]$RelativePath,
        [string]$Content
    )
    $FullPath = Join-Path $Root $RelativePath
    $Dir = Split-Path -Parent $FullPath
    if (-not (Test-Path -LiteralPath $Dir)) {
        New-Item -ItemType Directory -Path $Dir -Force | Out-Null
    }
    if (Test-Path -LiteralPath $FullPath) {
        $BackupTarget = Join-Path $BackupDir $RelativePath
        $BackupTargetDir = Split-Path -Parent $BackupTarget
        if (-not (Test-Path -LiteralPath $BackupTargetDir)) {
            New-Item -ItemType Directory -Path $BackupTargetDir -Force | Out-Null
        }
        Copy-Item -LiteralPath $FullPath -Destination $BackupTarget -Force
    }
    $FinalContent = $Content.Replace('__AR_REVIEWS_TITLE__', $ArReviewsTitle).Replace('__AR_FORBIDDEN_PHRASE__', $ArForbiddenPhrase)
    [System.IO.File]::WriteAllText($FullPath, $FinalContent, $Utf8NoBom)
    Write-Host "[OK] Wrote $RelativePath" -ForegroundColor Green
}

Write-Host "`n=== 1. Checking Existing Local Environment (No Reinstalls) ===" -ForegroundColor Cyan
$checks = @(
    @{ Name = 'Node.js'; Cmd = 'node.exe'; Args = @('--version') },
    @{ Name = 'npm.cmd'; Cmd = 'npm.cmd'; Args = @('--version') },
    @{ Name = 'Python';  Cmd = 'python';  Args = @('--version') },
    @{ Name = 'Git';     Cmd = 'git';     Args = @('--version') }
)
foreach ($c in $checks) {
    $found = Get-Command $c.Cmd -ErrorAction SilentlyContinue
    if ($found) {
        $ver = & $c.Cmd @($c.Args) 2>&1 | Select-Object -First 1
        Write-Host "[FOUND] $($c.Name): $ver" -ForegroundColor Green
    } else {
        Write-Host "[MISSING IN PATH] $($c.Name) - check PATH or open a fresh terminal before reinstalling" -ForegroundColor Yellow
    }
}

Write-Host "`n=== 2. Writing Production-Grade CLAUDE.md & 5 Custom Skills ===" -ForegroundColor Cyan

$ClaudeMd = @'
# OVIRA PLAY - Production Engineering Constitution (CLAUDE.md)

## 1. Mission & Production-Grade Mindset (MANDATORY)
- OVIRA PLAY is a REAL commercial Arabic (RTL) digital store for real customers, NOT a demo, prototype, or throwaway sandbox.
- Every HTML, CSS, JavaScript, and Backend change MUST be production-grade: resilient error handling, real data contracts, clean UX, fast on modest devices, responsive from 360px to 1440px, accessible, and secure.
- Communication Language: Always communicate with the user in clear Arabic ONLY. Keep explanations concise, honest, and clearly separated between Verified vs Planned vs Untested.
- Never fabricate fake prices, fake customer reviews, or fake product features pretending to be real production data. Any synthetic test data must be explicitly labeled as test-only.

## 2. Strict Local Isolation & Safety Boundaries (NON-NEGOTIABLE)
- Workspace Root: Work EXCLUSIVELY inside D:\WebStudio\OVIRA-LOCAL-DEV.
- Forbidden Targets: NEVER modify GitHub (git push), Render, production MongoDB, D:\WebStudio\projects, or D:\Compressed.
- Secrets Protection: NEVER read, print, copy, or commit .env, LOCAL-ADMIN-CREDENTIALS.txt, API keys, JWT secrets, MongoDB URIs, or Telegram/Chargily live keys.
- Network Isolation: NEVER send POST, PATCH, PUT, or DELETE requests to production endpoints (https://ovira-api.onrender.com). Read-only GET requests from public catalog/approved-reviews endpoints are allowed ONLY when explicitly requested to seed the local DB.
- Local Services:
  - Frontend: D:\WebStudio\OVIRA-LOCAL-DEV\OVIRAPLAY-main -> http://127.0.0.1:5511/ (python -m http.server 5511 --bind 127.0.0.1)
  - Backend: D:\WebStudio\OVIRA-LOCAL-DEV\ovira-api-main -> http://127.0.0.1:5001/ (node.exe .\local-dev.js)
  - Local MongoDB: ovira_play_dev on port 27018 via mongodb-memory-server (managed by local-dev.js).
- Windows / PowerShell Rules:
  - ALWAYS use npm.cmd (never npm, which is blocked by npm.ps1 ExecutionPolicy).
  - ALWAYS use node.exe for syntax and script execution.
  - ALWAYS create a timestamped backup inside D:\WebStudio\OVIRA-LOCAL-DEV\backups\ before large edits.

## 3. Tech Stack & Architecture Preservation
- Frontend: Pure HTML5, Modern CSS3, and Vanilla JavaScript (Hash SPA). Do NOT introduce React, Vue, Tailwind CLI, PHP, or frontend build bundlers.
- Backend: Node.js + Express + Mongoose (MongoDB).
- Preserve Working Logic: NEVER break or remove existing DOM IDs, classes, data-* attributes, cart operations, plan selection, account auth, checkout flow, or admin moderation routes.

## 4. Autonomous Self-Verification Loop (RUN BEFORE REPORTING DONE)
You MUST test your own work autonomously before claiming any task is complete:
1. Read First: Inspect the exact target files and surrounding lines before editing.
2. Syntax Check: Run node.exe --check on every modified .js file (frontend and backend).
3. Encoding & Mojibake Check: Verify every modified file is valid UTF-8 and contains ZERO Mojibake characters.
4. Backend Tests: When touching ovira-api-main, run npm.cmd run test:offline and npm.cmd run security:check inside ovira-api-main.
5. Visual & Functional Verification (Playwright / Browser): When touching UI, open http://127.0.0.1:5511/, verify zero console/network errors, test interactive flows (plan switching, cart add, reviews pagination), and inspect screenshots at both 360px (mobile) and 1440px (desktop).
6. Honest Reporting: Report exact commands run and observed results in Arabic. Never claim tested if you only ran a syntax check.

## 5. Active Project Skills
Before executing any specialized task, load and obey the matching skill in .claude/skills/:
- .claude/skills/ovira-anti-hallucination/SKILL.md
- .claude/skills/ovira-minimal-rtl/SKILL.md
- .claude/skills/ovira-arabic-typography/SKILL.md
- .claude/skills/ovira-perf-a11y/SKILL.md
- .claude/skills/ovira-security-isolation/SKILL.md
'@
Write-SafeFile -RelativePath 'CLAUDE.md' -Content $ClaudeMd

$Skill1 = @'
---
name: ovira-anti-hallucination
description: Enforce strict read-before-edit discipline, exact API/MongoDB contract compliance, and autonomous verification to eliminate hallucinations and broken code in OVIRA PLAY.
---

# OVIRA Anti-Hallucination & Code Discipline

## Mandatory Rules
1. Read Before Edit: Never guess function names, CSS classes, DOM IDs, or API fields. Read the exact file lines first.
2. Exact Data Contract (models/Product.js <-> services/productService.js):
   - Frontend short keys (id, n, t, sub, cat, c, c2, l, img, badge, f, steps, aud, lim, faq, guar, dlv, seoT, seoD, pl) map to MongoDB fields (productId, brandName, title, subtitle, category, primaryColor, secondaryColor, iconText, imageUrl, badgeText, features, steps, audience, limits, faqs, guaranteeText, deliveryText, seoTitle, seoDescription, plans).
   - NEVER insert raw frontend API objects directly into MongoDB. Always transform to the Mongoose schema and upsert by productId (never copy production _id).
3. Reviews Contract (models/Review.js & routes/orders.js):
   - Public endpoints return ONLY { approved: true } reviews with pagination (page, limit default 6, max 12) and no sensitive customer fields.
   - Admin moderation (PATCH /api/admin/reviews/:id) remains strictly intact.
4. Minimal Diffs: Make clean, surgical, maintainable edits. Do not rewrite unrelated functions.
5. Verification Gate: Every JS edit MUST pass node.exe --check. Every UI edit MUST be verified in a real browser/Playwright session with zero console errors.
'@
Write-SafeFile -RelativePath '.claude\skills\ovira-anti-hallucination\SKILL.md' -Content $Skill1

$Skill2 = @'
---
name: ovira-minimal-rtl
description: Production-grade Minimal Matte Dark RTL design system for OVIRA PLAY. Strictly bans glassmorphism, bright blue hero washes, tilted cards, and giant bottom buttons.
---

# OVIRA Minimal Matte Dark RTL Design System

## Core Aesthetic Philosophy
- Clean, calm, high-contrast Minimal Matte Dark UI inspired by Linear/Stripe discipline, adapted natively for Arabic RTL e-commerce.
- ZERO Glassmorphism: NEVER use backdrop-filter: blur(...), translucent frosted glass cards, or noisy blur layers. Use clean, solid matte surfaces with crisp 1px hairline borders.

## Zero-Tolerance Ban List
- NO Glassmorphic Cards: No backdrop-filter or semi-transparent foggy panels.
- NO Full-Screen Bright Blue Gradients: Never wash the page or Hero background in bright blue. Base background stays deep matte obsidian (#06080F). Product accent color (--c) is strictly limited to subtle accents (1px border highlight, badge dot, subtle top hairline, or ultra-low localized glow <= 0.08 opacity).
- NO Tilted Cards: Never apply permanent transform: rotate(...) to product cards. All cards stay straight, sharp, and geometrically aligned.
- NO Giant Full-Width Bottom Action Bars: Action buttons MUST stay compact (height: 46px, balanced padding) inside a structured purchase panel; on mobile sticky bars, keep compact height with safe-area padding and zero overlap over FAQ or reviews.

## Mandatory CSS Tokens (Unify in OVIRAPLAY-main/shared/ovira-tokens.css)

    :root {
      --bg-obsidian: #06080F;
      --bg-surface: #0D121D;
      --bg-surface-elevated: #141C2B;
      --bg-surface-hover: #1A2436;
      --border-hairline: rgba(255, 255, 255, 0.08);
      --border-strong: rgba(255, 255, 255, 0.16);
      --accent-primary: #0EA5E9;
      --accent-primary-hover: #0284C7;
      --text-primary: #F8FAFC;
      --text-secondary: #94A3B8;
      --text-muted: #64748B;
      --radius-card: 16px;
      --radius-control: 10px;
      --space-unit: 8px;
    }

## Layout & RTL Rules
- Enforce strict 8px spacing grid (8px, 16px, 24px, 32px, 48px).
- Use logical CSS properties (margin-inline, padding-inline, inset-inline-start, border-inline-start).
- Reviews Section Layout: Must occupy a full-width dedicated section (NOT squeezed into a narrow half-column inside .ov-product-proof-grid), displaying rating average, 5-to-1 star distribution bars, clean responsive review cards, and a reliable load-more button.
- Test strictly at 360px (mobile, zero horizontal overflow), 768px (tablet), and 1440px (desktop).
'@
Write-SafeFile -RelativePath '.claude\skills\ovira-minimal-rtl\SKILL.md' -Content $Skill2

$Skill3 = @'
---
name: ovira-arabic-typography
description: Arabic typography, numeric alignment for DZD pricing, natural Arabic UX microcopy, and strict UTF-8 / anti-Mojibake protection for OVIRA PLAY.
---

# OVIRA Arabic Typography, Language & Encoding Skill

## 1. Strict UTF-8 & Anti-Mojibake Enforcement
- Save ALL .html, .css, .js, and .json files in UTF-8 without BOM.
- Never write Arabic text through unescaped ANSI PowerShell strings.
- Before finishing any edit, scan modified files for Mojibake sequences and fix immediately.
- Priority fix: Repair all corrupted Arabic strings and star symbols inside reviewEvidence() in OVIRAPLAY-main/app.js.

## 2. Fonts & Loading Performance
- Load Cairo (weights 400, 500, 600, 700, 800) and Plus Jakarta Sans (weights 500, 600, 700 for Latin brand names/numbers) via link preconnect + link stylesheet in index.html (avoid render-blocking CSS @import).
- Apply font-variant-numeric: tabular-nums; on all prices (DZD), durations, star averages, and review counts so numbers never jump when switching plans.

## 3. Arabic Readability & Hierarchy
- Body text: 15px-16px, line-height: 1.7 for Arabic comfort.
- Headings: Cairo 700/800, line-height: 1.3, clear size contrast from body text.
- Keep paragraphs concise (max-width: 65ch) with generous breathing room.

## 4. Arabic UX Copy Rules
- Write crisp, trustworthy, direct commercial Arabic — no robotic filler or exaggerated hype.
- Reviews Section Heading: Must read strictly __AR_REVIEWS_TITLE__ ONLY. NEVER display __AR_FORBIDDEN_PHRASE__ to store visitors (approval moderation stays internal in the backend/admin panel).
- Handle empty states gracefully (e.g., 0 reviews shows a clean, honest state rather than a misleading 0.0 stars).
'@
Write-SafeFile -RelativePath '.claude\skills\ovira-arabic-typography\SKILL.md' -Content $Skill3

$Skill4 = @'
---
name: ovira-perf-a11y
description: High performance, targeted DOM updates, lightweight GPU animations, and accessibility standards for OVIRA PLAY on modest hardware and mobile devices.
---

# OVIRA Performance, Motion & Accessibility Skill

## 1. Performance & Targeted DOM Updates
- Optimize pickPlan() in OVIRAPLAY-main/app.js to update active plan state, price, savings badge, and CTA targets directly in the DOM where safe, avoiding full-page draw() re-renders that cause layout thrashing and scroll jumps.
- Avoid heavy libraries, WebGL, continuous infinite animations, or expensive blur filters (backdrop-filter is banned).
- Lazy-load non-critical images and defer product reviews fetch until viewing a product page.
- Prevent duplicate concurrent requests on Load More reviews (disable button + show loading state + preserve scroll/focus + offer retry on error).

## 2. Subtle, Purposeful Motion
- Animate ONLY GPU-composited properties (transform, opacity).
- Restrict hover elevation (translateY(-2px)) to @media (hover: hover) and (pointer: fine).
- Always include @media (prefers-reduced-motion: reduce) to disable non-essential transitions and entrance animations.

## 3. Accessibility & UX Polish
- Maintain strong WCAG AA contrast on dark matte surfaces (#F8FAFC / #94A3B8 on #0D121D).
- Provide clear :focus-visible outlines for keyboard users on every button, plan option, and link.
- Provide lightweight loading skeletons to minimize CLS (layout shift).
'@
Write-SafeFile -RelativePath '.claude\skills\ovira-perf-a11y\SKILL.md' -Content $Skill4

$Skill5 = @'
---
name: ovira-security-isolation
description: Security hardening, XSS prevention, secret hygiene, and local/production isolation rules for OVIRA PLAY frontend and backend.
---

# OVIRA Security & Isolation Skill

## 1. Frontend XSS & Injection Prevention
- ALWAYS escape dynamic values (customer names, review comments, product text, URL params) via esc() or textContent before injecting into DOM. Never render raw unsanitized HTML from API responses.

## 2. Backend & Data Privacy
- Keep public review routes strictly filtered to { approved: true } and projected to public fields only (no phone, email, customerId, or internal IDs).
- NEVER copy production customers, orders, payment logs, or unapproved reviews into ovira_play_dev.
- When importing public catalog/approved reviews for local development, use a read-only GET script with --dry-run default and schema validation.

## 3. Local Environment Safety
- Ensure Telegram bots, webhooks, and live Chargily keys remain disabled in ovira-api-main/local-dev.js.
- Verify via browser Network tab / Playwright request listener that zero POST/PATCH/DELETE requests leave 127.0.0.1 during local testing.
- Never expose or log .env values or LOCAL-ADMIN-CREDENTIALS.txt.
'@
Write-SafeFile -RelativePath '.claude\skills\ovira-security-isolation\SKILL.md' -Content $Skill5

$VsCodeSettings = @'
{
  "files.encoding": "utf8",
  "files.autoGuessEncoding": false,
  "files.eol": "\n",
  "editor.formatOnSave": false,
  "search.exclude": {
    "**/node_modules": true,
    "**/data/**": true,
    "**/backups/**": true
  },
  "files.watcherExclude": {
    "**/node_modules/**": true,
    "**/data/**": true,
    "**/backups/**": true
  }
}
'@
Write-SafeFile -RelativePath '.vscode\settings.json' -Content $VsCodeSettings

Write-Host "`n=== DONE! OVIRA Production AI Workspace is Ready ===" -ForegroundColor Cyan
Write-Host "Next: Install Claude Code + Free Claude Code (FCC) and open VS Code in $Root" -ForegroundColor White