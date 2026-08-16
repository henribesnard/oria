# PATHS.md -- Mission 0 : Reconnaissance

**Date** : 2026-08-15T17:15:00Z
**Auteur** : Claude Code (Opus 4.6)
**Branche** : `main` @ `b2ee0ee`
**Appels API-Football consommes pendant la reconnaissance** : 1 (via `GET /catalog/fixtures/live` qui a declenche un appel `fixtures?live=all`)

---

## A. Racines

| Element | Attendu | Resolu | Statut |
|---|---|---|---|
| Racine du repo | -- | `C:\Users\henri\Projets\oria` | OK |
| Branche git | main | `main` @ `b2ee0ee` | OK |
| Etat git | propre | 2 fichiers modifies (`.claude/settings.local.json`), 4 untracked (fichiers temp, `oria.db-shm`, `oria.db-wal`, `nul`) | **Pas propre** |
| Layout source | `src/oria/` | `C:\Users\henri\Projets\oria\src\oria\` | OK |
| Repertoire de travail courant | -- | `/c/Users/henri/Projets/oria` (MSYS2/Git Bash) | OK |
| OS | -- | Windows (win32), shell MSYS2/Git Bash, separateur `\` | **Windows** |

**Note OS** : le protocole suppose des chemins POSIX. Tous les chemins dans ce document sont donnes en notation Windows (`\`). Les modules Python utilisent `pathlib.Path`, donc la portabilite est assuree en interne. Le harness devra utiliser `Path` systematiquement et jamais de chemins en dur avec `/`.

---

## B. Configuration et secrets

### Fichiers de configuration

| Fichier | Chemin absolu | Statut |
|---|---|---|
| `.env` | `C:\Users\henri\Projets\oria\.env` | Existe (1 259 octets) |
| `.env.example` | `C:\Users\henri\Projets\oria\.env.example` | Existe (842 octets) |

### Resolution du `.env` par Settings

La classe `Settings` (`src/oria/config.py:8`) herite de `pydantic_settings.BaseSettings` avec :
```python
model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}
```
Le `.env` est resolu **relativement au CWD** du processus, pas relativement au fichier `config.py`. En pratique, uvicorn est lance depuis la racine du repo, donc `./. env` pointe bien vers `C:\Users\henri\Projets\oria\.env`.

### Variables d'environnement

| Variable | Present | Valeur (si non-secret) |
|---|---|---|
| `APIFOOTBALL_KEY` | present | *(secret)* |
| `DEEPSEEK_API_KEY` | present | *(secret)* |
| `JWT_SECRET` | present | *(secret)* |
| `ADMIN_TOKEN` | present | *(secret)* |
| `ADMIN_BOOTSTRAP_TOKEN` | **absent** | -- |
| `DB_PATH` | present | `./oria.db` |
| `ENABLE_LLM` | present | `true` |
| `ENABLE_LIVE` | present | `false` |
| `ENABLE_INGESTION` | present | `false` |
| `ENABLE_MONITORING` | present | `true` |
| `ENABLE_PUSH` | present | `false` |
| `ENABLE_ODDS` | present | `false` |
| `ENABLE_WEATHER` | present | `false` |
| `APIFOOTBALL_DAILY_BUDGET` | present | `100` |
| `APIFOOTBALL_RATE_PER_MIN` | present | `10` |
| `BREAKER_FAIL_MAX` | present | `5` |
| `BREAKER_RESET_SECONDS` | present | `30` |
| `DEFAULT_TIMEOUT_SECONDS` | present | `15` |
| `LOG_LEVEL` | present | `DEBUG` |
| `MONITORING_PERSIST` | present | `false` |
| `CORS_ORIGINS` | present | `*` |

### Alertes configuration

1. **Budget tres bas** : `APIFOOTBALL_DAILY_BUDGET=100` (plan essai). Le `.env.example` indique 7 500. Le run matchday a besoin d'environ 3 000-5 000 appels. **Ce budget doit etre releve avant le run.**
2. **Rate limit basse** : `APIFOOTBALL_RATE_PER_MIN=10` (vs 300 par defaut). A adapter pour le run.
3. **`ADMIN_BOOTSTRAP_TOKEN`** absent du `.env`. Il est defini dans `Settings` comme champ optionnel (defaut `""`). Necessaire pour creer un admin via `POST /admin/bootstrap`.
4. **Entitlements dev** : free et premium ont les memes limites (999 999 messages, tous les features actives). Pour tester la differentiation free/premium, il faudra configurer des limites differentes via `PATCH /admin/entitlements/{tier}`.
5. **`ENABLE_LIVE=false`** : le module live est desactive. Le run matchday necessite `ENABLE_LIVE=true`.

---

## C. Donnees et etat

### Base SQLite

| Element | Valeur |
|---|---|
| Chemin DB dev | `C:\Users\henri\Projets\oria\oria.db` |
| Taille | 331 776 octets (~324 Ko) |
| WAL present | Oui (`oria.db-wal`, `oria.db-shm` dans le repo) |

### Base dediee au run

**Proposition** : `C:\Users\henri\Projets\oria\tests\matchday\runs\matchday-YYYYMMDD-HHMM\oria-run.db`

Le harness campaign existant utilise `db_path=":memory:"` (conftest.py:52). Pour le run matchday avec le serveur HTTP, il faut passer par `DB_PATH` dans le `.env` ou l'environnement du processus. Recommandation : lancer le serveur avec `DB_PATH=<chemin_run>/oria-run.db` via variable d'environnement.

### Cache

Le cache est **interne a la DB SQLite** (table `cache` geree par `storage/cache.py`). Pas de fichier cache separe.

### Etat persistant hors DB

| Element | Chemin | Statut |
|---|---|---|
| Cache de saison | `tests/campaign/.season_cache.json` | Genere dynamiquement (TTL 24h) |
| Compteur de quota | **En memoire uniquement** (`ApiFootballClient.governor`) | Pas de persistence disque |
| Journal d'ingestion | Pas de fichier dedie (logs stdout) | -- |

**Risque** : le compteur de quota governor est purement en memoire. Un restart du serveur remet le compteur a zero. Le header `x-ratelimit-requests-remaining` de l'API-Football est la seule source de verite persistante. Le `reconcile_quota()` du harness croise les trois sources.

---

## D. Outillage de test existant

### tests/campaign/ -- Harness de campagne

| Fichier | Chemin absolu | Statut | Contenu |
|---|---|---|---|
| `harness.py` | `C:\Users\henri\Projets\oria\tests\campaign\harness.py` | Existe | `Probe`, `BudgetGuard`, `ProbeResult`, `Latencies`, `reconcile_quota` |
| `workloads.py` | `C:\Users\henri\Projets\oria\tests\campaign\workloads.py` | Existe | `CanonicalQuestion`, `Paraphrase`, `AdversarialQuestion`, `build_canonical(season)`, `build_paraphrases(season)`, `build_adversarial()` -- 90+ questions canoniques, 12 paraphrases, 21 adversariales |
| `recorder.py` | `C:\Users\henri\Projets\oria\tests\campaign\recorder.py` | Existe | `ApiCallRecord`, `Recorder`, `install_recorder()` -- monkeypatch du client API pour tracer les appels |
| `report.py` | `C:\Users\henri\Projets\oria\tests\campaign\report.py` | Existe | `PhaseResult`, `CampaignMetrics`, `create_run_dir()`, `generate_report()` -- genere REPORT.md + metrics.json + anomalies.md |
| `seasons.py` | `C:\Users\henri\Projets\oria\tests\campaign\seasons.py` | Existe | `resolve_current_season()`, `resolve_seasons_batch()` -- resolution dynamique de saison avec cache disque |
| `run_campaign.py` | `C:\Users\henri\Projets\oria\tests\campaign\run_campaign.py` | Existe | Point d'entree CLI (stub, affiche les instructions) |
| `conftest.py` | `C:\Users\henri\Projets\oria\tests\campaign\conftest.py` | Existe | Fixtures pytest session-scoped : `campaign_env`, `probe`, `recorder`, `latencies` -- boot pipeline avec vraie API, LLM desactive, DB en memoire |

### tests/campaign/phases/

| Fichier | Statut | Description |
|---|---|---|
| `p0_setup.py` | Existe | Setup initial |
| `p1_endpoints.py` | Existe | Verification des endpoints |
| `p2_pertinence.py` | Existe | Tests de pertinence des reponses |
| `p3_cache.py` | Existe | Tests de cache |
| `p4_singleflight.py` | Existe | Tests single-flight (coalescence) |
| `p5_load.py` | Existe | Tests de charge |
| `p6_ingestion.py` | Existe | Tests d'ingestion |
| `p7_live.py` | Existe | Tests live (necessite matchs en direct) |
| `p8_degradation.py` | Existe | Tests de degradation gracieuse |
| `p9_e2e.py` | Existe | Tests end-to-end |
| `p10_soak.py` | Existe | Tests d'endurance |

### tests/campaign/runs/

Le repertoire existe mais est **vide** -- aucun run precedent.

### audit/ -- Outils de probe

| Fichier | Chemin absolu | Statut | Description |
|---|---|---|---|
| `probe.py` | `C:\Users\henri\Projets\oria\audit\probe.py` | Existe | Sonde de calibrage offline (sans LLM, sans API, DB :memory:). Teste 100+ formulations via pipeline minimal. Produit `probe-output.txt`. |
| `live_test.py` | `C:\Users\henri\Projets\oria\audit\live_test.py` | Existe | Test contextuel live via HTTP (`/chat/public`, `/catalog/fixtures/live`). Selectionne 5 matchs, pose 27 categories de questions par match. Produit `live_test_report.json`. |
| `calibrage.json` | `C:\Users\henri\Projets\oria\audit\calibrage.json` | Existe | Donnees de calibrage |
| `live_test_report.json` | `C:\Users\henri\Projets\oria\audit\live_test_report.json` | Existe | Rapport du dernier live test |
| `probe-output.txt` | `C:\Users\henri\Projets\oria\audit\probe-output.txt` | Existe | Sortie du dernier probe |

### Sorties existantes

| Fichier | Chemin absolu | Statut |
|---|---|---|
| `tests/campaign_report.json` | `C:\Users\henri\Projets\oria\tests\campaign_report.json` | Existe |
| `tests/campaign_report.txt` | `C:\Users\henri\Projets\oria\tests\campaign_report.txt` | Existe |

### tests/test_campaign.py

Fichier standalone qui boot le pipeline complet avec la vraie API Football (pas de mock), envoie des questions exhaustives, et produit un rapport. Estimé a ~80-120 appels API.

### tests/fixtures/apifootball/

Fichiers de stub API-Football pour les tests offline :
`empty_response.json`, `error_response.json`, `events_response.json`, `fixtures_response.json`, `injuries_response.json`, `lineups_response.json`, `odds_response.json`, `players_response.json`, `standings_response.json`, `statistics_response.json`, `teams_response.json`

### Verdict de reutilisabilite

| Composant | Reutilisable tel quel ? | Action requise |
|---|---|---|
| `Recorder` + `install_recorder` | **Oui** | Tel quel -- monkeypatch du client, export CSV/JSON |
| `BudgetGuard` | **Oui** | Tel quel -- context manager async, verifie budget phase + reserve globale |
| `Probe` (harness) | **Partiellement** | Fonctionne via pipeline interne. Le matchday a besoin d'un probe HTTP (comme `audit/live_test.py`). A adapter ou wrapper. |
| `Latencies` | **Oui** | Tel quel -- accumulateur avec percentiles |
| `reconcile_quota` | **Oui** | Tel quel -- reconciliation 3 sources |
| `workloads.py` | **Partiellement** | Les questions canoniques sont pertinentes mais le matchday necessite des questions contextualisees aux matchs en direct (dynamiques). `audit/live_test.py` a deja ce pattern. |
| `report.py` | **Partiellement** | Le format est bon mais le matchday exige un format de pack specifique (manifest.json, oracle/, raw/, etc.). A etendre. |
| `seasons.py` | **Oui** | Tel quel -- resolution dynamique + cache |
| `conftest.py` (campaign) | **Non** | Trop couple au pipeline interne. Le matchday passe par HTTP. |
| `audit/live_test.py` | **Base solide** | Pattern de test live via HTTP tres pertinent. Les categories de questions, la selection de matchs, l'evaluation de verdict sont reutilisables. A refactorer en modules. |
| `audit/probe.py` | **Non pour matchday** | Test offline, pas applicable au run HTTP. |
| Fixtures apifootball/ | **Oui pour dry-run** | Utiles pour le dry-run Mission 1 |

**A ecrire pour le matchday** :
1. `personas.py` -- 9 comptes de test (free/premium/guest) avec profils
2. `plan.py` -- generation de `plan.json` a partir des matchs selectionnes
3. `oracle.py` -- collecte de verite terrain (scores, events) via API-Football
4. `runner.py` -- orchestrateur de vagues HTTP avec watchdog
5. `checks.py` -- verification post-run (pack complet, coherent, jugeable)
6. `pack.py` -- assemblage du dossier de handoff pour Cowork
7. `watchdog.py` -- surveillance continue (quota, 5xx, modules down)

---

## E. Surface HTTP reelle

Tous les endpoints sont servis **a la racine** (pas de prefixe `/api/`). Confirme par `GET /api/health` -> 404.

### Health

| Methode | Path | Auth | Reponse testee |
|---|---|---|---|
| GET | `/health` | Non | `{"status": "up", "modules": {...}}` -- 36 modules tous `"up"` |

### Chat

| Methode | Path | Auth | Reponse testee |
|---|---|---|---|
| POST | `/chat` | Oui (JWT) | 401 sans auth |
| POST | `/chat/stream` | Oui (JWT) | SSE (text/event-stream) |
| POST | `/chat/public` | Non | `{"text": "Salut ! Je suis Oria...", "attachments": [], "suggested_actions": [...], "degraded": false, "freshness": null}` |

Schema du body `/chat/public` : `{"text": string, "context": object}`
Context : `{"league_id": int?, "team_id": int?, "fixture_id": int?, "season": int?}`

### Admin

| Methode | Path | Auth | Reponse testee |
|---|---|---|---|
| GET | `/admin/health` | Bearer ADMIN_TOKEN | Identique a `/health` (modules detailles) |
| GET | `/admin/quota` | Bearer ADMIN_TOKEN | `{"daily_budget": 100, "calls_today": 0, "remaining_budget": 100, "rate_per_min": 10, ...}` |
| GET | `/admin/metrics` | Bearer ADMIN_TOKEN | `{"error": "monitoring not available"}` |
| GET | `/admin/traces` | Bearer ADMIN_TOKEN | `[]` (vide) |
| GET | `/admin/bottlenecks` | Bearer ADMIN_TOKEN | `[]` (vide) |
| GET | `/admin/live` | Bearer ADMIN_TOKEN | `{"status": "ok"}` |
| GET | `/admin/entitlements` | Bearer ADMIN_TOKEN | `{"free": {...}, "premium": {...}}` -- limites identiques actuellement |
| PATCH | `/admin/entitlements/{tier}` | Bearer ADMIN_TOKEN | Met a jour les limites par tier |
| GET | `/admin/users` | JWT admin | Liste des utilisateurs |
| POST | `/admin/bootstrap` | Non (requiert `ADMIN_BOOTSTRAP_TOKEN`) | Cree le premier admin |

### Catalog

| Methode | Path | Auth | Reponse testee |
|---|---|---|---|
| GET | `/catalog/leagues` | Non | Liste des ligues (tableau JSON) |
| GET | `/catalog/teams?league_id=X&season=Y` | Non | Liste des equipes |
| GET | `/catalog/players?team_id=X&season=Y` | Non | Liste des joueurs |
| GET | `/catalog/fixtures?league_id=X&season=Y&date=...` | Non | Liste des matchs |
| GET | `/catalog/fixtures/live` | Non | Matchs en cours (JSON array, ~50 matchs le 15/08/2026 a 19h) |

**Confirmation** : `/catalog/fixtures/live` existe bien (le protocole supposait ce chemin).

### Auth

| Methode | Path | Auth | Schema |
|---|---|---|---|
| POST | `/auth/register` | Non | Body: `{"email": str, "password": str}` |
| POST | `/auth/login` | Non | Body: `{"email": str, "password": str}` |
| POST | `/auth/refresh` | Non | Body: `{"refresh_token": str}` |
| POST | `/auth/logout` | Non | Body: `{"refresh_token": str}` |

### Preferences

| Methode | Path | Auth |
|---|---|---|
| GET | `/follows` | JWT |
| POST | `/follows` | JWT |
| DELETE | `/follows` | JWT |
| GET | `/settings/notifications` | JWT |
| PATCH | `/settings/notifications` | JWT |

### Billing

| Methode | Path | Auth |
|---|---|---|
| GET | `/billing/subscription` | JWT |
| POST | `/billing/checkout` | JWT |
| POST | `/billing/webhook` | Non (signature Stripe) |

### Promotion premium

Deux methodes fonctionnelles :
1. **Via Stripe webhook** : `POST /billing/webhook` -> met a jour le tier en DB
2. **Via admin** : `PATCH /admin/users/{user_id}` avec JWT admin -> peut changer le role/status
3. **Via DB directe** : `billing.upsert_subscription()` dans le code

Pour le run matchday, la methode la plus simple est `PATCH /admin/users/{user_id}` apres creation d'un admin via bootstrap.

---

## F. Environnement d'execution

| Element | Valeur |
|---|---|
| Python | 3.13.6 |
| uv | 0.6.4 |
| ruff | 0.15.22 |
| mypy | 2.3.0 (compiled) |
| pytest | 9.1.1 |
| OS | Windows 10/11, MSYS2/Git Bash |
| Fuseau horaire | Europe/Paris (UTC+2, heure d'ete) |
| Heure locale | 2026-08-15T19:15:19+02:00 |

### Commande de lancement uvicorn

```bash
uv run python -m oria web
```
ou directement :
```bash
uv run uvicorn oria.main:create_app --factory --host 0.0.0.0 --port 8000
```

Le serveur est **actuellement en ecoute** sur le port 8000 (TCP, IPv4 + IPv6).

### Espace disque

| Volume | Taille | Utilise | Disponible | Usage |
|---|---|---|---|---|
| C: | 953 Go | 824 Go | 129 Go | 87% |

129 Go disponibles -- largement suffisant pour les runs (quelques centaines de Mo maximum).

### Acces reseau sortant

| Service | Statut | Preuve |
|---|---|---|
| API-Football (v3.football.api-sports.io) | **Confirme** | `/catalog/fixtures/live` a retourne ~50 matchs en direct |
| DeepSeek | **Confirme** | Implicite -- `ENABLE_LLM=true`, module LLM marque `"up"` dans `/health` |

### Synchronisation NTP

Non verifiable directement sous Windows/MSYS2 (`timedatectl` absent). L'horloge systeme affiche 19:15 CEST alors que l'heure UTC est ~17:15. Ecart apparent : coherent.

---

## G. Arborescence de travail proposee

```
C:\Users\henri\Projets\oria\tests\matchday\           # code du harness (versionne)
    PATHS.md                                           # ce fichier
    personas.py                                        # 9 comptes de test
    plan.py                                            # generation plan.json
    oracle.py                                          # collecte verite terrain
    runner.py                                          # orchestrateur de vagues HTTP
    checks.py                                          # verification post-run
    pack.py                                            # assemblage dossier handoff
    watchdog.py                                        # surveillance continue

