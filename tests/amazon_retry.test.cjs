const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const crypto = require('node:crypto');

const source = fs.readFileSync(path.join(__dirname, '../sources/amazon/index.js'), 'utf8');
const ok = body => ({ statusCode: 200, body: JSON.stringify(body) });
const audio = { audio: { url: 'https://offline.invalid/audio.flac', codec: 'flac', bitDepth: 24, sampleRate: 96000 } };

function load(respond, overrides = {}) {
  const calls = [], sleeps = [], downloads = [];
  let ticketCount = 0, extension;
  const context = vm.createContext({
    URL, URLSearchParams,
    registerExtension(value) { extension = value; },
    log: { info() {}, debug() {}, warn() {}, error() {} },
    utils: {
      sha256: value => crypto.createHash('sha256').update(value).digest('hex'),
      sleep(ms) { sleeps.push(ms); return true; },
      isDownloadCancelled: () => false,
      ...overrides,
    },
    session: { signedFetch(method, url, body, headers) {
      calls.push({ method, url, body, headers });
      if (url === '/tickets') return ok({ ticket_id: `ticket-${++ticketCount}` });
      return respond({ method, url, body, headers }, calls);
    } },
    file: { download(url, output) { downloads.push(url); return { success: true, path: output }; } },
  });
  vm.runInContext(source, context, { filename: 'amazon/index.js' });
  return {
    context, calls, sleeps, downloads,
    download: (quality = 'best') => extension.download('B000000001', quality, '/offline.flac', null, {
      preparedContext: { web_metadata: { title: 'Offline track' } },
    }),
    mediaCalls: () => calls.filter(call => call.url !== '/tickets'),
    ticketCount: () => ticketCount,
  };
}

for (const failure of [
  { error: 'track not available', statusCode: 404 },
  { error: 'No catalog entry', statusCode: 404, code: 'TRACK_NOT_FOUND', retryable: false, retryMode: 'none' },
]) {
  test(`permanent catalog absence makes one request: ${failure.error}`, () => {
    const app = load(() => failure);
    const result = app.download();
    assert.equal(result.error_type, 'not_found');
    assert.equal(app.mediaCalls().length, 1);
    assert.equal(app.ticketCount(), 1);
    assert.deepEqual(app.sleeps, []);
  });
}

test('unavailable requested codec immediately falls back to FLAC once', () => {
  const app = load(({ body }) => body.codec === 'eac3'
    ? { error: 'Requested quality unavailable', code: 'QUALITY_UNAVAILABLE', retryable: false, retryMode: 'none' }
    : ok(audio));
  assert.equal(app.download('eac3').success, true);
  assert.deepEqual(app.mediaCalls().map(call => call.body.codec), ['eac3', 'flac']);
  assert.deepEqual(app.sleeps, []);
});

for (const retryMode of ['poll_existing', 'new_ticket']) {
  test(`${retryMode} preserves contract and respects rate limit delay`, () => {
    let attempt = 0;
    const app = load(() => ++attempt === 1
      ? { statusCode: 429, error: 'Operation pending', code: 'OPERATION_PENDING', retryable: true, retryMode, headers: { 'rEtRy-AfTeR': '2' } }
      : ok(audio));
    assert.equal(app.download().success, true);
    assert.equal(attempt, 2);
    assert.equal(app.sleeps.length, 1);
    assert.ok(app.sleeps[0] >= 2000);
    const tickets = app.mediaCalls().map(call => call.headers['X-Zarz-Ticket']);
    assert.equal(app.ticketCount(), retryMode === 'poll_existing' ? 1 : 2);
    assert.equal(tickets[0] === tickets[1], retryMode === 'poll_existing');
  });
}

for (const retryMode of ['none', 'same_operation', 'future_mode']) {
  test(`terminal/host-owned retry mode ${retryMode} does not retry or downgrade`, () => {
    const app = load(() => ({ statusCode: 503, error: 'Provider temporarily unavailable', code: 'PROVIDER_UNAVAILABLE', retryable: true, retryMode }));
    assert.equal(app.download('eac3').error_type, 'api_error');
    assert.equal(app.mediaCalls().length, 1);
    assert.deepEqual(app.sleeps, []);
  });
}

