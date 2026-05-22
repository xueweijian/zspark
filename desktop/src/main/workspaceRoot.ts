import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

function discoverRepoRoot(start: string): string | null {
  let dir = resolve(start)
  while (true) {
    if (existsSync(join(dir, '.git')) && (existsSync(join(dir, 'codex-rs')) || existsSync(join(dir, '.codex')))) {
      return dir
    }
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

function packagedWorkspaceRoot(): string {
  return join(app.getPath('documents'), 'zspark')
}

export function resolveWorkspaceRoot(start: string, explicitRoot = process.env.ZSPARK_WORKSPACE_ROOT): string {
  const explicit = explicitRoot?.trim()
  if (explicit) return resolve(explicit)

  const repoRoot = discoverRepoRoot(start)
  if (repoRoot) return repoRoot

  return app.isPackaged ? packagedWorkspaceRoot() : resolve(start)
}

export function ensureWorkspaceRoot(path: string): void {
  mkdirSync(path, { recursive: true })
}

/**
 * Validate that a path is a valid workspace root.
 * Returns the normalized absolute path if valid, or null if invalid.
 */
export function validateWorkspaceRoot(rawPath: string): string | null {
  try {
    const normalized = resolve(rawPath)
    if (!existsSync(normalized)) return null
    const stat = statSync(normalized)
    if (!stat.isDirectory()) return null
    return normalized
  } catch {
    return null
  }
}

/**
 * Detect the technology stack of a project.
 * Returns a string like "vue", "react", "node", "python", etc.
 */
export function detectTechStack(workspacePath: string): string {
  try {
    const pkgPath = join(workspacePath, 'package.json')
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }

      if (deps.vue || deps.nuxt) return 'vue'
      if (deps.react || deps['react-dom'] || deps.next) return 'react'
      if (deps.svelte || deps.sveltekit) return 'svelte'
      if (deps.angular || deps['@angular/core']) return 'angular'
      if (deps.astro) return 'astro'
      if (deps.express || deps.fastify || deps.koa) return 'node'
      if (deps.typescript) return 'ts'
      return 'js'
    }

    // Check for Python project
    if (existsSync(join(workspacePath, 'pyproject.toml')) ||
        existsSync(join(workspacePath, 'setup.py')) ||
        existsSync(join(workspacePath, 'requirements.txt'))) {
      return 'python'
    }

    // Check for Go project
    if (existsSync(join(workspacePath, 'go.mod'))) return 'go'

    // Check for Rust project
    if (existsSync(join(workspacePath, 'Cargo.toml'))) return 'rust'

    return 'unknown'
  } catch {
    return 'unknown'
  }
}
