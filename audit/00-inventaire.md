# Audit Oria - Etape 0 : Inventaire brut

> Cartographie exhaustive des modules, outils, patterns et tests existants.
> Produit le 2026-08-11. Aucun jugement dans ce document.

---

## 1. PreRouter (`src/oria/core/prerouter.py`)

### Flux
1. Tentative de resolution automatique du `team_id` via regex + `get_team_info(search=...)`
2. Normalisation du texte en minuscules
3. Parcours sequentiel des patterns regex ; retour au premier match
4. Si aucun match : `return None` (fallthrough vers orchestrateur)

### Patterns regex (ordre de parcours)

| # | Pattern | Handler | Tool appele | Attachment | Retourne None si |
|---|---------|---------|-------------|------------|-----------------|
| 1 | `\b(bonjour\|salut\|hello\|hey\|coucou)\b` | hardcode | aucun | aucun | jamais |
| 2 | `\b(aide\|help)\b` | hardcode | aucun | aucun | jamais |
| 3 | `\b(classement\|standings?)\b` | `_handle_standings` | `get_standings` | `table` | tools=None, exception, data vide |
| 4 | `\b(prochain\s+match\|next\s+match)\b` | `_handle_next_match` | `get_fixtures(next=1)` | `fixture_card` | idem |
| 5 | `\b(dernier\s+r[eE]sultat\|last\s+result\|score)\b` | `_handle_last_result` | `get_fixtures(last=1)` | `fixture_card` | idem |
| 6 | `\b(forme\|form)\b` | `_handle_form` | `get_fixtures(last=5)` | `table` | idem |
| 7 | `\b(calendrier\|programme\|schedule)\b` | `_handle_schedule` | `get_fixtures(next=5)` | `table` | idem |
| 8 | `\b(matchs?\|fixtures?\|rencontres?)\b` | `_handle_matches` | `get_fixtures` | `table` | idem |
| 9 | `\b(blessures?\|injur\|bless[eE]s?)\b` | `_handle_injuries` | `get_injuries` | `table` | idem |
| 10 | `\b(joueurs?\|players?\|effectif\|stats?\b)` | `_handle_players` | `get_player_stats` | `table` | idem |
| 11 | `\b(infos?\|informations?\|qui\s+est)\b` | `_handle_team_info` | `get_team_info` | `table` | idem |
| 12 | `\b(en\s+direct\|live\|en\s+cours)\b` | `_handle_live` | `get_live_scores` | `table` | idem |
| 13 | `\b(cotes?\|odds?\|pronostics?)\b` | `_handle_odds` | `get_odds` | `table` | idem |

### Resolution d'equipe (pre-pattern)
- Regex : `(?:du|de\s+l[']\s*|de\s+la\s+|de|d[']\s*)\s*([A-Za-z...]{1,25})`
- Stop list : la, le, les, un, une, des, ce, cette, mon, football, foot, ligue, saison, match, equipe, joueur
- Appel : `get_team_info(search=candidat)` si candidat >= 2 caracteres

---

## 2. Orchestrateur (`src/oria/core/orchestrator.py`)

### System prompt
```
Tu es Oria, un assistant expert en football.
Tu reponds en francais, de maniere concise et precise.
Tu utilises les outils disponibles pour recuperer les donnees les plus recentes.
Tu ne specules jamais -- si tu n'as pas les donnees, dis-le.
Tu indiques toujours la fraicheur des donnees quand elle est connue.
Ne revele jamais ton raisonnement interne (reasoning_content).
```

### Parametres
- `_MAX_TOOL_ROUNDS = 5`
- Validation arguments : JSON parse, pas de validation schema (deleguee au registry)
- Echec outil : erreur retournee au LLM comme message tool, boucle continue
- Echec LLM : log warning, return None
- Contexte : `[Contexte : league_id=X, team_id=Y, ...]` prepend au message user
- Historique : `conversation_history` injecte entre system prompt et message user

---

## 3. Pipeline (`src/oria/core/pipeline.py`)

### Stages (dans l'ordre)
1. **Entitlements** : `check(user_id, "chat_message")` -> quota_exceeded si DENY
2. **Context merge** : merge contexte persistant (ConversationService) avec contexte requete
3. **Conversation history** : recuperation des tours recents (window=20)
4. **PreRouter** : routage template, sortie rapide si match
5. **Orchestrateur** : LLM + outils, synthese si texte retourne
6. **Fallback final** : reponse degradee "Une erreur inattendue est survenue"

