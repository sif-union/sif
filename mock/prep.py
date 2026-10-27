"""Build data.json for the dashboard mockup from SIF_holdings.csv.

Monthly position returns use Modified Dietz: (gains + income) / (prior value + flow/2).
VTI weights and VTI sector numbers are hand-entered approximations for the mockup.
"""
import csv, json, sys, collections

CSV = sys.argv[1]
OUT = sys.argv[2]

GICS = {
    "GOOG": "Communication Services", "NFLX": "Communication Services", "SPOT": "Communication Services",
    "AMZN": "Consumer Discretionary", "RACE": "Consumer Discretionary", "BYDDY": "Consumer Discretionary",
    "AAPL": "Information Technology", "TXN": "Information Technology",
    "LLY": "Health Care", "SMMNY": "Health Care", "CNTA": "Health Care",
    "LMT": "Industrials", "CAT": "Industrials", "FDX": "Industrials", "FDXF": "Industrials",
    "WMT": "Consumer Staples",
    "CCJ": "Energy",
    "JPM": "Financials", "V": "Financials", "BAC": "Financials", "MC": "Financials",
    "PLD": "Real Estate",
    "NEE": "Utilities", "BIP": "Utilities", "AEP": "Utilities",
}
ETF_THEME = {
    "VTI": "Broad Market ETFs", "VB": "Broad Market ETFs", "VIG": "Broad Market ETFs",
    "XLK": "Tech & Semis ETFs", "XSD": "Tech & Semis ETFs",
    "XLV": "Health Care ETF",
    "IAUM": "Gold",
    "ITA": "Aerospace & Defense ETF",
    "PAVE": "Infrastructure ETF",
    "SGOV": "Cash", "Cash": "Cash",
}
# Approximate VTI weights (%), mockup only. GOOG/AMZN/AAPL/NFLX/CAT/LMT from the 2026 annual report.
VTI_STOCK_W = {"GOOG": 1.41, "AMZN": 3.45, "AAPL": 5.60, "NFLX": 0.90, "LLY": 1.30, "LMT": 0.20,
               "CAT": 0.30, "WMT": 0.75, "TXN": 0.28, "JPM": 1.25, "V": 0.95, "BAC": 0.55,
               "PLD": 0.17, "MC": 0.01, "NEE": 0.25, "AEP": 0.09, "FDX": 0.09, "FDXF": 0.01}
VTI_SECTOR_W = {"Information Technology": 30.5, "Financials": 14.3, "Consumer Discretionary": 10.5,
                "Communication Services": 9.5, "Health Care": 9.8, "Industrials": 9.8,
                "Consumer Staples": 5.0, "Energy": 3.2, "Utilities": 2.6, "Real Estate": 2.5,
                "Materials": 2.3}
# Illustrative VTI sector 1Y returns, rescaled below so they add up to VTI's real 1Y return.
VTI_SECTOR_R_ILLUS = {"Information Technology": 32, "Financials": 14, "Consumer Discretionary": 12,
                      "Communication Services": 22, "Health Care": 8, "Industrials": 18,
                      "Consumer Staples": 4, "Energy": 6, "Utilities": 15, "Real Estate": 3,
                      "Materials": 10}
