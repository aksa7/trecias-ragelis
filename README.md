# BustedAI (Trečias ragelis)

BustedAI — AI sargas telefono linijoje: klausosi pokalbio, realiu laiku transkribuoja lietuvišką kalbą, vertina sukčiavimo riziką, kylant rizikai įspėja auką balsu ir siunčia SMS artimajam, o viską gyvai rodo dashboarde.

## Dokumentacija

- [Architektūra](docs/ARCHITECTURE.md) — kaip veikia sistema
- [Būsena ir darbai](docs/STATUS.md) — kas padaryta ir kas toliau
- [AGENTS.md](AGENTS.md) — taisyklės ir atsakomybės
- [Dashboardas](web/README.md) — kaip paleisti web/

## Greitas startas

```bash
git clone https://github.com/aksa7/trecias-ragelis.git
cd trecias-ragelis
npm install
cp .env.example .env
cd web && npm install && npm run dev
```

Atidarykite http://localhost:5173/?offline ir spauskite **D** (demo meniu) arba **1–4**.
