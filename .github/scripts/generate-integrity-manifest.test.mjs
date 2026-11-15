// Run with: node --test .github/scripts/generate-integrity-manifest.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { buildManifest, checksumsText, parseFileArg } from './generate-integrity-manifest.mjs'

const script = join(dirname(fileURLToPath(import.meta.url)), 'generate-integrity-manifest.mjs')
const sha256 = (s) => createHash('sha256').update(s).digest('hex')
const sha384 = (s) => `sha384-${createHash('sha384').update(s).digest('base64')}`

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'manifest-'))
  writeFileSync(join(dir, 'a.aar'), 'aaa')
  writeFileSync(join(dir, 'b.zip'), 'bbbb')
  return dir
}

test('parseFileArg: bare path uses the base name', () => {
  assert.deepEqual(parseFileArg('release/a.aar'), { path: 'release/a.aar', names: ['a.aar'] })
})

test('parseFileArg: path with several names', () => {
  assert.deepEqual(parseFileArg('dist/x.min.js:x.1.0.min.js,x.latest.min.js'), { path: 'dist/x.min.js', names: ['x.1.0.min.js', 'x.latest.min.js'] })
})

test('buildManifest lists size, sha256 and sha384 per name', () => {
  const dir = fixture()
  const m = buildManifest({ name: 'n', version: '1.0.0', tag: 'v1.0.0', commit: 'abc', entries: [{ path: join(dir, 'a.aar'), names: ['a.aar'] }, { path: join(dir, 'b.zip'), names: ['b.zip', 'b-alias.zip'] }] })
  assert.equal(m.schemaVersion, 1)
  assert.deepEqual(m.files['a.aar'], { size: 3, sha256: sha256('aaa'), sha384: sha384('aaa') })
  assert.deepEqual(m.files['b-alias.zip'], m.files['b.zip'])
  assert.deepEqual(Object.keys(m.files), ['a.aar', 'b.zip', 'b-alias.zip'])
})

test('buildManifest rejects duplicate names', () => {
  const dir = fixture()
  assert.throws(() => buildManifest({ entries: [{ path: join(dir, 'a.aar'), names: ['x'] }, { path: join(dir, 'b.zip'), names: ['x'] }] }), /Duplicate/)
})

test('checksumsText is sha256sum format', () => {
  const dir = fixture()
  const m = buildManifest({ entries: [{ path: join(dir, 'a.aar'), names: ['a.aar'] }] })
  assert.equal(checksumsText(m), `${sha256('aaa')}  a.aar\n`)
})

test('CLI (options mode) writes both files', () => {
  const dir = fixture()
  execFileSync('node', [script, '--manifest-out', join(dir, 'm.json'), '--checksums-out', join(dir, 'SHA256SUMS'), '--name', 'agent', '--version', '2.0.0', '--tag', 'v2.0.0', '--commit', 'deadbeef', '--file', join(dir, 'a.aar'), '--file', join(dir, 'b.zip')])
  const m = JSON.parse(readFileSync(join(dir, 'm.json'), 'utf8'))
  assert.equal(m.version, '2.0.0')
  assert.equal(m.commit, 'deadbeef')
  assert.equal(m.files['a.aar'].sha256, sha256('aaa'))
  assert.equal(readFileSync(join(dir, 'SHA256SUMS'), 'utf8').trim().split('\n').length, 2)
})

test('CLI (video-core-js call, unchanged) keeps the fields existing readers use', () => {
  const dir = fixture()
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: '@newrelic/video-core', version: '9.9.9' }))
  writeFileSync(join(dir, 'nrvideo.min.js'), 'console.log(1)')
  execFileSync('node', [script, join(dir, 'm.json'), join(dir, 'c.txt'), 'v9.9.9', 'cafe'], { cwd: dir, env: { ...process.env, DIST_FILE: join(dir, 'nrvideo.min.js') } })
  const m = JSON.parse(readFileSync(join(dir, 'm.json'), 'utf8'))
  assert.equal(m.version, '9.9.9')
  assert.equal(m.commit, 'cafe')
  assert.deepEqual(Object.keys(m.files), ['nrvideo.9.9.9.min.js', 'nrvideo.latest.min.js'])
  assert.equal(m.files['nrvideo.9.9.9.min.js'].sha384, sha384('console.log(1)'))
  assert.equal(readFileSync(join(dir, 'c.txt'), 'utf8'), `${sha256('console.log(1)')}  nrvideo.9.9.9.min.js\n${sha256('console.log(1)')}  nrvideo.latest.min.js\n`)
})
