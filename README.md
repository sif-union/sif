# SIF Equity Fund dashboard

The Union College Student Investment Fund's equity holdings, compared with VTI. Built with Next.js; all the numbers are computed at build time from the files in `data/`.

## Data

| File | What it is | How it changes |
| --- | --- | --- |
| `data/holdings.csv` | Monthly holdings from the professor | Upload page |
| `data/vti-holdings.csv` | Vanguard's "Export full holdings" for VTI ([portfolio page](https://advisors.vanguard.com/investments/products/vti/vanguard-morningstar-total-stock-market-etf#portfolio)), about monthly | Upload page |
| `data/market.json` | Month-end prices for VTI and the sector ETFs, plus news | Nightly GitHub Action |
| `data/pitches.json` | "Why we own it" summaries and deck links | Edit by hand |
| `data/extra-sectors.json`, `data/etf-themes.json` | Groups for stocks VTI doesn't hold, and for ETFs | Edit by hand when the upload page asks |

**Upload page:** click the top-right corner of the dashboard 6 times. It checks the password, validates the file, commits it to GitHub, and Vercel redeploys in about a minute. "Undo" puts back the previous version.

## Run locally

```sh
npm install
npm run dev            # http://localhost:3000
npm run market-data    # refresh prices (and news, with FINNHUB_API_KEY set)
```

## Deploy (one-time setup)

1. **Vercel:** sign in at vercel.com with the SIF GitHub account, choose "Add New → Project", and import `sif-union/sif`. The defaults work as they are.
2. **GitHub token for uploads:** on GitHub, go to Settings → Developer settings → Fine-grained tokens → Generate. Pick "Only select repositories" and choose `sif-union/sif`. Under permissions, set Contents to read and write. Set the expiry to a year.
3. **Vercel environment variables** (Project → Settings → Environment Variables), then redeploy:
   - `UPLOAD_PASSWORD`: the shared upload password. Change it every year.
   - `GITHUB_TOKEN`: the token from step 2.
   - `GITHUB_REPO`: `sif-union/sif`
4. **News:** get a free API key at finnhub.io. In the GitHub repo, go to Settings → Secrets and variables → Actions and add it as `FINNHUB_API_KEY`. Then run the "Market data" workflow once from the Actions tab.

The free Vercel plan works because the repo is public and owned by a personal account. Free plans can't deploy private repos owned by a GitHub organization.
