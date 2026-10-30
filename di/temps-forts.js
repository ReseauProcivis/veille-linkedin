/*
 * Temps forts de la NEWSLETTER HEBDO : remplissage des blocs Inauguré dans Dialog Insight.
 *
 * Tourne dans un onglet app.mydialoginsight.com connecté au projet PROCIVIS (session de la personne,
 * aucune clé). Portage JavaScript de nl_di.py (skill montage-newsletter-di) et des scripts du 16/10/2026.
 * Ne déclenche aucun envoi : il écrit seulement dans le brouillon du message.
 *
 * Chargement (Claude in Chrome, dans l'onglet DI) :
 *   await import('https://reseauprocivis.github.io/veille-linkedin/di/temps-forts.js?v=' + Date.now())
 * puis window.VLDI :
 *   await VLDI.etat(idMessage)            // blocs Inauguré en place (titre, image, lien)
 *   await VLDI.selection()                // dernière sélection validée sur la page de veille
 *   await VLDI.planche(sel.temps_forts)   // affiche les images candidates numérotées (1.a, 1.b...)
 *   VLDI.candidat('1.b')                  // source de l'image choisie, à mettre dans plan[i].image
 *   VLDI.fermerPlanche()
 *   await VLDI.apercu(source)             // image préparée (dataURL) pour vérifier un recadrage
 *   VLDI.lancer(idMessage, plan)          // écrit les temps forts en tâche de fond
 *   VLDI.suivi()                          // avancement, puis rapport (ou erreur)
 *
 * plan = [{titre, texte, linkedin, image: {url} | {video, t} }, ...] dans l'ordre de la newsletter.
 *   texte : texte brut (1 à 3 phrases). Le script le passe en entités HTML avec la typographie de DI.
 *   image.url : photo LinkedIn (ou page de document) ; image.video + image.t : plan de la vidéo à t secondes.
 *   image.recadrage (facultatif) : {x, y, w, h} en fractions de l'image source (0 à 1).
 */

