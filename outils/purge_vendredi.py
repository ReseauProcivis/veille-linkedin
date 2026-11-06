#!/usr/bin/env python3
"""Purge du vendredi de la veille LinkedIn : chaque vendredi à 5 h 30 (heure de Paris).

Lancé par .github/workflows/purge-vendredi.yml. Remplace data/latest.json (le scan) et selections/latest.json
(la sélection validée) par une marque de purge quand ils datent d'avant le dernier vendredi 5 h 30.
Les archives datées (data/AAAA-MM-JJ.json, selections/AAAA-MM-JJ.json) restent dans le dépôt.

Sans effet si la purge est déjà faite ou si un scan a eu lieu après 5 h 30 : on peut le relancer sans risque.
La page (index.html) et le script DI (di/temps-forts.js) appliquent la même règle de leur côté.
"""
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

PARIS = ZoneInfo('Europe/Paris')
RACINE = Path(__file__).resolve().parent.parent


def derniere_purge(maintenant):
    """Le dernier vendredi 5 h 30, heure de Paris, au plus tard maintenant."""
    m = maintenant.astimezone(PARIS)
    seuil = m.replace(hour=5, minute=30, second=0, microsecond=0) - timedelta(days=(m.weekday() - 4) % 7)
    if seuil > m:
        seuil -= timedelta(days=7)
    return seuil


def iso_js(d):
    """Même format que toISOString() côté page : la page compare ces dates comme des chaînes."""
    d = d.astimezone(timezone.utc)
    return d.strftime('%Y-%m-%dT%H:%M:%S.') + f'{d.microsecond // 1000:03d}Z'


def purger(chemin, champ, vide, maintenant, seuil):
    f = RACINE / chemin
    if not f.exists():
        print(f'{chemin} : absent.')
        return
    d = json.loads(f.read_text(encoding='utf-8'))
    if d.get('purge'):
        print(f'{chemin} : déjà purgé.')
        return
    quand = d.get(champ)
    if quand and datetime.fromisoformat(quand.replace('Z', '+00:00')) >= seuil:
        print(f'{chemin} : {d.get("date")}, fait après la purge, gardé.')
        return
    marque = {'purge': True, 'purge_le': seuil.strftime('%Y-%m-%d %H:%M'), 'date': d.get('date'), champ: iso_js(maintenant)}
    if champ == 'genere':   # garde de quoi savoir si les pages dormantes ont été lues ce mois-ci
        marque['dormantes_scannees'] = bool(d.get('dormantes_scannees'))
    marque.update(vide)
    f.write_text(json.dumps(marque, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'{chemin} : {d.get("date")} purgé.')


def main():
    maintenant = datetime.now(timezone.utc)
    seuil = derniere_purge(maintenant)
    print('Purge du', seuil.strftime('%Y-%m-%d à %H:%M'), '(heure de Paris)')
    purger('data/latest.json', 'genere', {'resultats': []}, maintenant, seuil)
    purger('selections/latest.json', 'valide', {'temps_forts': []}, maintenant, seuil)


if __name__ == '__main__':
    main()
