// Shared helpers for the scripts in scripts/.
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

/** The `//` comment block right after a script's shebang is its documentation. */
function helpText(scriptUrl) {
  const lines = readFileSync(fileURLToPath(scriptUrl), 'utf8').split('\n').slice(1)
  const end = lines.findIndex((line) => !line.startsWith('//'))
  return lines
    .slice(0, end)
    .map((line) => line.replace(/^\/\/ ?/, ''))
    .join('\n')
}

/**
 * Parses the command line of a script.
 *
 * - `flags`: names of boolean options, e.g. ['watch', 'headed']
 * - `suites`: allowed positional values; the first one is the default
 * - `argument`: name of a required free-text positional instead, e.g. 'message'
 *
 * Everything after `--` is returned untouched in `passthrough`, for the
 * underlying tool. Handles -h/--help and rejects unknown arguments.
 */
export function parseCli(scriptUrl, { flags = [], suites = [], argument } = {}) {
  const argv = process.argv.slice(2)
  const separator = argv.indexOf('--')
  const own = separator === -1 ? argv : argv.slice(0, separator)
  const passthrough = separator === -1 ? [] : argv.slice(separator + 1)

  const options = { help: { type: 'boolean', short: 'h' } }
  for (const flag of flags) options[flag] = { type: 'boolean', default: false }

  try {
    const { values, positionals } = parseArgs({ args: own, options, allowPositionals: true })
    if (values.help) {
      console.log(helpText(scriptUrl))
      process.exit(0)
    }
    if (argument) {
      if (positionals.length !== 1) throw new Error(`genau ein Argument <${argument}> erwartet`)
      return { ...values, [argument]: positionals[0], passthrough }
    }
    const [suite = suites[0], ...rest] = positionals
    if (rest.length > 0 || (suite !== undefined && !suites.includes(suite))) {
      throw new Error(`unbekanntes Argument: ${positionals.join(' ')}`)
    }
    return { ...values, suite, passthrough }
  } catch (error) {
    console.error(`Fehler: ${error.message}\n`)
    console.error(helpText(scriptUrl))
    process.exit(2)
  }
}

/**
 * Runs a command with the terminal attached and resolves with its exit code.
 * `input` is written to its stdin instead (e.g. secrets that must not appear in arguments).
 */
export function run(command, args = [], { cwd = ROOT, env, input } = {}) {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, {
      cwd,
      env: env && { ...process.env, ...env },
      stdio: input === undefined ? 'inherit' : ['pipe', 'inherit', 'inherit'],
      // npx, uv etc. are .cmd shims on Windows and need a shell there.
      shell: process.platform === 'win32',
    })
    // Ctrl+C reaches the child directly; stay alive until it has finished.
    const ignore = () => {}
    const forward = (signal) => child.kill(signal)
    process.on('SIGINT', ignore)
    process.on('SIGTERM', forward)
    if (input !== undefined) child.stdin.end(input)
    child.on('exit', (code, signal) => {
      process.off('SIGINT', ignore)
      process.off('SIGTERM', forward)
      resolvePromise(code ?? (signal ? 1 : 0))
    })
  })
}

/** Runs a command and exits with its exit code, like `exec` in a shell. */
export async function exec(command, args, options) {
  process.exit(await run(command, args, options))
}

/** Runs commands one after another and stops at the first failure. */
export async function runAll(steps) {
  for (const [command, args, options] of steps) {
    const code = await run(command, args, options)
    if (code !== 0) process.exit(code)
  }
}