### Garantie "ne leve jamais"
- Double try/except : `_process()` -> `self._synthesis.fallback()` -> Response hardcode
- Chaque stage protege par `guard()` (catch silencieux)

---

## 4. Synthesis (`src/oria/core/synthesis.py`)

- `render(text, attachments, degraded, freshness)` -> Response valide
- `render_from_response(resp, freshness)` -> enrichit freshness si absent
- `quota_exceeded(reason)` -> degraded=True + SuggestedAction upgrade
- `fallback(reason)` -> degraded=True, message generique
- Null safety : None -> listes vides

---

## 5. Outils enregistres (`src/oria/tools/`)

### Registry (`registry.py`)
- Classes : `ToolDef(name, description, parameters, fn)`, `ToolRegistry`
- Methodes : `register()`, `get()`, `schemas()` (format OpenAI), `call()`

### Outils football (`football.py`) -- 10 outils

| # | Nom | Description | Params requis | Params optionnels |
|---|-----|-------------|---------------|-------------------|
| 1 | `get_fixtures` | Matchs d'une ligue/equipe | aucun | league_id, team_id, season, date, next, last |
| 2 | `get_standings` | Classement | league_id, season | aucun |
| 3 | `get_team_info` | Infos equipe | aucun | team_id, search |
| 4 | `get_player_stats` | Stats joueur | aucun | player_id, team_id, league_id, season |
| 5 | `get_injuries` | Blessures/suspensions | aucun | league_id, season, team_id, fixture_id |
| 6 | `get_lineups` | Compositions | fixture_id | aucun |
| 7 | `get_odds` | Cotes pre-match | aucun | fixture_id, league_id, season |
| 8 | `get_live_scores` | Scores en direct | aucun | league_id |
| 9 | `get_match_events` | Evenements match | fixture_id | aucun |
| 10 | `get_match_statistics` | Stats match | fixture_id | aucun |

### Outils MANQUANTS (requis par le catalogue)
- `get_h2h` (A7 : confrontations directes)
- `get_team_stats` (A9 : stats equipe saison)
- `get_top_scorers` / `get_top_assists` (A11 : meilleurs buteurs/passeurs)
- `get_squad` (A16 : effectif complet)
- outils `app/*` exposes au chat (follow, unfollow, get_quota, set_notifications...)

---

## 6. Domain Repositories (`src/oria/domain/`)

| Repository | Classe | Volatilite | Provides |
|------------|--------|-----------|----------|
| FixturesRepository | semi_rapide | fixtures |
| StandingsRepository | lent | standings |
| TeamsRepository | immuable | teams |
| PlayersRepository | lent | players |
| InjuriesRepository | semi_rapide | injuries |
| LineupsRepository | semi_rapide | lineups |
| OddsRepository | semi_rapide | odds |
| LiveRepository | live | live_scores |
| EventsRepository | semi_rapide | events |
| StatisticsRepository | semi_rapide | statistics |
| LeaguesRepository | immuable | leagues |

### Events domaine
- `DomainEvent` (base), `GoalEvent`, `CardEvent`, `MatchStartEvent`, `MatchEndEvent`, `LineupEvent`, `SubstitutionEvent`

---

## 7. Entitlements (`src/oria/app/entitlements/`)

### Features gatees

| Feature key | Free tier | Premium tier | Decision |
|-------------|-----------|-------------|----------|
| `chat_message` | 20/jour | 1000/jour | ALLOW / DENY |
| `live_realtime` | non | oui | ALLOW / UPGRADE_REQUIRED |
| `deep_analysis` | non | oui | ALLOW / UPGRADE_REQUIRED |
| `alert` | 1/jour | 9999/jour | ALLOW / UPGRADE_REQUIRED |
| `history_days` | 7 jours | 365 jours | implicite |

### Service
- `check(user_id, feature)` -> Decision
- `consume(user_id, feature, n)` -> increment compteur
- `usage(user_id)` -> UsageSnapshot

---

## 8. Preferences (`src/oria/app/preferences/`)

