# CLAUDE.md — Oria

Guide prioritaire pour travailler sur ce repo. Lis-le en entier avant d'écrire du code.
La spécification complète est dans **`docs/oria-specs-techniques.md`** — ce fichier-ci n'en est que le condensé opérationnel.

---

## Ce qu'est Oria

Assistant IA sur le sport (football d'abord, extensible). Cœur **agnostique au canal** : il reçoit une `IncomingRequest{ user_id, text, context }` et renvoie une `Response`. Les canaux (web, Telegram…) sont de simples adaptateurs.
**État actuel : on pose l'ossature.** Là où la logique métier n'existe pas encore, on écrit un **stub conforme à l'interface** — jamais un module qui casse le boot.

---

## Invariants — à ne JAMAIS violer

1. **Un module = une responsabilité, derrière une interface.** Un module dépend des **contrats** (`kernel/contracts.py`) d'un autre, jamais de son implémentation concrète. Le câblage se fait uniquement dans `container.py`.
2. **`httpx` uniquement dans `providers/`.** Aucun autre package ne fait d'appel réseau sortant.
3. **Le pipeline ne lève jamais vers l'adaptateur.** `handle_message` renvoie **toujours** une `Response` valide (au pire dégradée).
4. **Boot tolérant.** Seuls `config`, `storage/db`, `storage/cache`, `core/pipeline`, `core/synthesis` sont `required=True`. Tout le reste est optionnel : si son `start()` échoue → log + statut DOWN + on continue.
5. **Une panne d'un module optionnel ne rend jamais l'app indisponible.** Elle est capturée, tracée, marquée DOWN ; le reste route autour.
6. **Aucun `await` externe sans timeout. Aucune tâche de fond sans `Supervisor`.**
7. **Toute action de module est traçée** (`span()` / `@traced`) ; émettre un span ne lève jamais et n'attend rien.
8. **Config uniquement via `Settings`** (`config.py`). Jamais de `os.environ` dispersé. Une clé/API absente ⇒ module concerné DOWN, **pas** de crash.
9. **Jamais de `except: pass` silencieux.** Toujours logger + marquer la santé.
10. **DeepSeek : `deepseek-v4-flash` (défaut) et `deepseek-v4-pro`.** Ne JAMAIS utiliser `deepseek-chat` / `deepseek-reasoner` (retirés).

---

## Carte de l'architecture

```
adapters  →  ports  →  core (pipeline → prerouter → orchestrator → synthesis)
                          │
                          ├─ tools ─→ domain (repositories cache-first)
                          │                     │
                          │                     └─ providers (apifootball, llm, weather)
                          │
        kernel (contracts, models, errors, resilience, health, tracing, events, logging)
        storage (db, cache, userstore)   ·   ingestion · liveengine · notifications · monitoring
```

Flux d'une requête : `adapter → InboundPort → pipeline → (prerouter | orchestrator+tools+repos) → synthesis → Response`.
Chaque repo est **cache-first** : cache → si frais, renvoyer → sinon fetch via provider (si budget OK) → écrire cache. Si fetch impossible → servir le **cache périmé** avec `freshness` + `degraded=True`.

---

## Contrat de module

Tout module concret implémente `Module` :

```python
name: str
required: bool                 # True => son échec de boot avorte l'app
provides: tuple[str, ...]      # capacités, ex. ("live_scores",)
async def start(self) -> None
async def stop(self) -> None
async def health(self) -> ModuleStatus
```

Avant d'utiliser une capacité optionnelle : `health.capability_available("live_scores")` → sinon route autour + `Response.degraded=True` + message clair.

---

## Résilience (primitives dans `kernel/resilience.py`)

- `@resilient(timeout, retries, breaker, fallback)` enveloppe **tout** appel externe : timeout → retry borné → circuit breaker (par dépendance) → fallback.
- `guard(stage, on_error)` enveloppe **chaque stage** du pipeline : capture, dégrade, ne propage pas.
- `Supervisor` porte **chaque tâche de fond** (ingestion, live, notifications, monitoring) : relance avec backoff, en isolation.
- `guard` et `@resilient` **émettent leurs spans automatiquement** — ne pas ré-instrumenter par-dessus.

---

## Monitoring (`monitoring/` + `kernel/tracing.py`)

Trace = arbre de spans par `request_id`. Émission **fire-and-forget** sur le bus (`kernel/events.py`) : le module tracé ne connaît pas le collecteur.
Le module `monitoring` est `required=False` : s'il est DOWN, les spans sont droppés, **l'app est inchangée**. Overhead cible < ~2 % (horloge monotone, buffers bornés, sampling ; erreurs et requêtes lentes toujours capturées).
Exposition : `/metrics`, `/trace/{id}`, `/bottlenecks`. Un dépassement de `STAGE_BUDGET_MS` marque un « goulot » et bascule le module en DEGRADED.

---

## Stack

Python 3.12+ · `uv` · `asyncio` · `httpx` · `pydantic` v2 + `pydantic-settings` · SQLite (`aiosqlite`) · `APScheduler` · SDK `openai` (base_url DeepSeek) · `tenacity` · `structlog` · `FastAPI`/`uvicorn`.
Tests : `pytest` + `pytest-asyncio` + `respx` + `time-machine`. Qualité : `ruff` + `mypy --strict`.

---

## Commandes

```bash
uv sync                          # installer
cp .env.example .env             # config locale
uv run python -m oria.main       # démarrer (console)
uv run uvicorn oria.adapters.web.app:app --reload   # démarrer (web)

uv run pytest                    # tests (offline, tout mocké)
uv run ruff check . && uv run ruff format --check .
uv run mypy src
```

---

## Ordre de construction

Livrer par jalons compilables/testables : **M0** socle → **M1** résilience/santé/traçage → **M2** stockage → **M3** providers → **M4** repositories → **M5** outils → **M6** cœur → **M7** modules optionnels + monitoring + web complet.
Détail dans `docs/oria-specs-techniques.md` §11.

---

## Definition of done

`mypy --strict` passe, `ruff` propre, **tous les tests verts sans réseau**, et les critères d'acceptation §10 de la spec sont couverts — notamment : boot sans LLM, API en panne servant le cache périmé, breaker qui s'ouvre, tâche de fond qui crashe et se relance, `handle_message` qui ne lève jamais, monitoring non intrusif, goulot détecté.

---

## Style

Typage strict partout · async pour l'I/O · messages utilisateur en français, dégradation annoncée dans la voix du produit (« Le direct est momentanément indisponible, voici la dernière info connue. ») · pas de sur-ingénierie : à ce stade, des stubs conformes valent mieux qu'une implémentation partielle qui casse le boot.