C:\Users\henri\Projets\oria\tests\matchday\runs\      # racine des runs (gitignore)
    matchday-YYYYMMDD-HHMM\                            # un run
        manifest.json                                  # metadonnees du run
        plan.json                                      # plan de matchs + vagues
        personas.json                                  # comptes + profils
        oria-run.db                                    # DB dediee au run
        oracle\                                        # verite terrain (scores, events)
        raw\                                           # reponses brutes ORIA
        metrics\                                       # metriques collectees
        traces\                                        # traces de requetes
        logs\                                          # logs serveur + harness
        anomalies\                                     # ecarts detectes
        judging\                                       # (vide, rempli par Cowork)

C:\Users\henri\Projets\oria\tests\matchday\handoff\    # ce qui part chez Cowork
    matchday-YYYYMMDD-HHMM.zip                         # archive du run
```

### G.1 -- Les runs vont-ils dans le repo git ?

**Recommandation : dans le repo, sous `.gitignore`.**

Justification :
- Le `.gitignore` existant exclut deja `*.db`. Il suffit d'ajouter `tests/matchday/runs/` et `tests/matchday/handoff/`.
- Garder les runs dans le repo simplifie la navigation et evite les chemins externes.
- Le volume estime (quelques centaines de Mo par run) est geerable sur 129 Go disponibles.
- Un volume externe n'apporterait un avantage que pour des campagnes repetees sur des semaines, ce qui n'est pas le cas ici.

Ligne a ajouter au `.gitignore` :
```
tests/matchday/runs/
tests/matchday/handoff/
```

### G.2 -- Comment le pack arrive-t-il chez Cowork ?

**Recommandation : archive ZIP via Drive ou equivalent.**

Justification :
- `pack.py` produira un ZIP auto-contenu avec `manifest.json` en entree.
- Le ZIP contient tout ce qui est necessaire pour juger sans ouvrir un autre fichier.
- Format universel, pas de dependance a un outil specifique.
- Le depot dans Drive / WeTransfer / partage reseau est independant du format.

**Question ouverte** : quel canal exact ? (Drive partage, depot Slack, email ?). A trancher avec Cowork.

---

## H. Ecarts et risques

### H.1 -- `/admin/metrics` retourne "monitoring not available"

**Constat** : `ENABLE_MONITORING=true` et `MONITORING_PERSIST=false` dans le `.env`. Le module monitoring est marque `"up"` dans `/health`, mais `/admin/metrics` retourne `{"error": "monitoring not available"}`.

**Impact** : les metriques de latence par route ne seront pas disponibles via l'admin API pendant le run. Le harness devra collecter ses propres metriques (ce que `Latencies` fait deja).

**Proposition** : investiguer le bug ou passer `MONITORING_PERSIST=true` avant le run. Si le probleme persiste, s'appuyer uniquement sur les metriques du harness.

### H.2 -- Budget API-Football a 100/jour

**Constat** : `APIFOOTBALL_DAILY_BUDGET=100`, `APIFOOTBALL_RATE_PER_MIN=10`. Le run matchday necessite 3 000-5 000 appels.

**Impact** : **bloquant**. Le run ne peut pas tourner avec ce budget.

**Proposition** : passer a `APIFOOTBALL_DAILY_BUDGET=7500` et `APIFOOTBALL_RATE_PER_MIN=300` dans le `.env` du run. Verifier que l'abonnement API-Football le permet (les headers de reponse donnent `x-ratelimit-requests-remaining`).

### H.3 -- `ENABLE_LIVE=false`

**Constat** : le module live est desactive. `/admin/live` retourne `{"status": "ok"}` mais c'est un stub.

**Impact** : les phases P7 (live) ne fonctionneront pas. L'ingestion automatique des scores en direct ne tournera pas.

**Proposition** : passer `ENABLE_LIVE=true` avant le run. Verifier que le `LiveEngine` fonctionne correctement une fois active.

### H.4 -- Entitlements free = premium

**Constat** : les entitlements free et premium sont identiques (999 999 messages, tous les features).

**Impact** : impossible de tester la differentiation free/premium (quotas, acces live, deep analysis).

**Proposition** : avant le run, configurer via `PATCH /admin/entitlements/free` des limites realistes (ex: `chat_message=50`, `live_realtime=false`, `deep_analysis=false`). Garder premium a des valeurs hautes.

### H.5 -- Probe harness vs probe HTTP

**Constat** : le `Probe` du harness (`harness.py`) travaille via le pipeline Python interne. Le run matchday doit passer par HTTP (`/chat/public`, `/chat`, `/chat/stream`).

**Impact** : le harness actuel ne teste pas la couche HTTP (serialisation, auth, rate limiting, CORS).

**Proposition** : creer un `HttpProbe` dans `tests/matchday/runner.py` qui wrappe `httpx.AsyncClient` et mesure les latences end-to-end. Reutiliser `audit/live_test.py` comme base.

### H.6 -- `ADMIN_BOOTSTRAP_TOKEN` absent

**Constat** : absent du `.env`. Le champ est defini dans Settings avec un defaut vide.

**Impact** : `POST /admin/bootstrap` echouera. Impossible de creer un admin via l'API.

**Proposition** : ajouter le token admin bootstrap au `.env` du run, ou creer l'admin directement en base.

### H.7 -- Protocole de reference absent

**Constat** : le fichier `PROTOCOLE-TEST-MATCHDAY-ORIA.md` n'existe ni dans le repo ni dans les Downloads.

**Impact** : les references aux sections du protocole (ss13.1, ss2.2, ss6.1, ss15) ne sont pas verifiables.

**Proposition** : fournir le fichier protocole pour que le harness puisse etre construit conformement aux specifications exactes.

### H.8 -- `ENABLE_INGESTION=false`

**Constat** : le module d'ingestion est desactive.

**Impact** : pas de pre-chargement automatique des donnees avant le run. Chaque requete fera un appel API a froid.

**Proposition** : laisser desactive pendant le run pour mesurer le comportement reel. Le cache se remplira naturellement au fil des requetes.

### H.9 -- Compteur de quota en memoire

**Constat** : le governor compte les appels en memoire. Un restart remet a zero.

**Impact** : si le serveur crash et restart pendant le run, le compteur local sera desynchronise de la realite API-Football.

**Proposition** : le `reconcile_quota()` du harness croise avec le header serveur. Ajouter une verification systematique apres chaque vague.

### H.10 -- `/admin/traces` et `/admin/bottlenecks` vides

**Constat** : les deux endpoints retournent `[]`.

**Impact** : pas de traces disponibles pour le debugging. Lie a H.1 (monitoring).

**Proposition** : le harness devra tracer ses propres requetes (deja prevu dans le recorder).

---

## I. Questions ouvertes

### Q1. Quel abonnement API-Football est actif ?

Le budget actuel est a 100/jour. Le run necessite 3 000-5 000 appels. Quel est le plan souscrit ? Peut-on passer a 7 500/jour ?

**Recommandation par defaut** : verifier via `GET /admin/quota` apres un appel, lire `x-ratelimit-requests-remaining` dans la reponse. Adapter le plan de run au budget reel.

### Q2. Canal de livraison du pack a Cowork ?

Drive partage, email, Slack, depot Git ? Le format ZIP est pret, mais le canal conditionne la taille maximale et l'automatisation.

**Recommandation par defaut** : Drive partage avec un lien.

### Q3. Le fichier PROTOCOLE-TEST-MATCHDAY-ORIA.md est-il disponible ?

Les instructions le referencent comme document de reference. Son absence empeche de verifier les specifications exactes des phases et du format de pack.

**Recommandation par defaut** : poursuivre avec les instructions fournies. Le protocole pourra etre integre a la Mission 1 une fois fourni.

### Q4. Faut-il tester avec `ENABLE_LLM=true` ou `false` ?

Le harness campaign actuel desactive le LLM (`enable_llm=False`). Le run matchday teste le comportement reel d'ORIA, donc avec LLM active. Mais chaque appel LLM coute en latence et en tokens DeepSeek.

**Recommandation par defaut** : `ENABLE_LLM=true` pour le run reel. Le dry-run Mission 1 peut utiliser `ENABLE_LLM=false` pour economiser.

### Q5. Combien de comptes de test sont necessaires et de quel type ?

Les instructions mentionnent 9 comptes. Repartition suggeree :
- 3 free (dont 1 avec follows, 1 sans, 1 rate-limited)
- 3 premium (idem)
- 3 guest/anonymes (via `/chat/public`)

**Recommandation par defaut** : confirmer cette repartition avant Mission 1.

### Q6. Quels matchs cibler pour le jour J ?

Le run necessite des matchs de ligues majeures (Ligue 1, Premier League, La Liga, Serie A, Bundesliga, Champions League). La date du run conditionne la disponibilite.

**Recommandation par defaut** : choisir un soir de multiplex (mardi/mercredi Champions League, ou week-end de championnat). Verifier le calendrier API-Football J-1.

### Q7. Promotion premium via quel mecanisme ?

Pas d'endpoint direct "promote to premium". Les options sont :
1. `PATCH /admin/users/{user_id}` (necessite un admin JWT)
2. Ecriture directe en base via un script
3. Stripe webhook (complexe a simuler)

**Recommandation par defaut** : utiliser `POST /admin/bootstrap` pour creer un admin, puis `PATCH /admin/users/{user_id}` pour promouvoir les comptes de test.

---

## Annexe : Signatures exactes du harness existant

### harness.py

```python
class ProbeResult:
    response: Response
    latency_ms: float
    api_calls_delta: int
    route: str
    degraded: bool
    attachment_kinds: list[str]
    trace_id: str = ""