### Follow
- Modele : `Follow(user_id, entity_type, entity_id, entity_name, logo_url)`
- entity_type : league | team | player
- Service : `follow()`, `unfollow()`, `list_follows()`, `aggregated_registry()`

### NotificationSettings
- Champs : prematch, result, lineup, live_goal, digest, quiet_start, quiet_end, timezone
- Service : `get()`, `update(**fields)`, `get_subscribers(event_type)`

---

## 9. Conversations (`src/oria/app/conversations/`)

### Turn
- Modele : `Turn(user_id, role, text, metadata, created_at)`
- Stockage : append-only log en SQLite

### Context persistant
- Modele : `Context` (meme que kernel.models)
- Table : `active_context` (singleton par user, upsert)

### Service
- `append()`, `recent(limit=20)`, `get_window()`, `set_context()`, `get_context()`, `clear()`

---

## 10. Tests existants

### test_pertinence.py
- `TestPreRouterIntentDetection` : salutations (4), aide (2), bypass complexe (2), detection standings/next (2)
- `TestPreRouterWithTools` : standings table, next fixture_card, last result, forme, calendrier, standings EN
- `TestPipelinePertinence` : fallback, salutation pipeline, ne leve jamais, quota exceeded
- `TestOrchestratorPertinence` : context hints (3), sans LLM, avec LLM mock, tool loop, history, LLM failure
- `TestSynthesisPertinence` : render basique, degrade, fallback, quota upgrade
- `TestToolRegistryPertinence` : schemas complets, call inconnu

### test_campaign.py
- 40+ questions E2E (salutations, help, classements, next match, last result, forme, calendrier, matchs ligue, team info, blessures, player stats, live, odds, analytique, hors-sujet, edge cases)
- Tests cache (reformulations)
- Generation rapport JSON/texte

### test_degradation.py
- Boot minimal, LLM absent, API failure/stale cache, circuit breaker, supervisor restart
- Pipeline invariant (5 params), broken stages, flag combinations, repo isolation
- Architecture boundaries (httpx), tracing, monitoring non-intrusive, bottleneck detection

### test_pipeline.py
- Pipeline returns Response, never raises

### test_resilience.py
- CircuitBreaker (closed, open, half-open, recovery), Resilient (timeout, fallback), Guard, Supervisor

### test_boot.py
- Boot optional down, required failure aborts, capabilities registered

### test_apifootball.py
- Mappers (12 tests), Governor (9 tests), Client (13 tests), Breaker integration

### test_precision.py
- Mapper precision, Cache roundtrip, Governor budget exact, Repository precision, Client precision

### test_latence.py
- Cache (<5ms), Governor (<0.1ms), PreRouter (<10ms), Pipeline (<15ms), Breaker, Negative cache, Single flight, Mapper (<1ms), Synthesis (<2ms)

### test_admin.py
- Auth (401/token/bearer/JWT), Endpoints (health/metrics/quota/traces), JWT admin

### test_integration_api.py
- Real API : fixtures L1, standings, team PSG, players, injuries, governor budget, latence moyenne

---

## 11. Fixtures de test (`tests/fixtures/apifootball/`)

| Fichier | Contenu |
|---------|---------|
| `fixtures_response.json` | Matchs type API-Football |
| `standings_response.json` | Classement |
| `teams_response.json` | Info equipe |
| `players_response.json` | Stats joueurs |
| `injuries_response.json` | Blessures |
| `lineups_response.json` | Compositions |
| `odds_response.json` | Cotes |
| `events_response.json` | Evenements match |
| `statistics_response.json` | Stats match |
| `empty_response.json` | Reponse vide |
| `error_response.json` | Reponse erreur |

---

## 12. Configuration (`src/oria/config.py`)

### Settings (Pydantic BaseSettings)
- Cles API : `apifootball_key`, `deepseek_api_key`, `weather_api_key`, `admin_token`
- Modules : `enable_llm`, `enable_ingestion`, `enable_live`, `enable_push`, `enable_odds`, `enable_weather`
- Quotas : `free_daily_messages=20`, `premium_daily_messages=1000`
- Resilience : `breaker_fail_max=5`, `breaker_reset_seconds=30`, `default_timeout_seconds=8`
- LLM : `llm_model_fast="deepseek-v4-flash"`, `llm_model_deep="deepseek-v4-pro"`
- DB : `db_path="./oria.db"`
