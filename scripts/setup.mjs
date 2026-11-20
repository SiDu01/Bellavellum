// Compiles installer/bellavellum.iss with Inno Setup's ISCC. Set ISCC to its path if it is not found.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const env = process.env
const candidates = [
  env.ISCC,
  env.LOCALAPPDATA && join(env.LOCALAPPDATA, 'Programs', 'Inno Setup 6', 'ISCC.exe'),
  env['ProgramFiles(x86)'] && join(env['ProgramFiles(x86)'], 'Inno Setup 6', 'ISCC.exe'),
  env.ProgramFiles && join(env.ProgramFiles, 'Inno Setup 6', 'ISCC.exe')
]
const iscc = candidates.find((p) => p && existsSync(p))
if (!iscc) {
  console.error('ISCC.exe nicht gefunden. Inno Setup 6 installieren oder ISCC=<Pfad zu ISCC.exe> setzen.')
  process.exit(1)
}
const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
execFileSync(iscc, [`/DAppVersion=${version}`, join('installer', 'bellavellum.iss')], { stdio: 'inherit' })