test('authentication error cannot be mistaken for catalog absence', () => {
  const app = load(() => ({ error: 'track not available', code: 'PROVIDER_AUTH_FAILED', retryable: false, retryMode: 'none' }));
  assert.equal(app.download('eac3').error_type, 'authentication_error');
  assert.equal(app.mediaCalls().length, 1);
});

test('retry exhaustion preserves rate limit rather than downgrading codec', () => {
  const app = load(() => ({ statusCode: 429, error: 'Rate limited', code: 'RATE_LIMITED', retryable: true, retryMode: 'new_ticket', retryAfterSeconds: 3 }));
  const result = app.download('eac3');
  assert.equal(result.error_type, 'rate_limited');
  assert.equal(result.retry_after_seconds, 3);
  assert.equal(app.mediaCalls().length, 5);
  assert.ok(app.mediaCalls().every(call => call.body.codec === 'eac3'));
  assert.ok(app.sleeps.every(ms => ms >= 3000));
});

test('Retry-After larger than remaining host budget returns timeout without an early retry', () => {
  const app = load(() => ({ statusCode: 429, error: 'Operation pending', code: 'OPERATION_PENDING', retryable: true, retryMode: 'poll_existing', retryAfterSeconds: 120 }), {
    getResolutionRemainingMs: () => 60000,
  });
  const result = app.download('eac3');
  assert.equal(result.error_type, 'timeout');
  assert.equal(result.retry_after_seconds, 120);
  assert.equal(app.mediaCalls().length, 1);
  assert.deepEqual(app.sleeps, []);
});

test('verification preserves auth URL without retry or downgrade', () => {
  const app = load(() => ({ needsVerification: true, auth_url: 'https://offline.invalid/verify' }));
  const result = app.download('eac3');
  assert.equal(result.error_type, 'verification_required');
  assert.equal(result.auth_url, 'https://offline.invalid/verify');
  assert.equal(app.mediaCalls().length, 1);
});

test('cancellation during retry sleep stops the operation', () => {
  const app = load(() => ({ statusCode: 503, error: 'HTTP 503' }), { sleep: () => false });
  assert.equal(app.download('eac3').error_type, 'cancelled');
  assert.equal(app.mediaCalls().length, 1);
});

test('already cancelled download makes no ticket or download request', () => {
  const app = load(() => { throw new Error('unexpected request'); }, { isDownloadCancelled: () => true });
  assert.equal(app.download('eac3').error_type, 'cancelled');
  assert.equal(app.calls.length, 0);
});

test('HTTP date Retry-After is parsed and signed errors retain typed fields', () => {
  const response = { statusCode: 429, error: 'Rate limited', code: 'RATE_LIMITED', retryable: true, retryMode: 'new_ticket', headers: { 'Retry-After': new Date(Date.now() + 10000).toUTCString() } };
  const app = load(() => response);
  assert.throws(() => app.context.signedJSON('POST', '/dl/amazeamazeamaze', {}), error => {
    assert.equal(error.code, response.code);
    assert.equal(error.retryMode, response.retryMode);
    assert.equal(error.retryable, true);
    assert.ok(error.retryAfterMs >= 8000 && error.retryAfterMs <= 10000);
    return true;
  });
});

test('explicitly retryable catalog response remains pending rather than confirming absence', () => {
  let attempt = 0;
  const app = load(() => ++attempt === 1
    ? { error: 'track not available', code: 'TRACK_UNAVAILABLE', retryable: true, retryMode: 'poll_existing' }
    : ok(audio));
  assert.equal(app.download('eac3').success, true);
  assert.deepEqual(app.mediaCalls().map(call => call.body.codec), ['eac3', 'eac3']);
  assert.equal(app.ticketCount(), 1);
  assert.equal(app.sleeps.length, 1);
});
