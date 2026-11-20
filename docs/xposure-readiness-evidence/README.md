# Industry mismatch visual verification

Real rendered Super Admin pages against local synthetic fixtures. These are not screenshots of authenticated Xposure, production customer records, or approved visual baselines. The fixture reproduces the same Photography-profile / Computer-Service-assignment mismatch without connecting to production or any provider. All six cases assert a visible blocked template action, correct organization-scoped management link and stable layout.

- [360px](industry-mismatch-360.png)
- [430px](industry-mismatch-430.png)
- [768px](industry-mismatch-768.png)
- [1024px](industry-mismatch-1024.png)
- [1440px](industry-mismatch-1440.png)
- [1920px](industry-mismatch-1920.png)

Command: `npx playwright test --config playwright.phase4.config.ts --grep "industry template mismatch"` (with the existing local fixture and memory-backed TMPDIR). No write, retry, test-agent or activation action was clicked.
