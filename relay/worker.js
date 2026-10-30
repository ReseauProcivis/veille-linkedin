/*
 * Relais Veille LinkedIn — Cloudflare Worker (même principe que relay/worker.js de veille-ush-presse).
 *
 * Rôle : recevoir de index.html (page publique, sans secret) le scan de la semaine, la sélection validée
 * ou la liste des pages modifiée, et les enregistrer dans le dépôt GitHub :
 *   action "data"      -> data/AAAA-MM-JJ.json + data/latest.json
 *   action "selection" -> selections/AAAA-MM-JJ.json + selections/latest.json
 *   action "pages"     -> pages.json
 *
 * Le jeton GitHub est un SECRET du Worker (GH_TOKEN) : il ne quitte jamais le serveur.
 * Déploiement : dashboard Cloudflare → Workers → Create → coller ce code →
 * Settings → Variables → GH_TOKEN (type "Secret") = PAT fine-grained, Contents: Read and write
 * sur le seul dépôt veille-linkedin. Puis mettre l'URL du Worker dans config.json ("relais").
 */

const REPO = 'maxtaillebois/veille-linkedin';
const ALLOWED_ORIGIN = 'https://maxtaillebois.github.io';
const MAX_OCTETS = 3 * 1024 * 1024;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    const reponse = (texte, status) => new Response(texte, { status, headers: cors });

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return reponse('Method Not Allowed', 405);
    // N'accepter que les requêtes venant de la page de veille.
    if (request.headers.get('Origin') !== ALLOWED_ORIGIN) return reponse('Origine non autorisée', 403);

    const brut = await request.text();
    if (brut.length > MAX_OCTETS) return reponse('Trop volumineux', 413);
    let payload;
    try {
      payload = JSON.parse(brut);
    } catch {
      return reponse('JSON invalide', 400);
    }
    const { action, contenu } = payload;
    if (!contenu || typeof contenu !== 'object') return reponse('Contenu manquant', 400);

    let fichiers, message;
    if (action === 'data') {
      if (!DATE.test(contenu.date) || !Array.isArray(contenu.resultats)) return reponse('Scan invalide', 400);
      fichiers = [`data/${contenu.date}.json`, 'data/latest.json'];
      message = `Scan du ${contenu.date} (${contenu.resultats.length} pages)`;
    } else if (action === 'selection') {
      if (!DATE.test(contenu.date) || !Array.isArray(contenu.temps_forts) || !contenu.temps_forts.length) return reponse('Sélection invalide', 400);
      fichiers = [`selections/${contenu.date}.json`, 'selections/latest.json'];
      message = `Sélection du ${contenu.date} (${contenu.temps_forts.length} temps forts)`;
    } else if (action === 'pages') {
      const pages = contenu.pages;
      const ok = Array.isArray(pages) && pages.length > 0 && pages.every(p =>
        p && typeof p.nom === 'string' && /^https:\/\/www\.linkedin\.com\/(company|showcase)\//.test(p.url) &&
        typeof p.slug === 'string' && (p.statut === 'suivie' || p.statut === 'dormante'));
      if (!ok) return reponse('Liste de pages invalide', 400);
      fichiers = ['pages.json'];
      message = `Liste des pages (${pages.length} pages)`;
    } else {
      return reponse('Action inconnue', 400);
    }

    const gh = {
      'Authorization': `token ${env.GH_TOKEN}`,
      'User-Agent': 'veille-linkedin-relay',
      'Accept': 'application/vnd.github+json',
    };
    const texte = JSON.stringify(contenu, null, 1);
    const base64 = btoa(unescape(encodeURIComponent(texte)));

    for (const chemin of fichiers) {
      const url = `https://api.github.com/repos/${REPO}/contents/${chemin}`;
      // Récupérer le sha si le fichier existe déjà (sinon création).
      let sha = null;
      const lu = await fetch(url, { headers: gh });
      if (lu.ok) sha = (await lu.json()).sha;
      const corps = { message, content: base64 };
      if (sha) corps.sha = sha;
      const ecrit = await fetch(url, {
        method: 'PUT',
        headers: { ...gh, 'Content-Type': 'application/json' },
        body: JSON.stringify(corps),
      });
      if (!ecrit.ok) {
        const err = await ecrit.text();
        return reponse('Erreur GitHub sur ' + chemin + ' : ' + err.slice(0, 300), 502);
      }
    }

    return new Response(JSON.stringify({ ok: true, fichiers }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  },
};
