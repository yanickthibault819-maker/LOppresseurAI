# L'OppresseurAI — FULL (Gemini • Vercel)

## Features
- Onglets: Générateur, Bibliothèque (IndexedDB illimitée), Templates 30+, Éditeur, Comparaison, Stats
- Génération: 1 passe / 2 passes (stratégie -> écriture) / Freestyle
- Session Studio: champs Projet + Track
- Exports: txt, json, export bundle de la bibliothèque
- Achievements (10) + dashboard
- 3 thèmes visuels: classic / ice / blood
- Raccourcis: Ctrl+Enter (générer), Ctrl+S (save editor), Ctrl+K (recherche)

## Endpoints
- `GET /api/models` -> liste des modèles Gemini (teste la clé)
- `POST /api/generate` -> génération (generateContent)

## Déploiement Vercel
1) Push ce dossier dans GitHub
2) Import sur Vercel
3) Settings -> Environment Variables:
   - `GEMINI_API_KEY` = ta clé (Google AI Studio)
4) Redeploy

## Notes
- La clé n'est jamais dans le front.
- Si "liste vide", vérifier quota / logs Vercel / clé.
