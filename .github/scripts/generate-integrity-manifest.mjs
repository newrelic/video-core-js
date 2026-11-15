/*
 * Generates an integrity manifest and a checksums file for release files.
 * Uses only node built-ins — runs before any dependencies are installed.
 *
 * Outputs:
 *   <manifest-out>  — JSON listing each file with its size, sha256 and SRI sha384:
 *                     { schemaVersion, name, version, tag, commit, files: { <name>: { size, sha256, sha384 } } }
 *                     Browser customers can use sha384 as the `integrity` attribute of a <script> tag.
 *   <checksums-out> — sha256sum-format listing ("<sha256>  <name>"), consumed by
 *                     actions/attest-build-provenance as `subject-checksums` and checkable with
 *                     `shasum -a 256 -c`.
 *
 * Usage (any repo):
 *   node generate-integrity-manifest.mjs \
 *     --manifest-out <path> --checksums-out <path> \
 *     --name <name> --version <version> --tag <tag> --commit <sha> \
 *     --file <path>[:<name>[,<name>...]] [--file ...]
 *   A file listed with several names (e.g. a versioned and a "latest" alias) gets one entry per name.
 *   Without ":<name>" the entry is named after the file's base name.
 *
 * Usage (video-core-js, unchanged):
 *   DIST_FILE=<path> node generate-integrity-manifest.mjs <manifest-out> <checksums-out> [release-tag] [commit]
 *   Reads name and version from package.json and writes <base>.<version>.min.js and <base>.latest.min.js.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'
import { fileURLToPath } from 'node:url'

export function hashFile(path) {
  const contents = readFileSync(path)
  return {
    size: contents.length,
    sha256: createHash('sha256').update(contents).digest('hex'),
    sha384: `sha384-${createHash('sha384').update(contents).digest('base64')}`,
  }
}

// entries: [{ path, names: [string, ...] }]
export function buildManifest({ name = '', version = '', tag = '', commit = '', entries }) {
  const files = {}
  for (const { path, names } of entries) {
    const h = hashFile(path)
    for (const n of names) {
      if (files[n]) throw new Error(`Duplicate file name in manifest: ${n}`)
      files[n] = { ...h }
    }
  }
  return { schemaVersion: 1, name, version, tag, commit, files }
}

export function checksumsText(manifest) {
  return Object.entries(manifest.files).map(([n, { sha256 }]) => `${sha256}  ${n}`).join('\n') + '\n'
}

export function parseFileArg(arg) {
  const idx = arg.lastIndexOf(':')
  if (idx <= 0) return { path: arg, names: [basename(arg)] }
  return { path: arg.slice(0, idx), names: arg.slice(idx + 1).split(',').filter(Boolean) }
}

function parseOptions(argv) {
  const opts = { files: [] }
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]
    const value = argv[i + 1]
    if (!flag.startsWith('--') || value === undefined) throw new Error(`Bad argument: ${flag}`)
    i++
    if (flag === '--file') opts.files.push(parseFileArg(value))
    else if (['--manifest-out', '--checksums-out', '--name', '--version', '--tag', '--commit'].includes(flag)) {
      opts[flag.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value
    } else throw new Error(`Unknown option: ${flag}`)
  }
  return opts
}

function main() {
  const argv = process.argv.slice(2)
  let manifestOut, checksumsOut, manifest

  if (argv[0] && argv[0].startsWith('--')) {
    let opts
    try { opts = parseOptions(argv) } catch (e) { console.error(e.message); process.exit(1) }
    ;({ manifestOut, checksumsOut } = opts)
    if (!manifestOut || !checksumsOut || opts.files.length === 0) {
      console.error('Usage: generate-integrity-manifest.mjs --manifest-out <path> --checksums-out <path> --name <n> --version <v> --tag <t> --commit <sha> --file <path>[:<name>,...] ...')
      process.exit(1)
    }
    manifest = buildManifest({ name: opts.name, version: opts.version, tag: opts.tag, commit: opts.commit, entries: opts.files.map(f => ({ path: f.path, names: f.names })) })
  } else {
    const [mOut, cOut, releaseTag = '', commit = ''] = argv
    manifestOut = mOut
    checksumsOut = cOut
    if (!manifestOut || !checksumsOut) {
      console.error('Usage: generate-integrity-manifest.mjs <manifest-out> <checksums-out> [release-tag] [commit]')
      process.exit(1)
    }
    const distFile = process.env.DIST_FILE
    if (!distFile) {
      console.error('DIST_FILE environment variable is required')
      process.exit(1)
    }
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
    const baseName = distFile.split('/').pop().replace(/\.min\.js$/, '')
    manifest = buildManifest({
      name: pkg.name,
      version: pkg.version,
      tag: releaseTag,
      commit,
      entries: [{ path: distFile, names: [`${baseName}.${pkg.version}.min.js`, `${baseName}.latest.min.js`] }],
    })
  }

  writeFileSync(manifestOut, JSON.stringify(manifest, null, 2) + '\n')
  writeFileSync(checksumsOut, checksumsText(manifest))

  console.log(`Wrote integrity manifest for ${manifest.name} ${manifest.version} (${Object.keys(manifest.files).length} files)`)
  for (const [key, { sha256 }] of Object.entries(manifest.files)) {
    console.log(`  ${key}: ${sha256}`)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
