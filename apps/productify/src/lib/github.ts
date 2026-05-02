// Low-level GitHub REST primitives. The agent's tools (lib/tools.ts) wrap
// these. Kept thin and side-effect-free so each call is a discrete unit
// the agent can invoke and reason over.

const GH = "https://api.github.com";

export type RepoRef = { owner: string; name: string };

export type RepoMeta = {
  fullName: string;
  htmlUrl: string;
  description: string | null;
  homepage: string | null;
  defaultBranch: string;
  primaryLanguage: string | null;
  stars: number;
  forks: number;
  topics: string[];
  license: string | null;
  pushedAt: string | null;
};

export type TreeEntry = {
  path: string;
  type: "blob" | "tree";
  size?: number;
};

function ghHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "productify-hackathon",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function ghFetch(path: string): Promise<Response> {
  return fetch(`${GH}${path}`, { headers: ghHeaders(), cache: "no-store" });
}

export function parseRepoUrl(input: string): RepoRef {
  const trimmed = input.trim().replace(/\.git$/, "").replace(/\/$/, "");
  const match = trimmed.match(
    /^(?:https?:\/\/(?:www\.)?github\.com\/)?([\w.-]+)\/([\w.-]+)(?:\/.*)?$/,
  );
  if (!match) throw new Error(`Could not parse GitHub URL: ${input}`);
  return { owner: match[1], name: match[2] };
}

export async function getRepoMeta({ owner, name }: RepoRef): Promise<RepoMeta> {
  const res = await ghFetch(`/repos/${owner}/${name}`);
  if (res.status === 404) throw new Error(`Repo not found: ${owner}/${name}`);
  if (res.status === 403) {
    throw new Error("GitHub rate limit hit. Set GITHUB_TOKEN in .env.local.");
  }
  if (!res.ok) throw new Error(`GitHub API error ${res.status} for ${owner}/${name}`);
  const repo = (await res.json()) as {
    full_name: string;
    html_url: string;
    description: string | null;
    homepage: string | null;
    default_branch: string;
    language: string | null;
    stargazers_count: number;
    forks_count: number;
    topics?: string[];
    license?: { name?: string } | null;
    pushed_at?: string;
  };
  return {
    fullName: repo.full_name,
    htmlUrl: repo.html_url,
    description: repo.description,
    homepage: repo.homepage,
    defaultBranch: repo.default_branch,
    primaryLanguage: repo.language,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    topics: repo.topics ?? [],
    license: repo.license?.name ?? null,
    pushedAt: repo.pushed_at ?? null,
  };
}

export async function getLanguages(ref: RepoRef): Promise<Record<string, number>> {
  const res = await ghFetch(`/repos/${ref.owner}/${ref.name}/languages`);
  if (!res.ok) return {};
  return res.json() as Promise<Record<string, number>>;
}

export async function getReadme(ref: RepoRef): Promise<string | null> {
  const res = await ghFetch(`/repos/${ref.owner}/${ref.name}/readme`);
  return decodeContents(res);
}

export async function getFile(
  ref: RepoRef,
  path: string,
  branch?: string,
): Promise<string | null> {
  const q = branch ? `?ref=${branch}` : "";
  const res = await ghFetch(
    `/repos/${ref.owner}/${ref.name}/contents/${encodeURIComponent(path)}${q}`,
  );
  return decodeContents(res);
}

async function decodeContents(res: Response): Promise<string | null> {
  if (!res.ok) return null;
  const data = (await res.json()) as { content?: string; encoding?: string };
  if (!data.content) return null;
  if (data.encoding === "base64") {
    return Buffer.from(data.content, "base64").toString("utf-8");
  }
  return data.content;
}

export async function listDir(
  ref: RepoRef,
  path: string,
  branch?: string,
): Promise<{ name: string; path: string; type: "file" | "dir"; size?: number }[]> {
  const q = branch ? `?ref=${branch}` : "";
  const res = await ghFetch(
    `/repos/${ref.owner}/${ref.name}/contents/${encodeURIComponent(path)}${q}`,
  );
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((e: { name: string; path: string; type: string; size?: number }) => ({
    name: e.name,
    path: e.path,
    type: e.type === "dir" ? "dir" : "file",
    size: e.size,
  }));
}

export async function getTree(ref: RepoRef, branch: string): Promise<TreeEntry[]> {
  const res = await ghFetch(
    `/repos/${ref.owner}/${ref.name}/git/trees/${branch}?recursive=1`,
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { tree?: TreeEntry[] };
  return data.tree ?? [];
}

export async function searchCode(
  ref: RepoRef,
  query: string,
): Promise<{ path: string; matches: string[] }[]> {
  const q = encodeURIComponent(`${query} repo:${ref.owner}/${ref.name}`);
  const res = await ghFetch(`/search/code?q=${q}&per_page=10`);
  if (!res.ok) return [];
  const data = (await res.json()) as {
    items?: { path: string; text_matches?: { fragment: string }[] }[];
  };
  return (data.items ?? []).map((it) => ({
    path: it.path,
    matches: (it.text_matches ?? []).map((m) => m.fragment).slice(0, 3),
  }));
}

export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + `\n…[truncated ${s.length - max} chars]`;
}
