#!/usr/bin/env node
// @ts-check
/**
 * 从 GitHub Actions 拉取最新 CI 构建的 codex.exe,放到 codex-rs/target/release/。
 *
 * 优先使用 gh CLI(若已 gh auth login);未登录或未安装时,回退到
 * GITHUB_TOKEN 环境变量走 REST API。
 *
 * 用法:
 *   node scripts/pull-codex.mjs              # 拉最新成功构建
 *   node scripts/pull-codex.mjs --run 12345  # 拉指定 run id
 *   node scripts/pull-codex.mjs --force      # 即使本地已存在也覆盖
 */
import { execSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, cpSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

const ROOT = resolve(import.meta.dirname, '..')
const DEST_DIR = join(ROOT, 'codex-rs', 'target', 'release')
const DEST_EXE = join(DEST_DIR, 'codex.exe')
const ARTIFACT = 'codex-windows-x64'
const WORKFLOW = 'build-codex-windows.yml'
const TMP_DIR = join(ROOT, '.codex-dl-tmp')

// ---- 参数解析 ----
const argv = process.argv.slice(2)
let runId = null
let force = false
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--run') runId = argv[++i]
  else if (argv[i] === '--force') force = true
  else if (argv[i] === '-h' || argv[i] === '--help') {
    console.log('用法: node scripts/pull-codex.mjs [--run <id>] [--force]')
    process.exit(0)
  }
}

const sh = (cmd, opts) => execSync(cmd, { encoding: 'utf8', ...opts }).trim()
const run = (cmd) => execSync(cmd, { stdio: 'inherit' })

// ---- 1. 确定 repo ----
// 从 git remote 推断 owner/repo,避免硬编码。
let repo
try {
  const url = sh('git remote get-url origin')
  const m = url.match(/github\.com[/:]([^/]+\/[^/]+?)(\.git)?$/i)
  if (!m) throw new Error(`无法从 origin 解析 repo: ${url}`)
  repo = m[1]
} catch (e) {
  console.error('无法读取 git remote origin。请确认在 zspark 仓库根目录运行。', e.message)
  process.exit(1)
}

