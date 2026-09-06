const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../sources/amazon/index.js'), 'utf8');
const sourceTrack = 'B000000001';
const resolvedTrack = 'B000000002';
const sourceAlbum = 'B000000003';
const resolvedAlbum = 'B000000004';

function runtime() {
  let extension;
  const context = vm.createContext({
    URL, URLSearchParams,
    registerExtension(value) { extension = value; },
    log: { info() {}, debug() {}, warn() {}, error() {} },
    utils: { isDownloadCancelled: () => false, sleep: () => true },
  });
  vm.runInContext(source, context);
  return { context, extension };
}

function metadataResponse(type, id, name) {
  const resource = type === 'MusicAlbum' ? 'albums' : 'tracks';
  const schema = {
    '@type': type, '@id': `https://music.amazon.com/${resource}/${id}`,
    name, byArtist: { name: 'Artist' }, duration: 'PT3M',
  };
  if (type === 'MusicAlbum') schema.numTracks = 1;
  const data = { methods: [
    { innerHTML: JSON.stringify(schema) },
    {
      interface: 'Web.TemplatesInterface.v1_0.Touch.WidgetsInterface.DescriptiveRowItemElement',
      primaryText: 'Signal', secondaryText1: 'Artist', secondaryText3: '03:00',
      primaryTextLink: { deeplink: `/albums/${resolvedAlbum}?trackAsin=${resolvedTrack}` },
    },
  ] };
  return { data, rawText: JSON.stringify(data) };
}

for (const domain of ['com', 'in', 'co.jp', 'co.uk', 'de', 'fr', 'it', 'es', 'com.br', 'com.mx', 'com.au', 'ca']) {
  test(`album URLs from ${domain} request the canonical catalog and return its track IDs`, () => {
    const { context, extension } = runtime();
    const seen = [];
    context.fetch = (url, options) => {
      seen.push({ url, options });
      if (url.endsWith('/config.json')) {
        return { ok: true, status: 200, json: () => ({ deviceId: 'fixture', sessionId: 'fixture' }) };
      }
      const headers = JSON.parse(JSON.parse(options.body).headers);
      assert.equal(headers['x-amzn-music-domain'], 'music.amazon.com');
      assert.equal(headers['x-amzn-currency-of-preference'], 'USD');
      assert.equal(options.headers.Origin, 'https://music.amazon.com');
      const response = metadataResponse('MusicAlbum', resolvedAlbum, 'Original Album');
      return { ok: true, status: 200, text: () => response.rawText };
    };
    const result = extension.handleUrl(`https://music.amazon.${domain}/albums/${sourceAlbum}?ref=share`);
    assert.equal(result.album.id, resolvedAlbum);
    assert.equal(result.tracks[0].id, resolvedTrack);
    assert.equal(result.tracks[0].album_id, resolvedAlbum);
    assert.equal(seen[0].url, 'https://music.amazon.com/config.json');
  });
}

test('regional album track links preserve trackAsin when normalizing the catalog', () => {
  const { context } = runtime();
  const parsed = context.parseAmazonMusicURL(`https://music.amazon.in/albums/${sourceAlbum}?ref=share&trackAsin=${sourceTrack}`);
  assert.equal(parsed.type, 'track');
  assert.equal(parsed.id, sourceTrack);
  assert.equal(parsed.albumId, sourceAlbum);
  assert.equal(parsed.context.musicBaseURL, 'https://music.amazon.com');
});

test('resolved track metadata uses the ASIN from the canonical track URL', () => {
  const { context, extension } = runtime();
  const response = metadataResponse('MusicRecording', resolvedTrack, 'Signal');
  context.callShowHome = () => response;
  const result = extension.getTrack(sourceTrack);
  assert.equal(result.id, resolvedTrack);
  assert.equal(result.external_urls, `https://music.amazon.com/tracks/${resolvedTrack}`);
  assert.equal(result.duration_ms, 180000);
});

test('album and artist URLs are not accepted as resolved track IDs', () => {
  const { context } = runtime();
  for (const resource of ['albums', 'artists']) {
    assert.equal(context.extractResolvedTrackASIN(`https://music.amazon.com/${resource}/${resolvedTrack}`), null);
  }
  assert.equal(context.extractResolvedTrackASIN(`https://music.amazon.com.evil.test/tracks/${resolvedTrack}`), null);
  assert.equal(context.parseAmazonMusicURL(`https://music.amazon.com.evil.test/albums/${sourceAlbum}`), null);
});

test('direct downloads honor canonical IDs in resolved Amazon metadata', () => {
  const { context, extension } = runtime();
  let requestedASIN;
  context.getTrack = () => ({
    id: resolvedTrack, name: 'Signal', artists: 'Artist', provider_id: 'amazon',
    external_urls: `https://music.amazon.com/tracks/${resolvedTrack}`,
  });
  context.callZarzMedia = asin => { requestedASIN = asin; return { streamUrl: 'https://audio.example.test/song.flac' }; };
  context.file = { download: (_url, output) => ({ success: true, path: output }) };
  assert.equal(extension.download(sourceTrack, 'best', '/song.flac').success, true);
  assert.equal(requestedASIN, resolvedTrack);
});
