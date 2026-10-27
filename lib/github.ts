// Reads and commits files in the site's GitHub repo; every commit to main makes Vercel redeploy the site.
// Needs GITHUB_TOKEN (a fine-grained token with "Contents: read and write" on this one repo) and
// GITHUB_REPO ("owner/name"), both set in Vercel's environment variables.
const API = "https://api.github.com";
const BRANCH = "main";

async function github(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}/repos/${process.env.GITHUB_REPO}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json", ...init.headers },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GitHub ${init.method ?? "GET"} ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

// The file's text and its blob sha (needed to replace it). `ref` reads an older commit.
export async function readFile(file: string, ref = BRANCH): Promise<{ text: string; sha: string }> {
  const { content, sha } = await github(`/contents/${file}?ref=${ref}`);
  return { text: Buffer.from(content, "base64").toString("utf8"), sha };
}

export async function commitFile(file: string, text: string, message: string) {
  const { sha } = await readFile(file);
  await github(`/contents/${file}`, {
    method: "PUT",
    body: JSON.stringify({ message, content: Buffer.from(text).toString("base64"), sha, branch: BRANCH }),
  });
}

// Puts back the version from before the file's latest commit.
export async function undoLastCommit(file: string) {
  const commits: { sha: string }[] = await github(`/commits?path=${file}&sha=${BRANCH}&per_page=2`);
  if (commits.length < 2) throw new Error(`${file} has no earlier version`);
  const { text } = await readFile(file, commits[1].sha);
  await commitFile(file, text, `Undo last upload of ${file}`);
}
