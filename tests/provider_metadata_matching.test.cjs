const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function runtime(provider) {
  const context = vm.createContext({
    registerExtension() {}, log: { info() {}, warn() {}, error() {} },
    utils: { isDownloadCancelled: () => false },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../sources', provider, 'index.js'), 'utf8'), context);
  return context;
}

for (const provider of ['qobuz-web', 'tidal-web']) {
  const c = runtime(provider);
  const matches = (title, artists, duration = 234, version = '') => {
    const candidate = provider === 'qobuz-web'
      ? { id: '1', title, version, performer: { name: artists }, duration }
      : { id: '1', name: title, artists, duration };
    return c[provider === 'qobuz-web' ? 'qobuzTrackMatchesRequest' : 'tidalTrackMatchesRequest'](
      candidate, '', 'Bhootni Ke - Remix', 'Pritam, Daler Mehndi & Mayur Puri', 234000
    );
  };

  test(`${provider}: title parentheses and hyphens already represent the same remix`, () => {
    assert.equal(matches('Bhootni Ke (Remix)', 'Pritam, Daler Mehndi & Mayur Puri'), true);
  });

  test(`${provider}: matching singers survive differing contributor lists`, () => {
    assert.equal(matches('Bhootni Ke (Remix)', 'Pritam, Daler Mehndi, Bhimal Oberoi'), true);
    assert.equal(matches('Bhootni Ke (Remix)', 'Daler Mehndi & Pritam'), true);
  });

  test(`${provider}: artist separators are preserved before punctuation normalization`, () => {
    assert.deepEqual(Array.from(c.splitArtists('Composer,Lead Singer & Guest Writer')), ['composer', 'lead singer', 'guest writer']);
    assert.equal(c.artistNamesMatch('Composer, Lead Singer & Lyric Writer', 'GUEST WRITER; LEAD SINGER'), true);
    assert.equal(c.artistNamesMatch('Pritam, Mika Singh, Mayur Puri & Bimal Oberoi', 'Pritam, Mika Singh, Bhimal Oberoi'), true);
  });

  test(`${provider}: downloaded metadata preserves duration for host validation`, () => {
    const result = c.applyTrackMetadataToDownloadResult({}, { duration_ms: 234000 });
    assert.equal(result.duration_ms, 234000);
  });

  test(`${provider}: metadata tolerance still rejects other artists and durations`, () => {
    assert.equal(matches('Bhootni Ke (Remix)', 'Unrelated Singer'), false);
    assert.equal(matches('Bhootni Ke (Remix)', 'Pritam, Daler Mehndi, Bhimal Oberoi', 305), false);
  });

  test(`${provider}: metadata tolerance does not merge original, remix, and named mixes`, () => {
    const artists = 'Pritam, Daler Mehndi & Mayur Puri';
    assert.equal(matches('Bhootni Ke', artists), false);
    assert.equal(matches('Bhootni Ke (Tiger Style Mix)', artists), false);
    assert.equal(matches('Bhootni Ke (Remix Live)', artists), false);
  });

  test(`${provider}: credit and soundtrack annotations preserve the requested mix`, () => {
    const expected = 'Bas Ek Kinng - Tiger Style Mix';
    assert.equal(c.trackTitlesMatch(expected, 'Bas Ek Kinng (feat. Hard Kaur) [Tiger Style Mix]'), true);
    assert.equal(c.trackTitlesMatch(expected, 'Bas Ek Kinng (Tiger Style Mix) [From "Singh Is Kinng"]'), true);
    assert.equal(c.trackTitlesMatch(expected, 'Bas Ek Kinng (feat. Hard Kaur) [Club Mix]'), false);
    assert.equal(c.trackTitlesMatch(expected, 'Bas Ek Kinng (feat. Hard Kaur)'), false);
    assert.equal(c.trackTitlesMatch('Bas Ek Kinng', 'Another Song (From "Bas Ek Kinng")'), false);
  });

  test(`${provider}: ISRC and recording names resolve conflicting catalog durations`, () => {
    const matching = c[provider === 'qobuz-web' ? 'qobuzTrackMatchesRequest' : 'tidalTrackMatchesRequest'];
    const candidate = (title, isrc, duration) => provider === 'qobuz-web'
      ? { id: '1', title, performer: { name: 'Pritam, Mika Singh' }, isrc, duration }
      : { id: '1', name: title, artists: 'Pritam, Mika Singh', isrc, duration };
    const artist = 'Pritam, Mika Singh, Mayur Puri';
    for (const [title, isrc, sourceDuration, duration] of [
      ['Bas Ek Kinng', 'INT130800412', 280000, 244],
      ['Bas Ek Kinng (Tiger Style Mix)', 'INT130800416', 243000, 280],
    ]) {
      assert.equal(matching(candidate(title, isrc, duration), isrc, title, artist, sourceDuration), true);
      assert.equal(matching(candidate(title, isrc, duration), '', title, artist, sourceDuration), false);
      assert.equal(matching(candidate(title, isrc, duration), 'INT130800499', title, artist, sourceDuration), false);
      assert.equal(matching(candidate(title, isrc, 30), isrc, title, artist, sourceDuration), false);
      assert.equal(matching(candidate(title, isrc, duration), isrc, title + ' (Live)', artist, sourceDuration), false);
      assert.equal(c.validateDownloadedDuration(duration * 1000, 30).valid, false);
      assert.equal(c.validateDownloadedDuration(duration * 1000, duration).valid, true);
    }
  });

  test(`${provider}: exact ISRC candidates outrank earlier name-only matches`, () => {
    const candidate = (id, isrc, duration) => provider === 'qobuz-web'
      ? { id, title: 'Signal', performer: { name: 'Artist' }, isrc, duration }
      : { id, name: 'Signal', artists: 'Artist', isrc, duration };
    const name = candidate('1', '', 280);
    const identified = candidate('2', 'USAAA0000001', 244);
    const timed = candidate('3', 'USAAA0000001', 280);
    assert.equal(c.selectBestSearchTrack([name, identified], 'USAAA0000001', 'Signal', 'Artist', 280000).id, '2');
    assert.equal(c.selectBestSearchTrack([name, identified, timed], 'USAAA0000001', 'Signal', 'Artist', 280000).id, '3');
  });

  if (provider === 'qobuz-web') {
    test('qobuz-web: the separate version field participates in recording matching', () => {
      assert.equal(matches('Bhootni Ke', 'Pritam, Daler Mehndi, Bhimal Oberoi', 234, 'Remix'), true);
      assert.equal(matches('Bhootni Ke', 'Pritam, Daler Mehndi & Mayur Puri', 234, 'Tiger Style Mix'), false);
    });
  }
}
