# API-Football v3 — Catalogue des endpoints

> Sources : [API-Sports Documentation](https://api-sports.io/documentation/football/v3),
> [Educative course](https://www.educative.io/courses/getting-soccer-data-with-api-football-in-javascript/request-and-response-structure),
> [API-Football Beginner Guide](https://www.api-football.com/news/post/how-to-get-started-with-api-football-the-complete-beginners-guide)

---

## 1. Authentification

| Mode | Base URL | En-têtes |
|------|----------|----------|
| **direct** (api-sports.io) | `https://v3.football.api-sports.io` | `x-apisports-key: <KEY>` |
| **rapidapi** | `https://api-football-v1.p.rapidapi.com/v3` | `x-rapidapi-key: <KEY>` + `x-rapidapi-host: api-football-v1.p.rapidapi.com` |

Toutes les requêtes sont **GET uniquement**.

## 2. En-têtes de quota (réponse)

| En-tête | Signification |
|---------|---------------|
| `x-ratelimit-requests-limit` | Budget journalier total |
| `x-ratelimit-requests-remaining` | Requêtes restantes aujourd'hui |
| `X-RateLimit-Limit` | Appels max par minute |
| `X-RateLimit-Remaining` | Appels restants cette minute |

## 3. Structure commune des réponses

```json
{
  "get": "fixtures",
  "parameters": { "league": "61", "season": "2024" },
  "errors": [],
  "results": 380,
  "paging": { "current": 1, "total": 1 },
  "response": [ ... ]
}
```

Les erreurs sont dans le champ `errors` (objet ou tableau). Code HTTP 200 même en cas
d'erreur logique (clé invalide, paramètre manquant).

## 4. Endpoints

### 4.1 `/fixtures`

Matchs passés, à venir ou en cours.

| Param | Requis | Description |
|-------|--------|-------------|
| `id` | — | ID du match |
| `ids` | — | Jusqu'à 20 IDs séparés par `-` |
| `league` | — | ID de la ligue |
| `season` | — | Année (YYYY) |
| `team` | — | ID de l'équipe |
| `date` | — | Date (YYYY-MM-DD) |
| `from` | — | Date début |
| `to` | — | Date fin |
| `status` | — | Statut (NS, 1H, HT, 2H, FT, etc.) |
| `live` | — | `all` ou `id-id` pour les matchs en cours |
| `timezone` | — | Fuseau horaire |

**Volatilité** : `semi_rapide` (matchs planifiés), `live` (matchs en cours)
**TTL** : 300 s (planifiés), 15 s (live, mis à jour toutes les 15 s)

### 4.2 `/fixtures/headtohead`

Confrontations directes entre deux équipes.

| Param | Requis | Description |
|-------|--------|-------------|
| `h2h` | **oui** | `teamA_id-teamB_id` |
| `date` | — | Date |
| `league` | — | ID ligue |
| `season` | — | Année |
| `last` | — | N derniers matchs |
| `next` | — | N prochains |

**Volatilité** : `lent` — **TTL** : 3600 s

### 4.3 `/fixtures/lineups`

Compositions d'équipe pour un match.

| Param | Requis | Description |
|-------|--------|-------------|
| `fixture` | **oui** | ID du match |
| `team` | — | ID équipe |

**Volatilité** : `semi_rapide` — **TTL** : 300 s (dispo ~30 min avant le coup d'envoi)

### 4.4 `/fixtures/statistics`

Statistiques d'un match (possession, tirs, corners…).

| Param | Requis | Description |
|-------|--------|-------------|
| `fixture` | **oui** | ID du match |
| `team` | — | ID équipe |

**Volatilité** : `semi_rapide` (live pendant le match) — **TTL** : 300 s / 15 s (live)

### 4.5 `/fixtures/events`

Événements du match (buts, cartons, remplacements).

| Param | Requis | Description |
|-------|--------|-------------|
| `fixture` | **oui** | ID du match |
| `team` | — | ID équipe |
| `player` | — | ID joueur |
| `type` | — | Type (Goal, Card, Subst, Var) |

**Volatilité** : `live` (mis à jour toutes les 15 s pendant le match) — **TTL** : 15 s

### 4.6 `/standings`

Classement d'une ligue.

| Param | Requis | Description |
|-------|--------|-------------|
| `league` | **oui** | ID ligue |
| `season` | **oui** | Année |
| `team` | — | ID équipe (filtre) |

**Volatilité** : `lent` — **TTL** : 3600 s

### 4.7 `/teams`

Informations sur les équipes.

| Param | Requis | Description |
|-------|--------|-------------|
| `id` | — | ID équipe |
| `league` | — | ID ligue |
| `season` | — | Année |
| `country` | — | Pays |
| `name` | — | Nom exact |
| `search` | — | Recherche (≥ 3 car.) |

**Volatilité** : `immuable` — **TTL** : 86400 s (infos rarement modifiées)

### 4.8 `/teams/statistics`

Statistiques saisonnières d'une équipe.

| Param | Requis | Description |
|-------|--------|-------------|
| `league` | **oui** | ID ligue |
| `season` | **oui** | Année |
| `team` | **oui** | ID équipe |

**Volatilité** : `lent` — **TTL** : 3600 s

### 4.9 `/players`

Statistiques de joueurs (paginé, 20 par page).

| Param | Requis | Description |
|-------|--------|-------------|
| `id` | — | ID joueur |
| `team` | — | ID équipe |
| `league` | — | ID ligue |
| `season` | — | Année |
| `page` | — | Page (défaut 1) |

**Volatilité** : `lent` — **TTL** : 3600 s

### 4.10 `/players/topscorers`

Top 20 buteurs d'une ligue.

| Param | Requis | Description |
|-------|--------|-------------|
| `league` | **oui** | ID ligue |
| `season` | **oui** | Année |

**Volatilité** : `lent` — **TTL** : 3600 s

### 4.11 `/players/topassists`

Top 20 passeurs d'une ligue.

| Param | Requis | Description |
|-------|--------|-------------|
| `league` | **oui** | ID ligue |
| `season` | **oui** | Année |

**Volatilité** : `lent` — **TTL** : 3600 s

### 4.12 `/injuries`

Blessures et suspensions.

| Param | Requis | Description |
|-------|--------|-------------|
| `fixture` | — | ID du match |
| `league` | — | ID ligue |
| `season` | — | Année |
| `team` | — | ID équipe |
| `player` | — | ID joueur |
| `date` | — | Date |
| `timezone` | — | Fuseau |

**Volatilité** : `semi_rapide` — **TTL** : 300 s

### 4.13 `/odds`

Cotes pré-match.

| Param | Requis | Description |
|-------|--------|-------------|
| `fixture` | — | ID du match |
| `league` | — | ID ligue |
| `season` | — | Année |
| `date` | — | Date |
| `bookmaker` | — | ID bookmaker |
| `bet` | — | ID type de pari |
| `page` | — | Page |

**Volatilité** : `semi_rapide` — **TTL** : 300 s
