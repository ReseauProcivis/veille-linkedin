// Favori « Veille LinkedIn » : scanne les pages du réseau depuis un onglet linkedin.com connecté.
// Méthode validée depuis le 02/10/2026 : API Voyager (ID de la page) puis GraphQL du fil trié par date.
// La CSP de LinkedIn interdit d'appeler GitHub ou Cloudflare depuis cet onglet : le favori ouvre donc la
// page de veille, qui lui envoie la liste des pages et la configuration, puis reçoit les résultats par postMessage.
// outils/construire_favori.py remplace __ORIGIN__ et __PAGE__ puis produit le lien javascript: à glisser.
(() => {
const ORIGIN = '__ORIGIN__';
const PAGE = '__PAGE__';
if (!/(^|\.)linkedin\.com$/.test(location.hostname)) {
  alert('Ouvrez d\'abord linkedin.com (connecté à votre compte), puis cliquez à nouveau sur le favori.');
  return;
}
const S = window.__VLS || (window.__VLS = {started: false, finished: false, results: [], total: 0, win: null});

// ---------------------------------------------------------------- bandeau de progression
let box = document.getElementById('vl-box');
if (!box) {
  box = document.createElement('div');
  box.id = 'vl-box';
  box.style.cssText = 'position:fixed;z-index:2147483647;right:20px;bottom:20px;width:320px;padding:14px 16px;' +
    'background:#fff;border:2px solid #EC6608;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.25);' +
    'font:14px/1.4 -apple-system,Segoe UI,Arial,sans-serif;color:#222';
  box.innerHTML = '<b style="color:#EC6608">Veille LinkedIn</b><div id="vl-msg" style="margin:6px 0 8px">Ouverture de la page de veille…</div>' +
    '<div style="height:8px;background:#eee;border-radius:4px;overflow:hidden"><div id="vl-bar" style="height:100%;width:0;background:#EC6608"></div></div>' +
    '<div style="margin-top:8px;font-size:12px;color:#666">Laissez cet onglet ouvert jusqu\'à la fin.</div>';
  document.body.appendChild(box);
}
const say = (msg, pct) => {
  box.querySelector('#vl-msg').textContent = msg;
  if (pct !== undefined) box.querySelector('#vl-bar').style.width = pct + '%';
};

const send = msg => { if (S.win && !S.win.closed) S.win.postMessage(msg, ORIGIN); };

// ---------------------------------------------------------------- dialogue avec la page de veille
if (!S.listening) {
  S.listening = true;
  window.addEventListener('message', e => {
    if (e.origin !== ORIGIN || !e.data || e.data.type !== 'vl-start') return;
    S.win = e.source;
    send({type: 'vl-ack', started: S.started, total: S.total});
    // Rejoue ce qui est déjà scanné (page de veille rouverte en cours de route).
    for (const r of S.results) send({type: 'vl-page', result: r});
    if (S.finished) send({type: 'vl-end', count: S.results.length, ms: S.ms});
    else if (!S.started) scan(e.data.pages, e.data.config);
  });
}
S.win = window.open(PAGE + '#scan', 'veille-linkedin');
if (!S.win) say('Le navigateur a bloqué l\'ouverture de la page de veille : autorisez les fenêtres pop-up pour linkedin.com, puis recliquez sur le favori.');
else if (S.finished) say('Scan terminé. Résultats renvoyés à la page de veille.', 100);

// ---------------------------------------------------------------- scan
async function scan(PAGES, C) {
  S.started = true;
  S.total = PAGES.length;
  const m = document.cookie.match(/JSESSIONID="?([^";]+)/);
  if (!m) { say('Session LinkedIn introuvable : connectez-vous à LinkedIn, rechargez, puis recliquez.'); S.started = false; return; }
  const H = {'csrf-token': m[1], 'accept': 'application/vnd.linkedin.normalized+json+2.1'};
  // Pauses par Web Worker : les setTimeout d'un onglet en arrière-plan sont bridés par Chrome.
  const w = new Worker(URL.createObjectURL(new Blob(['onmessage=e=>setTimeout(()=>postMessage(e.data),e.data.ms)'], {type: 'application/javascript'})));
  let seq = 0; const waiters = {};
  w.onmessage = e => { const f = waiters[e.data.id]; delete waiters[e.data.id]; if (f) f(); };
  const sleep = ms => new Promise(res => { const id = ++seq; waiters[id] = res; w.postMessage({id, ms}); });
  const NOW = Date.now();
  const ts = urn => Number(BigInt(urn.split(':').pop()) >> 22n);
  const rel = t => { const d = NOW - t, h = d / 36e5, j = h / 24;
    if (h < 1) return Math.max(1, Math.round(d / 6e4)) + ' min';
    if (h < 24) return Math.round(h) + ' h';
    if (j < 7) return Math.round(j) + ' j';
    if (j < 14) return '1 sem.';
    if (j < 30) return Math.round(j / 7) + ' sem.';
    if (j < 365) return Math.round(j / 30) + ' mois';
    return Math.round(j / 365) + ' an'; };
  const classify = t => { if (!t) return 'NON'; const j = (NOW - t) / 864e5; return j <= C.jours_actif ? 'OUI' : j <= C.jours_limite ? 'LIMITE' : 'NON'; };
  // Coupe par point de code, pas par unité UTF-16.
  const cut = (s, n) => Array.from(s || '').slice(0, n).join('');

  async function get(url) {
    for (let a = 0; a < 3; a++) {
      const r = await fetch(url, {headers: H, credentials: 'include'});
      if (r.status === 429) { await sleep(a === 0 ? 5000 : 10000); continue; }
      if (!r.ok) return {status: r.status};
      return {status: 200, json: await r.json()};
    }
    return {status: 429};
  }

  // Images d'un contenu de post : vectorImage (rootUrl + artifacts), en suivant les références *urn.
  function vec(o, out, by, depth) {
    if (depth > 14 || !o) return;
    if (Array.isArray(o)) { for (const v of o) vec(v, out, by, depth + 1); return; }
    if (typeof o !== 'object') return;
    if (o.rootUrl && o.artifacts && o.artifacts.length) {
      const best = o.artifacts.reduce((a, b) => (b.width || 0) > (a.width || 0) ? b : a);
      out.push({url: o.rootUrl + (best.fileIdentifyingUrlPathSegment || ''), w: best.width, h: best.height});
    }
    for (const k in o) {
      const v = o[k];
      if (k[0] === '*' && typeof v === 'string' && by[v]) vec(by[v], out, by, depth + 1);
      else if (k[0] === '*' && Array.isArray(v)) { for (const ref of v) if (typeof ref === 'string' && by[ref]) vec(by[ref], out, by, depth + 1); }
      else vec(v, out, by, depth + 1);
    }
  }
  function medias(u, by) {
    const res = {kind: [], images: [], doc_pages: [], video: null};
    const sources = [u];
    if (u['*resharedUpdate'] && by[u['*resharedUpdate']]) sources.push(by[u['*resharedUpdate']]);
    for (const src of sources) {
      const content = src.content || {};
      for (const k in content) if (content[k]) res.kind.push(k);
      vec(content, res.images, by, 0);
      const dc = content.documentComponent;
      if (dc && dc.document && dc.document.coverPages) {
        const pp = dc.document.coverPages.pagesPerResolution || [];
        if (pp.length) res.doc_pages = pp.reduce((a, b) => (b.width || 0) > (a.width || 0) ? b : a).imageUrls || [];
      }
      const vc = content.linkedInVideoComponent;
      const meta = vc && vc['*videoPlayMetadata'] && by[vc['*videoPlayMetadata']];
      if (meta && !res.video) {
        const c = [];
        for (const st of meta.progressiveStreams || []) for (const loc of st.streamingLocations || [])
          if (loc.url && (st.mediaType || '').startsWith('video/mp4')) c.push({url: loc.url, w: st.width, h: st.height});
        if (c.length) res.video = Object.assign(c.reduce((a, b) => (b.w || 0) > (a.w || 0) ? b : a), {duree_ms: meta.duration || null});
      }
    }
    const seen = new Set();
    res.images = res.images.filter(i => (i.w || 0) >= 300 && !seen.has(i.url) && seen.add(i.url));
    return res;
  }

  async function one(p) {
    const out = {id: p.id, nom: p.nom, url: p.url, statut: p.statut};
    const r1 = await get('/voyager/api/voyagerOrganizationDashCompanies?q=universalName&universalName=' + encodeURIComponent(p.slug));
    if (r1.status !== 200) { out.erreur = 'recherche_' + r1.status; return out; }
    const els = (r1.json.data && r1.json.data['*elements']) || [];
    if (!els.length) { out.erreur = 'introuvable'; return out; }
    const id = els[0].split(':').pop();
    out.company_id = id;
    const comp = (r1.json.included || []).find(x => x.entityUrn === els[0]);
    if (comp && comp.name) out.nom_linkedin = comp.name;
    await sleep(C.pause_ms);
    const vars = '(count:10,organizationalPageUrn:urn%3Ali%3Afsd_organizationalPage%3A' + id + ',moduleKey:ORGANIZATION_MEMBER_FEED_DESKTOP,start:0)';
    const r2 = await get('/voyager/api/graphql?variables=' + vars + '&queryId=' + C.queryId);
    if (r2.status !== 200) { out.erreur = 'fil_' + r2.status; return out; }
    const d = r2.json.data && r2.json.data.data;
    let elements = [];
    if (d) for (const k in d) { const v = d[k]; if (v && v['*elements']) { elements = v['*elements']; break; } }
    if (!d) { out.erreur = 'fil_vide'; return out; }
    const by = {};
    for (const x of r2.json.included || []) if (x.entityUrn) by[x.entityUrn] = x;
    const posts = [];
    for (const eu of elements) {
      const am = eu.match(/urn:li:activity:\d+/); if (!am) continue;
      const u = by[eu]; if (!u) continue;
      const act = am[0];
      let texte = u.commentary && u.commentary.text ? u.commentary.text.text : '';
      const ru = u['*resharedUpdate'] && by[u['*resharedUpdate']];
      const reprise = ru ? {auteur: ru.actor && ru.actor.name ? ru.actor.name.text : '', texte: ru.commentary && ru.commentary.text ? cut(ru.commentary.text.text, 3000) : ''} : null;
      if (!texte && reprise) texte = reprise.texte;
      posts.push({urn: act, ts: ts(act), url: 'https://www.linkedin.com/feed/update/' + act, texte: cut(texte, 3000),
        entete: u.header && u.header.text ? u.header.text.text : '',
        auteur: u.actor && u.actor.name ? u.actor.name.text : '', reprise, _u: u});
    }
    // Tri par date : neutralise les posts épinglés.
    posts.sort((a, b) => b.ts - a.ts);
    out.n_trouves = posts.length;
    const top = posts[0];
    out.dernier_ts = top ? top.ts : null;
    out.dernier_post = top ? rel(top.ts) : 'aucun';
    out.actif = classify(out.dernier_ts);
    out.n_7j = posts.filter(x => (NOW - x.ts) / 864e5 <= C.jours_actif).length;
    out.posts = (out.actif === 'NON' ? [] : posts.slice(0, C.posts_par_page)).map(x => {
      const md = medias(x._u, by); delete x._u;
      return Object.assign(x, {date: rel(x.ts)}, md);
    });
    return out;
  }

  say('Scan de ' + PAGES.length + ' pages…', 0);
  send({type: 'vl-ack', started: true, total: PAGES.length});
  for (const p of PAGES) {
    let out;
    try { out = await one(p); } catch (e) { out = {id: p.id, nom: p.nom, url: p.url, statut: p.statut, erreur: 'exception ' + String(e).slice(0, 100)}; }
    S.results.push(out);
    send({type: 'vl-page', result: out});
    say(S.results.length + ' / ' + PAGES.length + ' : ' + p.nom, Math.round(100 * S.results.length / PAGES.length));
    await sleep(C.pause_ms);
  }
  S.finished = true;
  S.ms = Date.now() - NOW;
  const nerr = S.results.filter(r => r.erreur).length;
  say('Scan terminé en ' + Math.round(S.ms / 60000) + ' min' + (nerr ? ', ' + nerr + ' erreur(s)' : '') +
    '. ' + (S.win && !S.win.closed ? 'Les résultats sont dans la page de veille.' : 'La page de veille a été fermée : recliquez sur le favori pour lui renvoyer les résultats.'), 100);
  send({type: 'vl-end', count: S.results.length, ms: S.ms});
}
})();
