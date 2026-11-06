/*
 * Generates an integrity manifest and a checksums file for published artifacts.
 * Uses only node built-ins — runs before any dependencies are installed.
 *
 * Usage: node generate-integrity-manifest.mjs <manifest-out> <checksums-out> [release-tag] [commit]
 *
 * Environment variables:
 *   DIST_FILE  — path to the built file to hash (e.g. dist/umd/newrelic-video-hls.min.js)
 *
 * Outputs:
 *   <manifest-out>  — JSON mapping each S3 key to its SRI sha384 digest.
 *                     Customers can use these as `integrity` attributes in <script> tags.
 *   <checksums-out> — sha256sum-format listing consumed by actions/attest-build-provenance
 *                     as `subject-checksums`.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const [manifestOut, checksumsOut, releaseTag = '', commit = ''] = process.argv.slice(2)

if (!manifestOut || !checksumsOut) {
  console.error('Usage: generate-integrity-manifest.mjs <manifest-out> <checksums-out> [release-tag] [commit]')
  process.exit(1)
}

const distFile = process.env.DIST_FILE
if (!distFile) {
  console.error('DIST_FILE environment variable is required')
  process.exit(1)
}

const version = JSON.parse(readFileSync('package.json', 'utf8')).version
const baseName = distFile.split('/').pop().replace(/\.min\.js$/, '')
const versionedKey = `${baseName}.${version}.min.js`
const latestKey = `${baseName}.latest.min.js`

const contents = readFileSync(distFile)
const sha384 = `sha384-${createHash('sha384').update(contents).digest('base64')}`
const sha256 = createHash('sha256').update(contents).digest('hex')

const manifest = {
  version,
  commit,
  files: {
    [versionedKey]: { sha384 },
    [latestKey]: { sha384 },
  },
}

writeFileSync(manifestOut, JSON.stringify(manifest, null, 2) + '\n')
writeFileSync(checksumsOut, [
  `${sha256}  ${versionedKey}`,
  `${sha256}  ${latestKey}`,
].join('\n') + '\n')

console.log(`Wrote integrity manifest for v${version} (${Object.keys(manifest.files).length} files)`)
for (const [key, { sha384: h }] of Object.entries(manifest.files)) {
  console.log(`  ${key}: ${h}`)
}
