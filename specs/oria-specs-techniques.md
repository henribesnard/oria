# Oria — Spécifications techniques de l'ossature

> Destinataire : **Claude Code**. Objectif : générer le **squelette** technique d'Oria — structure, interfaces, câblage (DI), primitives de résilience, santé/observabilité, config, tests — avec des implémentations **stub ou dégradables** là où la logique métier n'est pas encore écrite. Pas de logique métier complète à ce stade : on pose l'ossature.

---

## 1. Objet et périmètre

Oria est un assistant IA sur le sport (football d'abord, extensible). Le cœur est **agnostique au canal** : il reçoit une `IncomingRequest{ user_id, text, context }` et renvoie une `Response{ text, attachments, ... }`. Les canaux (web, Telegram…) sont des adaptateurs branchés sur des ports.

**Ce que Claude Code doit produire dans cette passe :**
- L'arborescence complète du projet (src layout) et l'outillage (uv, ruff, mypy, pytest).
- Les **contrats** (Protocols/ABCs) de tous les modules et des ports.
- Les **modèles de domaine** (DTO Pydantic) : `IncomingRequest`, `Response`, `Context`, etc.
- Les **primitives de résilience** (circuit breaker, timeout, retry, fallback, superviseur de tâches) dans le noyau.
- Le **registre de santé et de capacités** (health/capability registry).
- Le **module de monitoring natif** (traçage des actions par module, latences, détection de goulots), non intrusif.
- Le **composition root** (DI) qui démarre les modules de façon **tolérante aux pannes**.
- Une implémentation **stub ou dégradable** de chaque module, suffisante pour que l'app démarre et réponde.
- Un adaptateur **console** (tests) et un adaptateur **web FastAPI** minimal (`/health` + un endpoint de chat).
- La suite de **tests** qui prouve la dégradation gracieuse (voir §10).

**Hors périmètre de cette passe :** intégration réelle complète d'API-Football, prompts DeepSeek finalisés, moteur live réel, ingestion réelle. Ces modules existent en **stub conforme à leur interface**, désactivables, et l'app fonctionne sans eux.

---

## 2. Principes non négociables

1. **Un module = une responsabilité, derrière une interface.** Aucun module n'importe le module concret d'un autre : il dépend d'un **contrat** (Protocol) résolu par le conteneur DI. Cela rend chaque module remplaçable, testable en isolation, et empêche le couplage.
2. **Isolation des pannes (bulkheads).** La défaillance d'un module **non critique** ne doit jamais rendre l'application indisponible. Elle est capturée, journalisée, marquée dans le registre de santé, et l'app continue en mode dégradé.
3. **Dégradation gracieuse par défaut.** Toute dépendance externe (API-Football, DeepSeek, météo) et tout module optionnel est enveloppé d'un timeout + retry borné + circuit breaker + **fallback**. On sert le cache périmé plutôt que d'échouer ; on répond via template si le LLM est absent ; on annonce l'indisponibilité plutôt que de planter.
4. **Le pipeline ne lève jamais vers l'adaptateur.** `handle_message` renvoie **toujours** une `Response` valide, au pire un message d'indisponibilité cadré. Aucune exception ne remonte au canal.
5. **Boot tolérant.** Seul un ensemble **minimal** de modules est `required=True` (config, base de données). Tout le reste est `required=False` : si son démarrage échoue, on log, on marque DOWN, et on continue.
6. **Tout est piloté par la config.** Chaque module optionnel est activable/désactivable par variable d'environnement. L'ossature doit démarrer avec n'importe quelle combinaison de flags.

---

## 3. Stack technique et outillage

- **Python 3.12+**, asynchrone de bout en bout (`asyncio`).
- **Gestionnaire de projet/dépendances : `uv`** (`pyproject.toml`, `uv.lock`).
- **HTTP client :** `httpx` (async) — **uniquement** dans `providers/`, jamais ailleurs.
- **Modèles/validation :** `pydantic` v2 + `pydantic-settings` (config typée par env).
- **Base de données :** SQLite via `aiosqlite`. Migrations par fichiers SQL versionnés + un runner maison simple (pas d'ORM lourd imposé ; `SQLModel` toléré si utile).
- **Planificateur :** `APScheduler` (AsyncIOScheduler).
- **LLM :** SDK `openai` pointé sur DeepSeek (`base_url=https://api.deepseek.com`), modèles `deepseek-v4-flash` (défaut) et `deepseek-v4-pro` (raisonnement). ⚠️ Ne pas utiliser `deepseek-chat`/`deepseek-reasoner` (retirés).
- **Retry/backoff :** `tenacity`. **Circuit breaker :** implémentation maison légère dans `kernel/resilience.py` (pas de dépendance lourde).
- **Logging :** `structlog` (JSON structuré, champ `module` systématique).
- **Web (adaptateur) :** `FastAPI` + `uvicorn`.
- **Qualité :** `ruff` (lint+format), `mypy` (strict), `pytest` + `pytest-asyncio` + `respx` (mock httpx) + `time-machine` (temps).
- **Pré-commit** optionnel : ruff + mypy.

---

## 4. Arborescence du projet

```
oria/
├─ pyproject.toml
├─ uv.lock
├─ .env.example
├─ README.md
├─ CLAUDE.md                 # conventions pour Claude Code (voir §12)
├─ migrations/               # 0001_init.sql, ...
├─ src/oria/
│  ├─ main.py                # composition root : construit le conteneur et démarre
│  ├─ config.py              # pydantic-settings (toute la config d'env)
│  ├─ container.py           # DI : construit et câble les modules
│  │
│  ├─ kernel/                # transverse, sans dépendance métier
│  │  ├─ contracts.py        # Protocols : Module, InboundPort, OutboundPort, Repository, Provider...
│  │  ├─ models.py           # DTO domaine : IncomingRequest, Response, Context, Attachment...
│  │  ├─ errors.py           # hiérarchie d'exceptions
│  │  ├─ resilience.py       # CircuitBreaker, @resilient, guard(), Supervisor
│  │  ├─ health.py           # Availability, ModuleStatus, HealthRegistry (+ capacités)
│  │  ├─ tracing.py          # TraceContext, Span, span(), @traced, Tracer (primitives)
│  │  ├─ events.py           # bus d'événements interne (fan-out live/push + spans)
│  │  └─ logging.py          # setup structlog
│  │
│  ├─ core/                  # le cerveau, agnostique au canal
│  │  ├─ pipeline.py         # handle_message : orchestration défensive
│  │  ├─ prerouter.py        # pré-routeur d'intention (templates, sans LLM)
│  │  ├─ orchestrator.py     # boucle function-calling DeepSeek
│  │  └─ synthesis.py        # rédaction / templates de réponse
│  │
│  ├─ tools/                 # couche d'outils exposée au LLM
│  │  ├─ registry.py         # enregistrement outils + schéma JSON + validation d'args
│  │  └─ football.py         # façades get_fixtures, get_standings, ... (au-dessus des repos)
│  │
│  ├─ domain/                # repositories par domaine (cache-first)
│  │  ├─ base.py             # BaseRepository : chemin cache-first générique
│  │  ├─ fixtures.py  standings.py  teams.py  players.py
│  │  ├─ injuries.py  lineups.py    odds.py    live.py
│  │
│  ├─ providers/             # sorties vers l'extérieur (seul endroit avec httpx)
│  │  ├─ apifootball/
│  │  │  ├─ client.py        # client unique API-Football
│  │  │  ├─ governor.py      # gouverneur de quota + rate limit + single-flight + negative cache
│  │  │  └─ mapper.py        # JSON brut -> modèles domaine
│  │  ├─ llm/deepseek.py     # wrapper LLM (function calling)
│  │  └─ weather.py          # météo externe (optionnel)
│  │
│  ├─ storage/               # cache / base de connaissances
│  │  ├─ db.py               # connexion aiosqlite + runner de migrations
│  │  ├─ cache.py            # cache clé/valeur : fetched_at, TTL, classe de volatilité
│  │  └─ userstore.py        # préférences, mémoire conversation, follows
│  │
│  ├─ ingestion/             # proactif (optionnel)
│  │  ├─ scheduler.py        # jobs APScheduler pilotés par le registre agrégé de follows
│  │  └─ jobs.py
│  │
│  ├─ liveengine/            # live (optionnel)
│  │  ├─ engine.py           # poller unique/partagé par match, adaptatif, borné
│  │  └─ poller.py
│  │
│  ├─ notifications/         # push (optionnel)
│  │  └─ dispatcher.py       # consomme le cache, route via OutboundPort
│  │
│  ├─ monitoring/            # traçage + métriques (optionnel, non intrusif)
│  │  ├─ collector.py        # s'abonne au bus, assemble traces, agrégats glissants, goulots
│  │  └─ exporter.py         # /metrics, /trace/{id}, /bottlenecks
│  │
│  └─ adapters/              # canaux (fins)
│     ├─ console.py          # adaptateur test/console (InboundPort + OutboundPort)
│     └─ web/app.py          # FastAPI : /health + /metrics + /trace/{id} + POST /chat
│
└─ tests/
   ├─ conftest.py            # fakes de chaque module
   ├─ test_boot.py           # démarre avec toutes combinaisons de flags
   ├─ test_degradation.py    # critères d'acceptation §10
   └─ test_pipeline.py
```

---

## 5. Contrats du noyau (`kernel/`)

Ce sont les fondations. Tout le reste s'y conforme.

### 5.1 Modèles de domaine (`models.py`)

```python
from pydantic import BaseModel
from typing import Literal

class Context(BaseModel):
    country: str | None = None
    zone: str | None = None
    league_id: int | None = None
    season: int | None = None
    fixture_id: int | None = None
    team_id: int | None = None
    player_id: int | None = None

class IncomingRequest(BaseModel):
    user_id: str
    text: str
    context: Context = Context()
    locale: str = "fr"

class Attachment(BaseModel):
    kind: Literal["fixture_card", "table", "link", "image"]
    data: dict

class SuggestedAction(BaseModel):
    label: str
    payload: dict

class Response(BaseModel):
    text: str
    attachments: list[Attachment] = []
    suggested_actions: list[SuggestedAction] = []
    degraded: bool = False          # servi en mode dégradé
    freshness: str | None = None    # ex. "à jour il y a 2 h"
```

Le champ `context` porte des **IDs déjà résolus** (venant du sélecteur de l'UI) : quand ils sont présents, l'orchestrateur les injecte directement dans les appels d'outils sans re-résoudre les entités.

### 5.2 Contrats de modules et ports (`contracts.py`)

```python
from typing import Protocol, runtime_checkable

@runtime_checkable
class Module(Protocol):
    name: str
    required: bool                       # True => son échec de boot avorte l'app
    provides: tuple[str, ...]            # capacités déclarées, ex. ("live_scores",)
    async def start(self) -> None: ...
    async def stop(self) -> None: ...
    async def health(self) -> "ModuleStatus": ...

class InboundPort(Protocol):
    async def handle_message(self, req: IncomingRequest) -> Response: ...

class OutboundPort(Protocol):
    async def send(self, user_id: str, message: Response) -> None: ...

class Repository(Protocol):
    """Accès cache-first à un domaine de données."""
    volatility: str                      # "immuable" | "lent" | "semi_rapide" | "live"
    async def get(self, key: str, *, allow_stale: bool = True): ...

class DataProvider(Protocol):
    """Fournisseur externe (API-Football, LLM, météo)."""
    async def health(self) -> "ModuleStatus": ...
```

Chaque module concret **implémente `Module`** (donc a un `start/stop/health` et déclare `required` + `provides`). C'est ce qui rend le boot et la supervision uniformes.

### 5.3 Santé et capacités (`health.py`)

```python
from enum import Enum
from pydantic import BaseModel

class Availability(str, Enum):
    UP = "up"; DEGRADED = "degraded"; DOWN = "down"

class ModuleStatus(BaseModel):
    name: str
    availability: Availability
    detail: str | None = None

class HealthRegistry:
    def set(self, status: ModuleStatus) -> None: ...
    def get(self, name: str) -> ModuleStatus | None: ...
    def snapshot(self) -> dict[str, ModuleStatus]: ...
    # une capacité est disponible si au moins un module UP la fournit
    def capability_available(self, capability: str) -> bool: ...
```

Le `HealthRegistry` est **injecté partout**. Avant d'utiliser une fonctionnalité optionnelle, un module interroge `capability_available(...)` et route en conséquence.

### 5.4 Résilience (`resilience.py`)

Quatre primitives, définies une fois, réutilisées partout :

```python
# 1) Circuit breaker par dépendance externe (états CLOSED/OPEN/HALF_OPEN)
class CircuitBreaker:
    def __init__(self, name: str, fail_max: int = 5, reset_timeout: float = 30.0): ...
    async def call(self, coro_fn, *args, **kwargs): ...

# 2) Décorateur composite : timeout -> retry(backoff borné) -> breaker -> fallback
def resilient(*, timeout: float, retries: int = 2,
              breaker: str | None = None, fallback=None): ...

# 3) Garde de stage de pipeline : capture toute exception, renvoie une valeur dégradée
#    au lieu de propager. Journalise + marque la santé.
class guard:  # async context manager
    def __init__(self, stage: str, on_error): ...

# 4) Superviseur de tâches de fond : relance une tâche crashée avec backoff,
#    en isolation (son crash ne tue pas la boucle d'événements)
class Supervisor:
    def spawn(self, name: str, coro_factory, *, restart: bool = True): ...
    async def stop_all(self): ...
```

**Règle :** aucun `await` vers l'extérieur sans timeout. Aucune tâche de fond sans superviseur.

### 5.5 Traçage (`tracing.py`)

Primitives d'instrumentation utilisées par tous les modules pour émettre des **spans** (une action = un span). L'émission est **fire-and-forget** sur le bus d'événements : elle ne lève jamais, n'attend rien, et ne crée aucune dépendance vers le collecteur.

```python
from contextlib import asynccontextmanager
from pydantic import BaseModel

class Span(BaseModel):
    trace_id: str
    span_id: str
    parent_id: str | None = None
    name: str                     # ex. "orchestrator.tool_loop", "apifootball.fetch"
    start_ms: float
    duration_ms: float | None = None
    status: str = "ok"            # "ok" | "degraded" | "error"
    attrs: dict = {}              # cache_hit, api_calls, tokens, model, breaker_state...

def current_trace() -> "TraceContext | None": ...   # propagé via contextvars

@asynccontextmanager
async def span(name: str, *, attrs: dict | None = None): ...   # ouvre/ferme, mesure (horloge monotone)

def traced(name: str): ...        # décorateur équivalent, instrumente une coroutine en une ligne
```

Le `TraceContext` (trace_id + span parent) est propagé par `contextvars`, jamais via les signatures. `guard()` et `@resilient` (5.4) **émettent automatiquement un span** (avec `status=error/degraded` quand ils rattrapent) : l'essentiel du pipeline est donc instrumenté sans code supplémentaire.

---

## 6. Modules et responsabilités

Chaque ligne = un module, une responsabilité unique, une interface publique, un statut de criticité et un **comportement dégradé** défini.

| Module | Responsabilité unique | Interface | Criticité | Comportement si en panne |
|---|---|---|---|---|
| `config` | Charger/valider la config d'env | `Settings` | **Requis** | Boot avorté (fail-fast) |
| `storage/db` | Connexion + migrations SQLite | `Module` | **Requis** | Boot avorté |
| `storage/cache` | Cache clé/valeur (fetched_at, TTL, volatilité) | `Repository`-like | **Requis** | Boot avorté |
| `storage/userstore` | Préférences, mémoire, follows | `Module` | Optionnel | Sans mémoire ni perso ; réponses génériques |
| `providers/apifootball` | Point d'entrée unique API-Football + gouverneur quota | `DataProvider`, `Module` | Optionnel | Sert le cache (même périmé) ; pas de fetch frais |
| `providers/llm` | Appels DeepSeek (function calling) | `DataProvider`, `Module` | Optionnel | Le pré-routeur/templates répondent sans LLM |
| `providers/weather` | Météo stade (externe) | `DataProvider` | Optionnel | Omet la météo, le reste répond |
| `domain/*` (repos) | Accès cache-first par domaine | `Repository` | Optionnel/par domaine | Repo indispo => outil correspondant indisponible, pas l'app |
| `tools` | Exposer/valider les fonctions au LLM | `ToolRegistry` | Optionnel | Outil manquant => l'orchestrateur route sans lui |
| `core/prerouter` | Répondre au trivial sans LLM (famille A) | `InboundPort`-stage | Optionnel | Tout passe à l'orchestrateur |
| `core/orchestrator` | Boucle function-calling, choix d'outils | stage | Optionnel | Repli sur pré-routeur/templates |
| `core/synthesis` | Rédiger la réponse finale | stage | **Requis(min)** | Template minimal garanti |
| `core/pipeline` | Enchaîner les stages défensivement | `InboundPort` | **Requis** | Renvoie toujours une `Response` (au pire dégradée) |
| `ingestion` | Pré-fetch programmé piloté par les follows | `Module` (tâche) | Optionnel | Pas de pré-chauffage ; fetch à la demande |
| `liveengine` | Poller partagé/borné par match | `Module` (tâche) | Optionnel | Capacité `live_scores` DOWN ; le reste marche |
| `notifications` | Router les push via `OutboundPort` | `Module` | Optionnel | Pas de push ; le chat reste dispo |
| `monitoring` | Tracer les actions de chaque module, agréger les latences, remonter les goulots | `Module` (tâche) + `kernel/tracing` | Optionnel | Spans droppés ; **app inchangée**, aucun impact |
| `adapters/console` | Canal test | `InboundPort`+`OutboundPort` | Optionnel | — |
| `adapters/web` | Canal HTTP (FastAPI) + `/health` | — | Optionnel | — |

Point clé illustratif : **si `providers/llm` est DOWN**, le `prerouter` sert quand même les questions fréquentes (classement, prochain match, résultats) directement depuis le cache. **Si `liveengine` est DOWN**, tout le factuel et l'analyse restent disponibles. Aucun de ces cas ne rend l'app indisponible.

---

## 7. Modèle de résilience en détail

**Boot tolérant (composition root).** `main.py` construit le conteneur, puis démarre les modules **un par un et indépendamment**. Chaque `start()` est enveloppé : succès → marqué UP ; exception → log + marqué DOWN + on continue, **sauf** si `module.required` est vrai (alors on avorte proprement). L'ensemble requis doit rester minimal : `config`, `storage/db`, `storage/cache`, `core/pipeline`, `core/synthesis`.

**Registre de capacités.** À l'UP, un module publie ses `provides` (`live_scores`, `push`, `odds`, `prefetch`, `llm_reasoning`, `weather`…). Les consommateurs testent `capability_available(cap)` avant d'appeler et **routent autour** si absent, en positionnant `Response.degraded=True` et un message clair.

**Enveloppe des appels externes.** Tout appel sortant passe par `@resilient(timeout, retries, breaker, fallback)` : timeout strict → retry borné avec backoff → circuit breaker par dépendance (ouvre après N échecs, half-open après cooldown) → fallback (cache, cache périmé, ou message dégradé). Le breaker **évite de gaspiller le quota** quand API-Football est en panne.

**Cache-first + service du périmé.** `BaseRepository` : lire cache → si frais, renvoyer → sinon, si budget quota OK, fetch via provider → écrire cache → renvoyer. Si fetch impossible (quota/erreur/breaker ouvert) → **servir le cache périmé** avec `freshness` renseigné (« à jour il y a X »). Négative caching : mémoriser « pas de données » avec TTL court.

**Pipeline défensif.** `handle_message` enchaîne les stages (pré-routeur → orchestrateur → synthèse) chacun sous `guard(...)`. Une exception dans un stage **dégrade** (passe au repli) au lieu de propager. Invariant testé : `handle_message` ne lève jamais et renvoie toujours une `Response`.

**Bulkheads / tâches supervisées.** `ingestion`, `liveengine`, `notifications` tournent comme **tâches asyncio isolées** sous `Supervisor` : une tâche qui crashe est relancée avec backoff, son crash **ne touche ni la boucle d'événements ni le pipeline**. Pendant qu'elle est down, sa capacité est marquée DOWN.

**Arrêt propre.** `stop()` de chaque module ; `Supervisor.stop_all()` ; fermeture des connexions ; timeout global d'arrêt.

---

## 8. Configuration et feature flags (`config.py`)

Toute la config via `pydantic-settings` (fichier `.env`). Flags à prévoir au minimum :

```
# secrets / accès
APIFOOTBALL_KEY=
DEEPSEEK_API_KEY=
WEATHER_API_KEY=

# activation des modules optionnels (l'app boote avec n'importe quelle combinaison)
ENABLE_LLM=true
ENABLE_INGESTION=false
ENABLE_LIVE=false
ENABLE_PUSH=false
ENABLE_ODDS=false
ENABLE_WEATHER=false

# quota / résilience
APIFOOTBALL_DAILY_BUDGET=7500
APIFOOTBALL_RATE_PER_MIN=300
BREAKER_FAIL_MAX=5
BREAKER_RESET_SECONDS=30
DEFAULT_TIMEOUT_SECONDS=8

# modèles
LLM_MODEL_FAST=deepseek-v4-flash
LLM_MODEL_DEEP=deepseek-v4-pro

# base
DB_PATH=./oria.db
LOG_LEVEL=INFO

# monitoring (traçage + métriques ; jamais bloquant)
ENABLE_MONITORING=true
MONITORING_PERSIST=false          # écrire les spans en SQLite (batché, hors chemin chaud)
TRACE_SAMPLE_RATE=1.0             # 1.0 en dev ; erreurs et requêtes lentes toujours capturées
TRACE_BUFFER_SIZE=500             # nb de traces récentes en mémoire (ring buffer borné)
SLOW_REQUEST_MS=2500              # au-delà, requête toujours tracée en entier + signalée
STAGE_BUDGET_MS=1500              # au-delà, l'action est marquée « goulot »
```

Un `.env.example` documenté doit être fourni. **Aucune clé absente ne doit empêcher le boot** : clé manquante ⇒ module concerné DOWN, pas de crash.

---

## 9. Observabilité et monitoring natif

Trois couches complémentaires, aux responsabilités distinctes : le **logging** dit ce qui s'est passé, la **santé** dit qui est up/down, le **monitoring** dit *combien de temps* et *où* — c'est lui qui remonte les goulots.

**Logging** (`kernel/logging.py`). `structlog` en JSON, champs `module`, `event`, et `request_id` propagé dans tout le pipeline.

**Santé** (`kernel/health.py`). `/health` renvoie le `snapshot()` du `HealthRegistry` : statut par module + capacités disponibles. Code 200 si les modules requis sont UP (même avec des optionnels DOWN), 503 sinon.

**Monitoring** (`monitoring/` + `kernel/tracing.py`). Responsabilité unique : **tracer les actions de chaque module dans le pipeline global et remonter les goulots**. Modèle :

- **Une trace par requête** (`request_id`), sous forme d'**arbre de spans**. Un span = une action de module (`prerouter.match`, `orchestrator.tool_loop`, `tools.get_fixtures`, `repo.fixtures.get`, `apifootball.fetch`, `llm.completion`…), avec durée, statut et attributs. L'arbre se lit comme un **waterfall** : on voit instantanément quel module domine le temps de réponse.
- **Instrumentation quasi gratuite** : `async with span("apifootball.fetch"):` ou `@traced("standings.get")`. Le contexte de trace passe par `contextvars` — aucune signature polluée. Comme `guard()` et `@resilient` émettent déjà des spans, le pipeline est instrumenté presque sans effort.
- **Collecteur** (`monitoring/collector.py`) : tâche **supervisée** abonnée au bus d'événements. Il assemble les spans en traces, garde un **ring buffer** des N traces récentes (pour le détail/waterfall), et maintient des **agrégats glissants** par (module, action) : count, p50/p95/p99, taux d'erreur, et surtout **part du temps total de requête** — le vrai signal de goulot. Persistance SQLite **optionnelle**, batchée et hors chemin chaud.
- **Détection de goulots** : une action qui dépasse `STAGE_BUDGET_MS`, ou dont le p95 franchit un seuil, est marquée « goulot » → log + bascule du module concerné en DEGRADED dans le `HealthRegistry` (la santé se nourrit du monitoring). Les requêtes plus lentes que `SLOW_REQUEST_MS` sont toujours tracées en entier (tail-based sampling).
- **Exposition native** (`monitoring/exporter.py`), sans outil externe requis : `/metrics` (agrégats, format texte compatible Prometheus pour brancher Grafana plus tard), `/trace/{request_id}` (le waterfall d'une requête), `/bottlenecks` (top des actions par part de temps / p95 / taux d'erreur sur la fenêtre récente).

**Métriques propres à Oria** (là où sont ses vrais goulots) : appels API-Football par requête + quota restant ; **cache hit ratio** par domaine (efficacité de l'ingestion) ; latence et **tokens LLM** par modèle (flash vs pro) ; nombre et durée des **tool-calls** par requête (une analyse qui déclenche 6 appels d'outils se voit) ; état des breakers et nombre de fallbacks servis ; latence du poller live et nombre de pollers actifs.

**Le moniteur ne nuit jamais.** `required=False`, `provides=("monitoring",)` : s'il est DOWN, les spans sont simplement droppés, l'app est inchangée. Émission non bloquante (horloge monotone, pas de réseau), buffers bornés (drop du plus ancien), **sampling** (agrégats toujours calculés car peu coûteux ; traces détaillées échantillonnées via `TRACE_SAMPLE_RATE` ; erreurs et requêtes lentes toujours capturées). Budget d'overhead cible < ~2 %.

---

## 10. Tests et critères d'acceptation

La suite `tests/` doit **prouver la résilience**, pas seulement le chemin nominal. Chaque module a un **fake** dans `conftest.py`. Critères d'acceptation (chacun = un test) :

1. **Boot minimal.** L'app démarre avec `ENABLE_LLM=false`, `ENABLE_INGESTION=false`, `ENABLE_LIVE=false`, `ENABLE_PUSH=false` et répond aux requêtes factuelles depuis le cache.
2. **LLM absent.** Avec `DEEPSEEK_API_KEY` vide, la capacité `llm_reasoning` est DOWN mais le pré-routeur répond aux questions de la famille A (classement, prochain match) via template. `handle_message` renvoie une `Response` valide.
3. **API-Football en panne / quota épuisé.** Les fetchs échouent (mock `respx`) → le repo sert le cache périmé avec `freshness` renseigné et `degraded=True`. Aucune exception ne remonte.
4. **Breaker.** Après `BREAKER_FAIL_MAX` échecs, le circuit ouvre : les appels suivants ne partent plus vers le réseau (vérifié) et servent le fallback ; passage half-open après cooldown.
5. **Tâche de fond crashée.** Une tâche du `liveengine` qui lève est relancée par le `Supervisor` ; `/health` la montre DEGRADED puis UP ; le pipeline reste pleinement fonctionnel pendant l'incident.
6. **Invariant pipeline.** Propriété testée sur des entrées variées (y compris modules injectés en erreur) : `handle_message` ne lève **jamais** et renvoie toujours une `Response`.
7. **Combinatoire de flags.** Test paramétré : l'app boote pour un échantillon de combinaisons de `ENABLE_*`.
8. **Isolation d'un repo.** Un `Repository` de domaine injecté en panne rend l'outil correspondant indisponible sans affecter les autres outils ni l'app.
9. **Frontières d'architecture** (test statique) : aucun import de `httpx` hors de `providers/` ; aucun module ne dépend du concret d'un autre (uniquement des `contracts`).
10. **Traçage bout-en-bout.** Une requête produit une trace dont l'arbre de spans couvre pré-routeur → orchestrateur → outil → repo → provider ; `/trace/{id}` renvoie le waterfall avec les durées.
11. **Monitoring non intrusif.** Avec `monitoring` DOWN (ou `ENABLE_MONITORING=false`), le pipeline répond normalement et les spans sont droppés sans erreur ; l'overhead d'instrumentation reste sous le budget.
12. **Détection de goulot.** Une action stubée pour dépasser `STAGE_BUDGET_MS` est marquée « goulot », apparaît dans `/bottlenecks`, et fait basculer le module concerné en DEGRADED dans le `HealthRegistry`.

Cible : `mypy` strict passe, `ruff` propre, tous les tests verts **sans accès réseau** (tout mocké).

---

## 11. Ordre de construction (jalons)

Livrer par jalons, chacun compilable/testable :

- **M0 — Socle.** `pyproject.toml`/uv, ruff, mypy, `config.py`, `kernel/logging.py`, `kernel/models.py`, `kernel/errors.py`, `kernel/contracts.py`, `container.py` + `main.py` qui boote à vide, `adapters/console.py`, `adapters/web/app.py` avec `/health`. L'app démarre et répond « service prêt ».
- **M1 — Résilience, santé & traçage.** `kernel/resilience.py` (breaker, `resilient`, `guard`, `Supervisor`), `kernel/health.py`, `kernel/events.py`, `kernel/tracing.py` (Span, `span()`, `@traced` ; `guard`/`resilient` émettent des spans). Tests unitaires des primitives.
- **M2 — Stockage.** `storage/db.py` + migrations `0001_init.sql` (tables du §10 de l'archi), `storage/cache.py` (fetched_at/TTL/volatilité), `storage/userstore.py`. Requis + testés.
- **M3 — Providers (stubs conformes).** `providers/apifootball/{client,governor,mapper}` (gouverneur réel : budget, rate limit, single-flight, negative cache ; fetch réel derrière un flag mais mockable), `providers/llm/deepseek.py`, `providers/weather.py`. Fakes pour tests.
- **M4 — Repositories.** `domain/base.py` (cache-first) + `fixtures`/`standings` comme implémentations de référence, les autres en stub conforme.
- **M5 — Outils.** `tools/registry.py` (schéma JSON + validation d'args) + `tools/football.py` (façades minces).
- **M6 — Cœur.** `core/prerouter.py` (templates famille A), `core/orchestrator.py` (boucle function-calling), `core/synthesis.py`, `core/pipeline.py` (défensif). Repli LLM→templates opérationnel.
- **M7 — Modules optionnels supervisés.** `ingestion/`, `liveengine/`, `notifications/`, `monitoring/` (collecteur + exporter `/metrics` `/trace` `/bottlenecks`) en tâches isolées, toggleables. Adaptateur web complété (`POST /chat`). Suite d'acceptation §10 verte.

---

## 12. Conventions de code et garde-fous (à mettre dans `CLAUDE.md`)

- **Typage strict** partout ; `mypy --strict` doit passer.
- **Async** exclusif pour l'I/O ; pas d'appel bloquant dans la boucle.
- **Frontières** : `httpx` **seulement** dans `providers/` ; un module importe les **contrats** d'un autre, jamais son implémentation ; l'injection se fait dans `container.py`.
- **Aucun `await` externe sans timeout** ; **aucune tâche de fond sans `Supervisor`**.
- **Toute action de module est traçée** via `span()`/`@traced` ; émettre un span ne lève jamais et n'attend rien.
- **Le pipeline ne propage pas d'exception** vers l'adaptateur.
- Chaque module expose `name`, `required`, `provides`, `start`, `stop`, `health`.
- Erreurs = hiérarchie de `kernel/errors.py` ; jamais de `except: pass` silencieux (toujours logguer + marquer la santé).
- Config exclusivement via `Settings` ; pas de `os.environ` dispersé.
- Messages utilisateur en français, dégradation annoncée dans la voix du produit (« Le direct est momentanément indisponible, voici la dernière info connue. »).

---

### Résumé pour Claude Code

Pose une ossature hexagonale où chaque module a une responsabilité unique derrière un contrat, où le boot et les appels externes sont tolérants aux pannes, et où le pipeline garantit toujours une réponse. La réussite se mesure au §10 : l'application doit rester debout et utile même avec le LLM absent, l'API en panne, une tâche de fond qui crashe, ou n'importe quelle combinaison de modules optionnels désactivés.
