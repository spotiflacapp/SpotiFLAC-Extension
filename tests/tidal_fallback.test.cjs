const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const crypto = require('node:crypto');

const source = fs.readFileSync(path.join(__dirname, '../sources/tidal-web/index.js'), 'utf8');
const ok = body => ({ statusCode: 200, body: JSON.stringify(body) });
function flac(quality = 'HI_RES_LOSSLESS') {
  return ok({ data: {
    audioQuality: quality, bitDepth: quality === 'LOSSLESS' ? 16 : 24, sampleRate: quality === 'LOSSLESS' ? 44100 : 96000,
    manifest: Buffer.from(JSON.stringify({ urls: ['https://offline.invalid/audio.flac'], mimeType: 'audio/flac' })).toString('base64'),
  } });
}
function load(respond, overrides = {}) {
  const calls = [], sleeps = [];
  let ticketCount = 0;
  const context = vm.createContext({
    registerExtension() {},
    log: { info() {}, debug() {}, warn() {}, error() {} },
    utils: {
      sha256: value => crypto.createHash('sha256').update(value).digest('hex'),
      base64Decode: value => Buffer.from(value, 'base64').toString('utf8'),
      sleep(ms) { sleeps.push(ms); return true; },
      isDownloadCancelled: () => false,
      ...overrides,
    },
    session: { signedFetch(method, url, body, headers) {
      calls.push({ method, url, body, headers });
      if (url === '/tickets') return ok({ ticket_id: `ticket-${++ticketCount}` });
      return respond({ method, url, body, headers }, calls);
    } },
  });
  vm.runInContext(source, context, { filename: 'tidal-web/index.js' });
  return {
    context, calls, sleeps,
    fetch: (quality = 'DOLBY_ATMOS') => context.fetchDownloadInfo('123456', quality),
    mediaCalls: () => calls.filter(call => call.url !== '/tickets'),
    qualities: () => calls.filter(call => call.url !== '/tickets').map(call => call.body.endpoint === 'manifests' ? 'DOLBY_ATMOS' : call.body.quality),
    ticketCount: () => ticketCount,
  };
}

for (const code of ['QUALITY_UNAVAILABLE', 'TRACK_UNAVAILABLE', 'TRACK_NOT_FOUND']) {
  test(`${code} immediately tries FLAC after unavailable Atmos`, () => {
    const app = load(({ body }) => body.endpoint === 'manifests'
      ? { statusCode: 404, error: 'No matching catalog rendition', code, retryable: false, retryMode: 'none' }
      : flac());
    assert.equal(app.fetch().resolvedQuality, 'HI_RES_LOSSLESS');
    assert.deepEqual(app.qualities(), ['DOLBY_ATMOS', 'HI_RES_LOSSLESS']);
    assert.deepEqual(app.sleeps, []);
  });
}

test('confirmed missing Atmos and hi-res tries CD FLAC', () => {
  const app = load(({ body }) => body.quality === 'LOSSLESS' ? flac('LOSSLESS')
    : { error: 'Requested quality unavailable', code: 'QUALITY_UNAVAILABLE', retryable: false, retryMode: 'none' });
  assert.equal(app.fetch().resolvedQuality, 'LOSSLESS');
  assert.deepEqual(app.qualities(), ['DOLBY_ATMOS', 'HI_RES_LOSSLESS', 'LOSSLESS']);
  assert.deepEqual(app.sleeps, []);
});

for (const error of ['Requested quality unavailable', 'track not available']) {
  test(`narrow legacy catalog message allows fallback: ${error}`, () => {
    const app = load(({ body }) => body.endpoint === 'manifests' ? { error } : flac());
    assert.equal(app.fetch().resolvedQuality, 'HI_RES_LOSSLESS');
    assert.equal(app.mediaCalls().length, 2);
    assert.deepEqual(app.sleeps, []);
  });
}

test('missing EAC3_JOC in actual manifest response immediately tries FLAC', () => {
  const app = load(({ body }) => body.endpoint === 'manifests'
    ? ok({ data: { data: { attributes: { formats: ['FLAC'] } } } }) : flac());
  assert.equal(app.fetch().resolvedQuality, 'HI_RES_LOSSLESS');
  assert.deepEqual(app.qualities(), ['DOLBY_ATMOS', 'HI_RES_LOSSLESS']);
});

