# CaféStock

Application Windows de bureau **hors ligne** pour la vente de fournitures et consommables pour cafés.

## Démarrage (développement)

```bash
npm install
npm run build:shared
npm run prisma:migrate -w @cafestock/api
npm run prisma:seed -w @cafestock/api
npm run dev
```

Compte initial : `admin` / `admin123`

- API : `http://127.0.0.1:47821/api`
- Interface Electron + Vite

## Production (installeur Windows)

```bash
npm run build
npm run pack -w @cafestock/desktop
```

L’installeur NSIS est généré dans `apps/desktop/release`.

En production, la base SQLite est dans `%APPDATA%/CaféStock/data/cafestock.db`.

## Architecture

Voir [ARCHITECTURE.md](./ARCHITECTURE.md).
