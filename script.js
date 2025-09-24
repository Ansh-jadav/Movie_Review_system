/**
 * Critic's Cut — Vanilla JS app (Netlify-secure version)
 * Data sources:
 *  - OMDb (via Netlify function)
 *  - TMDb (via Netlify function)
 * Storage: localStorage per imdbID
 */

// DOM refs
const el = id => document.getElementById(id);
const resultsEl = el('results');
const resultsEmptyEl = el('resultsEmpty');

const qEl = el('q');
const searchBtn = el('search');
const clearBtn = el('clearAll');

const detailSection = el('detailSection');
const detailPoster = el('detailPoster');
const detailTitle = el('detailTitle');
const detailMeta = el('detailMeta');
const detailPlot = el('detailPlot');
const detailGenre = el('detailGenre');
const detailRuntime = el('detailRuntime');
const detailRated = el('detailRated');

const posBar = el('posBar');
const posLabel = el('posLabel');

const videoTabs = el('videoTabs');
const videosEl = el('videos');

const reviewForm = el('reviewForm');
const reviewText = el('reviewText');
const thumbUp = el('thumbUp');
const thumbDown = el('thumbDown');
const reviewsEl = el('reviews');
const randomSection = el('randomSection');

const randomSuggestionsEl = el('randomSuggestions');
const randomEmptyEl = el('randomEmpty');

const GENRES = ["Action", "Comedy", "Drama", "Sci-Fi", "Horror", "Thriller", "Romance", "Adventure"];

// State
let currentMovie = null; // { imdbID, Title, ... }
let thumbChoice = null;  // 'up' | 'down'

