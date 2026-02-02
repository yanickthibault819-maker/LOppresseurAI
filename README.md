# L'Oppresseur AI v2.2 (Vercel + GitHub)

Ce projet est une version **stable pour Vercel** (front-end + API serverless) :
- Interface HTML/JS (même look)
- Onglet **🔑 api** pour tester les clés et détecter les modèles disponibles
- Les appels Gemini/OpenAI/Claude passent par `/api/*` (plus de CORS, plus stable)

## 1) Prérequis (débutant)

- Un compte **GitHub**
- Un compte **Vercel**
- Git installé sur Windows
- (Optionnel) Node.js installé si tu veux tester en local

## 2) Mettre le projet sur GitHub (pas à pas)

### A. Créer un repo GitHub
1. Va sur GitHub → bouton **New** (nouveau repo)
2. Nom: `lopresseur-ai-v2-2`
3. Choisis **Private** (recommandé)
4. Clique **Create repository**

### B. Mettre les fichiers du ZIP dans ton dossier
1. Dézippe ce projet dans `C:\LOppresseurAI\`
2. Tu dois voir `index.html`, `api/`, `vercel.json`, etc.

### C. Initialiser Git et pousser sur GitHub
Ouvre **PowerShell** dans le dossier du projet.

> Si tu as déjà un remote `origin` (erreur "remote origin already exists"), suis la section “Fix origin”.

Commandes :
```powershell
cd C:\LOppresseurAI
git init
git add .
git commit -m "deploy v2.2"
git branch -M main
git remote add origin https://github.com/<TON_USER>/<TON_REPO>.git
git push -u origin main
```

#### Fix origin (si “remote origin already exists”)
```powershell
git remote -v
git remote set-url origin https://github.com/<TON_USER>/<TON_REPO>.git
git push -u origin main
```

Pour voir ton URL GitHub :
- Sur la page du repo, l’URL dans la barre d’adresse est ton URL.
- Exemple: `https://github.com/yanickthibault819-maker/lopresseur-ai-v2-2`

## 3) Déployer sur Vercel (pas à pas)

### A. Importer le repo
1. Va sur Vercel → **Add New…** → **Project**
2. **Import Git Repository**
3. Connecte GitHub si demandé
4. Choisis ton repo `lopresseur-ai-v2-2`
5. Clique **Deploy**

### B. Ajouter les clés API dans Vercel (.env)
1. Dans Vercel → ton projet → **Settings** → **Environment Variables**
2. Ajoute :
   - `GEMINI_API_KEY` = ta clé Gemini
   - `OPENAI_API_KEY` = ta clé OpenAI (optionnel)
   - `ANTHROPIC_API_KEY` = ta clé Claude (optionnel)
3. Clique **Save**
4. Re-deploy (Vercel → Deployments → **Redeploy**)

### C. Vérifier que ça marche
- Va sur l’URL Vercel
- Onglet **🔑 api** → clique **tester** sur Gemini
- Tu devrais voir “ok: X modèles détectés”
- Retourne sur Générateur → choisis un modèle et génère

## 4) Développement local (optionnel)
Tu peux lancer un serveur local simple (sans Node) :
- Installe l’extension VS Code “Live Server” et lance `index.html`

Pour tester les endpoints `/api`, le plus simple est d’utiliser Vercel (car les serverless fonctions tournent là-bas).

## 5) Notes importantes
- Ne mets **jamais** tes clés directement dans `index.html` ou dans GitHub.
- Utilise Vercel Env Vars.
- L’onglet 🔑 api accepte une clé “override” (stockée dans ton navigateur) si tu veux tester rapidement — mais en prod, mieux = env vars.

Bon build 🤝


## Vercel env (obligatoire)

- GEMINI_API_KEY = ta clé Google Gemini (Generative Language API)
- (optionnel) OPENAI_API_KEY
- (optionnel) CLAUDE_API_KEY

L'app ne demande plus les clés dans l'interface: tout passe par les variables d'environnement Vercel.
