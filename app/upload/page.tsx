"use client";
// Reached by clicking the top-right corner of the dashboard 6 times. Upload a new holdings CSV or VTI holdings file, or undo the last upload.
import { useState } from "react";
import styles from "./upload.module.css";

type Result = { done?: string; problems?: string[]; warnings?: string[] };

export default function UploadPage() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function send(fields: Record<string, string | File>) {
    const form = new FormData();
    form.set("password", password);
    for (const [k, v] of Object.entries(fields)) form.set(k, v);
    setBusy(true);
    setResult(null);
    try {
      setResult(await (await fetch("/api/upload", { method: "POST", body: form })).json());
    } catch {
      setResult({ problems: ["Couldn't reach the server. Try again."] });
    }
    setBusy(false);
  }

  return (
    <main className={styles.page}>
      <h1>Update the data</h1>
      <p>
        Upload either file. The <b>holdings CSV</b> is the monthly file with Date, fund, Ticker, name, type, value, income, flow and cap_gains.
        The <b>VTI file</b> is Vanguard&apos;s &quot;Export full holdings&quot; download from the{" "}
        <a href="https://advisors.vanguard.com/investments/products/vti/vanguard-morningstar-total-stock-market-etf#portfolio" target="_blank" rel="noopener">VTI portfolio page</a>.
        Files are checked before anything changes.
      </p>

      <label className={styles.field}>
        Password
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
      </label>
      <label className={styles.field}>
        File
        <input type="file" accept=".csv,text/csv" disabled={busy || !password}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) send({ file: f }); e.target.value = ""; }} />
      </label>

      <div className={styles.undo}>
        Undo the last upload of:
        <button disabled={busy || !password} onClick={() => send({ undo: "holdings" })}>holdings CSV</button>
        <button disabled={busy || !password} onClick={() => send({ undo: "vti" })}>VTI file</button>
      </div>

      {busy && <p>Working…</p>}
      {result?.done && <p className={styles.done}>{result.done}</p>}
      {!!result?.problems?.length && (
        <div className={styles.problems}><b>Not saved. Fix these and upload again:</b><ul>
          {result.problems.slice(0, 20).map((p) => <li key={p}>{p}</li>)}
          {result.problems.length > 20 && <li>…and {result.problems.length - 20} more (often caused by the first ones)</li>}
        </ul></div>
      )}
      {!!result?.warnings?.length && (
        <div className={styles.warnings}><b>Worth a look (send these to whoever maintains the site):</b><ul>{result.warnings.map((w) => <li key={w}>{w}</li>)}</ul></div>
      )}
      <p><a href="/">← Back to the dashboard</a></p>
    </main>
  );
}