# Placeholder theses. CCJ and V summaries/links come from the 2026 annual report.
PITCH = {
    "GOOG": "Search and YouTube fund heavy investment in Google Cloud and AI, with a strong balance sheet behind it.",
    "AMZN": "AWS and advertising carry most of the profit while retail scale keeps getting cheaper to run.",
    "AAPL": "A loyal installed base keeps buying devices and a growing, high-margin services business.",
    "NFLX": "The largest global streaming subscriber base, now adding ads and price increases on top.",
    "SPOT": "The default music app for hundreds of millions of users, with margins finally expanding.",
    "LLY": "GLP-1 obesity and diabetes drugs give Lilly one of the fastest-growing pipelines in pharma.",
    "LMT": "Long-term defense contracts like the F-35 give steady, government-backed revenue.",
    "CAT": "Construction, mining and power-generation equipment demand rides infrastructure and data-center spending.",
    "WMT": "Scale and low prices win share in any economy, and e-commerce and ads are growing.",
    "TXN": "Analog chips sit in nearly every car and factory, and new US fabs should lower costs.",
    "CCJ": "World's largest public uranium company, a long-term play on the nuclear energy comeback, now vertically integrated through Westinghouse.",
    "JPM": "The best-run large US bank, earning across lending, investment banking and trading.",
    "V": "A high-quality compounder bought at an attractive entry point: cash-to-digital shift, 60%+ margins, growing cross-border volume and network effects.",
    "BAC": "A huge low-cost deposit base that earns more when interest rates are higher.",
    "PLD": "The largest owner of logistics warehouses, which e-commerce needs close to cities.",
    "MC": "An advisory boutique that benefits when mergers and restructuring activity recover.",
    "NEE": "The largest US renewable energy developer, plus a regulated Florida utility for stability.",
    "BIP": "Owns toll roads, pipelines, data centers and ports with inflation-linked contracts.",
    "AEP": "A regulated utility whose grid spending rises with data-center power demand.",
    "BYDDY": "China's largest EV maker, vertically integrated down to its own batteries.",
    "RACE": "A luxury brand that happens to sell cars, with pricing power and long waitlists.",
    "SMMNY": "Imaging and diagnostics equipment with a large recurring service base.",
    "FDX": "Cost cuts and network consolidation should lift margins in parcel delivery.",
    "FDXF": "Received in the FedEx Freight spin-off; the leading US less-than-truckload carrier.",
    "VTI": "Holding the benchmark itself keeps part of the fund at market exposure.",
    "VB": "Adds small-cap US stocks, which large-cap picks underweight.",
    "VIG": "Companies with long records of raising dividends, for steadier quality exposure.",
    "XLK": "Low-cost exposure to large US tech, partly filling the IT underweight.",
    "XSD": "An equal-weight basket of US semiconductor companies.",
    "XLV": "Broad health-care exposure without single-drug risk.",
    "IAUM": "A hedge against inflation, geopolitical risk and market volatility.",
    "ITA": "US aerospace and defense manufacturers as defense budgets rise.",
    "PAVE": "US companies building roads, grids and other infrastructure.",
    "SGOV": "Short-term Treasury bills, used as interest-earning cash.",
}
DECK = {"CCJ": "https://muse.union.edu/sif/2025/07/11/cameco-investing-in-the-future-of-energy/",
        "V": "https://muse.union.edu/sif/2026/04/08/visa-durable-growth-at-a-more-attractive-entry/"}

num = lambda x: 0.0 if x in ("NA", "") else float(x)
rows = [r for r in csv.DictReader(open(CSV)) if r["fund"] == "equity"]
dates = sorted({r["Date"] for r in rows})
by = collections.defaultdict(dict)
names = {}
for r in rows:
    by[r["Ticker"]][r["Date"]] = r
    names[r["Ticker"]] = r["name"]

fund_val = {d: sum(num(r["value"]) for r in rows if r["Date"] == d) for d in dates}
fund_gain = {d: sum(num(r["cap_gains"]) + num(r["income"]) for r in rows if r["Date"] == d) for d in dates}
fund_ret = {dates[i]: fund_gain[dates[i]] / fund_val[dates[i - 1]] for i in range(1, len(dates))}


def pos_returns(t):
    """Monthly return and fund contribution for one ticker, keyed by date."""
    out = {}
    for i in range(1, len(dates)):
        d, p = dates[i], dates[i - 1]
        r = by[t].get(d)
        if not r:
            continue
        prev = num(by[t][p]["value"]) if p in by[t] else 0.0
        g = num(r["cap_gains"]) + num(r["income"])
        denom = prev + num(r["flow"]) / 2
        if denom > 1 and (prev > 0 or num(r["value"]) > 0):
            out[d] = {"r": g / denom, "c": g / fund_val[p]}
    return out


# VTI benchmark: monthly returns from the fund's own VTI row (gap Jun-Aug 2024 filled with approx values).
vti = {d: v["r"] for d, v in pos_returns("VTI").items()}
for d, approx in {"2024-06-30": 0.032, "2024-07-31": 0.019, "2024-08-31": 0.021}.items():
    vti[d] = approx

LAST = dates[-1]
PERIODS = {"1M": 1, "3M": 3, "6M": 6, "YTD": dates.index(LAST) - dates.index("2025-12-31"),
           "1Y": 12, "3Y": 36, "5Y": 60}


def chain(series, ds):
    g = 1.0
    for d in ds:
        g *= 1 + series.get(d, 0.0)
    return g - 1


def annualize(r, months):
    return (1 + r) ** (12 / months) - 1 if months > 12 else r