// Utilities
const h = (tag, attrs = {}, children = []) => {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') n.className = v; else if (k === 'html') n.innerHTML = v; else n.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children])
    .filter(Boolean)
    .forEach(c => n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return n;
};
const fmt = (s) => (s && s !== 'N/A') ? s : '—';
const safePoster = (url) => (url && url !== 'N/A') ? url : 'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="100%" height="100%" fill="#0c0f16"/><text x="50%" y="50%" fill="#93a3b8" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="20">No Poster</text></svg>`);
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

// Local Storage helpers
const LS_PREFIX = 'criticscut_reviews_';
const getReviews = (imdbID) => JSON.parse(localStorage.getItem(LS_PREFIX + imdbID) || '[]');
const setReviews = (imdbID, arr) => localStorage.setItem(LS_PREFIX + imdbID, JSON.stringify(arr));
const clearAll = () => Object.keys(localStorage).filter(k => k.startsWith(LS_PREFIX)).forEach(k => localStorage.removeItem(k));

clearBtn.addEventListener('click', () => {
  if (confirm('Clear all saved reviews on this device?')) {
    clearAll();
    if (currentMovie) {
      renderReviews(currentMovie.imdbID);
      updateSentimentBar(currentMovie.imdbID);
    }
  }
});

// --- API helpers (via Netlify functions) ---
async function searchMovies(q) {
  const res = await fetch(`/.netlify/functions/omdb?s=${encodeURIComponent(q)}`);
  const data = await res.json();
  if (data.Response === 'True' && Array.isArray(data.Search)) return data.Search;
  return [];
}

async function getMovieById(imdbID) {
  const res = await fetch(`/.netlify/functions/omdb?i=${imdbID}&plot=full`);
  return await res.json();
}

async function tmdbFindByIMDb(imdbID) {
  const res = await fetch(`/.netlify/functions/tmdb?path=find/${imdbID}&external_source=imdb_id`);
  if (!res.ok) return null;
  const data = await res.json();
  return (data.movie_results && data.movie_results[0]) || null;
}

async function tmdbVideos(tmdbId) {
  const res = await fetch(`/.netlify/functions/tmdb?path=movie/${tmdbId}/videos`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.results) ? data.results : [];
}

// --- Rendering ---
function renderResults(list) {
  resultsEl.innerHTML = '';
  if (!list.length) { resultsEmptyEl.style.display = 'block'; return; }
  resultsEmptyEl.style.display = 'none';
  list.forEach(m => {
    const card = h('div', { class: 'card', tabindex: 0, role: 'button' });
    card.addEventListener('click', () => openDetail(m.imdbID));
    card.append(
      h('img', { class: 'poster', src: safePoster(m.Poster), alt: m.Title }),
      h('div', { class: 'card-body' }, [
        h('div', { class: 'title' }, m.Title),
        h('div', { class: 'meta' }, `${fmt(m.Year)} • ${fmt(m.Type).toUpperCase?.() || fmt(m.Type)}`)
      ])
    );
    resultsEl.appendChild(card);
  });
}

async function openDetail(imdbID) {
  const movie = await getMovieById(imdbID);
  currentMovie = movie;
  detailSection.style.display = 'block';

  detailPoster.src = safePoster(movie.Poster);
  detailTitle.textContent = `${movie.Title || ''}`;
  detailMeta.textContent = `${fmt(movie.Year)} • ${fmt(movie.Director)} • ${fmt(movie.Country)}`;
  detailPlot.textContent = fmt(movie.Plot);
  detailGenre.textContent = fmt(movie.Genre);
  detailRuntime.textContent = fmt(movie.Runtime);
  detailRated.textContent = `Rated: ${fmt(movie.Rated)}`;

  renderReviews(imdbID);
  updateSentimentBar(imdbID);

  // Videos
  await loadVideos(imdbID);
  scrollTo({ top: detailSection.offsetTop - 12, behavior: 'smooth' });
}

function groupVideos(videos) {
  const map = new Map();
  const wanted = ['Trailer','Teaser','Clip','Featurette','Behind the Scenes','Bloopers','Interview'];
  videos.filter(v => v.site === 'YouTube' && wanted.includes(v.type)).forEach(v => {
    const key = v.type;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(v);
  });
  return map;
}

async function loadVideos(imdbID) {
  videosEl.innerHTML = '';
  videoTabs.innerHTML = '';
  videoTabs.style.display = 'none';

  const tmdb = await tmdbFindByIMDb(imdbID);
  if (!tmdb) return;
  const vids = await tmdbVideos(tmdb.id);
  const grouped = groupVideos(vids);
  if (!grouped.size) return;

  const order = ['Trailer','Clip','Interview','Featurette','Behind the Scenes','Bloopers','Teaser'];
  const tabs = order.filter(t => grouped.has(t));
  if (!tabs.length) return;

  videoTabs.style.display = 'flex';

  const renderType = (type) => {
    videosEl.innerHTML = '';
    const arr = grouped.get(type) || [];
    arr.slice(0, 6).forEach(v => {
      const iframe = h('iframe', { src: `https://www.youtube.com/embed/${v.key}`, allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share', allowfullscreen: '' });
      videosEl.appendChild(h('div', { class: 'video' }, iframe));
    });
  };

  tabs.forEach((t, i) => {
    const tab = h('button', { class: 'tab' + (i === 0 ? ' active' : ''), 'data-type': t }, t === 'Clip' ? 'Clips' : t);
    tab.addEventListener('click', () => {
      [...videoTabs.children].forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      renderType(t);
    });
    videoTabs.appendChild(tab);
  });

  renderType(tabs[0]);
}

// --- Reviews ---
function setThumb(choice) {
  thumbChoice = choice;
  thumbUp.classList.toggle('active', choice === 'up');
  thumbUp.classList.toggle('up', choice === 'up');
  thumbDown.classList.toggle('active', choice === 'down');
  thumbDown.classList.toggle('down', choice === 'down');
}
thumbUp.addEventListener('click', () => setThumb('up'));
thumbDown.addEventListener('click', () => setThumb('down'));

reviewForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!currentMovie) return;
  const imdbID = currentMovie.imdbID;
  const text = reviewText.value.trim();
  if (!text) { alert('Please write something.'); return; }
  if (!thumbChoice) { alert('Choose Thumbs Up or Down.'); return; }
  const now = new Date();
  const item = { id: uid(), text, thumb: thumbChoice, ts: now.toISOString() };
  const arr = getReviews(imdbID);
  arr.unshift(item);
  setReviews(imdbID, arr);

  reviewText.value = '';
  setThumb(null);
  renderReviews(imdbID);
  updateSentimentBar(imdbID);
});

