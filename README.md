# Votons Proche 🗺️

**Plateforme Électorale Nationale du Cameroun**  
Hackathon VotonsProche · 18 Avril 2026

> Permettre à chaque citoyen camerounais de trouver rapidement son bureau de vote ou point d'enregistrement ELECAM le plus proche.

---

## Fonctionnalités

| Critère | Statut |
|---|---|
| Localiser les bureaux de vote par ville / arrondissement | ✅ |
| Afficher les points d'enregistrement ELECAM sur la carte | ✅ |
| Recherche par quartier, ville ou arrondissement | ✅ |
| Suggérer les 10 points les plus proches si lieu introuvable | ✅ |
| Téléchargement CSV des résultats filtrés | ✅ (bonus) |
| Tableaux de bord analytiques (participation, partis, capacité) | ✅ (bonus) |
| Identité visuelle aux couleurs officielles du Cameroun | ✅ |
| Déploiement en ligne (Netlify / Vercel) | ✅ |

---

## Stack technique

- **React 18.3.1** UMD + Babel Standalone (aucun build requis)
- **Leaflet 1.9.4** + MarkerCluster — carte interactive
- **Chart.js 4.4.0** — graphiques analytiques
- **Données** : CSV ELECAM & Bureaux de vote (Yaoundé + Douala)
- **Performance** : `data/bundle.json` pré-compilé (1 requête au lieu de 4)

---

## Lancer en local

> **Prérequis** : Python 3 ou Node.js installé.

### Option A — Python (recommandé, inclus sur macOS/Linux)

```bash
cd hackathonV1
python3 -m http.server 8080
```

Ouvrir : [http://localhost:8080](http://localhost:8080)

### Option B — Node.js (npx serve)

```bash
cd hackathonV1
npx serve .
```

Ouvrir l'URL affichée dans le terminal (généralement http://localhost:3000).

### Option C — Extension VS Code

Installer **Live Server** (Ritwick Dey) → clic droit sur `index.html` → *Open with Live Server*.

> ⚠️ Ne pas ouvrir `index.html` directement dans le navigateur (file://) — les requêtes fetch vers les CSV/JSON seront bloquées par CORS.

---

## Pré-compiler le bundle JSON (optionnel, déjà généré)

Si vous modifiez les CSV, régénérez `data/bundle.json` :

```bash
node build_data.js
```

Cela fusionne les 4 fichiers CSV en un JSON unique (~6 MB) pour un chargement 3× plus rapide.

---

## Structure du projet

```
hackathonV1/
├── index.html              # Point d'entrée principal
├── App.jsx                 # Composant racine React
├── Sidebar.jsx             # Panneau latéral (liste, analyse, filtres, import)
├── Analytics.jsx           # Tableaux de bord Chart.js
├── MapView.jsx             # Carte Leaflet
├── Detail.jsx              # Fiche détail d'un point
├── icons.jsx               # Icônes SVG
├── data.js                 # Chargement et parsing CSV/JSON
├── cameroon_locations.js   # Base GPS des quartiers camerounais (143 lieux)
├── app.css                 # Styles (couleurs officielles Cameroun)
├── build_data.js           # Script Node.js pour compiler bundle.json
├── data/
│   ├── bundle.json                    # Bundle pré-compilé (rapide)
│   ├── PointsELECAM_Yaounde.csv
│   ├── PointsELECAM_Douala.csv
│   ├── BureauxDeVote_Yaounde.csv
│   └── BureauxDeVote_Douala.csv
├── netlify.toml            # Configuration Netlify
└── vercel.json             # Configuration Vercel
```

---

## Déploiement en ligne

### Netlify (le plus simple)

1. Aller sur [netlify.com](https://netlify.com) → *Add new site* → *Deploy manually*
2. Glisser-déposer le dossier `hackathonV1/`
3. Le site est en ligne en ~30 secondes

### Vercel

```bash
npm i -g vercel
cd hackathonV1
vercel --prod
```

---

## Données

- **~3 800** points ELECAM (Yaoundé + Douala)
- **~4 900** bureaux de vote (Yaoundé + Douala)
- **143** quartiers/arrondissements camerounais géolocalisés (toutes régions)
- Source : fichiers CSV fournis par l'organisation VotonsProche

---

## Équipe

Hackathon VotonsProche · 18 Avril 2026  
Contact soumission : audrey-jordan.souop@talent-tally.com
