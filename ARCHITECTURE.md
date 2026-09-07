# CaféStock — Architecture

Application de bureau Windows (offline) pour la vente de fournitures et consommables pour cafés.

## 1. Objectif

Gérer le flux métier :

**Entrée stock → Stock → Vente → Paiement → Caisse → Profit → Rapports → Facture**

Un seul utilisateur, un seul PC. Aucun module fournisseurs. Aucun module dépenses.

## 2. Structure du dépôt

```
/
  ARCHITECTURE.md
  package.json                  # npm workspaces
  apps/
    api/                        # NestJS + Prisma
    desktop/                    # Electron + React (Vite)
      electron/                 # process principal + preload
      renderer/                 # UI React
  packages/
    shared/                     # types, enums, formatage, constantes
```

Le frontend **n’accède jamais** à SQLite. Toutes les opérations passent par l’API NestJS.

## 3. Flux technique

```
Electron (main)
  → démarre NestJS en local (127.0.0.1)
  → fenêtre React (renderer isolé)
       → HTTP / TanStack Query
            → NestJS (contrôleurs, services, DTO)
                 → Prisma
                      → SQLite (AppData)
```

- **Développement** : API sur `http://127.0.0.1:47821`, Vite + Electron.
- **Production** : le process Electron démarre l’API, pose `DATABASE_URL` vers le fichier SQLite utilisateur, puis charge l’UI packagée.

## 4. Electron et sécurité

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true` sur la fenêtre
- Preload via `contextBridge` uniquement pour :
  - URL de l’API
  - impression / ouverture de PDF
  - chemins de backup (dialogues natifs, pas d’API filesystem libre)
- Pas d’accès Node, Prisma ou disque depuis React.

## 5. Emplacement des données

| Donnée | Emplacement |
|---|---|
| Base SQLite | `app.getPath('userData')/data/cafestock.db` |
| Backups | `app.getPath('userData')/backups/` |
| PDF factures | `app.getPath('userData')/invoices/` |
| Secret JWT | `app.getPath('userData')/config.json` (généré au premier lancement) |

En développement : `apps/api/prisma/dev.db` (jamais utilisé comme base de production).

**SQLite spécifique (à isoler lors d’une migration PostgreSQL) :**

- URL Prisma `file:...`
- Copie fichier pour backup/restore (PostgreSQL utilisera dump/restore)
- WAL : `PRAGMA journal_mode=WAL` au démarrage pour la robustesse locale
- Compteurs de documents mis à jour dans la même transaction Prisma (pas de séquence PostgreSQL)

Le reste du schéma (relations, enums Prisma, décimaux, UUID/CUID) est volontairement portable.

## 6. Stratégie base de données

- Accès **uniquement** via Prisma.
- Pas de SQL métier brut.
- IDs `cuid()`.
- Montants et quantités en `Decimal` (millimes / 3 décimales).
- Index sur SKU, code-barres, numéro de facture, dates, `clientId`.
- Une migration PostgreSQL future : changer le `provider`, l’URL, et remplacer backup fichier par `pg_dump`. Frontend et services métier inchangés.

## 7. Coût moyen pondéré (CMP) — profit historique

**Règle :** le coût utilisé pour une vente est **figé sur la ligne** (`SaleItem.unitCost`) au moment de la vente. Changer le prix d’achat ensuite ne recalcule **jamais** les anciennes ventes.

### Mise à jour du CMP (entrée de stock)

Pour un produit :

```
stockAvant, coûtAvant = Product.currentStock, Product.purchasePrice
quantitéEntrée, prixEntrée = ligne d’entrée

si stockAvant + quantitéEntrée = 0 → CMP inchangé
sinon CMP = (stockAvant * coûtAvant + quantitéEntrée * prixEntrée)
            / (stockAvant + quantitéEntrée)

