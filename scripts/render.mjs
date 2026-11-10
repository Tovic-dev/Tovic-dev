// Renders the cards of the profile README (cards/*.svg, light and dark). No dependencies:  node scripts/render.mjs
//
// - Texts and figures come from the published portfolio (the content file https://www.mikelarnao.com serves),
//   so the cards follow the site. If the site can't be reached, the last cards stay as they are.
// - Contributions come from the GitHub API when GH_TOKEN is set (the Action sets it) and are kept in
//   data/contributions.json; without a token that file is used as it is.
// - The cards are shown through <img>, where an SVG can't load anything: fonts and artwork are embedded,
//   and the animations are CSS keyframes inside the SVG. STATIC=1 leaves them out (final frame, to screenshot).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://www.mikelarnao.com', USER = 'Tovic-dev';
const PINNED = 3;               // tiles in the row
const STATIC = process.env.STATIC === '1';
const OUT = path.join(ROOT, 'cards');
fs.mkdirSync(OUT, { recursive: true });

// ---- data ---------------------------------------------------------------------------------------------------
async function siteContent() {
  const html = await (await fetch(SITE + '/')).text();
  const m = html.match(/assets\/content-en\.[a-f0-9]+\.js/);
  if (!m) throw new Error('content file not found in the home page');
  const js = await (await fetch(`${SITE}/${m[0]}`)).text();
  return JSON.parse(js.slice(js.indexOf('{'), js.lastIndexOf('}') + 1));
}
async function contributions() {
  const file = path.join(ROOT, 'data/contributions.json');
  if (process.env.GH_TOKEN) {
    const query = `query{user(login:"${USER}"){contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{date contributionCount}}}}}}`;
    const r = await fetch('https://api.github.com/graphql', { method: 'POST', headers: { authorization: `bearer ${process.env.GH_TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify({ query }) });
    const cal = (await r.json()).data?.user?.contributionsCollection?.contributionCalendar;
    if (cal) {
      const days = cal.weeks.flatMap(w => w.contributionDays), by = {};
      for (const d of days) by[d.date.slice(0, 7)] = (by[d.date.slice(0, 7)] || 0) + d.contributionCount;
      const data = { total: cal.totalContributions, days: days.filter(d => d.contributionCount > 0).length, byMonth: Object.entries(by).map(([m, c]) => ({ m, c })) };
      fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
      return data;
    }
    console.warn('! contributions not read from the API: using data/contributions.json');
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// ---- drawing ------------------------------------------------------------------------------------------------
const b64 = f => fs.readFileSync(path.join(ROOT, f)).toString('base64');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const plain = s => String(s || '').replace(/<[^>]+>/g, '').replace(/ /g, ' ').trim();
// the same tokens as the site
const THEMES = {
  light: { paper: '#ECECE7', ink: '#141413', ink2: '#5D5D57', rule: 'rgba(20,20,19,.16)', spot: '#FF5B14' },
  dark: { paper: '#121211', ink: '#E9E8E2', ink2: '#9A9991', rule: 'rgba(233,232,226,.15)', spot: '#FF6A2B' },
};
const PLATE = '#ECECE7'; // the figure keeps its paper in both themes: the artwork is drawn on it
const FONTS = `
@font-face{font-family:"Inter Tight";font-weight:300 800;src:url(data:font/woff2;base64,${b64('assets/fonts/inter-tight-latin.woff2')}) format("woff2")}
@font-face{font-family:"IBM Plex Mono";font-weight:400;src:url(data:font/woff2;base64,${b64('assets/fonts/ibm-plex-mono-latin-400.woff2')}) format("woff2")}
@font-face{font-family:"IBM Plex Mono";font-weight:500;src:url(data:font/woff2;base64,${b64('assets/fonts/ibm-plex-mono-latin-500.woff2')}) format("woff2")}`;
const css = t => `${FONTS}
.bg{fill:${t.paper}}.ink{fill:${t.ink}}.ink2{fill:${t.ink2}}.spot{fill:${t.spot}}
.rule{stroke:${t.rule};stroke-width:1;fill:none}
.h{font-family:"Inter Tight",-apple-system,"Helvetica Neue",Arial,sans-serif;font-weight:640;letter-spacing:-.035em}
.s{font-family:"Inter Tight",-apple-system,"Helvetica Neue",Arial,sans-serif;font-weight:440;letter-spacing:-.015em}
.m{font-family:"IBM Plex Mono",ui-monospace,Menlo,monospace;font-size:11.5px;letter-spacing:.06em}
.m5{font-weight:500}
${STATIC ? '' : `
@keyframes up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes rise{from{transform:translateY(105%)}to{transform:none}}
@keyframes fade{from{opacity:0}to{opacity:1}}
@keyframes grow{from{transform:scaleY(0)}to{transform:none}}
@keyframes drawx{from{transform:scaleX(0)}to{transform:none}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
.up{animation:up .8s cubic-bezier(.2,.7,.1,1) both}
.rise{animation:rise 1.1s cubic-bezier(.16,1,.3,1) both}
.fade{animation:fade .9s ease both}
.grow{animation:grow .9s cubic-bezier(.2,.7,.1,1) both;transform-box:fill-box;transform-origin:bottom}
.drawx{animation:drawx 1s cubic-bezier(.2,.7,.1,1) both;transform-box:fill-box;transform-origin:left}
.pulse{animation:pulse 2.4s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}`}`;
// the cards play top to bottom: every element takes its delay (seconds)
const d = s => (STATIC ? '' : ` style="animation-delay:${s}s"`);
const svg = (w, h, t, title, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
<style>${css(t)}</style>
<rect class="bg" width="${w}" height="${h}"/>
${body}
</svg>
`;
// SVG text does not wrap: break by characters
const wrap = (s, max) => { const out = []; let cur = ''; for (const w of String(s).split(/\s+/)) { if ((cur + ' ' + w).trim().length > max && cur) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); } if (cur) out.push(cur); return out; };
const lines = (arr, x, y, lh, cls, extra = '') => arr.map((l, i) => `<text x="${x}" y="${y + i * lh}" class="${cls}"${extra}>${esc(l)}</text>`).join('');

function hero(t, D) {
  const W = 880, H = 340, px = 28, H0 = D.home, S = D.site;
  const pw = 372, ph = 284, pxr = W - px - pw, py = 28;
  const deck = wrap(plain(H0.deckMobile || H0.deck), 34);
  return svg(W, H, t, `${S.name}, ${S.role}. ${plain(H0.deckMobile || H0.deck)}`, `
<g class="up"${d(.05)}><circle class="spot pulse" cx="${px + 4}" cy="40" r="3.5"/><text x="${px + 16}" y="44" class="m ink2">${esc(H0.availability.toUpperCase())}</text></g>
<clipPath id="c1"><rect x="0" y="62" width="${pxr - 10}" height="92"/></clipPath><clipPath id="c2"><rect x="0" y="150" width="${pxr - 10}" height="96"/></clipPath>
<g clip-path="url(#c1)"><text x="${px - 4}" y="146" class="h ink rise" font-size="104"${d(.1)}>${esc(H0.first)}</text></g>
<g clip-path="url(#c2)"><text x="${px - 4}" y="234" class="h ink2 rise" font-size="104"${d(.2)}>${esc(H0.last)}</text></g>
<g class="up"${d(.45)}>${lines(deck, px, 276, 25, 's ink', ' font-size="20"')}</g>
<g class="fade"${d(.7)}>
  <rect x="${pxr}" y="${py}" width="${pw}" height="${ph}" fill="${PLATE}"/>
  <image x="${pxr + 26}" y="${py + 6}" width="320" height="267" href="data:image/jpeg;base64,${b64('assets/seat.jpg')}" preserveAspectRatio="xMidYMid meet"/>
  <rect x="${pxr + .5}" y="${py + .5}" width="${pw - 1}" height="${ph - 1}" fill="none" stroke="${t.rule}"/>
  <path d="M${pxr} ${py + 14}V${py}h14M${pxr + pw - 14} ${py}h14v14M${pxr + pw} ${py + ph - 14}v14h-14M${pxr + 14} ${py + ph}h-14v-14" fill="none" stroke="#141413" stroke-width="2"/>
  <text x="${pxr + 14}" y="${py + 24}" class="m m5" fill="#141413">${esc(S.ui.fig.toUpperCase())} 01</text>
  <text x="${pxr + pw - 14}" y="${py + ph - 12}" class="m" fill="#5D5D57" text-anchor="end">${esc((H0.featured[0].figure + ' · ' + S.ui.explodedView).toUpperCase())}</text>
</g>
<text x="${px}" y="${H - 14}" class="m ink2 up"${d(.55)}>${esc((S.role + ' · ' + S.footer.place).toUpperCase())}</text>`);
}

// one tile per pinned project: its title and its first figure
function tile(t, D, i) {
  const p = D.projects.find(x => x.id === D.home.featured[i].project), st = (p.stats || [])[0];
  const TERR = Object.fromEntries(D.works.categories.map(c => [c.key, c.label]));
  const W = 286, H = 214, px = 18;
  const title = wrap(plain(p.title), 20), label = st ? wrap(plain(st[1]), 40).slice(0, 2) : [];
  return svg(W, H, t, `${plain(p.title)}${st ? `: ${plain(st[0])}, ${plain(st[1])}` : ''}`, `
<rect class="rule" x=".5" y=".5" width="${W - 1}" height="${H - 1}"/>
<rect class="spot drawx" x="0" y="0" width="${W}" height="2"${d(.9 + i * .12)}/>
<g class="up"${d(1 + i * .12)}>
<text x="${px}" y="30" class="m ink2">${esc(String(i + 1).padStart(2, '0') + ' · ' + p.terr.map(c => TERR[c]).join(' · ').toUpperCase())}</text>
<text x="${W - px}" y="31" class="m spot" text-anchor="end" font-size="14">↗</text>
${lines(title, px, 62, 26, 'h ink', ' font-size="24" style="letter-spacing:-.025em;font-weight:560"')}
${st ? `<line class="rule" x1="${px}" y1="${H - 86}" x2="${W - px}" y2="${H - 86}"/>
<text x="${px}" y="${H - 48}" class="h ink" font-size="34">${esc(plain(st[0]))}</text>
${lines(label, px, H - 28, 14, 'm ink2', ' style="letter-spacing:.01em;font-size:10.5px"')}` : ''}
</g>`);
}

// design and engineering tools as text (the code stack is an icon row in the README)
function tools(t, D) {
  const W = 880, H = 96, px = 28;
  const all = (D.about.facts.find(f => f.type === 'chips') || { items: [] }).items;
  const design = all.filter(x => !/^(React|Next\.js|TypeScript|Tailwind)/i.test(x));
  let x = px;
  const chips = design.map((n, i) => { const w = Math.round(n.length * 9.6) + 22; const g = `<g class="up"${d(1.5 + i * .05)}><rect class="rule" x="${x + .5}" y="46.5" width="${w}" height="28"/><text x="${x + 11}" y="65" class="s ink" font-size="15">${esc(n)}</text></g>`; x += w + 8; return g; }).join('');
  return svg(W, H, t, 'Design and engineering tools: ' + design.join(', '), `<text x="${px}" y="30" class="m ink2 up"${d(1.4)}>DESIGN &amp; ENGINEERING</text>${chips}`);
}

// contributions per month, the best month in the spot colour (not in the README yet: see README notes)
function activity(t, c) {
  const W = 880, H = 230, px = 28, months = c.byMonth.slice(-12), max = Math.max(1, ...months.map(m => m.c));
  const bw = 34, gap = 14, bx = W - px - months.length * (bw + gap) + gap, by = 176, bh = 110;
  const best = months.reduce((a, m) => (m.c > a.c ? m : a), months[0]);
  const bars = months.map((m, i) => { const h = Math.max(2, Math.round(m.c / max * bh)), x = bx + i * (bw + gap), top = m === best && m.c;
    return `<rect class="${top ? 'spot' : 'ink'} grow" x="${x}" y="${by - h}" width="${bw}" height="${h}"${top ? '' : ' opacity=".8"'}${d(1.9 + i * .05)}/>
<text x="${x + bw / 2}" y="${by + 18}" class="m ink2" text-anchor="middle" style="font-size:10px">${new Date(m.m + '-15').toLocaleString('en', { month: 'short' }).toUpperCase()}</text>
${top ? `<text x="${x + bw / 2}" y="${by - h - 8}" class="m m5 ink fade" text-anchor="middle"${d(2.8)}>${m.c}</text>` : ''}`; }).join('');
  return svg(W, H, t, `${c.total} contributions in the last 12 months, ${c.days} active days`, `
<text x="${px}" y="34" class="m ink2 up"${d(1.8)}>ACTIVITY · LAST 12 MONTHS</text>
<g class="up"${d(1.9)}><text x="${px}" y="112" class="h ink" font-size="64">${c.total}</text><text x="${px}" y="136" class="m ink2">CONTRIBUTIONS</text>
<text x="${px}" y="176" class="s ink" font-size="20">${c.days}</text><text x="${px + 34}" y="175" class="m ink2">ACTIVE DAYS</text></g>
<line class="rule" x1="${bx - 10}" y1="${by + .5}" x2="${W - px}" y2="${by + .5}"/>${bars}`);
}

const [D, C] = await Promise.all([siteContent(), contributions()]);
for (const [name, t] of Object.entries(THEMES)) {
  const w = (f, s) => fs.writeFileSync(path.join(OUT, `${f}-${name}.svg`), s);
  w('hero', hero(t, D));
  for (let i = 0; i < PINNED; i++) w('tile-' + (i + 1), tile(t, D, i));
  w('tools', tools(t, D));
  w('activity', activity(t, C));
}
// the tiles link to their case studies: keep the ids next to the cards for whoever edits the README
console.log('cards/: ' + fs.readdirSync(OUT).length + ' files · tiles → ' + D.home.featured.slice(0, PINNED).map(f => f.project).join(', '));
