var CONFIG = {
  apiBaseURL: "https://api.zarz.moe/v2/qbz",
  fallbackApiBaseURL: "",
  appID: "798273057",
  previewApiBaseURL: "https://www.qobuz.com",
  previewAppID: "712109809",
  previewAppSecret: "589be88e4538daea11f509d29e4a23b1",
  widgetAppID: "735532640",
  storeBaseURL: "https://www.qobuz.com/us-en",
  openBaseURL: "https://open.qobuz.com",
  playBaseURL: "https://play.qobuz.com",
  countryCode: "US",
  maxArtistAlbums: 100,
  pageSize: 50,
  metadataCacheTtlMs: 5 * 60 * 1000,
  searchCacheTtlMs: 60 * 1000,
  negativeCacheTtlMs: 30 * 1000,
  metadataCacheMaxEntries: 500,
  maxDownloadAttempts: 5,
  metadataAttempts: 3,
  retryBaseDelayMs: 250,
  retryMaxDelayMs: 4000,
  downloadProviders: [
    { name: "zarz-v2", url: "/dl/qbz" }
  ]
};

var STORE_TRACK_ID_REGEX = /\/v4\/ajax\/popin-add-cart\/track\/([0-9]+)/g;
var LOCALE_SEGMENT_REGEX = /^[a-z]{2}-[a-z]{2}$/i;
var IMAGE_SIZE_REGEX = /_\d+\.jpg$/;
var METADATA_CACHE = new Map();
var METADATA_CACHE_MISS = { notFound: true };

function metadataCacheGet(key) {
  var normalizedKey = String(key || "");
  var entry = METADATA_CACHE.get(normalizedKey);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    METADATA_CACHE.delete(normalizedKey);
    return null;
  }
  METADATA_CACHE.delete(normalizedKey);
  METADATA_CACHE.set(normalizedKey, entry);
  return entry.value;
}

function metadataCacheSet(key, value, ttlMs) {
  var normalizedKey = String(key || "");
  if (!normalizedKey || value === null || value === undefined) return value;
  if (METADATA_CACHE.has(normalizedKey)) METADATA_CACHE.delete(normalizedKey);
  METADATA_CACHE.set(normalizedKey, {
    value: value,
    expiresAt: Date.now() + Number(ttlMs || CONFIG.metadataCacheTtlMs)
  });
  while (METADATA_CACHE.size > CONFIG.metadataCacheMaxEntries) {
    METADATA_CACHE.delete(METADATA_CACHE.keys().next().value);
  }
  return value;
}
var ENGLISH_GENRE_NAMES = {
  "accordeon": "Accordion",
  "acid-jazz": "Acid Jazz",
  "afrique": "Africa",
  "afrobeat": "Afrobeat",
  "allemagne": "Germany",
  "allemand": "German",
  "alternatif-et-inde": "Alternative & Indie",
  "ambiance": "Ambient/New Age",
  "ambiant": "Ambient",
  "amerique-du-nord": "North America",
  "amerique-latine": "Latin America",
  "anglais": "English",
  "musique-de-films": "Soundtracks",
  "anime-jeux-video": "Anime/Video game",
  "anime": "Anime",
  "asie": "Asia",
  "ballets": "Ballets",
  "bandes-originales-de-films": "Film Soundtracks",
  "be-bop": "Bebop",
  "blues": "Blues",
  "bolero": "Bolero",
  "bossa-nova": "Bossa Nova",
  "bresil": "Brazil",
  "cantates-profanes": "Cantatas (secular)",
  "cantates-sacrees": "Cantatas (sacred)",
  "celtique": "Celtic",
  "chanson-francaise": "French Music",
  "chansons-paillardes": "Bawdy songs",
  "chours-sacres": "Choirs (sacred)",
  "classique": "Classical",
  "comedies-musicales": "Musical Theatre",
  "concertos-pour-instruments-a-vent": "Concertos for wind instruments",
  "concertos-pour-piano": "Keyboard Concertos",
  "concertos-pour-trompette": "Concertos for trumpet",
  "concertos-pour-violon": "Violin Concertos",
  "concertos-pour-violoncelle": "Cello Concertos",
  "contes-et-comptines": "Stories and Nursery Rhymes",
  "cool": "Cool Jazz",
  "coree": "Korean music",
  "country": "Country",
  "crooners": "Crooners",
  "dance": "Dance",
  "dancehall": "Dancehall",
  "diction-litterature": "Eclectic/Other",
  "disco": "Disco",
  "dixieland": "Dixieland",
  "documents-historiques": "Historical Documents",
  "downtempo": "Chill-out",
  "drum-bass": "Drum & Bass",
  "dub": "Dub",
  "ecosse": "Scottish",
  "educatif": "Educational",
  "electro": "Electronic",
  "electronique-ou-concrete": "Experimental",
  "enfants": "Children",
  "espagne": "Spain",
  "europe": "Europe",
  "europe-de-l-est": "Eastern Europe",
  "extraits": "Opera Extracts",
  "fado": "Fado",
  "flamenco": "Flamenco",
  "folk": "Folk/Americana",
  "forro": "Forro",
  "francais": "French",
  "free-jazz-avant-garde": "Free Jazz & Avant-Garde",
  "funk": "Funk",
  "funk-brasil": "Brazilian Funk",
  "gipsy": "Gypsy",
  "gospel": "Gospel",
  "grece": "Greece",
  "hard-rock": "Hard Rock",
  "house": "House",
  "humour": "Humour",
  "integrales": "Full Operas",
  "interpretes": "French Artists",
  "irish-celtic": "Irish Celtic",
  "irish-popmusic": "Irish Pop Music",
  "irlande": "Ireland",
  "italie": "Italy",
  "j-pop": "J-Pop",
  "japon": "Japanese music",
  "jazz": "Jazz",
  "jazz-contemporain": "Contemporary Jazz",
  "jazz-crossover": "Crossover",
  "jazz-fusion-jazz-rock": "Jazz Fusion & Jazz Rock",
  "jazz-manouche": "Gypsy Jazz",
  "jazz-traditionnel-new-orleans": "Traditional Jazz & New Orleans",
  "jazz-vocal": "Vocal Jazz",
  "jeux-video": "Video Games",
  "k-pop": "K-Pop",
  "karaoke": "Karaoke",
  "latin-jazz": "Latin Jazz",
  "lieder-allemagne": "Lieder (German)",
  "lieder-autres-territoires": "Art Songs",
  "litterature": "Literature",
  "lounge": "Lounge",
  "maghreb": "Maghreb",
  "melodies-angleterre": "Mélodies (England)",
  "melodies-autres-territoires": "Mélodies",
  "melodies-europe-du-nord": "Mélodies (Northern Europe)",
  "melodies-france": "Mélodies (French)",
  "melodies-lieder": "Art Songs, Melodies & Lieder",
  "messes-passions-requiems": "Masses, Passions, Requiems",
  "metal": "Metal",
  "mpb": "MPB",
  "musique-chorale-pour-chour": "Choral Music (Choirs)",
  "musique-concertante": "Concertos",
  "musique-concrete": "Musique Concrète",
  "musique-coreenne-traditionnelle": "Korean traditional",
  "musique-d-ensemble-musique-sans-chour": "Music by vocal ensembles",
  "musique-de-chambre": "Chamber Music",
  "musique-de-scene": "Theatre Music",
  "musique-electronique": "Electronic",
  "musique-folklorique-suisse": "Swiss Folk Music",
  "musique-indienne": "Indian Music",
  "musique-japonaise-traditionnelle": "Japanese traditional",
  "musique-militaire": "Military Music",
  "musique-minimaliste": "Minimal Music",
  "musique-orchestrale": "Symphonic Music",
  "musique-vocale-profane": "Secular Vocal Music",
  "musique-vocale-profane-et-sacree": "Vocal Music (Secular and Sacred)",
  "musique-vocale-sacree": "Sacred Vocal Music",
  "musiques-de-noel": "Christmas Music",
  "musiques-du-monde": "World",
  "musiques-pour-le-cinema": "Cinema Music",
  "neerlandais": "Dutch",
  "new-age": "New Age",
  "opera": "Opera",
  "operette": "Operettas",
  "oratorios-profanes": "Oratorios (secular)",
  "oratorios-sacrees": "Sacred Oratorios",
  "orient-maghreb": "Oriental Music",
  "ouvertures": "Overtures",
  "pagode": "Pagode",
  "pedagogie": "Educational",
  "piano-solo": "Solo Piano",
  "poemes-symphoniques": "Symphonic Poems",
  "pop": "Pop",
  "pop-inde": "Indie Pop",
  "pop-rock": "Pop/Rock",
  "portugal": "Portugal",
  "punk-new-wave": "Punk / New Wave",
  "quatuors": "Quartets",
  "quintettes": "Quintets",
  "ragtime": "Ragtime",
  "rai": "Raï",
  "rap-hip-hop": "Hip-Hop/Rap",
  "rb": "R&B",
  "recitals-vocaux": "Vocal Recitals",
  "reggae": "Reggae",
  "reggaeton": "Reggaeton",
  "relaxation": "Relaxation",
  "retro": "Retro French Music",
  "rock": "Rock",
  "rock-francais": "French Rock",
  "rock-progressif": "Progressive Rock",
  "rockabilly": "Rockabilly",
  "russie": "Russia",
  "salsa": "Salsa",
  "samba": "Samba",
  "schlager": "Schlager",
  "series-tv": "TV Series",
  "sertanejo": "Sertanejo",
  "ska-rocksteady": "Ska & Rocksteady",
  "sonates-pour-deux-instruments": "Duets",
  "soul": "Soul",
  "soul-funk-rap": "Soul/Funk/R&B",
  "stimmungsmusik": "Stimmungsmusik",
  "symphonies": "Symphonies",
  "tango": "Tango",
  "techno": "Techno",
  "trance": "Trance",
  "trios": "Trios",
  "trip-hop": "Trip Hop",
  "turquie": "Turkey",
  "urban-latino": "Latin Urban",
  "variete-internationale": "International Pop",
  "violon-solo": "Violin Solos",
  "violoncelle-solo": "Cello Solos",
  "volksmusik": "Volksmusik",
  "yiddish-klezmer": "Yiddish & Klezmer",
  "zouk-antilles": "Zouk & Antilles"
};
var ENGLISH_GENRES_LOADED = false;

