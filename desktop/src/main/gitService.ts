import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
const EXEC_OPTS = { encoding: 'utf8' as const, maxBuffer: 10 * 1024 * 1024 }

export interface GitFileStatus { path: string; status: string; additions: number; deletions: number }
export interface GitStatusResult { branchName: string; files: GitFileStatus[]; stagedFiles: GitFileStatus[]; unstagedFiles: GitFileStatus[]; totalAdditions: number; totalDeletions: number }
export interface GitFileDiff { path: string; diff: string; status: string }
export interface GitLogEntry { sha: string; summary: string; author: string; timestamp: number }
export interface GitLogResponse { total: number; entries: GitLogEntry[]; ahead: number; behind: number; aheadEntries: GitLogEntry[]; behindEntries: GitLogEntry[]; upstream: string | null }
export interface GitCommitDiff { path: string; status: string; diff: string }
export interface BranchInfo { name: string; lastCommit: number }

function escapePath(p: string): string { return `"${p.replace(/"/g, '\\"')}"` }

function parseNumstat(stdout: string): Map<string, { additions: number; deletions: number }> {
  const map = new Map<string, { additions: number; deletions: number }>()
  for (const line of stdout.split('\n')) {
    if (!line.trim()) continue
    const [add, del, ...pathParts] = line.split('\t')
    const path = pathParts.join('\t')
    if (path) map.set(path, { additions: add === '-' ? 0 : parseInt(add, 10) || 0, deletions: del === '-' ? 0 : parseInt(del, 10) || 0 })
  }
  return map
}

function splitDiffByFile(diffOutput: string): Map<string, string> {
  const files = new Map<string, string>()
  const parts = diffOutput.split(/^diff --git /m)
  for (const part of parts) {
    if (!part.trim()) continue
    const fullDiff = 'diff --git ' + part
    const match = /^diff --git a\/(.+?) b\/(.+)$/m.exec(fullDiff)
    if (match) files.set(match[2].trim(), fullDiff)
  }
  return files
}

function parseLogEntries(stdout: string): GitLogEntry[] {
  const entries: GitLogEntry[] = []
  for (const line of stdout.split('\n')) {
    if (!line.trim()) continue
    const [sha, summary, author, timestamp] = line.split('|')
    if (sha) entries.push({ sha: sha.trim(), summary: (summary || '').trim(), author: (author || '').trim(), timestamp: parseInt(timestamp || '0', 10) || 0 })
  }
  return entries
}

