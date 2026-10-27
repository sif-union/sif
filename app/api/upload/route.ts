// Upload page backend: checks the password, validates the file, and commits it to GitHub (Vercel then redeploys).
// Accepts the professor's holdings CSV or Vanguard's "Export full holdings" file for VTI; it tells them apart by content.
import { timingSafeEqual } from "node:crypto";
import pitches from "@/data/pitches.json";
import { groupOf } from "@/lib/groups";
import { checkHoldings, readHoldingsCsv } from "@/lib/holdings";
import { commitFile, readFile, undoLastCommit } from "@/lib/github";
import { readVtiHoldings } from "@/lib/vti";

const FILES = { holdings: "data/holdings.csv", vti: "data/vti-holdings.csv" } as const;
type Kind = keyof typeof FILES;

export async function POST(req: Request) {
  const form = await req.formData();
  if (!passwordOk(String(form.get("password") ?? ""))) return Response.json({ problems: ["Wrong password."] }, { status: 401 });

  try {
    const undo = form.get("undo") as Kind | null;
    if (undo) {
      await undoLastCommit(FILES[undo]);
      return Response.json({ done: `Restored the previous ${FILES[undo]}. The site updates in about a minute.` });
    }

    const text = await (form.get("file") as File).text();
    const kind: Kind = text.includes("Equity,as of") ? "vti" : "holdings";
    const { problems, warnings } = kind === "vti" ? await checkVti(text) : await checkHoldingsFile(text);
    if (problems.length) return Response.json({ kind, problems, warnings }, { status: 422 });

    await commitFile(FILES[kind], text, `Upload ${FILES[kind]}`);
    return Response.json({ kind, warnings, done: `Saved ${FILES[kind]}. The site updates in about a minute.` });
  } catch (e) {
    return Response.json({ problems: [(e as Error).message] }, { status: 500 });
  }
}

async function checkHoldingsFile(text: string) {
  const rows = readHoldingsCsv(text);
  const problems = checkHoldings(rows);
  if (problems.length) return { problems, warnings: [] };
  // Current holdings the site can't place in a group (it shows them under "Other") or has no pitch for.
  const vti = readVtiHoldings((await readFile(FILES.vti)).text);
  const last = rows.reduce((max, r) => (r.date > max ? r.date : max), "");
  const held = rows.filter((r) => r.date === last && r.fund === "equity" && r.value > 0.5);
  const warnings = [
    ...held.filter((r) => !groupOf(r.ticker, r.type, vti)).map((r) => `${r.ticker} has no sector: add it to data/extra-sectors.json (stocks) or data/etf-themes.json (ETFs).`),
    ...held.filter((r) => r.type !== "Cash" && !(r.ticker in pitches)).map((r) => `${r.ticker} has no pitch summary: add it to data/pitches.json.`),
  ];
  return { problems, warnings };
}

async function checkVti(text: string) {
  const vti = readVtiHoldings(text);
  const count = Object.keys(vti.stock).length;
  const problems = count < 1000 ? [`Only ${count} stocks found; VTI holds over 3,000. Is this the full holdings export?`] : [];
  const warnings = vti.unknownSubIndustries.map((s) => `Unknown GICS sub-industry "${s}": add it to data/gics-sectors.json, or its stocks count toward no sector.`);
  return { problems, warnings };
}

function passwordOk(given: string) {
  const a = Buffer.from(given), b = Buffer.from(process.env.UPLOAD_PASSWORD ?? "");
  return b.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}
