const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function runtime() {
  const ctx = vm.createContext({
    registerExtension() {}, log: { info() {}, warn() {}, error() {} },
    utils: { isDownloadCancelled: () => false },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../sources/qobuz-web/index.js'), 'utf8'), ctx);
  return ctx;
}
const track = (id, extra = {}) => ({ id, title: 'Signal', performer: { name: 'Artist' },
  isrc: 'USAAA0000001', duration: 180, ...extra });
const request = c => c.checkAvailability('USAAA0000001', 'Signal', 'Artist', { duration_ms: 180000 });
function sources(c, api, album = () => [], store = () => []) {
  c.searchTracksViaAPI = api;
  c.searchTracksViaAlbumSearch = album;
  c.searchTracksViaStore = store;
}

test('download metadata includes duration for host matching across release editions', () => {
  const c = runtime();
  const result = c.applyTrackMetadataToDownloadResult({ success: true }, {
    name: 'Signal', artists: 'Composer, Singer', album_name: 'Compilation', duration_ms: 305000,
  });
  assert.equal(result.duration_ms, 305000);
  assert.equal(c.applyTrackMetadataToDownloadResult({}, {}).duration_ms, 0);
});

test('exact ISRC outranks an earlier valid name match and still enforces duration', () => {
  const c = runtime();
  const name = track('1', { isrc: 'different', maximum_bit_depth: 24 });
  const exact = track('2', { isrc: ' usaaa0000001 ', maximum_bit_depth: 16 });
  const long = track('3', { duration: 210 });
  assert.equal(c.selectBestSearchTrack([name, long, exact], 'USAAA0000001', 'Signal', 'Artist', 180000).id, '2');
  assert.equal(c.selectBestSearchTrack([long], 'USAAA0000001', 'Signal', 'Artist', 180000), null);
  assert.equal(c.validateDownloadedDuration(180000, 30).valid, false);
  assert.equal(c.validateDownloadedDuration(180000, 191).valid, false);
});

test('ISRC-only searches reject unrelated results, including direct IDs', () => {
  const c = runtime();
  const unrelated = track('1', { isrc: 'different' });
  sources(c, () => [unrelated]);
  c.fetchTrackRaw = () => unrelated;
  assert.equal(c.checkAvailability('USAAA0000001', '', '', { qobuz_id: '1' }).available, false);
});

test('invalid API candidates allow album and store fallbacks', () => {
  for (const matchSource of ['album', 'store']) {
    const c = runtime();
    const calls = [];
    sources(c, () => { calls.push('api'); return [track('1', { duration: 240 })]; },
      () => { calls.push('album'); return matchSource === 'album' ? [track('2')] : [track('3', { isrc: '', title: 'Other' })]; },
      () => { calls.push('store'); return [track('4')]; });
    assert.equal(request(c).track_id, matchSource === 'album' ? '2' : '4');
    assert.deepEqual(calls, matchSource === 'album' ? ['api', 'album'] : ['api', 'album', 'store']);
  }
});

test('an ISRC alternate query can match even when a name was supplied', () => {
  const c = runtime();
  const calls = [];
  sources(c, q => { calls.push(q); return q === 'USAAA0000001' ? [track('2')] : [track('1', { duration: 220 })]; });
  assert.equal(request(c).track_id, '2');
  assert.deepEqual(calls, ['Signal Artist', 'USAAA0000001']);
});

test('search remains bounded and deduplicates alternate queries', () => {
  const c = runtime();
  const calls = [];
  const empty = q => { calls.push(q); return []; };
  sources(c, empty, empty, empty);
  assert.equal(request(c).available, false);
  assert.equal(calls.length, 9);
  assert.equal(request(c).available, false);
  assert.equal(calls.length, 9, 'negative source caches avoid repeating requests');
  c.cleanup();
  calls.length = 0;
  assert.equal(c.checkAvailability('', 'Signal', '', {}).available, false);
  assert.equal(calls.length, 3, 'identical title and title+artist queries run once');
});

test('raw cache results are revalidated for each request and shared with normal search', () => {
  const c = runtime();
  let apiCalls = 0;
  let albumCalls = 0;
  sources(c, () => { apiCalls++; return [track('1', { duration: 210 })]; },
    () => { albumCalls++; return [track('2')]; });
  assert.equal(c.searchTracksWithFallback('Signal Artist', 8)[0].id, '1');
  assert.equal(request(c).track_id, '2');
  assert.equal(apiCalls, 1);
  assert.equal(albumCalls, 1);
  assert.equal(request(c).track_id, '2');
  assert.equal(albumCalls, 1);
});

test('verification halts fallback search and direct-ID verification propagates', () => {
  const c = runtime();
  let fallbackCalls = 0;
  sources(c, () => { throw new Error('VERIFY_REQUIRED'); }, () => { fallbackCalls++; return []; });
  assert.throws(() => request(c), /VERIFY_REQUIRED/);
  assert.equal(fallbackCalls, 0);
  c.fetchTrackRaw = () => { throw new Error('VERIFY_REQUIRED'); };
  assert.throws(() => c.checkAvailability('USAAA0000001', 'Signal', 'Artist', { qobuz_id: '1' }), /VERIFY_REQUIRED/);
});

test('native signed-session challenges propagate from availability and manual search', () => {
  const c = runtime();
  let signedCalls = 0;
  c.session = {
    signedFetch() {
      signedCalls++;
      return { needsVerification: true, auth_url: 'https://auth.example.test/verify' };
    },
  };
  c.http = { get() { assert.fail('verification must not fall through to public search'); } };
  assert.throws(() => request(c), /VERIFY_REQUIRED/);
  assert.throws(() => c.customSearch('Signal', { filter: 'track' }), /VERIFY_REQUIRED/);
  assert.equal(signedCalls, 2);
});

test('verification errors are not cached as unavailable after a grant', () => {
  const c = runtime();
  let granted = false;
  let signedCalls = 0;
  c.session = {
    signedFetch() {
      signedCalls++;
      if (!granted) return { needsVerification: true };
      return { statusCode: 200, body: JSON.stringify({ tracks: { items: [track('1')] } }) };
    },
  };
  assert.throws(() => request(c), /VERIFY_REQUIRED/);
  granted = true;
  assert.equal(request(c).track_id, '1');
  assert.equal(signedCalls, 2);
});

test('cached misses do not contact the session while a manual search can request verification', () => {
  const c = runtime();
  const originalSources = [c.searchTracksViaAPI, c.searchTracksViaAlbumSearch, c.searchTracksViaStore];
  sources(c, () => [], () => [], () => []);
  assert.equal(request(c).available, false);
  sources(c, ...originalSources);
  let signedCalls = 0;
  c.session = {
    signedFetch() {
      signedCalls++;
      return { needsVerification: true };
    },
  };
  assert.equal(request(c).available, false);
  assert.equal(signedCalls, 0, 'the host must prepare the session before accepting cached availability');
  assert.throws(() => c.customSearch('Signal', { filter: 'track' }), /VERIFY_REQUIRED/);
  assert.equal(signedCalls, 1);
});

for (const method of ['fetchTrackRaw', 'fetchAlbumRaw', 'fetchPlaylistPage']) {
  test(`${method} preserves native verification instead of caching public fallback metadata`, () => {
    const c = runtime();
    let publicCalls = 0;
    c.session = { signedFetch: () => ({ needsVerification: true }) };
    c.getPublicQobuzJSON = () => {
      publicCalls++;
      return { ...track('1'), tracks_count: 1, tracks: { items: [track('1')] } };
    };
    c.ensureAlbumUPC = album => album;
    c.hydrateGenreHierarchy = () => {};
    assert.throws(() => c[method]('1', 10, 0), /VERIFY_REQUIRED/);
    assert.equal(publicCalls, 0);
    assert.equal(c.METADATA_CACHE.size, 0);
  });

  test(`${method} still uses public metadata for ordinary API failures`, () => {
    const c = runtime();
    let publicCalls = 0;
    c.getMetadataJSON = () => { throw new Error('HTTP 503'); };
    c.getPublicQobuzJSON = () => {
      publicCalls++;
      return { ...track('1'), tracks_count: 1, tracks: { items: [track('1')] } };
    };
    c.ensureAlbumUPC = album => album;
    c.hydrateGenreHierarchy = () => {};
    assert.equal(c[method]('1', 10, 0).id, '1');
    assert.equal(publicCalls, 1);
  });
}

test('only a successful grant clears search misses before retrying availability', () => {
  const c = runtime();
  const originalSources = [c.searchTracksViaAPI, c.searchTracksViaAlbumSearch, c.searchTracksViaStore];
  sources(c, () => [], () => [], () => []);
  assert.equal(request(c).available, false);
  sources(c, ...originalSources);
  let granted = false;
  let signedCalls = 0;
  c.session = {
    completeGrant: () => ({ success: granted }),
    signedFetch() {
      signedCalls++;
      return { statusCode: 200, body: JSON.stringify({ tracks: { items: [track('1')] } }) };
    },
  };
  assert.equal(c.completeGrant().success, false);
  assert.equal(request(c).available, false);
  assert.equal(signedCalls, 0);
  granted = true;
  assert.equal(c.completeGrant().success, true);
  assert.equal(request(c).track_id, '1');
  assert.equal(signedCalls, 1);
});

test('download resolution stops at a verification challenge without trying other qualities', () => {
  const c = runtime();
  let calls = 0;
  c.fetchProviderDownloadInfo = () => { calls++; throw new Error('VERIFY_REQUIRED'); };
  assert.throws(() => c.resolveDownloadInfo('1', 'HI_RES_LOSSLESS'), /VERIFY_REQUIRED/);
  assert.equal(calls, 1);
});

test('the native download response can request verification without an error string', () => {
  const c = runtime();
  let calls = 0;
  c.signedTicket = () => 'fixture-ticket';
  c.session = { signedFetch() { calls++; return { needsVerification: true }; } };
  assert.throws(() => c.resolveDownloadInfo('1', 'HI_RES_LOSSLESS'), /VERIFY_REQUIRED/);
  assert.equal(calls, 1);
});

test('a challenge after a preview download retains its verification error type', () => {
  const c = runtime();
  let resolutions = 0;
  c.gobackend = {};
  c.resolveDownloadInfo = () => {
    if (++resolutions === 2) throw new Error('VERIFY_REQUIRED');
    return { directURL: 'https://audio.example.test/preview.flac', candidateKey: 'fixture@27' };
  };
  c.downloadDirectFile = () => ({ success: true, path: '/preview.flac' });
  c.readDownloadedAudioQuality = () => ({ duration: 30 });
  c.deleteQuietly = () => {};
  const result = c.download('1', 'HI_RES_LOSSLESS', '/song.flac', null, {
    preparedContext: { host_track: { name: 'Signal', artists: 'Artist', duration_ms: 180000 } },
  });
  assert.equal(result.success, false);
  assert.equal(result.error_type, 'verification_required');
  assert.equal(resolutions, 2);
});

test('cancellation stops requests before search and between sources', () => {
  const c = runtime();
  let calls = 0;
  let cancelled = true;
  c.utils.isDownloadCancelled = () => cancelled;
  sources(c, () => { calls++; cancelled = true; return []; }, () => { calls++; return []; });
  assert.match(request(c).reason, /cancelled/);
  assert.equal(calls, 0);
  cancelled = false;
  assert.match(request(c).reason, /cancelled/);
  assert.equal(calls, 1);
});

test('album and store hydration do not swallow verification', () => {
  const c = runtime();
  c.fetchAlbumRaw = () => { throw new Error('VERIFY_REQUIRED'); };
  assert.throws(() => c.selectTracksFromAlbumSearch('Signal', [{ id: '1' }], 8), /VERIFY_REQUIRED/);
  c.fetchText = () => '';
  c.extractTrackIDsFromStoreSearchHTML = () => ['1'];
  c.fetchTrackRaw = () => { throw new Error('VERIFY_REQUIRED'); };
  assert.throws(() => c.searchTracksViaStore('Signal', 8), /VERIFY_REQUIRED/);
});

test('ordinary source errors permit the next source and alternate queries', () => {
  const c = runtime();
  sources(c, () => { throw new Error('HTTP 503'); }, () => [track('2')]);
  assert.equal(request(c).track_id, '2');
  c.cleanup();
  sources(c, q => { if (q === 'USAAA0000001') return [track('3')]; throw new Error('HTTP 503'); },
    () => { throw new Error('HTTP 503'); }, () => { throw new Error('HTTP 503'); });
  assert.equal(request(c).track_id, '3');
});

test('title-only alternate keeps artist and duration validation', () => {
  const c = runtime();
  sources(c, q => q === 'Signal' ? [track('1', { isrc: '', performer: { name: 'Someone else' } }),
    track('2', { isrc: '', duration: 230 }), track('3', { isrc: '' })] : []);
  assert.equal(request(c).track_id, '3');
});