function md5(input) {
  function add32(a, b) {
    return (a + b) & 0xFFFFFFFF;
  }

  function cmn(q, a, b, x, s, t) {
    a = add32(add32(a, q), add32(x, t));
    return add32((a << s) | (a >>> (32 - s)), b);
  }

  function ff(a, b, c, d, x, s, t) {
    return cmn((b & c) | ((~b) & d), a, b, x, s, t);
  }

  function gg(a, b, c, d, x, s, t) {
    return cmn((b & d) | (c & (~d)), a, b, x, s, t);
  }

  function hh(a, b, c, d, x, s, t) {
    return cmn(b ^ c ^ d, a, b, x, s, t);
  }

  function ii(a, b, c, d, x, s, t) {
    return cmn(c ^ (b | (~d)), a, b, x, s, t);
  }

  function md5cycle(x, k) {
    var a = x[0], b = x[1], c = x[2], d = x[3];

    a = ff(a, b, c, d, k[0], 7, -680876936);
    d = ff(d, a, b, c, k[1], 12, -389564586);
    c = ff(c, d, a, b, k[2], 17, 606105819);
    b = ff(b, c, d, a, k[3], 22, -1044525330);
    a = ff(a, b, c, d, k[4], 7, -176418897);
    d = ff(d, a, b, c, k[5], 12, 1200080426);
    c = ff(c, d, a, b, k[6], 17, -1473231341);
    b = ff(b, c, d, a, k[7], 22, -45705983);
    a = ff(a, b, c, d, k[8], 7, 1770035416);
    d = ff(d, a, b, c, k[9], 12, -1958414417);
    c = ff(c, d, a, b, k[10], 17, -42063);
    b = ff(b, c, d, a, k[11], 22, -1990404162);
    a = ff(a, b, c, d, k[12], 7, 1804603682);
    d = ff(d, a, b, c, k[13], 12, -40341101);
    c = ff(c, d, a, b, k[14], 17, -1502002290);
    b = ff(b, c, d, a, k[15], 22, 1236535329);

    a = gg(a, b, c, d, k[1], 5, -165796510);
    d = gg(d, a, b, c, k[6], 9, -1069501632);
    c = gg(c, d, a, b, k[11], 14, 643717713);
    b = gg(b, c, d, a, k[0], 20, -373897302);
    a = gg(a, b, c, d, k[5], 5, -701558691);
    d = gg(d, a, b, c, k[10], 9, 38016083);
    c = gg(c, d, a, b, k[15], 14, -660478335);
    b = gg(b, c, d, a, k[4], 20, -405537848);
    a = gg(a, b, c, d, k[9], 5, 568446438);
    d = gg(d, a, b, c, k[14], 9, -1019803690);
    c = gg(c, d, a, b, k[3], 14, -187363961);
    b = gg(b, c, d, a, k[8], 20, 1163531501);
    a = gg(a, b, c, d, k[13], 5, -1444681467);
    d = gg(d, a, b, c, k[2], 9, -51403784);
    c = gg(c, d, a, b, k[7], 14, 1735328473);
    b = gg(b, c, d, a, k[12], 20, -1926607734);

    a = hh(a, b, c, d, k[5], 4, -378558);
    d = hh(d, a, b, c, k[8], 11, -2022574463);
    c = hh(c, d, a, b, k[11], 16, 1839030562);
    b = hh(b, c, d, a, k[14], 23, -35309556);
    a = hh(a, b, c, d, k[1], 4, -1530992060);
    d = hh(d, a, b, c, k[4], 11, 1272893353);
    c = hh(c, d, a, b, k[7], 16, -155497632);
    b = hh(b, c, d, a, k[10], 23, -1094730640);
    a = hh(a, b, c, d, k[13], 4, 681279174);
    d = hh(d, a, b, c, k[0], 11, -358537222);
    c = hh(c, d, a, b, k[3], 16, -722521979);
    b = hh(b, c, d, a, k[6], 23, 76029189);
    a = hh(a, b, c, d, k[9], 4, -640364487);
    d = hh(d, a, b, c, k[12], 11, -421815835);
    c = hh(c, d, a, b, k[15], 16, 530742520);
    b = hh(b, c, d, a, k[2], 23, -995338651);

    a = ii(a, b, c, d, k[0], 6, -198630844);
    d = ii(d, a, b, c, k[7], 10, 1126891415);
    c = ii(c, d, a, b, k[14], 15, -1416354905);
    b = ii(b, c, d, a, k[5], 21, -57434055);
    a = ii(a, b, c, d, k[12], 6, 1700485571);
    d = ii(d, a, b, c, k[3], 10, -1894986606);
    c = ii(c, d, a, b, k[10], 15, -1051523);
    b = ii(b, c, d, a, k[1], 21, -2054922799);
    a = ii(a, b, c, d, k[8], 6, 1873313359);
    d = ii(d, a, b, c, k[15], 10, -30611744);
    c = ii(c, d, a, b, k[6], 15, -1560198380);
    b = ii(b, c, d, a, k[13], 21, 1309151649);
    a = ii(a, b, c, d, k[4], 6, -145523070);
    d = ii(d, a, b, c, k[11], 10, -1120210379);
    c = ii(c, d, a, b, k[2], 15, 718787259);
    b = ii(b, c, d, a, k[9], 21, -343485551);

    x[0] = add32(a, x[0]);
    x[1] = add32(b, x[1]);
    x[2] = add32(c, x[2]);
    x[3] = add32(d, x[3]);
  }

  function md5blk(s) {
    var md5blks = [];
    for (var i = 0; i < 64; i += 4) {
      md5blks[i >> 2] = s.charCodeAt(i) +
        (s.charCodeAt(i + 1) << 8) +
        (s.charCodeAt(i + 2) << 16) +
        (s.charCodeAt(i + 3) << 24);
    }
    return md5blks;
  }

  function md51(s) {
    var n = s.length;
    var state = [1732584193, -271733879, -1732584194, 271733878];
    var i;
    for (i = 64; i <= n; i += 64) {
      md5cycle(state, md5blk(s.substring(i - 64, i)));
    }
    s = s.substring(i - 64);
    var tail = [];
    for (i = 0; i < 16; i++) tail[i] = 0;
    for (i = 0; i < s.length; i++) {
      tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
    }
    tail[i >> 2] |= 0x80 << ((i % 4) << 3);
    if (i > 55) {
      md5cycle(state, tail);
      for (i = 0; i < 16; i++) tail[i] = 0;
    }
    tail[14] = n * 8;
    md5cycle(state, tail);
    return state;
  }

  function rhex(n) {
    var s = "";
    var hex = "0123456789abcdef";
    for (var j = 0; j < 4; j++) {
      s += hex.charAt((n >> (j * 8 + 4)) & 0x0F) + hex.charAt((n >> (j * 8)) & 0x0F);
    }
    return s;
  }

  var utf8 = unescape(encodeURIComponent(String(input || "")));
  var state = md51(utf8);
  return rhex(state[0]) + rhex(state[1]) + rhex(state[2]) + rhex(state[3]);
}

function initialize(settings) {
  settings = settings || {};

  // V2 metadata is signed and bound to the manifest baseUrl. Ignore persisted
  // V1 API URL settings so upgrades cannot silently fall back to /v1.

  var appID = String(settings.appId || "").trim();
  if (appID) {
    CONFIG.appID = appID;
  }

  var countryCode = String(settings.countryCode || "").trim().toUpperCase();
  if (countryCode) {
    CONFIG.countryCode = countryCode;
  }

  return true;
}

function cleanup() {
  METADATA_CACHE.clear();
  return true;
}

function normalizeBaseURL(value) {
  var text = String(value || "").trim();
  if (!text) return "";
  if (text.indexOf("http://") === 0) {
    text = "https://" + text.substring("http://".length);
  }
  return text.replace(/\/+$/, "");
}

function firstNonEmpty() {
  for (var i = 0; i < arguments.length; i++) {
    var value = String(arguments[i] || "").trim();
    if (value) return value;
  }
  return "";
}

function mergeObjects(primary, fallback) {
  var result = {};
  var key;
  primary = primary || {};
  fallback = fallback || {};
  for (key in fallback) {
    if (fallback.hasOwnProperty(key)) result[key] = fallback[key];
  }
  for (key in primary) {
    if (!primary.hasOwnProperty(key)) continue;
    var value = primary[key];
    if (value === null || value === undefined || value === "") continue;
    result[key] = value;
  }
  return result;
}

function uniquePush(target, value, seen) {
  var text = String(value || "").trim();
  if (!text) return;
  var key = text.toLowerCase();
  if (seen[key]) return;
  seen[key] = true;
  target.push(text);
}

function appUserAgent() {
  if (utils && typeof utils.appUserAgent === "function") {
    return String(utils.appUserAgent() || "").trim() || "SpotiFLAC-Mobile";
  }
  return "SpotiFLAC-Mobile";
}

function requestUserAgent(url) {
  var text = String(url || "").trim().toLowerCase();
  if (text.indexOf("https://api.zarz.moe") === 0 || text.indexOf("http://api.zarz.moe") === 0) {
    return appUserAgent();
  }
  if (utils && typeof utils.randomUserAgent === "function") {
    return String(utils.randomUserAgent() || "").trim() || appUserAgent();
  }
  return appUserAgent();
}

function requestHeaders(url, extra) {
  var headers = {
    "Accept": "application/json",
    "User-Agent": requestUserAgent(url)
  };
  extra = extra || {};
  for (var key in extra) {
    if (extra.hasOwnProperty(key)) {
      headers[key] = extra[key];
    }
  }
  return headers;
}

function storePageHeaders() {
  // Qobuz rejects browser user agents when the TLS fingerprint is a native
  // HTTP client. Use the matching host-client identity for public store HTML.
  return {
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent": "Go-http-client/1.1"
  };
}

function getHeaderValue(headers, name) {
  if (!headers) return "";
  var lower = String(name || "").toLowerCase();
  for (var key in headers) {
    if (!headers.hasOwnProperty(key)) continue;
    if (String(key).toLowerCase() === lower) {
      return String(headers[key] || "");
    }
  }
  return "";
}

function looksLikeHTML(body) {
  var text = String(body || "").trim();
  if (!text) return false;
  return text.indexOf("<!DOCTYPE html") === 0 || text.indexOf("<html") === 0;
}

function isCloudflareChallenge(body) {
  var text = String(body || "");
  return looksLikeHTML(text) && text.indexOf("Just a moment") >= 0;
}

function parseJSONResponse(response, url) {
  if (!response || response.error) {
    throw new Error(response && response.error ? response.error : "request failed");
  }
  if (response.statusCode !== 200) {
    throw new Error("HTTP " + response.statusCode + " for " + url + summarizeErrorBody(response.body));
  }
  if (isCloudflareChallenge(response.body)) {
    throw new Error("Cloudflare challenge for " + url);
  }
  if (looksLikeHTML(response.body)) {
    throw new Error("Unexpected HTML for " + url);
  }
  return JSON.parse(response.body);
}

function summarizeErrorBody(body) {
  var text = String(body || "").trim();
  if (!text) return "";
  try {
    var parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") {
      text = String(parsed.error || parsed.message || parsed.detail || JSON.stringify(parsed));
    }
  } catch (e) {
    // Keep the raw text.
  }
  text = text.replace(/\s+/g, " ").trim();
  if (text.length > 180) {
    text = text.substring(0, 177) + "...";
  }
  return text ? ": " + text : "";
}

function getJSON(url, headers) {
  return parseJSONResponse(http.get(url, headers || requestHeaders(url)), url);
}

function postJSON(url, body, headers) {
  return parseJSONResponse(
    http.post(url, JSON.stringify(body), requestHeaders(url, headers || {
      "Content-Type": "application/json"
    })),
    url
  );
}

function throwIfVerificationRequired(response) {
  if (response && response.needsVerification) {
    var verificationError = new Error("VERIFY_REQUIRED");
    verificationError.needsVerification = true;
    verificationError.authUrl = response.auth_url || response.open_auth_url || "";
    throw verificationError;
  }
}

function signedJSON(method, path, body, headers) {
  if (typeof session === "undefined" || !session || typeof session.signedFetch !== "function") {
    throw new Error("signed session runtime is not available");
  }
  var response = session.signedFetch(method, path, body || null, headers || {});
  throwIfVerificationRequired(response);
  if (!response || response.error) {
    var error = response && response.error ? response.error : "signed request failed";
    var signedError = new Error(error);
    signedError.retryAfterMs = retryAfterMilliseconds(response);
    signedError.retryMode = response && response.retryMode ? String(response.retryMode) : "";
    signedError.retryable = !!(response && response.retryable);
    signedError.code = response && response.code ? String(response.code) : "";
    throw signedError;
  }
  if (response.statusCode !== 200) {
    var statusError = new Error("HTTP " + response.statusCode + " for " + path + summarizeErrorBody(response.body));
    statusError.retryAfterMs = retryAfterMilliseconds(response);
    statusError.retryMode = response.retryMode ? String(response.retryMode) : "";
    statusError.retryable = !!response.retryable;
    statusError.code = response.code ? String(response.code) : "";
    throw statusError;
  }
  return JSON.parse(response.body || "{}");
}

function retryAfterMilliseconds(response) {
  var raw = getHeaderValue(response && response.headers, "Retry-After").trim();
  if (!raw) {
    var seconds = Number(response && response.retryAfterSeconds || 0);
    return seconds > 0 ? Math.round(seconds * 1000) : 0;
  }
  if (/^\d+(?:\.\d+)?$/.test(raw)) return Math.max(0, Math.round(Number(raw) * 1000));
  var timestamp = Date.parse(raw);
  return isNaN(timestamp) ? 0 : Math.max(0, timestamp - Date.now());
}

function waitBeforeRetry(attempt, retryAfterMs) {
  var exponential = Math.min(
    CONFIG.retryBaseDelayMs * Math.pow(2, Math.max(0, attempt)),
    CONFIG.retryMaxDelayMs
  );
  var delay = Math.max(exponential, Number(retryAfterMs || 0));
  delay += Math.floor(Math.random() * Math.max(25, Math.floor(exponential / 4)));
  if (utils && typeof utils.sleep === "function") return utils.sleep(delay);
  return true;
}

function signedTicket(provider, type, id) {
  var resourceHash = utils.sha256(provider + ":" + (type || "track") + ":" + String(id || "").toLowerCase());
  var payload = signedJSON("POST", "/tickets", {
    capability: "download_ticket",
    provider: provider,
    resource_hash: resourceHash
  });
  var ticketID = String(payload.ticket_id || payload.ticket || "").trim();
  if (!ticketID) {
    throw new Error("signed ticket response missing ticket_id");
  }
  return ticketID;
}

function isVerificationRequiredError(error) {
  var message = String(error && error.message || error || "");
  return message.indexOf("VERIFY_REQUIRED") >= 0 || message.indexOf("verification_required") >= 0;
}

function fetchText(url, headers) {
  var response = http.get(url, headers || requestHeaders(url, {
    "Accept": "text/html,application/xhtml+xml"
  }));
  if (!response || response.error) {
    throw new Error(response && response.error ? response.error : "request failed");
  }
  if (response.statusCode !== 200) {
    throw new Error("HTTP " + response.statusCode + " for " + url);
  }
  return String(response.body || "");
}

