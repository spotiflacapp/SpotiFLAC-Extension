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

  if (provider === 'qobuz-web') {
    test('qobuz-web: the separate version field participates in recording matching', () => {
      assert.equal(matches('Bhootni Ke', 'Pritam, Daler Mehndi, Bhimal Oberoi', 234, 'Remix'), true);
      assert.equal(matches('Bhootni Ke', 'Pritam, Daler Mehndi & Mayur Puri', 234, 'Tiger Style Mix'), false);
    });
  }
}