for (const failure of [
  { error: 'track not available', code: 'PROVIDER_AUTH_FAILED', retryable: false, retryMode: 'none' },
  { error: 'Rate limited', statusCode: 429, code: 'RATE_LIMITED', retryable: false, retryMode: 'none' },
  { error: 'Provider temporarily unavailable', code: 'PROVIDER_UNAVAILABLE', retryable: true, retryMode: 'same_operation' },
  { error: 'Bad ticket', code: 'TICKET_INVALID', retryable: false, retryMode: 'none' },
  { error: 'unknown result', code: 'FUTURE_ERROR', retryable: true, retryMode: 'future_mode' },
]) {
  test(`${failure.code} does not confirm quality absence`, () => {
    const app = load(() => failure);
    assert.throws(() => app.fetch(), /without confirmation/);
    assert.deepEqual(app.qualities(), ['DOLBY_ATMOS']);
    assert.deepEqual(app.sleeps, []);
  });
}

for (const failure of [
  { error: 'network timeout' },
  { error: 'Atmos manifest payload missing attributes' },
  { error: 'Download API payload missing manifest' },
  { error: 'Download API returned no data' },
]) {
  test(`ambiguous failure does not downgrade: ${failure.error}`, () => {
    const app = load(() => failure);
    assert.throws(() => app.fetch(), /without confirmation/);
    assert.equal(app.mediaCalls().length, 5);
    assert.ok(app.qualities().every(quality => quality === 'DOLBY_ATMOS'));
  });
}

for (const retryMode of ['poll_existing', 'new_ticket']) {
  test(`${retryMode} observes Retry-After and ticket identity`, () => {
    let attempt = 0;
    const app = load(() => ++attempt === 1
      ? { statusCode: 429, error: 'Operation pending', code: 'OPERATION_PENDING', retryable: true, retryMode, retryAfterSeconds: 2 }
      : flac());
    assert.equal(app.fetch('HI_RES_LOSSLESS').resolvedQuality, 'HI_RES_LOSSLESS');
    assert.equal(app.sleeps.length, 1);
    assert.ok(app.sleeps[0] >= 2000);
    assert.equal(app.ticketCount(), retryMode === 'poll_existing' ? 1 : 2);
    const tickets = app.mediaCalls().map(call => call.headers['X-Zarz-Ticket']);
    assert.equal(tickets[0] === tickets[1], retryMode === 'poll_existing');
  });
}

test('Retry-After beyond remaining budget stops without sleeping or retrying early', () => {
  const app = load(() => ({ statusCode: 429, error: 'Operation pending', code: 'OPERATION_PENDING', retryable: true, retryMode: 'poll_existing', retryAfterSeconds: 120 }), {
    getResolutionRemainingMs: () => 60000,
  });
  assert.throws(() => app.fetch(), error => error.code === 'RESOLUTION_TIMEOUT' && error.retryAfterMs === 120000);
  assert.equal(app.mediaCalls().length, 1);
  assert.deepEqual(app.sleeps, []);
});

test('verification flag stops immediately even with nonstandard error message', () => {
  const app = load(() => ({ needsVerification: true, error: 'Please verify session' }));
  assert.throws(() => app.fetch(), error => error.needsVerification === true);
  assert.equal(app.mediaCalls().length, 1);
  assert.deepEqual(app.sleeps, []);
});

test('cancellation during wait stops without a second request or quality fallback', () => {
  const app = load(() => ({ error: 'network timeout' }), { sleep: () => false });
  assert.throws(() => app.fetch(), /download cancelled/);
  assert.equal(app.mediaCalls().length, 1);
});

test('already cancelled lookup does not mint a ticket', () => {
  const app = load(() => { throw new Error('unexpected request'); }, { isDownloadCancelled: () => true });
  assert.throws(() => app.fetch(), /download cancelled/);
  assert.equal(app.calls.length, 0);
});

test('explicitly retryable track unavailability does not confirm quality absence', () => {
  const app = load(() => ({ error: 'Requested quality unavailable', code: 'TRACK_UNAVAILABLE', retryable: true, retryMode: 'poll_existing' }));
  assert.throws(() => app.fetch(), /without confirmation/);
  assert.equal(app.mediaCalls().length, 5);
  assert.equal(app.ticketCount(), 1);
  assert.ok(app.qualities().every(quality => quality === 'DOLBY_ATMOS'));
});
