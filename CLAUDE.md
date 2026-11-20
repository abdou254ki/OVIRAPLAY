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