function renderReviews(imdbID) {
  const arr = getReviews(imdbID);
  reviewsEl.innerHTML = '';
  if (!arr.length) {
    reviewsEl.appendChild(h('div', { class: 'empty' }, 'No reviews yet. Be the first critic!'));
    return;
  }
  arr.forEach(r => {
    const when = new Date(r.ts).toLocaleString();
    const chip = h('span', { class: 'pill ' + (r.thumb === 'up' ? 'chip-up' : 'chip-down') }, r.thumb === 'up' ? '👍 Up' : '👎 Down');
    const meta = h('div', { class: 'meta' }, [chip, h('span', {}, `• ${when}`)]);
    const del = h('button', { class: 'iconbtn danger' }, 'Delete');
    del.addEventListener('click', () => {
      const filtered = getReviews(imdbID).filter(x => x.id !== r.id);
      setReviews(imdbID, filtered);
      renderReviews(imdbID);
      updateSentimentBar(imdbID);
    });
    const item = h('div', { class: 'review' }, [ h('div', {}, r.text), meta, h('div', { class: 'controls' }, [del]) ]);
    reviewsEl.appendChild(item);
  });
}

function updateSentimentBar(imdbID) {
  const arr = getReviews(imdbID);
  const total = arr.length || 0;
  const ups = arr.filter(r => r.thumb === 'up').length;
  const pos = total ? Math.round((ups / total) * 100) : 0;
  posBar.style.width = pos + '%';
  posLabel.textContent = `${pos}% 👍`;
  document.documentElement.style.setProperty('--pos', pos);
}

// --- Search logic ---
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

async function doSearch() {
  const q = qEl.value.trim();
  randomSection.style.display = 'none';
  if (!q) { renderResults([]); return; }
  resultsEmptyEl.style.display = 'none';
  resultsEl.innerHTML = Array.from({length: 8}).map(() => `<div class="card"><div class="poster" style="display:grid;place-items:center;color:#334155;">Loading…</div></div>`).join('');
  try {
    const list = await searchMovies(q);
    renderResults(list);
  } catch (e) {
    console.error(e);
    renderResults([]);
  }
}

async function loadRandomSuggestions() {
  randomSuggestionsEl.innerHTML = '';
  randomEmptyEl.style.display = 'block';

  const genre = GENRES[Math.floor(Math.random() * GENRES.length)];
  try {
    const res = await fetch(`/.netlify/functions/omdb?s=${encodeURIComponent(genre)}&type=movie`);
    const data = await res.json();
    if (data.Response === 'True' && Array.isArray(data.Search)) {
      const picks = data.Search.slice(0, 5);
      randomEmptyEl.style.display = 'none';

      picks.forEach(m => {
        const card = h('div', { class: 'card', tabindex: 0, role: 'button' });
        card.addEventListener('click', () => openDetail(m.imdbID));
        card.append(
          h('img', { class: 'poster', src: safePoster(m.Poster), alt: m.Title }),
          h('div', { class: 'card-body' }, [
            h('div', { class: 'title' }, m.Title),
            h('div', { class: 'meta' }, `${fmt(m.Year)} • ${fmt(m.Type).toUpperCase?.() || fmt(m.Type)}`)
          ])
        );
        randomSuggestionsEl.appendChild(card);
      });
    } else {
      randomEmptyEl.textContent = "No suggestions available right now.";
    }
  } catch (e) {
    console.error(e);
    randomEmptyEl.textContent = "Failed to load suggestions.";
  }
}

// --- Events ---
searchBtn.addEventListener('click', doSearch);
qEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
qEl.addEventListener('input', debounce(() => { if (qEl.value.trim().length >= 3) doSearch(); }, 400));

// --- On load ---
resultsEmptyEl.style.display = 'block';
loadRandomSuggestions();