Product.purchasePrice ← CMP
Product.currentStock  ← stockAvant + quantitéEntrée
```

### Vente

```
revenuLigne = qté * prixVente
coûtLigne   = qté * Product.purchasePrice   // CMP courant, puis snapshot
profitLigne = revenuLigne - coûtLigne
```

### Retour client

Le stock revient ; le profit de la vente est diminué avec le **`unitCost` historique** de la ligne, pas le CMP actuel.

Le CMP produit **n’est pas recalculé** au retour (évite de fausser le coût moyen). Documenté : choix v1.

### Ajustement / perte

Mouvement `ADJUSTMENT` ou `LOSS`. Le CMP n’est pas modifié (sauf entrée d’achat).

## 8. Mouvements de stock

Aucun changement de stock silencieux. Types :

| Type Prisma | Sens | Origine |
|---|---|---|
| `ENTRY` | + | Entrée stock |
| `SALE` | − | Vente validée |
| `CUSTOMER_RETURN` | + | Retour |
| `LOSS` | − | Perte explicite |
| `ADJUSTMENT` | +/− | Inventaire |

Chaque mouvement enregistre : produit, qté, type, stock avant/après, motif, référence, date.

## 9. Vente transactionnelle

Une seule transaction Prisma :

1. Vérifier le stock (refus si insuffisant).
2. Créer `Sale` + `SaleItem` (coût snapshot).
3. Décrémenter le stock + mouvements `SALE`.
4. Paiement éventuel + `CashTransaction` si espèces.
5. Numéro de facture unique + `Invoice`.
6. Totaux : CA, coût, profit, payé, reste.

Échec → rollback intégral.

**Suppression de vente interdite.** Annulation via retours.

## 10. Paiements et soldes client

- Statuts : `UNPAID` | `PARTIAL` | `PAID`
- `remaining = total - sum(paiements) + sum(remboursements)`
- Client optionnel (« Vente comptoir »).
- Solde client = somme des restes des ventes du client.

Moyens : Espèces, Chèque, Virement, Autre.

## 11. Caisse

Pas de module dépenses. Solde indicatif :

```
ouverture (paramètre) + encaissements espèces − remboursements espèces
```

Historique via `CashTransaction`.

## 12. Factures

- Numéro `FAC-YYYY-00001` (compteur atomique en transaction).
- PDF généré côté API (PDFKit).
- Electron ouvre / imprime le fichier.

## 13. Backup / restore

1. **Backup** : copie cohérente du fichier SQLite (checkpoint WAL si besoin) vers `backups/`.
2. **Restore** : valider le fichier → backup de sécurité de la base actuelle → remplacer.
3. **Auto-backup** : option dans les paramètres (copie quotidienne au démarrage si activée).

Spécifique SQLite (à remplacer pour PostgreSQL).

## 14. Auth

- Rôle `ADMIN` (extensible).
- Mot de passe `bcrypt`.
- JWT court, secret local.
- Compte initial : `admin` / `admin123` (à changer dans Paramètres).

## 15. Modules NestJS

`auth`, `products`, `categories`, `clients`, `sales`, `payments`, `stock`, `stock-entries`, `invoices`, `cash`, `reports`, `settings`, `backup`

Règles métier **uniquement** dans les services, pas dans React.

## 16. Frontend

- React + Vite + TypeScript strict
- React Router, TanStack Query, RHF + Zod
- Tailwind + shadcn/ui + Lucide
- Thème clair/sombre persisté (`localStorage`)
- UI **française**, devise **DT**, format `125.500 DT`
- Vente clavier / douchette (le scanner agit comme un clavier)

## 17. Packaging

Electron Builder → installeur Windows NSIS. L’API compilée et le moteur Prisma sont des ressources extra.

## 18. Décisions v1

- Quantités décimales (cartons, lots).
- Remise globale optionnelle sur la vente (`discountAmount`).
- Inventaire = `ADJUSTMENT` (jamais un update brut).
- Perte stock depuis mouvements / inventaire, pas un module séparé.
- Un seul magasin / une seule caisse.
- Thème : gris neutre + accent bleu ardoise.