class BudgetGuard:
    def __init__(self, phase_name: str, max_calls: int, recorder: Recorder, governor: Any) -> None
    calls_used: int  # property
    remaining: int   # property
    async def __aenter__(self) -> BudgetGuard
    async def __aexit__(self, *args) -> None
    def check(self) -> None  # leve PhaseBudgetExceeded

class Probe:
    def __init__(self, pipeline: Pipeline, governor: Any) -> None
    async def ask(self, question: str, context: Context | None = None, *, user_id: str = "campaign-probe") -> ProbeResult

class Latencies:
    def record(self, value: float, category: str = "") -> None
    def percentile(self, p: float, values: list[float] | None = None) -> float
    def stats(self, values: list[float] | None = None) -> dict[str, float]
    def stats_by_category(self) -> dict[str, dict[str, float]]
    def global_stats(self) -> dict[str, float]

def reconcile_quota(governor: Any, recorder: Recorder, phase: str | None = None) -> dict[str, Any]
```

### recorder.py

```python
class ApiCallRecord:
    ts_monotonic: float
    ts_utc: float
    endpoint: str
    params: str        # JSON-serialized
    latency_ms: float
    http_status: int
    errors: str
    results: int
    paging_current: int
    paging_total: int
    ratelimit_remaining: int
    origin: str        # prerouter | orchestrator | ingestion | liveengine | direct
    single_flight_join: bool
    trace_id: str
    phase: str

class Recorder:
    calls: list[ApiCallRecord]  # property
    call_count: int             # property
    def set_phase(self, phase: str) -> None
    def record(self, call: ApiCallRecord) -> None
    def calls_in_phase(self, phase: str) -> list[ApiCallRecord]
    def real_calls(self, *, phase: str | None = None) -> list[ApiCallRecord]
    def coalesced_calls(self, *, phase: str | None = None) -> list[ApiCallRecord]
    def latest_remaining(self) -> int | None
    def export_csv(self, path: Path) -> None
    def export_json(self, path: Path) -> None
    def summary(self) -> dict[str, Any]

def install_recorder(client: Any, recorder: Recorder) -> None
```

---

**STOP** -- Ce livrable est remis. En attente de validation des chemins et des arbitrages G.1 / G.2 avant de passer a la Mission 1.