function trimPrefix(value, prefix) {
  var raw = String(value || "").trim();
  return raw.indexOf(prefix) === 0 ? raw.substring(prefix.length) : raw;
}

function withPrefix(id) {
  var raw = String(id || "").trim();
  if (!raw) return "";
  return raw.indexOf("qobuz:") === 0 ? raw : "qobuz:" + raw;
}

function stripPrefix(value) {
  return trimPrefix(value, "qobuz:");
}

function parseNumericID(value, resourceType) {
  var raw = String(value || "").trim();
  if (!raw) return "";

  var direct = raw.match(/^\d+$/);
  if (direct) return direct[0];

  var prefixed = raw.match(/^qobuz:(\d+)$/i);
  if (prefixed) return prefixed[1];

  var pattern = new RegExp(resourceType + "\\/(\\d+)", "i");
  var match = raw.match(pattern);
  if (match) return match[1];

  return "";
}

function parseTrackID(value) {
  return parseNumericID(value, "track");
}

function parseAlbumID(value) {
  var raw = String(value || "").trim();
  if (!raw) return "";

  if (/^[A-Za-z0-9]+$/.test(raw) && !/^qobuz:/i.test(raw)) return raw;

  var prefixed = raw.match(/^qobuz:([A-Za-z0-9]+)$/i);
  if (prefixed) return prefixed[1];

  var match = raw.match(/album\/([^/?#]+)/i);
  if (match) return match[1];

  return "";
}

function parseArtistID(value) {
  return parseNumericID(value, "interpreter");
}

function parsePlaylistID(value) {
  return parseNumericID(value, "playlist");
}

function splitPathSegments(path) {
  var rawSegments = String(path || "").split("/");
  var segments = [];
  for (var i = 0; i < rawSegments.length; i++) {
    var segment = String(rawSegments[i] || "").trim();
    if (!segment) continue;
    segments.push(segment);
  }
  if (segments.length && LOCALE_SEGMENT_REGEX.test(segments[0])) {
    return segments.slice(1);
  }
  return segments;
}

function resourceTypeFromSegment(segment) {
  switch (String(segment || "").trim().toLowerCase()) {
    case "album":
      return "album";
    case "interpreter":
    case "artist":
      return "artist";
    case "playlist":
    case "playlists":
      return "playlist";
    case "track":
      return "track";
    default:
      return "";
  }
}

function parseURL(url) {
  var text = String(url || "").trim();
  if (!text) return null;

  var appMatch = text.match(/^qobuzapp:\/\/([^/]+)\/([^?#/]+)/i);
  if (appMatch) {
    var appType = resourceTypeFromSegment(appMatch[1]);
    if (!appType) return null;
    return { type: appType, id: appMatch[2] };
  }

  var prefixed = text.match(/^qobuz:(track|album|artist|playlist):([^?#/]+)$/i);
  if (prefixed) {
    return { type: prefixed[1].toLowerCase(), id: prefixed[2] };
  }

  var urlObj;
  try {
    urlObj = new URL(text.indexOf("://") >= 0 ? text : ("https://" + text));
  } catch (e) {
    return null;
  }

  var host = String(urlObj.host || "").toLowerCase();
  if (
    host !== "qobuz.com" &&
    host !== "www.qobuz.com" &&
    host !== "play.qobuz.com" &&
    host !== "open.qobuz.com"
  ) {
    return null;
  }

  var segments = splitPathSegments(urlObj.pathname || "");
  if (segments.length < 2) return null;

  // Regional storefront URLs can prefix the resource with locale segments,
  // for example /au-en/album/slug/id. Find the first known resource segment
  // instead of assuming it is always at the start of the path.
  var type = "";
  var resourceIndex = -1;
  for (var i = 0; i < segments.length; i++) {
    type = resourceTypeFromSegment(segments[i]);
    if (type) {
      resourceIndex = i;
      break;
    }
  }
  if (!type || resourceIndex >= segments.length - 1) return null;

  var id = String(segments[segments.length - 1] || "").trim();
  if (!id) return null;

  return { type: type, id: id };
}

function normalizeDate(value) {
  var text = String(value || "").trim();
  if (!text) return "";
  if (text.length >= 10) return text.substring(0, 10);
  return text;
}

function upscaleImageURL(url) {
  var text = String(url || "").trim();
  if (!text) return "";
  return text.replace(IMAGE_SIZE_REGEX, "_max.jpg");
}

function removeDiacritics(value) {
  var text = String(value || "");
  try {
    text = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  } catch (e) {
  }
  return text
    .replace(/[đĐ]/g, "dj")
    .replace(/[ßẞ]/g, "ss")
    .replace(/[æÆ]/g, "ae")
    .replace(/[œŒ]/g, "oe");
}

function isLatinScript(value) {
  var text = String(value || "").trim();
  if (!text) return true;
  return !(/[^\u0000-\u024f]/.test(text));
}

function hasAlphaNumericChars(value) {
  return /[a-z0-9]/i.test(String(value || ""));
}

function normalizeLooseTitle(value) {
  return removeDiacritics(String(value || ""))
    .toLowerCase()
    .replace(/[\/\\_\-|.&+]/g, " ")
    .replace(/[^\w\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSymbolOnlyTitle(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[a-z0-9\s!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/gi, "")
    .replace(/[\u0300-\u036f]/g, "");
}

function extractCoreTitle(value) {
  return String(value || "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/\s*\[[^\]]*\]\s*$/, "")
    .replace(/\s+-\s+.*$/, "")
    .trim();
}

function cleanTitle(value) {
  var cleaned = String(value || "");
  var patterns = [
    "remaster", "remastered", "deluxe", "bonus", "single",
    "album version", "radio edit", "original mix", "extended",
    "club mix", "remix", "live", "acoustic", "demo"
  ];
  var changed = true;
  while (changed) {
    changed = false;
    cleaned = cleaned.replace(/\(([^)]*)\)|\[([^\]]*)\]/g, function(match, paren, bracket) {
      var content = String(paren || bracket || "").toLowerCase();
      for (var i = 0; i < patterns.length; i++) {
        if (content.indexOf(patterns[i]) >= 0) {
          changed = true;
          return " ";
        }
      }
      return match;
    });
  }
  return cleaned.replace(/\s+/g, " ").trim();
}

function normalizeSearchText(value) {
  return removeDiacritics(String(value || ""))
    .toLowerCase()
    .replace(/[&]/g, " and ")
    .replace(/[^\w\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitArtists(value) {
  var normalized = normalizeSearchText(value)
    .replace(/\bfeat\b/g, "|")
    .replace(/\bfeaturing\b/g, "|")
    .replace(/\bft\b/g, "|")
    .replace(/\band\b/g, "|")
    .replace(/,/g, "|")
    .replace(/\bx\b/g, "|");
  var parts = normalized.split("|");
  var results = [];
  for (var i = 0; i < parts.length; i++) {
    var part = String(parts[i] || "").trim();
    if (part) {
      results.push(part);
    }
  }
  return results;
}

function sameWordsUnordered(a, b) {
  var wordsA = String(a || "").trim().split(/\s+/).filter(Boolean).sort();
  var wordsB = String(b || "").trim().split(/\s+/).filter(Boolean).sort();
  if (!wordsA.length || wordsA.length !== wordsB.length) return false;
  for (var i = 0; i < wordsA.length; i++) {
    if (wordsA[i] !== wordsB[i]) return false;
  }
  return true;
}

function titlesMatch(expected, found) {
  var rawA = String(expected || "").trim();
  var rawB = String(found || "").trim();
  var a = normalizeSearchText(rawA);
  var b = normalizeSearchText(rawB);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.indexOf(b) >= 0 || b.indexOf(a) >= 0) return true;

  var cleanA = cleanTitle(a);
  var cleanB = cleanTitle(b);
  if (cleanA && cleanB) {
    if (cleanA === cleanB) return true;
    if (cleanA.indexOf(cleanB) >= 0 || cleanB.indexOf(cleanA) >= 0) return true;
  }

  var coreA = extractCoreTitle(a);
  var coreB = extractCoreTitle(b);
  if (coreA && coreB && coreA === coreB) return true;

  var looseA = normalizeLooseTitle(rawA);
  var looseB = normalizeLooseTitle(rawB);
  if (looseA && looseB) {
    if (looseA === looseB) return true;
    if (looseA.indexOf(looseB) >= 0 || looseB.indexOf(looseA) >= 0) return true;
  }

  if ((!hasAlphaNumericChars(rawA) || !hasAlphaNumericChars(rawB)) && rawA && rawB) {
    var symbolsA = normalizeSymbolOnlyTitle(rawA);
    var symbolsB = normalizeSymbolOnlyTitle(rawB);
    if (symbolsA && symbolsB && symbolsA === symbolsB) return true;
    return false;
  }

  if (isLatinScript(rawA) !== isLatinScript(rawB)) return true;
  return false;
}

function artistNamesMatch(expected, found) {
  var a = normalizeSearchText(expected);
  var b = normalizeSearchText(found);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.indexOf(b) >= 0 || b.indexOf(a) >= 0) return true;

  var aParts = splitArtists(expected);
  var bParts = splitArtists(found);
  for (var i = 0; i < aParts.length; i++) {
    for (var j = 0; j < bParts.length; j++) {
      if (!aParts[i] || !bParts[j]) continue;
      if (aParts[i] === bParts[j]) return true;
      if (aParts[i].indexOf(bParts[j]) >= 0 || bParts[j].indexOf(aParts[i]) >= 0) {
        return true;
      }
      if (sameWordsUnordered(aParts[i], bParts[j])) return true;
    }
  }

  if (isLatinScript(expected) !== isLatinScript(found)) return true;
  return false;
}

function trackDurationMs(track) {
  var durationMs = Number(track && track.duration_ms || 0);
  if (durationMs > 0) return durationMs;
  var durationSec = Number(track && track.duration || 0);
  if (durationSec > 0) return durationSec * 1000;
  return 0;
}

function durationMatches(expectedDurationMs, foundDurationMs) {
  var expected = Math.round(Number(expectedDurationMs || 0) / 1000);
  var found = Math.round(Number(foundDurationMs || 0) / 1000);
  if (expected <= 0 || found <= 0) return true;
  return Math.abs(expected - found) <= 10;
}

function qobuzTrackMatchesRequest(track, isrc, trackName, artistName, expectedDurationMs) {
  if (!track) return false;

  var expectedISRC = String(isrc || "").trim().toUpperCase();
  var foundISRC = String(track.isrc || "").trim().toUpperCase();
  var exactISRCMatch = !!expectedISRC && !!foundISRC && expectedISRC === foundISRC;

  if (!exactISRCMatch) {
    // An ISRC-only request must never accept an unrelated search hit.
    if (expectedISRC && !String(trackName || "").trim()) return false;
    if (trackName && !titlesMatch(trackName, track.title || trackDisplayTitle(track))) {
      return false;
    }
    if (artistName && !artistNamesMatch(artistName, trackArtistName(track))) {
      return false;
    }
  }

  if (!durationMatches(expectedDurationMs, trackDurationMs(track))) {
    return false;
  }

  return true;
}

function scoreTrackCandidate(query, track) {
  var queryNorm = normalizeSearchText(query);
  if (!queryNorm || !track) return 0;

  var titleNorm = normalizeSearchText(track.title || "");
  var displayNorm = normalizeSearchText(trackDisplayTitle(track));
  var artistNorm = normalizeSearchText(trackArtistName(track));
  var albumNorm = normalizeSearchText(track.album && track.album.title || "");
  var score = 0;

  if (titlesMatch(query, track.title) || titlesMatch(query, trackDisplayTitle(track))) {
    score += 900;
  }

  if (queryNorm === titleNorm || queryNorm === displayNorm) {
    score += 1200;
  } else if (
    (titleNorm && titleNorm.indexOf(queryNorm) >= 0) ||
    (displayNorm && displayNorm.indexOf(queryNorm) >= 0)
  ) {
    score += 420;
  }

  if (artistNorm && queryNorm.indexOf(artistNorm) >= 0) score += 180;
  if (albumNorm && queryNorm.indexOf(albumNorm) >= 0) score += 100;
  if (String(track.isrc || "").trim()) score += 15;
  if (Number(track.maximum_bit_depth || 0) >= 24) score += 10;
  if (Number(track.maximum_sampling_rate || 0) >= 88.2) score += 10;

  return score;
}

function selectBestSearchTrack(tracks, isrc, trackName, artistName, expectedDurationMs) {
  if (!tracks || !tracks.length) return null;

  var normalizedISRC = String(isrc || "").trim().toUpperCase();
  if (normalizedISRC) {
    for (var i = 0; i < tracks.length; i++) {
      if (tracks[i] && tracks[i].id &&
          String(tracks[i].isrc || "").trim().toUpperCase() === normalizedISRC &&
          qobuzTrackMatchesRequest(tracks[i], normalizedISRC, trackName, artistName, expectedDurationMs)) {
        return tracks[i];
      }
    }
  }

  if (!String(trackName || "").trim()) {
    return null;
  }

  var matches = [];
  for (var j = 0; j < tracks.length; j++) {
    var candidate = tracks[j];
    if (candidate && candidate.id && qobuzTrackMatchesRequest(candidate, isrc, trackName, artistName, expectedDurationMs)) {
      matches.push(candidate);
    }
  }
  if (matches.length) {
    matches.sort(function(a, b) {
      if (Number(a.maximum_bit_depth || 0) !== Number(b.maximum_bit_depth || 0)) {
        return Number(b.maximum_bit_depth || 0) - Number(a.maximum_bit_depth || 0);
      }
      return Number(a.id || 0) - Number(b.id || 0);
    });
    return matches[0];
  }

  return null;
}

function ensureNotCancelled() {
  return !!(utils && typeof utils.isDownloadCancelled === "function" && utils.isDownloadCancelled());
}

function metadataURL(path, params, useFallback) {
  var base = useFallback ? CONFIG.fallbackApiBaseURL : CONFIG.apiBaseURL;
  var query = [];
  params = params || {};

  for (var key in params) {
    if (!params.hasOwnProperty(key)) continue;
    var value = params[key];
    if (value === null || value === undefined || value === "") continue;
    query.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(value)));
  }

  if (!useFallback && CONFIG.appID) {
    query.push("app_id=" + encodeURIComponent(CONFIG.appID));
  }

  return base + "/" + String(path || "").replace(/^\/+/, "") + (query.length ? ("?" + query.join("&")) : "");
}

function publicQobuzURL(path, params) {
  var query = [];
  params = params || {};
  for (var key in params) {
    if (!params.hasOwnProperty(key)) continue;
    var value = params[key];
    if (value === null || value === undefined || value === "") continue;
    query.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(value)));
  }
  return CONFIG.previewApiBaseURL + "/api.json/0.2/" +
    String(path || "").replace(/^\/+/, "") +
    (query.length ? ("?" + query.join("&")) : "");
}

function widgetStore() {
  return String(CONFIG.countryCode || "US").toUpperCase() + "-en";
}

function getPublicQobuzJSON(path, params) {
  var url = publicQobuzURL(path, params);
  return getJSON(url, requestHeaders(url, {
    "X-App-Id": CONFIG.widgetAppID
  }));
}

function qobuzSignedURL(objectName, methodName, params) {
  var requestTS = String(Math.floor((new Date()).getTime() / 1000));
  var keys = [];
  var query = [];
  var raw = String(objectName || "") + String(methodName || "");
  params = params || {};

  for (var key in params) {
    if (!params.hasOwnProperty(key)) continue;
    keys.push(key);
  }
  keys.sort();

  for (var i = 0; i < keys.length; i++) {
    raw += keys[i] + String(params[keys[i]]);
  }
  raw += requestTS + CONFIG.previewAppSecret;

  for (var j = 0; j < keys.length; j++) {
    query.push(encodeURIComponent(keys[j]) + "=" + encodeURIComponent(String(params[keys[j]])));
  }
  query.push("request_ts=" + encodeURIComponent(requestTS));
  query.push("request_sig=" + encodeURIComponent(md5(raw)));

  return CONFIG.previewApiBaseURL + "/api.json/0.2/" + objectName + "/" + methodName + "?" + query.join("&");
}

function qobuzPreviewURL(track) {
  if (!track) return "";

  var trackID = String(track.id || "").trim();
  if (!trackID) return "";

  if (track.previewable === false && track.sampleable === false && track.streamable === false) {
    return "";
  }

  try {
    var url = qobuzSignedURL("track", "getFileUrl", {
      track_id: trackID,
      format_id: "5",
      intent: "stream"
    });
    var payload = getJSON(url, requestHeaders(url, {
      "X-App-Id": CONFIG.previewAppID
    }));
    var preview = String(payload && payload.url || "").trim();
    if (!preview) return "";
    if (payload.sample === false && Number(payload.duration || 0) > 45) return "";
    return preview;
  } catch (e) {
    log.warn("[QobuzWeb] Preview URL unavailable for track " + trackID + ": " + e.message);
    return "";
  }
}

function shouldRetryMetadataError(error) {
  if (!error || isVerificationRequiredError(error)) return false;
  if (error.retryable) return true;
  var message = String(error.message || error).toLowerCase();
  return /http (408|425|429|5\d\d)\b/.test(message) ||
    /timeout|timed out|temporar|network|connection|socket|reset|eof|unavailable/.test(message);
}

function getMetadataJSON(path, params, validator) {
  var primaryURL = metadataURL(path, params, false);
  var relative = primaryURL.replace(/^https:\/\/api\.zarz\.moe\/v2/i, "");
  var attempts = Math.max(1, Number(CONFIG.metadataAttempts || 1));
  var lastError = null;

  for (var attempt = 0; attempt < attempts; attempt++) {
    if (ensureNotCancelled()) throw new Error("download cancelled");
    try {
      var payload = signedJSON("GET", relative, null, {});
      if (typeof validator === "function" && !validator(payload)) {
        var shapeError = new Error("Metadata response missing expected payload for " + path);
        shapeError.retryable = true;
        throw shapeError;
      }
      return payload;
    } catch (e) {
      if (isVerificationRequiredError(e)) throw e;
      lastError = e;
      if (attempt + 1 >= attempts || !shouldRetryMetadataError(e)) throw e;
      waitBeforeRetry(attempt, e.retryAfterMs);
    }
  }

  throw lastError || new Error("Metadata request failed for " + path);
}

function trackDisplayTitle(track) {
  if (!track) return "";
  var title = String(track.title || "").trim();
  var version = String(track.version || "").trim();
  if (!title || !version) return title;
  if (title.toLowerCase().indexOf(version.toLowerCase()) >= 0) return title;
  return title + " (" + version + ")";
}

function albumDisplayTitle(album) {
  if (!album) return "";
  var title = String(album.title || "").trim();
  var version = String(album.version || "").trim();
  if (!title || !version) return title;
  if (title.toLowerCase().indexOf(version.toLowerCase()) >= 0) return title;
  return title + " (" + version + ")";
}

function qobuzAlbumURL(album) {
  if (!album) return "";
  return firstNonEmpty(album.id ? CONFIG.openBaseURL + "/album/" + album.id : "", album.url);
}

function qobuzTrackURL(track) {
  return track && track.id ? CONFIG.openBaseURL + "/track/" + track.id : "";
}

function qobuzArtistURL(artist) {
  return artist && artist.id ? CONFIG.openBaseURL + "/artist/" + artist.id : "";
}

function qobuzPlaylistURL(playlist) {
  return playlist && playlist.id ? CONFIG.openBaseURL + "/playlist/" + playlist.id : "";
}

function releaseDateForAlbum(album) {
  if (!album) return "";
  return normalizeDate(firstNonEmpty(
    album.release_date_download,
    album.release_date_stream,
    album.release_date_original,
    album.release_date_purchase
  ));
}

function creditNamesForRoles(rawCredits, rolePattern) {
  var names = [];
  var seen = {};
  var groups = String(rawCredits || "").split(/\s+-\s+/);
  for (var i = 0; i < groups.length; i++) {
    var parts = String(groups[i] || "").split(/\s*,\s*/);
    if (parts.length < 2) continue;
    var name = String(parts.shift() || "").trim();
    var roles = parts.join(",");
    if (name && rolePattern.test(roles)) uniquePush(names, name, seen);
  }
  return names;
}

function trackComposerNames(track) {
  var names = [];
  var seen = {};
  uniquePush(names, track && track.composer && track.composer.name, seen);
  var parsed = creditNamesForRoles(
    track && track.performers,
    /(composer|writer|lyricist)/i
  );
  for (var i = 0; i < parsed.length; i++) uniquePush(names, parsed[i], seen);
  return names.join(", ");
}

function decodeGenreHTMLLabel(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, function (_, hex) {
      return String.fromCharCode(parseInt(hex, 16));
    })
    .replace(/&#(\d+);/g, function (_, decimal) {
      return String.fromCharCode(parseInt(decimal, 10));
    })
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&(?:apos|#39);/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function cacheEnglishGenreNamesFromHTML(html) {
  var pattern = /<a\s+href=["']\/us-en\/genre\/([^"'/?#]+)\/download-streaming-albums["'][^>]*>([\s\S]*?)<\/a>/gi;
  var count = 0;
  var match;
  while ((match = pattern.exec(String(html || ""))) !== null) {
    var slug = String(match[1] || "").trim().toLowerCase();
    var label = decodeGenreHTMLLabel(match[2]);
    if (!slug || !label) continue;
    if (!ENGLISH_GENRE_NAMES[slug]) count++;
    ENGLISH_GENRE_NAMES[slug] = label;
  }
  return count;
}

function ensureEnglishGenreNames() {
  if (ENGLISH_GENRES_LOADED) return;
  ENGLISH_GENRES_LOADED = true;
  try {
    var html = fetchText(
      CONFIG.storeBaseURL + "/genres/download-streaming-albums",
      storePageHeaders()
    );
    cacheEnglishGenreNamesFromHTML(html);
  } catch (e) {
    log.warn("[QobuzWeb] English genre catalogue unavailable: " + e.message);
  }
}

function englishGenreName(genre) {
  var slug = String(genre && genre.slug || "").trim().toLowerCase();
  if (!slug) return "";
  var knownName = String(ENGLISH_GENRE_NAMES[slug] || "").trim();
  if (knownName) return knownName;
  ensureEnglishGenreNames();
  return String(ENGLISH_GENRE_NAMES[slug] || "").trim();
}

function resolveGenreName(genreID) {
  var id = String(genreID || "").trim();
  if (!id) return "";
  var cacheKey = "genre:" + id;
  var cached = metadataCacheGet(cacheKey);
  if (cached !== null) return cached;
  var genreName = "";
  try {
    var genre = getPublicQobuzJSON("genre/get", { genre_id: id });
    genreName = firstNonEmpty(
      englishGenreName(genre),
      genre && genre.name
    );
  } catch (e) {}
  // Empty names are cached too, preventing repeated unavailable lookups.
  return metadataCacheSet(cacheKey, genreName);
}

function hydrateGenreHierarchy(album) {
  if (!album || !album.genre) return album;
  var names = [];
  var seen = {};
  var path = album.genre.path || [];
  for (var i = 0; i < path.length; i++) {
    uniquePush(names, resolveGenreName(path[i]), seen);
  }
  uniquePush(
    names,
    firstNonEmpty(englishGenreName(album.genre), album.genre.name),
    seen
  );
  album.genre.full_name = names.join("; ");
  return album;
}

function genreDisplayName(album) {
  return String(album && album.genre && (album.genre.full_name || album.genre.name) || "").trim();
}

function joinArtistNames(artists, fallback) {
  var names = [];
  var seen = {};
  artists = artists || [];
  for (var i = 0; i < artists.length; i++) {
    uniquePush(names, artists[i] && artists[i].name, seen);
  }
  if (names.length) return names.join(", ");
  return String(fallback || "").trim();
}

function trackArtistName(track) {
  if (!track) return "";
  var names = [];
  var seen = {};

  // Qobuz exposes only the primary performer in `performer`. Additional
  // credited artists live in the role-based `performers` string.
  uniquePush(names, track.performer && track.performer.name, seen);

  var artists = track.artists || [];
  for (var i = 0; i < artists.length; i++) {
    uniquePush(names, artists[i] && artists[i].name, seen);
  }

  var credited = creditNamesForRoles(
    track.performers,
    /(?:main|featured)[\s_-]*artist/i
  );
  for (var j = 0; j < credited.length; j++) {
    uniquePush(names, credited[j], seen);
  }

  if (!names.length) {
    uniquePush(names, track.album && track.album.artist && track.album.artist.name, seen);
  }
  return names.join(", ");
}

function trackAlbumArtist(track) {
  if (!track || !track.album) return "";
  return joinArtistNames(track.album.artists || [], track.album.artist && track.album.artist.name);
}

function albumTypeFromRelease(releaseType, productType, totalTracks) {
  var kind = String(releaseType || productType || "").trim().toLowerCase();
  switch (kind) {
    case "album":
    case "single":
    case "ep":
    case "compilation":
      return kind;
  }
  if (Number(totalTracks || 0) > 0 && Number(totalTracks || 0) <= 3) {
    return "single";
  }
  return "album";
}

function trackAlbumImage(track) {
  if (!track || !track.album) return "";
  return upscaleImageURL(firstNonEmpty(
    track.album.image && track.album.image.large,
    track.album.image && track.album.image.small,
    track.album.image && track.album.image.thumbnail
  ));
}

function albumImage(album) {
  if (!album) return "";
  return upscaleImageURL(firstNonEmpty(
    album.image && album.image.large,
    album.image && album.image.small,
    album.image && album.image.thumbnail
  ));
}

function artistImage(artist) {
  if (!artist) return "";
  return firstNonEmpty(
    artist.image && artist.image.large,
    artist.image && artist.image.small,
    artist.image && artist.image.thumbnail
  );
}

function computeTotalDiscs(tracks) {
  var maxDisc = 0;
  tracks = tracks || [];
  for (var i = 0; i < tracks.length; i++) {
    var disc = Number(tracks[i] && tracks[i].media_number || 0);
    if (disc > maxDisc) maxDisc = disc;
  }
  return maxDisc;
}

function qobuzAudioQualityLabel(track) {
  var bitDepth = Number(track.maximum_bit_depth || 0);
  var sampleRate = Number(track.maximum_sampling_rate || 0);
  if (bitDepth <= 0 || sampleRate <= 0) return "";
  var rateDisplay = sampleRate % 1 === 0 ? String(sampleRate) : sampleRate.toFixed(1);
  return bitDepth + "bit/" + rateDisplay + "kHz";
}

function formatTrack(track, totalDiscsOverride, options) {
  if (!track) return null;
  options = options || {};

  var album = track.album || {};
  var totalTracks = Number(album.tracks_count || 0);
  var totalDiscs = Number(totalDiscsOverride || 0);
  if (!totalDiscs) totalDiscs = Number(album.media_count || album.total_discs || 0);
  var albumURL = qobuzAlbumURL(album);
  var trackURL = qobuzTrackURL(track);
  var artist = track.performer || album.artist || {};

  var formatted = {
    id: withPrefix(track.id),
    name: trackDisplayTitle(track),
    artists: trackArtistName(track),
    artist_id: withPrefix(artist.id || ""),
    artist_url: qobuzArtistURL(artist),
    album_name: albumDisplayTitle(album),
    album_artist: trackAlbumArtist(track),
    album_id: withPrefix(album.id || ""),
    album_url: albumURL,
    duration_ms: Number(track.duration || 0) * 1000,
    cover_url: trackAlbumImage(track),
    images: trackAlbumImage(track),
    release_date: releaseDateForAlbum(album),
    track_number: Number(track.track_number || 0),
    total_tracks: totalTracks,
    disc_number: Number(track.media_number || 0),
    total_discs: totalDiscs,
    isrc: String(track.isrc || "").trim(),
    upc: String(album.upc || "").trim(),
    provider_id: "qobuz-web",
    item_type: "track",
    album_type: albumTypeFromRelease(
      album.release_type,
      album.product_type,
      totalTracks
    ),
    explicit: track.parental_warning === true,
    qobuz_id: String(track.id || "").trim(),
    external_urls: trackURL,
    external_links: {
      qobuz: trackURL,
      qobuz_track: trackURL,
      qobuz_album: albumURL,
      qobuz_store_album: String(album.url || "").trim()
    },
    label: String(album.label && album.label.name || "").trim(),
    genre: genreDisplayName(album),
    copyright: firstNonEmpty(track.copyright, album.copyright),
    composer: trackComposerNames(track),
    comment: albumURL,
    audio_quality: qobuzAudioQualityLabel(track)
  };

  if (options.includePreview) {
    var previewURL = qobuzPreviewURL(track);
    if (previewURL) formatted.preview_url = previewURL;
  }

  return formatted;
}

function formatAlbum(album) {
  if (!album) return null;

  var totalDiscs = Number(album.media_count || 0) || computeTotalDiscs(album.tracks && album.tracks.items || []);
  var tracks = [];
  var items = album.tracks && album.tracks.items || [];
  for (var i = 0; i < items.length; i++) {
    var item = items[i] || {};
    item.album = mergeObjects(item.album, {
      id: album.id,
      qobuz_id: album.qobuz_id,
      title: album.title,
      version: album.version,
      url: album.url,
      upc: album.upc,
      release_date_original: album.release_date_original,
      release_date_download: album.release_date_download,
      release_date_stream: album.release_date_stream,
      release_date_purchase: album.release_date_purchase,
      tracks_count: album.tracks_count,
      media_count: totalDiscs,
      product_type: album.product_type,
      release_type: album.release_type,
      artist: album.artist,
      artists: album.artists,
      image: album.image,
      label: album.label,
      genre: album.genre,
      copyright: album.copyright,
      parental_warning: album.parental_warning
    });
    var formattedTrack = formatTrack(item, totalDiscs);
    if (formattedTrack) {
      tracks.push(formattedTrack);
    }
  }

  return {
    id: withPrefix(album.id),
    name: albumDisplayTitle(album),
    artists: joinArtistNames(album.artists || [], album.artist && album.artist.name),
    artist_id: withPrefix(album.artist && album.artist.id || ""),
    artist_url: qobuzArtistURL(album.artist),
    cover_url: albumImage(album),
    images: albumImage(album),
    release_date: releaseDateForAlbum(album),
    total_tracks: Number(album.tracks_count || 0),
    total_discs: totalDiscs,
    album_type: albumTypeFromRelease(album.release_type, album.product_type, album.tracks_count),
    album_url: qobuzAlbumURL(album),
    external_urls: qobuzAlbumURL(album),
    upc: String(album.upc || "").trim(),
    label: String(album.label && album.label.name || "").trim(),
    genre: genreDisplayName(album),
    copyright: String(album.copyright || "").trim(),
    comment: qobuzAlbumURL(album),
    explicit: album.parental_warning === true,
    tracks: tracks,
    provider_id: "qobuz-web",
    item_type: "album"
  };
}

function qobuzCollectionItems(collection) {
  if (!collection) return [];
  if (Array.isArray(collection)) return collection;
  return Array.isArray(collection.items) ? collection.items : [];
}

function artistTopTrackItems(artist) {
  if (!artist) return [];
  var candidates = [artist.top_tracks, artist.topTracks, artist.tracks];
  for (var i = 0; i < candidates.length; i++) {
    var items = qobuzCollectionItems(candidates[i]);
    if (items.length) return items;
  }
  return [];
}

function formatArtistAlbum(album) {
  if (!album) return null;
  return {
    id: withPrefix(album.id),
    name: albumDisplayTitle(album),
    artists: joinArtistNames(album.artists || [], album.artist && album.artist.name),
    cover_url: albumImage(album),
    images: albumImage(album),
    release_date: releaseDateForAlbum(album),
    total_tracks: Number(album.tracks_count || 0),
    album_url: qobuzAlbumURL(album),
    external_urls: qobuzAlbumURL(album),
    upc: String(album.upc || "").trim(),
    album_type: albumTypeFromRelease(album.release_type, album.product_type, album.tracks_count),
    tracks: [],
    provider_id: "qobuz-web",
    item_type: "album"
  };
}

function formatArtist(artist, albums) {
  albums = albums || [];
  var formattedAlbums = [];
  for (var i = 0; i < albums.length; i++) {
    var formattedAlbum = formatArtistAlbum(albums[i]);
    if (formattedAlbum) formattedAlbums.push(formattedAlbum);
  }

  var rawTopTracks = artistTopTrackItems(artist);
  var formattedTopTracks = [];
  for (var j = 0; j < rawTopTracks.length; j++) {
    var formattedTrack = formatTrack(rawTopTracks[j]);
    if (formattedTrack) formattedTopTracks.push(formattedTrack);
  }

  return {
    id: withPrefix(artist && artist.id || ""),
    name: String(artist && artist.name || "").trim(),
    image_url: artistImage(artist),
    header_image: artistImage(artist),
    cover_url: artistImage(artist),
    images: artistImage(artist),
    artist_url: qobuzArtistURL(artist),
    external_urls: qobuzArtistURL(artist),
    albums: formattedAlbums,
    releases: formattedAlbums,
    top_tracks: formattedTopTracks,
    provider_id: "qobuz-web",
    item_type: "artist"
  };
}

function playlistImage(playlist) {
  return firstNonEmpty(
    playlist && playlist.images300 && playlist.images300[0],
    playlist && playlist.images150 && playlist.images150[0],
    playlist && playlist.images && playlist.images[0],
    playlist && playlist.image_rectangle && playlist.image_rectangle[0],
    playlist && playlist.image_rectangle_mini && playlist.image_rectangle_mini[0]
  );
}

function formatPlaylist(rawPlaylist) {
  if (!rawPlaylist) return null;
  var tracks = [];
  var items = rawPlaylist.tracks && rawPlaylist.tracks.items || [];
  for (var i = 0; i < items.length; i++) {
    var formattedTrack = formatTrack(items[i]);
    if (formattedTrack) tracks.push(formattedTrack);
  }

  return {
    id: withPrefix(rawPlaylist.id),
    name: String(rawPlaylist.name || "").trim(),
    artists: String(rawPlaylist.owner && rawPlaylist.owner.name || "").trim(),
    description: String(rawPlaylist.description || "").trim(),
    cover_url: playlistImage(rawPlaylist),
    images: playlistImage(rawPlaylist),
    total_tracks: Number(rawPlaylist.tracks_count || items.length || 0),
    external_urls: qobuzPlaylistURL(rawPlaylist),
    tracks: tracks,
    provider_id: "qobuz-web",
    item_type: "playlist"
  };
}

// The nested album object on track/get frequently omits album-level fields
// like UPC. The public widget album payload carries it, so one lightweight
// lookup fills the barcode for tagging when it is missing.
function ensureAlbumUPC(album) {
  if (!album || String(album.upc || "").trim()) return album;
  var albumID = parseAlbumID(album.id);
  if (!albumID) return album;
  try {
    var details = getPublicQobuzJSON("widget/getAlbumById", {
      album_id: albumID,
      widget_store: widgetStore()
    });
    if (details && String(details.upc || "").trim()) {
      album.upc = String(details.upc).trim();
    }
  } catch (e) {
    log.debug("[QobuzWeb] Album UPC lookup unavailable: " + e.message);
  }
  return album;
}

function fetchTrackRaw(trackID) {
  var normalizedID = parseTrackID(trackID);
  if (!normalizedID) {
    throw new Error("Invalid Qobuz track ID");
  }
  var cacheKey = "track:" + normalizedID;
  var cached = metadataCacheGet(cacheKey);
  if (cached) return cached;
  var signedError = null;
  try {
    var primary = getMetadataJSON("track/get", {
      track_id: normalizedID
    });
    if (primary && primary.id) {
      ensureAlbumUPC(primary.album);
      hydrateGenreHierarchy(primary.album);
      return metadataCacheSet(cacheKey, primary);
    }
  } catch (e) {
    if (isVerificationRequiredError(e)) throw e;
    signedError = e;
    log.warn("[QobuzWeb] Signed track metadata unavailable, using public fallback: " + e.message);
  }
  try {
    var fallback = getPublicQobuzJSON("widget/getTrackById", {
      track_id: normalizedID,
      widget_store: widgetStore()
    });
    ensureAlbumUPC(fallback && fallback.album);
    hydrateGenreHierarchy(fallback && fallback.album);
    return metadataCacheSet(cacheKey, fallback);
  } catch (publicError) {
    throw signedError || publicError;
  }
}

function mergeAlbumPayloads(primary, fallback) {
  if (!primary) return fallback;
  if (!fallback) return primary;
  var merged = mergeObjects(primary, fallback);
  var primaryItems = primary.tracks && primary.tracks.items || [];
  var fallbackItems = fallback.tracks && fallback.tracks.items || [];
  var baseItems = fallbackItems.length > primaryItems.length ? fallbackItems : primaryItems;
  var primaryByID = {};
  for (var i = 0; i < primaryItems.length; i++) {
    primaryByID[String(primaryItems[i] && primaryItems[i].id || "")] = primaryItems[i];
  }
  var items = [];
  for (var j = 0; j < baseItems.length; j++) {
    var baseItem = baseItems[j] || {};
    items.push(mergeObjects(primaryByID[String(baseItem.id || "")], baseItem));
  }
  merged.tracks = mergeObjects(primary.tracks, fallback.tracks);
  merged.tracks.items = items;
  merged.tracks.total = Number(merged.tracks_count || merged.tracks.total || items.length);
  return merged;
}

function albumTrackItems(album) {
  return album && album.tracks && Array.isArray(album.tracks.items) ? album.tracks.items : [];
}

function albumTracksComplete(album) {
  var items = albumTrackItems(album);
  if (!album || !album.id || !items.length) return false;
  var expected = Number(album.tracks_count || album.tracks && album.tracks.total || 0);
  return expected <= 0 || items.length >= expected;
}

function completePublicAlbumTracks(album) {
  var items = albumTrackItems(album);
  if (!album || albumTracksComplete(album)) return album;
  album.tracks = album.tracks || {};
  album.tracks.items = items;
  try {
    var pageURL = firstNonEmpty(album.url, qobuzAlbumURL(album));
    var html = fetchText(pageURL, storePageHeaders());
    var ids = extractTrackIDsFromStoreSearchHTML(html);
    var seen = {};
    for (var i = 0; i < items.length; i++) seen[String(items[i] && items[i].id || "")] = true;
    for (var j = 0; j < ids.length; j++) {
      if (seen[ids[j]]) continue;
      var track = getPublicQobuzJSON("widget/getTrackById", {
        track_id: ids[j],
        widget_store: widgetStore()
      });
      if (track && track.id) {
        items.push(track);
        seen[String(track.id)] = true;
      }
    }
    items.sort(function(a, b) {
      var discDifference = Number(a && a.media_number || 0) - Number(b && b.media_number || 0);
      return discDifference || (Number(a && a.track_number || 0) - Number(b && b.track_number || 0));
    });
    album.tracks.items = items;
  } catch (e) {
    log.warn("[QobuzWeb] Could not complete public album track list: " + e.message);
  }
  return album;
}

function fetchAlbumRaw(albumID) {
  var normalizedID = parseAlbumID(albumID);
  if (!normalizedID) {
    throw new Error("Invalid Qobuz album ID");
  }
  var cacheKey = "album:" + normalizedID;
  var cached = metadataCacheGet(cacheKey);
  if (cached) return cached;
  var signed = null;
  var signedError = null;
  try {
    signed = getMetadataJSON("album/get", { album_id: normalizedID });
  } catch (e) {
    if (isVerificationRequiredError(e)) throw e;
    signedError = e;
  }

  if (albumTracksComplete(signed)) {
    hydrateGenreHierarchy(signed);
    return metadataCacheSet(cacheKey, signed);
  }

  var direct = null;
  var directError = null;
  try {
    direct = getPublicQobuzJSON("widget/getAlbumById", {
      album_id: normalizedID,
      widget_store: widgetStore()
    });
  } catch (e) {
    directError = e;
  }

  if (signedError && direct) {
    log.warn("[QobuzWeb] Signed album metadata unavailable, completing public payload: " + signedError.message);
  }
  var merged = mergeAlbumPayloads(signed, direct);
  if (!merged) throw signedError || directError || new Error("Qobuz album metadata unavailable");
  if (!albumTracksComplete(merged)) {
    completePublicAlbumTracks(merged);
  }
  if (!albumTrackItems(merged).length) {
    throw signedError || directError || new Error("Qobuz album track metadata unavailable");
  }
  hydrateGenreHierarchy(merged);
  if (albumTracksComplete(merged)) {
    return metadataCacheSet(cacheKey, merged);
  }
  // A partial payload is useful for the current view but must not poison the
  // five-minute album cache; a later retry may recover the remaining tracks.
  return merged;
}

function fetchPlaylistPage(playlistID, limit, offset) {
  var normalizedID = parsePlaylistID(playlistID);
  if (!normalizedID) {
    throw new Error("Invalid Qobuz playlist ID");
  }

  try {
    return getMetadataJSON("playlist/get", {
      playlist_id: normalizedID,
      extra: "tracks",
      limit: limit,
      offset: offset
    });
  } catch (primaryError) {
    if (isVerificationRequiredError(primaryError)) throw primaryError;
    log.warn("[QobuzWeb] Signed playlist metadata unavailable, using public fallback: " + primaryError.message);
    return getPublicQobuzJSON("playlist/get", {
      playlist_id: normalizedID,
      extra: "tracks,track_ids",
      limit: limit,
      offset: offset
    });
  }
}

function fetchArtistAlbums(artistID) {
  var normalizedID = parseArtistID(artistID);
  if (!normalizedID) {
    throw new Error("Invalid Qobuz artist ID");
  }
  var payload = getMetadataJSON("artist/get", {
    artist_id: normalizedID,
    extra: "albums",
    limit: CONFIG.maxArtistAlbums,
    offset: 0
  });
  var albums = qobuzCollectionItems(payload && payload.albums);
  try {
    var artistPage = getMetadataJSON("artist/page", {
      artist_id: normalizedID
    });
    var topTracks = artistTopTrackItems(artistPage);
    if (topTracks.length) {
      payload.top_tracks = topTracks;
    }
  } catch (e) {
    // Popular tracks are optional. A failure here must not hide the artist's
    // valid profile and album catalogue.
    log.warn("[QobuzWeb] Artist popular tracks unavailable: " + e.message);
  }
  return {
    artist: payload,
    albums: albums
  };
}

function fetchPlaylistRaw(playlistID) {
  var offset = 0;
  var combined = null;

  while (true) {
    if (ensureNotCancelled()) {
      throw new Error("download cancelled");
    }

    var page = fetchPlaylistPage(playlistID, CONFIG.pageSize, offset);
    var pageTracks = page.tracks || {};
    var pageItems = pageTracks.items || [];

    if (!combined) {
      combined = page;
      // Reassign with a fresh tracks object so emptying the accumulator does
      // not also clear the just-fetched page's items (same reference).
      combined.tracks = {
        total: Number(pageTracks.total || 0),
        offset: 0,
        limit: CONFIG.pageSize,
        items: []
      };
    }

    for (var i = 0; i < pageItems.length; i++) {
      combined.tracks.items.push(pageItems[i]);
    }

    var total = Number(pageTracks.total || page.tracks_count || 0);
    if (!pageItems.length || offset + pageItems.length >= total || pageItems.length < CONFIG.pageSize) {
      break;
    }
    offset += pageItems.length;
  }

  return combined;
}

function getTrack(trackID) {
  return formatTrack(fetchTrackRaw(trackID));
}

function getAlbum(albumID) {
  return formatAlbum(fetchAlbumRaw(albumID));
}

function getArtist(artistID) {
  var payload = fetchArtistAlbums(artistID);
  return formatArtist(payload.artist, payload.albums);
}

function getPlaylist(playlistID) {
  return formatPlaylist(fetchPlaylistRaw(playlistID));
}

function extractTrackIDsFromStoreSearchHTML(html) {
  var ids = [];
  var seen = {};
  var match;
  STORE_TRACK_ID_REGEX.lastIndex = 0;
  while ((match = STORE_TRACK_ID_REGEX.exec(html)) !== null) {
    uniquePush(ids, match[1], seen);
  }
  return ids;
}

function metadataCollectionItems(payload, key) {
  var collection = payload && payload[key];
  if (Array.isArray(collection)) return collection;
  if (collection && Array.isArray(collection.items)) return collection.items;
  return null;
}

function searchCollectionViaAPI(resource, query, limit) {
  var key = resource + "s";
  var params = {
    query: String(query || "").trim(),
    limit: limit,
    offset: 0
  };
  var signedItems = null;
  var signedError = null;

  try {
    var signedPayload = getMetadataJSON(resource + "/search", params, function(payload) {
      return metadataCollectionItems(payload, key) !== null;
    });
    signedItems = metadataCollectionItems(signedPayload, key);
    if (signedItems && signedItems.length) return signedItems;
  } catch (e) {
    if (isVerificationRequiredError(e)) throw e;
    signedError = e;
  }

  try {
    var publicPayload = getPublicQobuzJSON(resource + "/search", params);
    var publicItems = metadataCollectionItems(publicPayload, key);
    if (publicItems && publicItems.length) {
      if (signedError) {
        log.warn("[QobuzWeb] Signed " + resource + " search unavailable, using public fallback: " + signedError.message);
      }
      return publicItems;
    }
  } catch (publicError) {
    if (signedError) throw signedError;
    if (signedItems === null) throw publicError;
  }

  if (signedError) throw signedError;
  return signedItems || [];
}

function searchTracksViaAPI(query, limit) {
  return searchCollectionViaAPI("track", query, limit);
}

function searchArtistsViaAPI(query, limit) {
  return searchCollectionViaAPI("artist", query, limit);
}

function searchAlbumsViaAPI(query, limit) {
  return searchCollectionViaAPI("album", query, limit);
}

function selectTracksFromAlbumSearch(query, summaries, limit) {
  var candidates = [];
  var seen = {};

  for (var i = 0; i < summaries.length; i++) {
    var albumID = String(summaries[i] && summaries[i].id || "").trim();
    if (!albumID) continue;

    var album;
    try {
      album = fetchAlbumRaw(albumID);
    } catch (e) {
      if (isVerificationRequiredError(e) || ensureNotCancelled()) throw e;
      continue;
    }

    var items = album.tracks && album.tracks.items || [];
    for (var j = 0; j < items.length; j++) {
      var track = items[j];
      track.album = track.album || {};
      track.album.id = album.id;
      track.album.qobuz_id = album.qobuz_id;
      track.album.title = album.title;
      track.album.version = album.version;
      track.album.url = album.url;
      track.album.upc = album.upc;
      track.album.release_date_original = album.release_date_original;
      track.album.release_date_download = album.release_date_download;
      track.album.release_date_stream = album.release_date_stream;
      track.album.release_date_purchase = album.release_date_purchase;
      track.album.tracks_count = album.tracks_count;
      track.album.media_count = album.media_count;
      track.album.product_type = album.product_type;
      track.album.release_type = album.release_type;
      track.album.artist = album.artist;
      track.album.artists = album.artists;
      track.album.image = album.image;
      track.album.label = album.label;
      track.album.genre = album.genre;
      track.album.copyright = album.copyright;

      var key = String(track.id || "").trim();
      if (key && seen[key]) continue;
      seen[key] = true;

      var score = scoreTrackCandidate(query, track);
      if (score <= 0) continue;
      candidates.push({
        score: score,
        track: track
      });
    }
  }

  candidates.sort(function(a, b) {
    if (a.score !== b.score) return b.score - a.score;
    if (Number(a.track.maximum_bit_depth || 0) !== Number(b.track.maximum_bit_depth || 0)) {
      return Number(b.track.maximum_bit_depth || 0) - Number(a.track.maximum_bit_depth || 0);
    }
    return Number(a.track.id || 0) - Number(b.track.id || 0);
  });

  var results = [];
  for (var k = 0; k < candidates.length; k++) {
    results.push(candidates[k].track);
    if (limit > 0 && results.length >= limit) break;
  }
  return results;
}

function searchTracksViaAlbumSearch(query, limit) {
  var albumLimit = limit;
  if (albumLimit < 3) albumLimit = 3;
  if (albumLimit > 8) albumLimit = 8;

  var summaries = searchAlbumsViaAPI(query, albumLimit);
  return selectTracksFromAlbumSearch(query, summaries, limit);
}

function searchTracksViaStore(query, limit) {
  var searchURL = CONFIG.storeBaseURL + "/search/tracks/" + encodeURIComponent(String(query || "").trim());
  var html = fetchText(searchURL, storePageHeaders());
  var trackIDs = extractTrackIDsFromStoreSearchHTML(html);
  if (limit > 0 && trackIDs.length > limit) {
    trackIDs = trackIDs.slice(0, limit);
  }

  var tracks = [];
  for (var i = 0; i < trackIDs.length; i++) {
    try {
      tracks.push(fetchTrackRaw(trackIDs[i]));
    } catch (e) {
      if (isVerificationRequiredError(e) || ensureNotCancelled()) throw e;
      log.warn("[QobuzWeb] Store hydration failed for track " + trackIDs[i] + ": " + e.message);
    }
  }
  return tracks;
}

// Search caches contain raw results, never request-specific match decisions.
function searchTracksWithFallback(query, limit, selectMatch) {
  var cacheKey = "search-track:" + String(query || "").trim().toLowerCase().replace(/\s+/g, " ") + ":" + Number(limit || 0);
  var sources = [searchTracksViaAPI, searchTracksViaAlbumSearch, searchTracksViaStore];
  var lastError = null;
  for (var i = 0; i < sources.length; i++) {
    if (ensureNotCancelled()) throw new Error("download cancelled");
    var sourceKey = cacheKey + ":source:" + i;
    try {
      var tracks = metadataCacheGet(sourceKey);
      if (tracks === METADATA_CACHE_MISS) continue;
      if (!tracks) {
        tracks = sources[i](query, limit) || [];
        if (ensureNotCancelled()) throw new Error("download cancelled");
        metadataCacheSet(sourceKey, tracks.length ? tracks : METADATA_CACHE_MISS,
          tracks.length ? CONFIG.searchCacheTtlMs : CONFIG.negativeCacheTtlMs);
      }
      if (tracks.length && (!selectMatch || selectMatch(tracks))) return tracks;
    } catch (e) {
      if (isVerificationRequiredError(e) || ensureNotCancelled() ||
          String(e && e.message || e).toLowerCase().indexOf("cancelled") >= 0) throw e;
      lastError = e;
    }
  }
  if (lastError) throw lastError;
  return [];
}

function findVerifiedSearchTrack(isrc, trackName, artistName, expectedDurationMs) {
  var queries = [];
  var seen = {};
  uniquePush(queries, (String(trackName || "") + " " + String(artistName || "")).trim(), seen);
  uniquePush(queries, String(isrc || "").trim(), seen);
  // A title-only query helps when the provider tokenizes artist credits differently.
  // Keep the original title (including version labels) and all match safeguards.
  uniquePush(queries, String(trackName || "").trim(), seen);
  var best = null;
  for (var i = 0; i < queries.length; i++) {
    if (ensureNotCancelled()) throw new Error("download cancelled");
    try {
      searchTracksWithFallback(queries[i], 8, function(tracks) {
        best = selectBestSearchTrack(tracks, isrc, trackName, artistName, expectedDurationMs);
        return best !== null;
      });
      if (best) return best;
    } catch (e) {
      if (isVerificationRequiredError(e) || ensureNotCancelled() ||
          String(e && e.message || e).toLowerCase().indexOf("cancelled") >= 0) throw e;
      log.warn("[QobuzWeb] Search query failed: " + (e && e.message || e));
    }
  }
  return null;
}

function searchOne(query, filter, limit) {
  var cleanQuery = String(query || "").trim();
  var normalizedFilter = String(filter || "").trim().toLowerCase();
  if (!cleanQuery) return [];

  if (!limit || limit <= 0) {
    limit = normalizedFilter === "track" ? 20 : 10;
  }

  if (normalizedFilter === "track") {
    var rawTracks = searchTracksWithFallback(cleanQuery, limit);
    var trackResults = [];
    for (var i = 0; i < rawTracks.length; i++) {
      var formattedTrack = formatTrack(rawTracks[i], null, {
        includePreview: true
      });
      if (formattedTrack) trackResults.push(formattedTrack);
    }
    return trackResults;
  }

  if (normalizedFilter === "artist") {
    var artists = searchArtistsViaAPI(cleanQuery, limit);
    var artistResults = [];
    for (var j = 0; j < artists.length; j++) {
      artistResults.push({
        id: withPrefix(artists[j].id),
        name: String(artists[j].name || "").trim(),
        image_url: artistImage(artists[j]),
        header_image: artistImage(artists[j]),
        cover_url: artistImage(artists[j]),
        images: artistImage(artists[j]),
        provider_id: "qobuz-web",
        item_type: "artist"
      });
    }
    return artistResults;
  }

  if (normalizedFilter === "album") {
    var albums = searchAlbumsViaAPI(cleanQuery, limit);
    var albumResults = [];
    for (var k = 0; k < albums.length; k++) {
      albumResults.push({
        id: withPrefix(albums[k].id),
        name: albumDisplayTitle(albums[k]),
        artists: joinArtistNames(albums[k].artists || [], albums[k].artist && albums[k].artist.name),
        artist_id: withPrefix(albums[k].artist && albums[k].artist.id || ""),
        cover_url: albumImage(albums[k]),
        images: albumImage(albums[k]),
        release_date: releaseDateForAlbum(albums[k]),
        total_tracks: Number(albums[k].tracks_count || 0),
        total_discs: Number(albums[k].media_count || 0),
        album_url: qobuzAlbumURL(albums[k]),
        external_urls: qobuzAlbumURL(albums[k]),
        explicit: albums[k].parental_warning === true,
        album_type: albumTypeFromRelease(albums[k].release_type, albums[k].product_type, albums[k].tracks_count),
        tracks: [],
        provider_id: "qobuz-web",
        item_type: "album"
      });
    }
    return albumResults;
  }

  return [];
}

function searchOneBestEffort(query, filter, limit) {
  try {
    return searchOne(query, filter, limit);
  } catch (e) {
    if (isVerificationRequiredError(e)) throw e;
    log.warn("[QobuzWeb] " + filter + " search unavailable: " + e.message);
    return [];
  }
}

function customSearch(query, options) {
  options = options || {};
  var filter = String(options.filter || "").trim().toLowerCase();
  var limit = Number(options.limit || 20);
  if (!limit || limit <= 0) limit = 20;
  if (limit > 50) limit = 50;
  if (!filter || filter === "all") {
    filter = "";
  }

  // A filtered search should surface a real provider failure so the app can
  // offer Retry instead of presenting a false "no results" state.
  if (filter) {
    return searchOne(query, filter, limit);
  }

  // Keep successful legs when another resource endpoint is temporarily down.
  var results = [];
  results = results.concat(searchOneBestEffort(query, "track", limit || 20));
  results = results.concat(searchOneBestEffort(query, "artist", 5));
  results = results.concat(searchOneBestEffort(query, "album", 5));
  return results;
}

function searchTracks(query, limit) {
  return searchOne(query, "track", limit || 20);
}

function enrichTrack(track) {
  track = track || {};
  try {
    var id = parseTrackID(firstNonEmpty(track.qobuz_id, track.id));
    if (!id) {
      var best = findVerifiedSearchTrack(
        track.isrc, track.name, track.artists, Number(track.duration_ms || 0)
      );
      id = best && parseTrackID(best.id);
    }
    if (!id) return track;
    return formatTrack(fetchTrackRaw(id)) || track;
  } catch (e) {
    if (isVerificationRequiredError(e)) throw e;
    log.warn("[QobuzWeb] enrichTrack failed: " + e.message);
    return track;
  }
}

function applyTrackMetadataToDownloadResult(result, track) {
  result = result || {};
  track = track || {};
  result.title = track.name || "";
  result.artist = track.artists || "";
  result.duration_ms = Number(track.duration_ms || 0);
  result.album = track.album_name || "";
  result.album_artist = track.album_artist || "";
  result.track_number = Number(track.track_number || 0);
  result.total_tracks = Number(track.total_tracks || 0);
  result.disc_number = Number(track.disc_number || 0);
  result.total_discs = Number(track.total_discs || 0);
  result.release_date = track.release_date || "";
  result.cover_url = track.cover_url || "";
  result.isrc = track.isrc || "";
  result.upc = track.upc || "";
  result.label = track.label || "";
  result.genre = track.genre || "";
  result.composer = track.composer || "";
  result.copyright = track.copyright || "";
  result.comment = track.comment || track.album_url || "";
  return result;
}

function parentDirectory(path) {
  var text = String(path || "").trim();
  if (!text) return "";
  var normalized = text.replace(/\\/g, "/");
  var idx = normalized.lastIndexOf("/");
  if (idx <= 0) return "";
  return normalized.substring(0, idx);
}

function ensureOutputExtension(outputPath, extension) {
  var text = String(outputPath || "").trim();
  var ext = String(extension || "").trim();
  if (!text || !ext) return text;
  if (ext.charAt(0) !== ".") ext = "." + ext;

  var dot = text.lastIndexOf(".");
  if (dot < 0) return text + ext;
  if (text.substring(dot).toLowerCase() === ext.toLowerCase()) return text;
  return text.substring(0, dot) + ext;
}

function deleteQuietly(path) {
  var text = String(path || "").trim();
  if (!text || !file || typeof file.delete !== "function") return;
  try {
    file.delete(text);
  } catch (e) {}
}

function progressPercent(onProgress, percent) {
  if (typeof onProgress !== "function") return;
  var value = Number(percent || 0);
  if (value < 0) value = 0;
  if (value > 100) value = 100;
  onProgress(Math.round(value));
}

function mapMusicDLQuality(qualityCode) {
  switch (String(qualityCode || "").trim()) {
    case "27":
      return "hi-res-max";
    case "7":
      return "hi-res";
    default:
      return "cd";
  }
}

function normalizeQualityCode(quality) {
  switch (String(quality || "").trim().toUpperCase()) {
    case "HI_RES":
      return "7";
    case "HI_RES_LOSSLESS":
    case "DEFAULT":
    case "":
      return "27";
    case "LOSSLESS":
    default:
      return "6";
  }
}

function qualityFallbackChain(quality) {
  var code = normalizeQualityCode(quality);
  if (code === "27") return ["27", "7", "6"];
  if (code === "7") return ["7", "6"];
  return ["6"];
}

function parseDownloadInfo(payload) {
  payload = payload || {};

  if (payload.error && String(payload.error).trim()) {
    throw new Error(String(payload.error).trim());
  }
  if (payload.detail && String(payload.detail).trim()) {
    throw new Error(String(payload.detail).trim());
  }
  if (payload.success === false) {
    throw new Error(String(payload.message || "provider returned success=false"));
  }

  var nested = payload.data || {};
  var url = firstNonEmpty(payload.download_url, payload.url, payload.link, nested.download_url, nested.url, nested.link);
  if (!url) {
    throw new Error("No download URL in provider response");
  }

  var bitDepth = Number(
    payload.bit_depth || nested.bit_depth || 0
  );
  var sampleRate = Number(
    payload.sampling_rate || nested.sampling_rate || 0
  );
  if (sampleRate > 0 && sampleRate < 1000) {
    sampleRate = Math.round(sampleRate * 1000);
  }

  return {
    directURL: String(url).trim(),
    bitDepth: bitDepth,
    sampleRate: sampleRate
  };
}

function providerRequestURL(provider, trackID, qualityCode) {
  return String(provider.url || "");
}

function fetchProviderDownloadInfo(provider, trackID, qualityCode) {
  var attempts = CONFIG.maxDownloadAttempts;
  var lastError = null;
  var trackURL = CONFIG.openBaseURL + "/track/" + String(trackID || "").trim();
  var ticketID = "";
  for (var attempt = 0; attempt < attempts; attempt++) {
    if (ensureNotCancelled()) {
      throw new Error("download cancelled");
    }

    try {
      // The ticket resource_hash must match what the server hashes at consume
      // time. The download body below sends `url`, and the server's /v2/dl/qbz
      // handler derives the hash from `body.url || body.id || body.asin` (so it
      // uses the URL). Minting with the bare trackID produced a different hash
      // and every download failed with "Ticket resource mismatch" (403).
      if (!ticketID) ticketID = signedTicket("qbz", "track", trackURL);
      var response = session.signedFetch("POST", providerRequestURL(provider, trackID, qualityCode), {
        quality: mapMusicDLQuality(qualityCode),
        upload_to_r2: false,
        id: String(trackID || "").trim(),
        type: "track",
        url: trackURL
      }, {
        "X-Zarz-Ticket": ticketID
      });
      throwIfVerificationRequired(response);

      if (!response || response.error) {
        var responseError = new Error(response && response.error ? response.error : "request failed");
        responseError.retryAfterMs = retryAfterMilliseconds(response);
        responseError.retryMode = response && response.retryMode ? String(response.retryMode) : "";
        responseError.retryable = !!(response && response.retryable);
        responseError.code = response && response.code ? String(response.code) : "";
        throw responseError;
      }

      if (response.statusCode === 429 || response.statusCode >= 500) {
        var retryableStatusError = new Error("HTTP " + response.statusCode + summarizeErrorBody(response.body));
        retryableStatusError.retryAfterMs = retryAfterMilliseconds(response);
        retryableStatusError.retryMode = response.retryMode ? String(response.retryMode) : "";
        retryableStatusError.retryable = !!response.retryable;
        retryableStatusError.code = response.code ? String(response.code) : "";
        throw retryableStatusError;
      }

      if (response.statusCode !== 200) {
        throw new Error("HTTP " + response.statusCode + summarizeErrorBody(response.body));
      }

      var contentType = getHeaderValue(response.headers, "Content-Type").toLowerCase();
      if (contentType.indexOf("application/json") < 0) {
        throw new Error("Qobuz download API returned non-JSON response");
      }

      if (isCloudflareChallenge(response.body)) {
        throw new Error("Cloudflare challenge");
      }

      var payload = JSON.parse(response.body);
      var info = parseDownloadInfo(payload);
      info.provider = provider.name;
      info.qualityCode = qualityCode;
      info.candidateKey = provider.name + "@" + qualityCode;
      return info;
    } catch (e) {
      if (isVerificationRequiredError(e)) throw e;
      lastError = e;
      var message = String(e && e.message ? e.message : e).toLowerCase();
      var retryMode = String(e && e.retryMode || "");
      var retryable = !!(e && e.retryable) ||
        message.indexOf("timeout") >= 0 ||
        message.indexOf("http 429") >= 0 ||
        message.indexOf("http 5") >= 0 ||
        message.indexOf("connection") >= 0 ||
        message.indexOf("cloudflare") >= 0;
      if (retryMode === "same_operation" || retryMode === "none" ||
          (retryMode && retryMode !== "new_ticket" && retryMode !== "poll_existing")) {
        retryable = false;
      }
      if (e && e.code && !e.retryable) retryable = false;
      if (!retryable || attempt === attempts - 1) {
        break;
      }
      // poll_existing keeps the ticket that owns the provider operation.
      // Every other retry must mint a fresh one-use ticket.
      if (retryMode !== "poll_existing") ticketID = "";
      if (!waitBeforeRetry(attempt, Number(e && e.retryAfterMs || 0))) {
        throw new Error("download cancelled");
      }
    }
  }

  throw lastError || new Error("provider request failed");
}

function resolveDownloadInfo(trackID, requestedQuality, rejectedCandidates) {
  var qualities = qualityFallbackChain(requestedQuality);
  var errors = [];
  rejectedCandidates = rejectedCandidates || {};

  for (var i = 0; i < qualities.length; i++) {
    for (var j = 0; j < CONFIG.downloadProviders.length; j++) {
      var candidateKey = CONFIG.downloadProviders[j].name + "@" + qualities[i];
      if (rejectedCandidates[candidateKey]) {
        errors.push(candidateKey + ": skipped after preview-length download");
        continue;
      }
      try {
        var info = fetchProviderDownloadInfo(CONFIG.downloadProviders[j], trackID, qualities[i]);
        var urlKey = "url:" + String(info.directURL || "").trim();
        if (rejectedCandidates[urlKey]) {
          errors.push(candidateKey + ": skipped duplicate preview URL");
          continue;
        }
        return info;
      } catch (e) {
        if (isVerificationRequiredError(e)) throw e;
        var message = e && e.message ? e.message : String(e);
        errors.push(candidateKey + ": " + message);
      }
    }
  }

  throw new Error("All Qobuz download providers failed: " + errors.join("; "));
}

function downloadDirectFile(downloadURL, outputPath, onProgress, progressStart, progressSpan) {
  return file.download(downloadURL, outputPath, {
    headers: {
      "User-Agent": requestUserAgent(downloadURL)
    },
    onProgress: function(written, total) {
      if (!total || total <= 0) return;
      var ratio = written / total;
      if (ratio < 0) ratio = 0;
      if (ratio > 1) ratio = 1;
      progressPercent(onProgress, progressStart + Math.round(ratio * progressSpan));
    }
  });
}

function readDownloadedAudioQuality(path) {
  if (!gobackend || typeof gobackend.getAudioQuality !== "function") {
    return null;
  }
  var qualityInfo = gobackend.getAudioQuality(path);
  if (!qualityInfo || qualityInfo.error) {
    return null;
  }
  return qualityInfo;
}

function audioDurationSeconds(qualityInfo) {
  var duration = Number(qualityInfo && qualityInfo.duration || 0);
  if (duration > 0) return Math.round(duration);

  var sampleRate = Number(qualityInfo && qualityInfo.sampleRate || 0);
  var totalSamples = Number(qualityInfo && qualityInfo.totalSamples || 0);
  if (sampleRate > 0 && totalSamples > 0) {
    return Math.round(totalSamples / sampleRate);
  }
  return 0;
}

function validateDownloadedDuration(expectedDurationMs, actualDurationSec) {
  var expectedSec = Math.round(Number(expectedDurationMs || 0) / 1000);
  var actualSec = Math.round(Number(actualDurationSec || 0));
  if (expectedSec <= 0 || actualSec <= 0) {
    return { valid: true, preview: false, message: "" };
  }

  var diff = Math.abs(expectedSec - actualSec);
  if (diff <= 10) {
    return { valid: true, preview: false, message: "" };
  }

  var preview = actualSec <= 35 && expectedSec > 45;
  return {
    valid: false,
    preview: preview,
    message: "Downloaded audio duration mismatch: expected " + expectedSec + "s, got " + actualSec + "s"
  };
}

function tryFetchLyricsLRC(track) {
  if (!gobackend || typeof gobackend.getLyricsLRC !== "function" || !track) {
    return "";
  }

  var payload = gobackend.getLyricsLRC(
    String(track.spotify_id || ""),
    String(track.name || ""),
    String(track.artists || ""),
    "",
    Number(track.duration_ms || 0)
  );
  if (!payload || payload.error) {
    return "";
  }
  return String(payload.lyrics || "");
}

function checkAvailability(isrc, trackName, artistName, options) {
  try {
    options = options || {};
    var expectedDurationMs = Number(options.duration_ms || 0);
    var directTrackId = parseTrackID(options.qobuz_id || "");
    if (directTrackId) {
      try {
        var directTrack = fetchTrackRaw(directTrackId);
        if (qobuzTrackMatchesRequest(directTrack, isrc, trackName, artistName, expectedDurationMs)) {
          return {
            available: true,
            track_id: String(directTrack.id || "").trim(),
            prepared_context: { raw_track: directTrack }
          };
        }
      } catch (directError) {
        if (isVerificationRequiredError(directError) || ensureNotCancelled()) throw directError;
        log.warn("[QobuzWeb] Direct Qobuz ID verification failed: " + directError.message);
      }
    }

    var query = ((trackName || "") + " " + (artistName || "")).trim();
    if (!query && isrc) {
      query = String(isrc || "").trim();
    }
    if (!query) {
      return {
        available: false,
        reason: "No Qobuz search query available"
      };
    }

    var best = findVerifiedSearchTrack(isrc, trackName, artistName, expectedDurationMs);
    if (!best || !best.id) {
      return {
        available: false,
        reason: "No verified Qobuz track match found"
      };
    }

    return {
      available: true,
      track_id: String(best.id || "").trim(),
      prepared_context: { raw_track: best }
    };
  } catch (e) {
    if (isVerificationRequiredError(e)) throw e;
    return {
      available: false,
      reason: e && e.message ? e.message : String(e)
    };
  }
}

function download(trackID, quality, outputPath, onProgress, options) {
  try {
    var prepared = options && options.preparedContext || {};
    var rawTrack = prepared.raw_track || null;
    var formattedTrack = null;
    if (rawTrack && String(rawTrack.id || "").trim() === String(parseTrackID(trackID) || "").trim()) {
      formattedTrack = formatTrack(rawTrack);
    } else if (prepared.host_track && prepared.host_track.name) {
      formattedTrack = prepared.host_track;
    } else {
      rawTrack = fetchTrackRaw(trackID);
      formattedTrack = formatTrack(rawTrack);
    }
    if (!formattedTrack) {
      return {
        success: false,
        error_message: "Track metadata was not available from Qobuz",
        error_type: "api_error"
      };
    }

    var outputDir = parentDirectory(outputPath);
    if (formattedTrack.isrc && outputDir && gobackend && typeof gobackend.checkISRCExists === "function") {
      var existing = gobackend.checkISRCExists(outputDir, formattedTrack.isrc);
      if (existing && existing.exists && existing.filePath) {
        return applyTrackMetadataToDownloadResult({
          success: true,
          already_exists: true,
          file_path: String(existing.filePath || "")
        }, formattedTrack);
      }
    }

    progressPercent(onProgress, 5);

    var actualOutputPath = ensureOutputExtension(outputPath, ".flac");

    var downloadInfo = null;
    var finalPath = actualOutputPath;
    var qualityInfo = null;
    var validation = { valid: true, preview: false, message: "" };

    var rejectedDownloadCandidates = {};
    var maxDownloadAttempts = qualityFallbackChain(quality).length * Math.max(CONFIG.downloadProviders.length, 1);
    var previewMessages = [];

    for (var attempt = 0; attempt < maxDownloadAttempts; attempt++) {
      try {
        downloadInfo = resolveDownloadInfo(trackID, quality, rejectedDownloadCandidates);
      } catch (resolveError) {
        if (isVerificationRequiredError(resolveError)) throw resolveError;
        if (previewMessages.length) {
          return {
            success: false,
            error_message: "All Qobuz candidates returned preview-length audio: " +
              previewMessages.join("; ") + "; " +
              (resolveError && resolveError.message ? resolveError.message : String(resolveError)),
            error_type: "duration_mismatch"
          };
        }
        throw resolveError;
      }
      progressPercent(onProgress, 10);

      var downloadResult = downloadDirectFile(downloadInfo.directURL, actualOutputPath, onProgress, 10, 82);
      if (!downloadResult || !downloadResult.success) {
        deleteQuietly(actualOutputPath);
        return {
          success: false,
          error_message: "Failed to download Qobuz stream: " + (downloadResult && downloadResult.error ? downloadResult.error : "unknown error"),
          error_type: "download_error"
        };
      }

      finalPath = downloadResult.path || actualOutputPath;
      qualityInfo = readDownloadedAudioQuality(finalPath);
      validation = validateDownloadedDuration(
        formattedTrack.duration_ms,
        audioDurationSeconds(qualityInfo)
      );
      if (validation.valid) {
        break;
      }
      deleteQuietly(finalPath);
      if (!validation.preview) {
        return {
          success: false,
          error_message: validation.message,
          error_type: "duration_mismatch"
        };
      }
      previewMessages.push(
        String(downloadInfo.provider || "provider") + "@" +
          String(downloadInfo.qualityCode || "") + ": " + validation.message
      );
      rejectedDownloadCandidates[String(downloadInfo.candidateKey || "")] = true;
      rejectedDownloadCandidates["url:" + String(downloadInfo.directURL || "").trim()] = true;
      log.warn(
        "[QobuzWeb] Preview-length download detected, trying next Qobuz candidate: " +
          validation.message
      );
      validation = {
        valid: false,
        preview: true,
        message: "All Qobuz candidates returned preview-length audio: " + previewMessages.join("; ")
      };
    }

    if (!validation.valid) {
      return {
        success: false,
        error_message: validation.message,
        error_type: "duration_mismatch"
      };
    }

    // preparedContext may intentionally contain only the normalized host track.
    // In that path rawTrack is null, so quality fallback must remain optional
    // after the audio file has already been downloaded successfully.
    var rawQuality = rawTrack || {};
    var bitDepth = Number(downloadInfo.bitDepth || rawQuality.maximum_bit_depth || 0);
    var sampleRate = Number(downloadInfo.sampleRate || 0);
    if (!sampleRate) {
      var rawRate = Number(rawQuality.maximum_sampling_rate || 0);
      if (rawRate > 0) {
        sampleRate = rawRate < 1000 ? Math.round(rawRate * 1000) : Math.round(rawRate);
      }
    }

    if (qualityInfo) {
      if (Number(qualityInfo.bitDepth || 0) > 0) {
        bitDepth = Number(qualityInfo.bitDepth);
      }
      if (Number(qualityInfo.sampleRate || 0) > 0) {
        sampleRate = Number(qualityInfo.sampleRate);
      }
    }

    var lyricsLRC = tryFetchLyricsLRC(formattedTrack);
    progressPercent(onProgress, 100);

    return applyTrackMetadataToDownloadResult({
      success: true,
      file_path: finalPath,
      bit_depth: bitDepth,
      sample_rate: sampleRate,
      lyrics_lrc: lyricsLRC
    }, formattedTrack);
  } catch (e) {
    var errorMessage = e && e.message ? e.message : String(e);
    return {
      success: false,
      error_message: errorMessage,
      error_type: isVerificationRequiredError(e) ? "verification_required" : "runtime_error"
    };
  }
}

function handleUrl(url) {
  try {
    var parsed = parseURL(url);
    if (!parsed) {
      return {
        success: false,
        error: "Unsupported Qobuz URL"
      };
    }

    if (parsed.type === "track") {
      return {
        type: "track",
        track: getTrack(parsed.id)
      };
    }

    if (parsed.type === "album") {
      var album = getAlbum(parsed.id);
      return {
        type: "album",
        name: album ? album.name : "",
        cover_url: album ? album.cover_url : "",
        album: album,
        tracks: album ? album.tracks : []
      };
    }

    if (parsed.type === "artist") {
      return {
        type: "artist",
        artist: getArtist(parsed.id)
      };
    }

    if (parsed.type === "playlist") {
      var playlist = getPlaylist(parsed.id);
      return {
        type: "playlist",
        id: playlist ? playlist.id : withPrefix(parsed.id),
        name: playlist ? playlist.name : "",
        cover_url: playlist ? playlist.cover_url : "",
        playlist: playlist,
        tracks: playlist ? playlist.tracks : []
      };
    }

    return {
      success: false,
      error: "Unsupported Qobuz URL type"
    };
  } catch (e) {
    log.error("[QobuzWeb] handleUrl failed:", e.message);
    return {
      success: false,
      error: e.message || "Failed to fetch Qobuz URL metadata"
    };
  }
}

function completeGrant() {
  if (typeof session === "undefined" || !session || typeof session.completeGrant !== "function") {
    return { success: false, error: "signed session runtime is not available" };
  }
  var result = session.completeGrant();
  if (result && result.success) {
    METADATA_CACHE.clear();
  }
  return result;
}

registerExtension({
  initialize: initialize,
  cleanup: cleanup,
  completeGrant: completeGrant,
  customSearch: customSearch,
  checkAvailability: checkAvailability,
  download: download,
  handleUrl: handleUrl,
  getTrack: getTrack,
  getAlbum: getAlbum,
  getArtist: getArtist,
  getPlaylist: getPlaylist,
  enrichTrack: enrichTrack,
  searchTracks: searchTracks
});

log.info("[QobuzWeb] Qobuz extension loaded");