const BASE = location.origin;
const EDIT = id => `/gw/contact/template-visual-editor/editor/message/${id}`;
const CMD = c => `/gw/contact/template-visual-editor/v1.0/${c}.ofsys`;
const XR = {'X-Requested-With': 'XMLHttpRequest'};
// DI renvoie InternalError avec le Content-Type que fetch pose seul pour un URLSearchParams
// (« ...;charset=UTF-8 », sans espace) : on envoie une chaîne avec l'en-tête de jQuery.
const FORM = {...XR, 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'};
const BSET = 'aeab3dcc-dce8-41ef-890f-46c0e875e53c';
const INAUG = {
  img: '619bbcd0-66f4-45a2-bb6d-9f523954578a',   // Bloc Inauguré : Image à gauche + Texte
  txt: 'bf011310-1ec7-4923-87dd-f5ea85d2b5bc',   // Bloc Inauguré : Texte + Image à droite
};
const PAGE_VEILLE = 'https://reseauprocivis.github.io/veille-linkedin/';
const LARGEUR = 900;
const QUALITE = 0.88;
const G = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const journal = [];
const log = (...a) => { const s = a.join(' '); journal.push(s); console.log('[VLDI]', s); };
const norm = x => x == null ? '' : String(x).replace(/\s+/g, ' ').trim();

// ------------------------------------------------------------------ éditeur visuel

function arbre(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return [...doc.querySelectorAll('[ofsysvisualeditor_id]')].map(el => {
    const path = el.getAttribute('ofsysvisualeditor_id');
    let conf = {};
    try { conf = JSON.parse(el.getAttribute('ofsysvisualeditor_designconfig') || '{}'); } catch (e) { /* bloc sans config */ }
    const kind = path.includes('BlockPlaceHolder') ? 'PH' : G.test(path) ? 'B' : 'L';
    return {kind, label: conf.label || null, path, conf, txt: kind === 'PH' ? '' : norm(el.textContent).slice(0, 80)};
  });
}

class Editeur {
  constructor(idm) { this.idm = Number(idm); }

  async charger() {
    const r = await fetch(BASE + EDIT(this.idm), {credentials: 'include'});
    const h = await r.text();
    const m = h.match(/AllHashes: (\{.*?\}),\n/s);
    if (!m) throw new Error(`L'éditeur du message ${this.idm} ne s'ouvre pas : session DI expirée, ou DI est sur un autre projet que PROCIVIS (le choisir dans la liste du haut de DI).`);
    this.hashes = JSON.parse(m[1]);
    this.bh = h.match(/BlocksetsCummulativeHash: '([^']*)'/)[1];
    this.ph = h.match(/PageCummulativeHash: '([^']*)'/)[1];
    this.args = h.match(/ControlParameters: (\{[^}]*\})/)[1];
    await this.refresh();
    return this;
  }

  async call(cmd, data = {}) {
    const corps = new URLSearchParams({controlMode: 2, arguments: this.args, hashes: JSON.stringify(this.hashes),
      pageHash: this.ph, blocksetsHash: this.bh, tsCache: '', culture: 'fr-CA', ...data});
    const r = await fetch(BASE + CMD(cmd), {method: 'POST', credentials: 'include', headers: FORM, body: corps.toString()});
    const t = await r.text();
    try { return JSON.parse(t); } catch (e) { throw new Error(`Réponse non JSON à ${cmd} (HTTP ${r.status}) : session DI probablement expirée.`); }
  }

  accept(r) {
    if (r.Hashes) this.hashes = r.Hashes;
    if (r.m_BlocksetsCummulativeHash) this.bh = r.m_BlocksetsCummulativeHash;
    if (r.m_PageCummulativeHash) this.ph = r.m_PageCummulativeHash;
    if (r.TemplateRender) this.rows = arbre(r.TemplateRender);
  }

  async cmd(name, data) {
    const r = await this.call(name, data);
    if (r.Status != null && !/^ok$/i.test(r.Status)) throw new Error(`${name} -> ${r.Status} ${JSON.stringify(r.ErrorMessages || '').slice(0, 400)}`);
    this.accept(r);
    return r;
  }

  async refresh() {
    const r = await this.call('getTemplateRender');
    this.accept(r);
    if (!r.TemplateRender) throw new Error('getTemplateRender sans rendu : ' + r.Status);
  }

  blocs() { return this.rows.filter(x => x.kind === 'B'); }
  blocsDe(liste) {
    const n = liste.split('/').length;
    return this.blocs().filter(x => x.path.startsWith(liste + '/') && x.path.split('/').length === n + 1);
  }
  rang(p) { return this.blocsDe(p.slice(0, p.lastIndexOf('/'))).map(x => x.path).indexOf(p); }

  async valeurs(path) {
    const x = this.rows.find(x => x.path === path);
    const r = await this.call('getProviders', {performValidation: 'false', blockPath: path,
      requestedProviders: JSON.stringify(x.conf.editedProviders), editedSingleProviderField: 'null'});
    const out = {};
    for (const p of r.ProviderInfo || []) {
      const vals = ((p.FieldsValues || {})['fr-CA'] || {}).Values || {};
      for (const c in vals) if (vals[c] && typeof vals[c] === 'object') out[p.Path.split('/').pop() + '/' + c] = vals[c].Value;
    }
    return out;
  }

  async ecrire(path, values) {
    const fieldList = Object.entries(values).map(([k, v]) => {
      const [prov, field] = k.split('/');
      const pp = path + '/' + prov;
      return {ProviderPath: pp, ProviderFieldName: field, ProviderHash: this.hashes[pp.replace(/\//g, '.')], NewValue: v, InputId: null};
    });
    return this.cmd('updateProvidersValues', {fieldList: JSON.stringify(fieldList), overwriteConcurrentEdits: 'false'});
  }

  async creer(liste, rang, typeGuid, label) {
    const avant = new Set(this.blocsDe(liste).map(x => x.path));
    const action = {Action: `createBlock(${liste},${BSET},${typeGuid})`, Assignations: []};
    const r = await this.cmd('factoryBlockDropped', {factoryDropType: 'BlockType', blockTypeGuid: typeGuid, blockSetTypeGuid: BSET,
      dropAtRank: rang, dropAction: JSON.stringify(action), label, overwriteConcurrentEdits: 'false'});
    if (r.m_DropReaction === 'OpenCreateBlockDialog') {
      const a = r.DropReactionArguments;
      await this.cmd('createNewBlock', {fieldList: '[]', blockSetTypeGuid: a.blockSetTypeGuid, blockTypeGuid: a.blockTypeGuid,
        blocksetPath: a.blocksetPath, dropAtRank: a.dropAtRank, deleteBlock: '', clearProviders: ''});
    }
    const nouveaux = this.blocsDe(liste).filter(x => !avant.has(x.path));
    if (nouveaux.length !== 1) throw new Error('Création ambiguë : ' + nouveaux.length + ' blocs nouveaux');
    return nouveaux[0].path;
  }

  async supprimer(path) { return this.cmd('deleteBlock', {block: path}); }
}

// ------------------------------------------------------------------ médiathèque

async function verser(blob, nom, idm, w, h) {
  const fd = new FormData();
  fd.append('files[]', blob, nom);
  for (const [k, v] of Object.entries({isLegacyMode: 'false', idMessage: String(idm), idHostedFileFolder: '', isMessageAttachment: 'false',
    permissionContext: '1', upload_ctrl_id: 'ctrl_vl', upload_job_id: 'job_vl'})) fd.append(k, v);
  const r = await (await fetch(BASE + CMD('hosted-files/uploadFiles2'), {method: 'POST', credentials: 'include', headers: XR, body: fd})).json();
  const f0 = (r.files || [])[0] || {};
  if (!f0.ofsys_idFile || !f0.url_abs || f0.error) throw new Error('Téléversement refusé : ' + JSON.stringify(f0).slice(0, 200));
  const conf = [{idFile: f0.ofsys_idFile, fKey: f0.ofsys_fKey, fileName: f0.ofsys_fileName, imageWidth: w, imageHeight: h}];
  const rc = await (await fetch(BASE + CMD('hosted-files/confirmFiles'), {method: 'POST', credentials: 'include', headers: FORM,
    body: new URLSearchParams({files: JSON.stringify(conf), categoryId: '', cbUseExpiry: 'false', rbUseDefaultExpiry: 'false',
      rbUseCustomExpiry: 'false', customExpiryDateTime: '', isMessageAttachment: 'false', idFileToReplace: '',
      idHostedFileFolder: '', permissionContext: '1'}).toString()})).json();
  if (rc.status !== 'ok') throw new Error('Confirmation du fichier refusée : ' + JSON.stringify(rc).slice(0, 200));
  return {id: f0.ofsys_idFile, url: f0.url_abs};
}

// ------------------------------------------------------------------ images

const charge = (el, ev) => new Promise((ok, ko) => {
  el.addEventListener(ev, () => ok(el), {once: true});
  el.addEventListener('error', () => ko(new Error('Média illisible (lien LinkedIn expiré ?)')), {once: true});
});

async function source(img) {
  if (img.video) {
    const v = document.createElement('video');
    v.crossOrigin = 'anonymous';
    v.muted = true;
    v.preload = 'auto';
    v.src = img.video;
    await charge(v, 'loadeddata');
    v.currentTime = Math.min(Number(img.t) || 0, Math.max(0, v.duration - 0.1));
    await charge(v, 'seeked');
    return {el: v, w: v.videoWidth, h: v.videoHeight};
  }
  const blob = await (await fetch(img.url)).blob();
  const bmp = await createImageBitmap(blob);
  return {el: bmp, w: bmp.width, h: bmp.height};
}

// Pas de recadrage par défaut : la photo garde ses proportions, largeur ramenée à 900 px au plus.
async function preparer(img) {
  const s = await source(img);
  const c = img.recadrage || {x: 0, y: 0, w: 1, h: 1};
  const sx = Math.round(c.x * s.w), sy = Math.round(c.y * s.h), sw = Math.round(c.w * s.w), sh = Math.round(c.h * s.h);
  const w = Math.min(LARGEUR, sw), h = Math.round(sh * w / sw);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(s.el, sx, sy, sw, sh, 0, 0, w, h);
  const blob = await new Promise(ok => cv.toBlob(ok, 'image/jpeg', QUALITE));
  return {blob, w, h, canvas: cv};
}

// ------------------------------------------------------------------ texte

function entites(s) {
  const nommees = {' ': 'nbsp', 'à': 'agrave', 'â': 'acirc', 'ä': 'auml', 'ç': 'ccedil', 'é': 'eacute', 'è': 'egrave', 'ê': 'ecirc',
    'ë': 'euml', 'î': 'icirc', 'ï': 'iuml', 'ô': 'ocirc', 'ö': 'ouml', 'ù': 'ugrave', 'û': 'ucirc', 'ü': 'uuml', 'ÿ': 'yuml',
    'À': 'Agrave', 'Â': 'Acirc', 'Ç': 'Ccedil', 'É': 'Eacute', 'È': 'Egrave', 'Ê': 'Ecirc', 'Î': 'Icirc', 'Ô': 'Ocirc', 'Ù': 'Ugrave',
    'Û': 'Ucirc', 'œ': 'oelig', 'Œ': 'OElig', 'æ': 'aelig', '«': 'laquo', '»': 'raquo', '°': 'deg', '²': 'sup2', '³': 'sup3',
    '€': 'euro', '’': 'rsquo', '‘': 'lsquo', '“': 'ldquo', '”': 'rdquo', '…': 'hellip', '–': 'ndash', '—': 'mdash'};
  let out = '';
  for (const ch of s) {
    if (ch === '&') out += '&amp;';
    else if (ch === '"') out += '&quot;';
    else if (ch === "'") out += '&#39;';
    else if (ch.codePointAt(0) > 127) out += nommees[ch] ? `&${nommees[ch]};` : `&#${ch.codePointAt(0)};`;
    else out += ch;
  }
  return out;
}

// Même typographie que corps() du 16/10 : insécables avant : ; ? ! %, dans les guillemets, les milliers, n° et m².
// Les balises <sup> passées dans le texte restent telles quelles.
function corps(texte) {
  const N = '&nbsp;';
  let s = entites(texte);
  s = s.replace(/&laquo; /g, '&laquo;' + N).replace(/ &raquo;/g, N + '&raquo;').replace(/ ([:;?!])/g, N + '$1');
  s = s.replace(/ %/g, N + '%').replace(/ h\./g, N + 'h.').replace(/n&deg; /g, 'n&deg;' + N);
  s = s.replace(/(\d) (\d{3})\b/g, '$1' + N + '$2').replace(/ m&sup2;/g, N + 'm&sup2;');
  return '<p>' + s + '</p>';
}

function valeursBloc(t, urlImage, dernier) {
  return {'Contenu/titre_art': t.titre, 'Contenu/contenu_art': corps(t.texte), 'Contenu/img_url': urlImage,
    'Contenu/linkedin': t.linkedin, 'Parametres/color_art': '#EC6608', 'Parametres/larg_sep': dernier ? '0' : '35'};
}

// ------------------------------------------------------------------ rubrique Temps Fort

// Blocs Inauguré de la newsletter, dans l'ordre. Ils doivent former une seule suite dans une même liste.
function inaugures(E) {
  const b = E.blocs().filter(x => /Inaugur/.test(x.label || ''));
  if (!b.length) return {liste: null, blocs: []};
  const liste = b[0].path.slice(0, b[0].path.lastIndexOf('/'));
  const dans = E.blocsDe(liste).map(x => x.path);
  const rangs = b.map(x => dans.indexOf(x.path));
  if (rangs.some(r => r < 0) || rangs.some((r, i) => i && r !== rangs[i - 1] + 1))
    throw new Error('Les blocs Inauguré ne forment pas une suite unique : rubrique Temps Fort à vérifier à la main.');
  return {liste, blocs: b};
}

const typeDe = x => /gauche/i.test(x.label) ? 'img' : 'txt';

async function ouvrir(idm) {
  const E = await new Editeur(idm).charger();
  log(`message ${idm} ouvert : ${E.blocs().length} blocs`);
  return E;
}

export async function etat(idm) {
  const E = await ouvrir(idm);
  const {blocs} = inaugures(E);
  const out = [];
  for (const x of blocs) {
    const v = await E.valeurs(x.path);
    out.push({rang: E.rang(x.path), bloc: x.path.slice(-36, -28), type: typeDe(x), titre: v['Contenu/titre_art'],
      image: v['Contenu/img_url'], linkedin: v['Contenu/linkedin'], sep: v['Parametres/larg_sep']});
  }
  return out;
}

export async function selection() {
  const r = await fetch(PAGE_VEILLE + 'selections/latest.json?v=' + Date.now(), {cache: 'no-store'});
  if (!r.ok) throw new Error('Aucune sélection validée en ligne (selections/latest.json).');
  return r.json();
}

export async function apercu(img) {
  const p = await preparer(img);
  return {w: p.w, h: p.h, dataUrl: p.canvas.toDataURL('image/jpeg', 0.6)};
}

function nomFichier(t, i, date) {
  const slug = t.titre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return `tf-${date}-${String(i + 1).padStart(2, '0')}-${slug}.jpg`;
}

export async function remplir(idm, plan, options = {}) {
  journal.length = 0;
  if (!Array.isArray(plan) || !plan.length) throw new Error('Plan vide.');
  for (const t of plan) if (!t.titre || !t.texte || !t.linkedin || !t.image) throw new Error('Temps fort incomplet : ' + JSON.stringify(t).slice(0, 120));
  const d = new Date();
  const date = String(d.getDate()).padStart(2, '0') + String(d.getMonth() + 1).padStart(2, '0');

  // 1. images : préparées dans le navigateur, versées et confirmées dans la médiathèque
  const urls = [];
  for (const [i, t] of plan.entries()) {
    if (t.image.dejaVersee) { urls.push(t.image.dejaVersee); continue; }
    const p = await preparer(t.image);
    const f = await verser(p.blob, nomFichier(t, i, date), idm, p.w, p.h);
    urls.push(f.url);
    log(`image ${i + 1} versée (${p.w}x${p.h}) : ${t.titre}`);
  }

  // 2. blocs : on remplit les blocs Inauguré en place, on crée ceux qui manquent, on retire ceux en trop
  const E = await ouvrir(idm);
  let {liste, blocs} = inaugures(E);
  if (!liste) throw new Error('Aucun bloc Inauguré dans ce message : rubrique Temps Fort absente.');
  const avant = [];
  for (const x of blocs) avant.push({bloc: x.path.slice(-36, -28), valeurs: await E.valeurs(x.path)});

  while (blocs.length < plan.length) {
    const dernier = blocs[blocs.length - 1];
    const type = typeDe(dernier) === 'img' ? 'txt' : 'img';
    await E.creer(liste, E.rang(dernier.path) + 1, INAUG[type], 'Temps fort ' + (blocs.length + 1));
    blocs = inaugures(E).blocs;
    log(`bloc ${blocs.length} créé (${type === 'img' ? 'image à gauche' : 'image à droite'})`);
  }
  const ecarts = [];
  for (const [i, t] of plan.entries()) {
    const p = blocs[i].path;
    const vals = valeursBloc(t, urls[i], i === plan.length - 1);
    await E.ecrire(p, vals);
    const relu = await E.valeurs(p);
    const diff = Object.keys(vals).filter(k => norm(relu[k]) !== norm(vals[k]));
    if (diff.length) ecarts.push({n: i + 1, titre: t.titre, champs: diff});
    log(`bloc ${i + 1} ${diff.length ? 'écrit, à vérifier : ' + diff.join(', ') : 'écrit'} : ${t.titre}`);
  }
  const enTrop = blocs.slice(plan.length);
  if (enTrop.length && options.garderEnTrop) log(`${enTrop.length} bloc(s) en trop laissé(s) en place`);
  else for (const x of enTrop) {
    await E.supprimer(x.path);
    log(`bloc en trop retiré : ${x.txt.slice(0, 40)}`);
  }

  await E.refresh();
  const fin = inaugures(E).blocs;
  return {message: idm, blocs: fin.length, ecarts, images: urls, journal: [...journal], sauvegarde_avant: avant,
    rappel: 'Recharger l\'éditeur DI (F5) avant d\'y toucher : il ne voit pas les modifications faites par le script.'};
}

// Un remplissage complet dure plusieurs minutes, plus que l'attente d'un appel Claude in Chrome (45 s) :
// lancer() rend la main tout de suite, suivi() dit où on en est.
let tache = null;

export function lancer(idm, plan, options) {
  if (tache && tache.etat === 'en cours') throw new Error('Un remplissage est déjà en cours.');
  tache = {etat: 'en cours', debut: Date.now()};
  remplir(idm, plan, options)
    .then(r => Object.assign(tache, {etat: 'fini', rapport: r}))
    .catch(e => Object.assign(tache, {etat: 'erreur', erreur: e.message}));
  return 'lancé';
}

export function suivi() {
  if (!tache) return {etat: 'rien'};
  return {etat: tache.etat, secondes: Math.round((Date.now() - tache.debut) / 1000), journal: [...journal],
    rapport: tache.rapport, erreur: tache.erreur};
}

// ------------------------------------------------------------------ planche des images candidates

// Affiche sur la page toutes les images possibles de chaque temps fort (photos, pages de document,
// trois plans de la vidéo), numérotées « 2.c ». Claude la regarde en capture d'écran et choisit.
let candidats = {};

export async function planche(tempsForts) {
  fermerPlanche();
  candidats = {};
  const box = document.createElement('div');
  box.id = 'vl-planche';
  box.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#fff;overflow:auto;padding:10px;font:13px/1.3 Arial,sans-serif';
  document.body.appendChild(box);
  for (const [i, t] of tempsForts.entries()) {
    const sources = [...(t.images || []).map(x => ({url: x.url})), ...(t.doc_pages || []).slice(0, 3).map(url => ({url}))];
    if (t.video) {
      const d = (t.video.duree_ms || 30000) / 1000;
      for (const f of [0.15, 0.4, 0.7]) sources.push({video: t.video.url, t: Math.round(d * f)});
    }
    const ligne = document.createElement('div');
    ligne.style.cssText = 'display:flex;gap:6px;align-items:flex-start;margin-bottom:8px;border-bottom:1px solid #ddd;padding-bottom:6px';
    ligne.innerHTML = `<div style="width:110px;flex:none"><b>${i + 1}</b> ${t.page || t.titre || ''}</div>`;
    box.appendChild(ligne);
    for (const [k, s] of sources.slice(0, 8).entries()) {
      const code = `${i + 1}.${'abcdefgh'[k]}`;
      candidats[code] = s;
      const fig = document.createElement('figure');
      fig.style.cssText = 'margin:0;width:150px;flex:none';
      try {
        const a = await apercu(s);
        fig.innerHTML = `<img src="${a.dataUrl}" style="width:150px;height:110px;object-fit:contain;background:#eee"><figcaption><b>${code}</b> ${s.video ? 'vidéo ' + s.t + ' s' : a.w + 'x' + a.h}</figcaption>`;
      } catch (e) {
        fig.innerHTML = `<div style="width:150px;height:110px;background:#fdd"></div><figcaption><b>${code}</b> illisible</figcaption>`;
      }
      ligne.appendChild(fig);
    }
  }
  return Object.keys(candidats);
}

export function candidat(code) {
  if (!candidats[code]) throw new Error('Image inconnue : ' + code);
  return {...candidats[code]};
}

export function fermerPlanche() {
  const b = document.getElementById('vl-planche');
  if (b) b.remove();
}

export const _interne = {Editeur, arbre, corps, entites, preparer, verser, inaugures};

window.VLDI = {etat, selection, apercu, planche, candidat, fermerPlanche, remplir, lancer, suivi, _interne};
