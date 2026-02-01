# L'Oppresseur AI v2.2 — Vercel + GitHub (stable)

Cette version est faite pour **Vercel** avec des **API Routes** (`/api/*`) afin d'éviter les erreurs CORS quand tu utilises Gemini/OpenAI/Claude.

## 1) Ce que tu dois avoir
- Un compte **GitHub**
- Un compte **Vercel**
- (Optionnel) **Node.js** installé sur ton PC si tu veux tester localement (pas obligatoire)

## 2) Mettre le projet sur GitHub (débutant)
1. Dézippe ce projet dans un dossier (ex: `C:\LOppresseurAI\`).
2. Ouvre le dossier, vérifie que tu vois:
   - `index.html`
   - `L_Oppresseur_AI_v2.2_DATA.js`
   - `L_Oppresseur_AI_v2.2_LOGIC.js`
   - dossier `api/`
   - `vercel.json`
3. Va sur GitHub → **New repository**
   - Name: `loppresseur-ai-v2-2`
   - Private (recommandé)
   - Create repository
4. Dans ton dossier, ouvre PowerShell et lance:

```powershell
cd C:\LOppresseurAI

git init

git add .

git commit -m "deploy v2.2"

git branch -M main

git remote add origin https://github.com/<TON_USER>/<TON_REPO>.git

git push -u origin main
```

Si tu as l'erreur **"remote origin already exists"**:
```powershell
git remote -v
# puis:
git remote set-url origin https://github.com/<TON_USER>/<TON_REPO>.git

git push -u origin main
```

## 3) Déployer sur Vercel (débutant)
1. Va sur Vercel → **Add New** → **Project**
2. **Import Git Repository** → sélectionne ton repo GitHub
3. Framework Preset: **Other**
4. Laisse les champs par défaut puis clique **Deploy**

## 4) Ajouter tes clés API dans Vercel (.env côté serveur)
Dans Vercel → ton projet → **Settings** → **Environment Variables**:
- `GEMINI_API_KEY` = ta clé Google
- `OPENAI_API_KEY` = ta clé OpenAI
- `ANTHROPIC_API_KEY` = ta clé Claude/Anthropic

Ensuite **Redeploy** (ou pousse un commit pour relancer le build).

## 5) Vérifier que l'API marche
Une fois déployé, ouvre:
- `https://TON-DOMAINE.vercel.app/api/health`
Tu dois voir un JSON `{ ok: true, ... }`.

## 6) Utilisation dans l'app
- Onglet **🔑 api** → tu peux:
  - tester ta clé et lister les modèles disponibles
  - choisir un modèle dans le menu déroulant
- Onglet **générateur** → génère en 2 passes.

## Notes importantes
- Les clés mises dans Vercel sont **cachées** côté serveur.
- Si tu colles une clé directement dans l'app (mode dev), elle est stockée en localStorage (donc visible sur ton navigateur). Préfère Vercel env.

