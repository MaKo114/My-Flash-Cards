import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const cache = path.join(root, '.cache')
mkdirSync(cache, { recursive: true })
const executable = path.join(cache, process.platform === 'win32' ? 'flashcards-e2e.exe' : 'flashcards-e2e')
const result = spawnSync('go', ['build', '-buildvcs=false', '-o', executable, './cmd/server'], {
  cwd: path.join(root, 'backend'),
  env: { ...process.env, GOCACHE: path.join(cache, 'go-build'), GOMODCACHE: path.join(cache, 'gomod') },
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
process.exit(result.status ?? 1)