export async function getGitStatus(cwd: string): Promise<GitStatusResult> {
  const empty: GitStatusResult = { branchName: '', files: [], stagedFiles: [], unstagedFiles: [], totalAdditions: 0, totalDeletions: 0 }
  try {
    let branchName = ''
    try { const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', { ...EXEC_OPTS, cwd }); branchName = stdout.trim() } catch {}
    const { stdout: statusOut } = await execAsync('git status --porcelain=v2 --branch', { ...EXEC_OPTS, cwd })
    const stagedFiles: GitFileStatus[] = []; const unstagedFiles: GitFileStatus[] = []; const allFiles: GitFileStatus[] = []
    for (const line of statusOut.split('\n')) {
      if (!line.trim()) continue
      if (line.startsWith('#')) { if (line.startsWith('# branch.head ')) branchName = line.slice('# branch.head '.length).trim(); continue }
      if (line.startsWith('1 ')) {
        const parts = line.split(' '); const xy = parts[1] || ''; const path = parts.slice(8).join(' ')
        const file: GitFileStatus = { path, status: '', additions: 0, deletions: 0 }
        if (xy[0] !== '.') { file.status = xy[0]; stagedFiles.push(file) }
        if (xy[1] !== '.') { file.status = xy[1]; unstagedFiles.push({ ...file }) }
        if (!file.status) file.status = 'M'; allFiles.push(file); continue
      }
      if (line.startsWith('2 ')) {
        const parts = line.split(' '); const xy = parts[1] || ''; const pathPart = parts.slice(8).join(' '); const tabIdx = pathPart.indexOf('\t'); const path = tabIdx >= 0 ? pathPart.slice(tabIdx + 1) : pathPart
        const file: GitFileStatus = { path, status: 'R', additions: 0, deletions: 0 }
        if (xy[0] !== '.') stagedFiles.push(file); if (xy[1] !== '.') unstagedFiles.push({ ...file }); allFiles.push(file); continue
      }
      if (line.startsWith('? ')) { const path = line.slice(2).trim(); const file: GitFileStatus = { path, status: '??', additions: 0, deletions: 0 }; unstagedFiles.push(file); allFiles.push(file); continue }
    }
    let totalAdditions = 0, totalDeletions = 0
    try { const { stdout } = await execAsync('git diff --cached --numstat', { ...EXEC_OPTS, cwd }); const m = parseNumstat(stdout); for (const f of stagedFiles) { const s = m.get(f.path); if (s) { f.additions = s.additions; f.deletions = s.deletions } } } catch {}
    try { const { stdout } = await execAsync('git diff --numstat', { ...EXEC_OPTS, cwd }); const m = parseNumstat(stdout); for (const f of unstagedFiles) { const s = m.get(f.path); if (s) { f.additions = s.additions; f.deletions = s.deletions } } } catch {}
    for (const f of stagedFiles) { totalAdditions += f.additions; totalDeletions += f.deletions }
    for (const f of unstagedFiles) { totalAdditions += f.additions; totalDeletions += f.deletions }
    return { branchName, files: allFiles, stagedFiles, unstagedFiles, totalAdditions, totalDeletions }
  } catch { return empty }
}

export async function getGitDiffs(cwd: string): Promise<GitFileDiff[]> {
  try {
    const results: GitFileDiff[] = []
    try { const { stdout } = await execAsync('git diff --cached', { ...EXEC_OPTS, cwd }); if (stdout.trim()) { for (const [path, diff] of splitDiffByFile(stdout)) results.push({ path, diff, status: 'M' }) } } catch {}
    try { const { stdout } = await execAsync('git diff', { ...EXEC_OPTS, cwd }); if (stdout.trim()) { for (const [path, diff] of splitDiffByFile(stdout)) { if (!results.find(r => r.path === path)) results.push({ path, diff, status: 'M' }) } } } catch {}
    try { const { stdout } = await execAsync('git ls-files --others --exclude-standard', { ...EXEC_OPTS, cwd }); for (const path of stdout.split('\n')) { if (!path.trim()) continue; try { await execAsync(`git diff --no-index -- ${escapePath('/dev/null')} ${escapePath(path)}`, { ...EXEC_OPTS, cwd }) } catch (e: any) { if (e?.stdout) results.push({ path, diff: e.stdout, status: 'A' }) } } } catch {}
    return results
  } catch { return [] }
}

export async function getGitLog(cwd: string, limit = 40): Promise<GitLogResponse> {
  const empty: GitLogResponse = { total: 0, entries: [], ahead: 0, behind: 0, aheadEntries: [], behindEntries: [], upstream: null }
  try {
    const fmt = '%H|%s|%an|%at'
    const { stdout } = await execAsync(`git log --format=${fmt} -${limit}`, { ...EXEC_OPTS, cwd })
    const entries = parseLogEntries(stdout)
    let upstream: string | null = null, ahead = 0, behind = 0, aheadEntries: GitLogEntry[] = [], behindEntries: GitLogEntry[] = []
    try {
      const { stdout: u } = await execAsync('git rev-parse --abbrev-ref @{upstream}', { ...EXEC_OPTS, cwd }); upstream = u.trim()
      const { stdout: lr } = await execAsync(`git rev-list --left-right --count HEAD...${upstream}`, { ...EXEC_OPTS, cwd }); const [a, b] = lr.trim().split(/\s+/); ahead = parseInt(a, 10) || 0; behind = parseInt(b, 10) || 0
      if (ahead > 0) { const { stdout: a2 } = await execAsync(`git log --format=${fmt} ${upstream}..HEAD`, { ...EXEC_OPTS, cwd }); aheadEntries = parseLogEntries(a2) }
      if (behind > 0) { const { stdout: b2 } = await execAsync(`git log --format=${fmt} HEAD..${upstream}`, { ...EXEC_OPTS, cwd }); behindEntries = parseLogEntries(b2) }
    } catch {}
    return { total: entries.length, entries, ahead, behind, aheadEntries, behindEntries, upstream }
  } catch { return empty }
}

export async function getGitCommitDiff(cwd: string, sha: string): Promise<GitCommitDiff[]> {
  try { const { stdout } = await execAsync(`git diff ${sha}^..${sha}`, { ...EXEC_OPTS, cwd }); return [...splitDiffByFile(stdout)].map(([path, diff]) => ({ path, status: 'M', diff })) } catch { return [] }
}

export async function stageGitFile(cwd: string, path: string): Promise<void> { await execAsync(`git add ${escapePath(path)}`, { ...EXEC_OPTS, cwd }) }
export async function stageGitAll(cwd: string): Promise<void> { await execAsync('git add -A', { ...EXEC_OPTS, cwd }) }
export async function unstageGitFile(cwd: string, path: string): Promise<void> { await execAsync(`git reset HEAD -- ${escapePath(path)}`, { ...EXEC_OPTS, cwd }) }
export async function revertGitFile(cwd: string, path: string): Promise<void> { try { await execAsync(`git checkout -- ${escapePath(path)}`, { ...EXEC_OPTS, cwd }) } catch { await execAsync(`git clean -f ${escapePath(path)}`, { ...EXEC_OPTS, cwd }) } }
export async function revertAllGitChanges(cwd: string): Promise<void> { await execAsync('git checkout -- . && git clean -fd && git reset', { ...EXEC_OPTS, cwd }) }
export async function commitGit(cwd: string, message: string): Promise<void> { await execAsync(`git commit -m ${JSON.stringify(message)}`, { ...EXEC_OPTS, cwd }) }
export async function pushGit(cwd: string): Promise<void> { await execAsync('git push', { ...EXEC_OPTS, cwd }) }
export async function pullGit(cwd: string): Promise<void> { await execAsync('git pull', { ...EXEC_OPTS, cwd }) }
export async function fetchGit(cwd: string): Promise<void> { await execAsync('git fetch', { ...EXEC_OPTS, cwd }) }
export async function syncGit(cwd: string): Promise<void> { await execAsync('git pull --rebase && git push', { ...EXEC_OPTS, cwd }) }
export async function listGitBranches(cwd: string): Promise<BranchInfo[]> {
  try { const { stdout } = await execAsync(`git for-each-ref --format='%(refname:short)|%(committerdate:unix)' refs/heads/`, { ...EXEC_OPTS, cwd }); const branches: BranchInfo[] = []; for (const line of stdout.split('\n')) { if (!line.trim()) continue; const [name, ts] = line.split('|'); if (name) branches.push({ name: name.trim(), lastCommit: parseInt(ts || '0', 10) || 0 }) }; return branches.sort((a, b) => b.lastCommit - a.lastCommit) } catch { return [] }
}
export async function checkoutGitBranch(cwd: string, name: string): Promise<void> { await execAsync(`git checkout ${escapePath(name)}`, { ...EXEC_OPTS, cwd }) }
export async function createGitBranch(cwd: string, name: string): Promise<void> { await execAsync(`git checkout -b ${escapePath(name)}`, { ...EXEC_OPTS, cwd }) }
export async function getGitRemote(cwd: string): Promise<string | null> { try { const { stdout } = await execAsync('git remote get-url origin', { ...EXEC_OPTS, cwd }); return stdout.trim() || null } catch { return null } }
