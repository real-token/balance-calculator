# 📋 PLAN_MIGRATION_V3.md

## 1. **Objectif**

Migrer la logique d'analyse des positions V3 (Uniswap/SushiSwap) du projet Python vers le projet TypeScript, afin de générer des fichiers JSON et CSV détaillant les positions V3 pour le calcul du pouvoir de vote.

---

## 2. **Analyse des besoins et des dépendances**

### a. **Données à extraire**

- Adresse du propriétaire (`owner`)
- ID de la position (`positionId`)
- Pool (`poolId`)
- Bornes de prix (`tickLower`, `tickUpper`)
- Montants de tokens (`adjusted_amount0`, `adjusted_amount1`)
- Symboles et décimales des tokens
- Statut de la position (active/inactive)
- Calculs d'équivalents REG pour chaque token
- Détails du pool (prix courant, feeTier, etc.)

### b. **Modules/fonctions à migrer ou adapter**

- Extraction et formatage des positions V3 (déjà présents dans `src/utils/queryDexs.ts`)
- Calcul d'équivalent REG (`calculateTokenEquivalentTypeUniV3`)
- Génération de fichiers JSON/CSV (`jsonToCsv` dans `src/utils/lib.ts`)
- Point d'intégration : `taskGetBalancesREG` (dans `src/tasks/GetBalancesREG.ts`)

### c. **Compatibilité**

- Les fonctions critiques existent déjà en TypeScript, il s'agit surtout d'orchestration et d'export.
- Les exports CSV utilisent déjà une fonction générique (`jsonToCsv`).

---

## 3. **Étapes d'intégration**

### **Étape 1 : Génération des données de positions V3**

- Ajouter dans `taskGetBalancesREG` un appel à la récupération des positions V3 pour chaque pool concerné (via `getRegBalancesTypeUniV3` ou équivalent).
- Stocker les résultats dans un fichier JSON dédié (ex : `positionsV3Details.json`).

### **Étape 2 : Export CSV**

- Utiliser la fonction `jsonToCsv` pour générer un fichier CSV à partir du JSON des positions V3.
- Sauvegarder le CSV dans le même dossier que les autres exports.

### **Étape 3 : Adaptation du calcul du pouvoir de vote**

- Lors de l'appel à la tâche de calcul du pouvoir de vote, lire le fichier JSON des positions V3.
- Ajouter un "modificateur" ou une logique conditionnelle pour intégrer ces données dans le calcul du pouvoir de vote (ex : pondération, exclusion, etc.).

### **Étape 4 : Documentation et validation**

- Documenter chaque étape, les structures de données, et les points d'intégration dans ce fichier.
- Prévoir des tests unitaires et d'intégration pour valider l'extraction, l'export et l'utilisation des données V3.

---

## 4. **Points d'attention & vérifications**

- **Vérifier la cohérence des données** entre les exports JSON et CSV.
- **S'assurer de la compatibilité** des types et des structures entre les modules existants et les nouvelles données.
- **Gérer les cas d'erreur** (ex : absence de positions, données incomplètes, erreurs d'API).
- **Respecter la structure actuelle** du projet pour faciliter la maintenance.

---

## 5. **Prochaines actions**

1. Créer un module/fonction pour l'export des positions V3 (JSON + CSV).
2. Intégrer l'appel à cette fonction dans `taskGetBalancesREG`.
3. Adapter la logique de calcul du pouvoir de vote pour exploiter ces données.
4. Documenter et tester chaque étape.

---

# ✅ Double vérification

- **Les fonctions critiques existent déjà** (extraction, calcul, export).
- **Aucune dépendance majeure manquante** pour la migration.
- **Le plan respecte la structure actuelle** et minimise les modifications.

---