// ---- 2. 选择下载方式 ----
const ghAvailable = (() => {
  try {
    spawnSync('gh', ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
})()

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
let useGh = ghAvailable
if (useGh) {
  const r = spawnSync('gh', ['auth', 'status'], { stdio: 'pipe' })
  if (r.status !== 0) {
    if (token) {
      console.log('gh 未登录,检测到 GITHUB_TOKEN,改用 REST API 方式。')
      useGh = false
    } else {
      console.error('gh 未登录,且未设置 GITHUB_TOKEN。请先运行: gh auth login')
      process.exit(1)
    }
  }
} else if (!token) {
  console.error('未安装/未找到 gh,且未设置 GITHUB_TOKEN 环境变量。')
  console.error('  方式1: 安装 gh 并 gh auth login')
  console.error('  方式2: 设置环境变量 GITHUB_TOKEN(需 repo / actions:read 权限)')
  process.exit(1)
}

// ---- 3. 解析目标 run id ----
const noRunHint = () => {
  console.error('暂无成功的构建。请先触发 build-codex-windows 工作流:')
  console.error('  网页: GitHub → Actions → build-codex-windows → Run workflow')
  console.error('  命令: gh workflow run build-codex-windows.yml --repo ' + repo)
}

const handle404 = (err) => {
  const msg = (err && (err.stderr || err.message)) || ''
  if (/not found|404/i.test(msg)) {
    console.error(`GitHub 上找不到 workflow "${WORKFLOW}"。`)
    console.error('请确认该 workflow 文件已 commit 并 push 到默认分支(main)。')
    console.error('当前改动可能尚未推送,可执行: git push')
    process.exit(1)
  }
  throw err
}

if (!runId) {
  console.log(`查询 ${repo} 的最近构建...`)
  if (useGh) {
    let runs
    try {
      runs = JSON.parse(sh(
        `gh run list --repo ${repo} --workflow=${WORKFLOW} --limit 5 ` +
        `--json databaseId,conclusion,status,createdAt,displayTitle`
      ))
    } catch (err) {
      handle404(err)
    }
    const ok = runs.filter(r => r.conclusion === 'success')
    if (!ok.length) {
      noRunHint()
      process.exit(1)
    }
    runId = ok[0].databaseId
    console.log(`找到构建: #${ok[0].databaseId}  ${ok[0].displayTitle}  (${ok[0].createdAt})`)
  } else {
    // REST API: 列出 workflow runs
    const api = (path) => JSON.parse(sh(
      `curl -fsSL -H "Authorization: Bearer ${token}" ` +
      `-H "Accept: application/vnd.github+json" ` +
      `"https://api.github.com/repos/${repo}/${path}"`
    ))
    let wfRes
    try {
      wfRes = api(`actions/workflows/${encodeURIComponent(WORKFLOW)}/runs?per_page=5`)
    } catch (err) {
      handle404(err)
    }
    const ok = (wfRes.workflow_runs || []).filter(r => r.conclusion === 'success')
    if (!ok.length) {
      noRunHint()
      process.exit(1)
    }
    runId = ok[0].id
    console.log(`找到构建: #${ok[0].id}  ${ok[0].name || ok[0].display_title}  (${ok[0].created_at})`)
  }
} else {
  console.log(`使用指定 run: #${runId}`)
}

// ---- 4. 下载 artifact ----
if (!force && existsSync(DEST_EXE)) {
  const sizeMB = (statSync(DEST_EXE).size / 1024 / 1024).toFixed(1)
  console.log(`本地已存在 ${DEST_EXE} (${sizeMB} MB)。加 --force 可覆盖。`)
} else {
  rmSync(TMP_DIR, { recursive: true, force: true })
  mkdirSync(TMP_DIR, { recursive: true })

  if (useGh) {
    run(`gh run download ${runId} --repo ${repo} -n ${ARTIFACT} -D "${TMP_DIR}"`)
  } else {
    // REST API: 找到该 artifact 后用 redirect URL 下载 zip
    const api = (path) => JSON.parse(sh(
      `curl -fsSL -H "Authorization: Bearer ${token}" ` +
      `-H "Accept: application/vnd.github+json" ` +
      `"https://api.github.com/repos/${repo}/${path}"`
    ))
    const arts = api(`actions/runs/${runId}/artifacts?per_page=100`).artifacts || []
    const art = arts.find(a => a.name === ARTIFACT)
    if (!art) {
      console.error(`构建 #${runId} 中找不到 artifact "${ARTIFACT}"。可能已被清理或构建失败。`)
      process.exit(1)
    }
    const zipPath = join(TMP_DIR, 'codex.zip')
    // -L 跟随 redirect 到 S3 临时 URL
    run(
      `curl -fsSL -H "Authorization: Bearer ${token}" ` +
      `-H "Accept: application/vnd.github+json" ` +
      `-o "${zipPath}" ` +
      `"https://api.github.com/repos/${repo}/actions/artifacts/${art.id}/zip"`
    )
    // 解压 (Windows 自带 tar 支持 zip)
    run(`tar -xf "${zipPath}" -C "${TMP_DIR}"`)
    rmSync(zipPath, { force: true })
  }

  if (!existsSync(join(TMP_DIR, 'codex.exe'))) {
    console.error('下载完成但未找到 codex.exe。下载目录内容:')
    try { run(`ls -la "${TMP_DIR}"`) } catch { /* ignore */ }
    process.exit(1)
  }

  mkdirSync(DEST_DIR, { recursive: true })
  cpSync(join(TMP_DIR, 'codex.exe'), DEST_EXE, {})
  rmSync(TMP_DIR, { recursive: true, force: true })
}

// ---- 5. 校验 ----
const sizeMB = (statSync(DEST_EXE).size / 1024 / 1024).toFixed(1)
console.log(`\n✓ 已写入: ${DEST_EXE}  (${sizeMB} MB)`)
try {
  run(`"${DEST_EXE}" --version`)
  console.log('\n✓ codex.exe 可正常运行。桌面端 pnpm dev 会自动使用它。')
} catch {
  console.warn('⚠ codex.exe --version 执行失败,可能是 Windows SmartScreen 拦截,或下载损坏。')
  console.warn('  如桌面端启动报错,可尝试 --force 重新下载。')
}