latest = [r for r in rows if r["Date"] == LAST and num(r["value"]) > 0.5]
total = fund_val[LAST]
holdings = []
for r in latest:
    t = r["Ticker"]
    pr = pos_returns(t)
    # Start of the current holding streak.
    i = len(dates) - 1
    while i > 0 and num(by[t].get(dates[i - 1], {}).get("value", "0")) > 0.5:
        i -= 1
    start = dates[i]
    held = [d for d in dates if d > start]
    rets, contrib, vrets = {}, {}, {}
    for k, n in PERIODS.items():
        win = dates[-n:]
        vrets[k] = annualize(chain(vti, win), n)
        if dates[-n - 1] < start:
            rets[k] = None
            contrib[k] = None
        else:
            rets[k] = annualize(chain({d: v["r"] for d, v in pr.items()}, win), n)
            contrib[k] = sum(pr[d]["c"] for d in win if d in pr)
    nm = len(held)
    rets["SI"] = annualize(chain({d: v["r"] for d, v in pr.items()}, held), nm)
    vrets["SI"] = annualize(chain(vti, held), nm)
    contrib["SI"] = sum(pr[d]["c"] for d in held if d in pr)
    # Growth of $100, monthly, since the streak start (chart filters by period client-side).
    g, gv, series = 100.0, 100.0, [[start, 100.0, 100.0]]
    for d in held:
        g *= 1 + pr.get(d, {"r": 0})["r"]
        gv *= 1 + vti.get(d, 0)
        series.append([d, round(g, 2), round(gv, 2)])
    inc12 = sum(num(by[t][d]["income"]) for d in dates[-12:] if d in by[t])
    group = GICS.get(t) or ETF_THEME.get(t)
    holdings.append({
        "t": t, "name": names[t].title() if names[t].isupper() else names[t], "group": group,
        "kind": "stock" if t in GICS else ("cash" if group == "Cash" else "etf"),
        "value": round(num(r["value"]), 2), "w": num(r["value"]) / total * 100,
        "vtiW": VTI_STOCK_W.get(t, 0.0) if t in GICS else None,
        "since": start, "sinceIsDataStart": start == dates[0],
        "ret": rets, "vtiRet": vrets, "contrib": contrib, "income12": round(inc12, 2),
        "series": series, "pitch": PITCH.get(t, ""), "deck": DECK.get(t),
        "pitchIsReal": t in DECK,
    })

groups = collections.defaultdict(lambda: {"value": 0.0, "holdings": []})
for h in holdings:
    groups[h["group"]]["value"] += h["value"]
    groups[h["group"]]["holdings"].append(h["t"])
sectors = []
for name, g in groups.items():
    kind = "sector" if name in VTI_SECTOR_W else ("cash" if name == "Cash" else "etf")
    sectors.append({"name": name, "kind": kind, "value": round(g["value"], 2), "w": g["value"] / total * 100,
                    "vtiW": VTI_SECTOR_W.get(name), "holdings": sorted(g["holdings"], key=lambda t: -next(h["value"] for h in holdings if h["t"] == t))})
for s, w in VTI_SECTOR_W.items():  # sectors VTI has but the fund doesn't hold directly
    if s not in groups:
        sectors.append({"name": s, "kind": "sector", "value": 0, "w": 0.0, "vtiW": w, "holdings": []})

# Contribution by group for every period (cumulative, in % points).
# Fund side from the CSV (includes since-sold positions). VTI side is illustrative.
WINDOWS = {k: dates[-n:] for k, n in PERIODS.items()}
WINDOWS["SI"] = dates[1:]  # fund level: since data start
raw = {s: VTI_SECTOR_W[s] / 100 * VTI_SECTOR_R_ILLUS[s] / 100 for s in VTI_SECTOR_W}
pr_all = {t: pos_returns(t) for t in by}
periods = {}
for k, win in WINDOWS.items():
    fc = collections.defaultdict(float)
    for t, pr in pr_all.items():
        grp = GICS.get(t) or ETF_THEME.get(t) or "Sold positions"
        if grp not in groups and grp not in VTI_SECTOR_W:
            grp = "Sold positions"
        for d, v in pr.items():
            if d in win:
                fc[grp] += v["c"]
    f_tot, v_tot = chain(fund_ret, win), chain(vti, win)
    link = f_tot / sum(fc.values())  # monthly sums -> compounded total
    scale = v_tot / sum(raw.values())
    names_ = sorted(set(fc) | set(VTI_SECTOR_W))
    periods[k] = {
        "start": dates[dates.index(win[0]) - 1], "months": len(win),
        "fund": f_tot * 100, "vti": v_tot * 100,
        "fundAnn": annualize(f_tot, len(win)) * 100, "vtiAnn": annualize(v_tot, len(win)) * 100,
        "contribution": [{"name": g, "fund": fc.get(g, 0.0) * link * 100, "vti": raw.get(g, 0.0) * scale * 100}
                         for g in names_],
    }

payload = json.dumps({"asOf": LAST, "dataStart": dates[0], "total": round(total, 2), "periods": periods,
                      "sectors": sectors, "holdings": holdings})
with open(OUT, "w") as f:  # .js so the mockup works when opened straight from disk
    f.write("window.SIF = " + payload + ";\n")
print("holdings", len(holdings), "groups", len(sectors))
for k, p in periods.items():
    print(f"  {k:4} fund {p['fund']:7.2f}  vti {p['vti']:7.2f}  sum {sum(c['fund'] for c in p['contribution']):7.2f}")
