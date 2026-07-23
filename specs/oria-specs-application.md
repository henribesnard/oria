# Oria — Spécifications de développement de l'application complète

> Destinataire : **Claude Code**. Prérequis : l'ossature (voir `oria-specs-techniques.md`) et la couche d'appels API-Football sont déjà en place et testées. Ce document spécifie le **développement complet, module par module**, de l'authentification jusqu'au monitoring admin.
>
> Principe directeur de bout en bout : **on développe l'application (web d'abord), mais tout le métier reste agnostique au canal.** Telegram/Discord ne seront que des adaptateurs ajoutés plus tard, sans toucher au cœur. Chaque module ci-dessous précise explicitement sa « note canal ».

---

## 1. Ce qui est agnostique au canal, et ce qui ne l'est pas

C'est la décision structurante de tout le document. On sépare trois cercles :

- **Cercle cœur (agnostique).** Identité/comptes, abonnement, quotas, préférences/suivis, mémoire de conversation, pipeline conversationnel, données, notifications (côté logique). Tout y raisonne sur un `user_id` abstrait et des `IncomingRequest`/`Response` abstraites. **Aucun de ces modules ne sait ce qu'est Telegram.**
- **Cercle authentification (partiellement spécifique).** Le *concept* d'identité est agnostique ; les *méthodes* d'auth ne le sont pas. Le web utilise email/mot de passe + OAuth + sessions. Telegram, lui, fait confiance à l'identité de sa plateforme. On réconcilie les deux avec un **modèle de liaison d'identités** (§3).
- **Cercle adaptateurs (spécifique).** Traduction entrée/sortie propre à chaque canal. Web (FastAPI) aujourd'hui ; Telegram/Discord demain. Fins par construction.

**Règle d'or :** si un module a besoin de savoir « d'où vient l'utilisateur » autrement que via un `user_id` déjà résolu, c'est un bug d'architecture. La résolution `(canal, identifiant externe) → user_id` se fait **une seule fois**, à la frontière, par l'`IdentityService`.

---

## 2. Vue d'ensemble des modules à développer

```
adapters/web  (surface HTTP : auth, compte, billing, chat, suivis, réglages, admin)
   │
   ▼  InboundPort / OutboundPort
app/                         # services applicatifs, agnostiques au canal
├─ identity/                 # comptes + liaison d'identités multi-canal
├─ auth/                     # auth web (mots de passe, OAuth, sessions/JWT, reset)
├─ billing/                  # abonnement, tiers, Stripe, webhooks
├─ entitlements/             # quotas freemium + gating de fonctionnalités
├─ preferences/             # suivis (follows) + réglages de notifications
├─ conversations/           # mémoire multi-tours + contexte persistant
└─ notifications/           # logique de push (route via OutboundPort)

core/                        # cerveau conversationnel (pipeline complet)
tools/ + domain/ + providers/  # données (API-Football, LLM) — cache-first
ingestion/ + liveengine/     # proactif + live (tâches supervisées)
monitoring/                  # traçage + métriques + endpoints admin
kernel/                      # contrats, résilience, santé, traçage (déjà en place)
storage/                     # db, cache, userstore (étendu ici)
```

Chaque module suit le même gabarit de spec : **Responsabilité · Interface · Données · Règles métier · Dépendances · Dégradation · Tests · Note canal.**

---

## 3. Module `identity` — comptes et liaison multi-canal (à développer en premier)

**Responsabilité.** Détenir le compte utilisateur (l'identité *interne* d'Oria) et relier à ce compte une ou plusieurs identités *externes* (email web, Google, Apple, plus tard Telegram, Discord). C'est la clé de voûte du multi-canal.

**Interface.**
```python
class IdentityService(Protocol):
    async def resolve_or_create(self, provider: str, external_id: str,
                                profile: dict | None = None) -> User: ...
    async def link(self, user_id: str, provider: str, external_id: str) -> None: ...
    async def unlink(self, user_id: str, provider: str) -> None: ...
    async def get(self, user_id: str) -> User | None: ...
    async def update_profile(self, user_id: str, **fields) -> User: ...
    async def delete_account(self, user_id: str) -> None: ...   # RGPD : purge complète
```

**Données.**
- `users(id, status, role, display_name, locale, timezone, created_at, deleted_at)` — `role ∈ {user, admin}`.
- `identities(id, user_id, provider, external_id, created_at, UNIQUE(provider, external_id))` — plusieurs identités → un seul `user_id`.

**Règles métier.** `resolve_or_create` est **idempotent** : si `(provider, external_id)` existe, renvoyer le compte ; sinon créer le user + l'identité en transaction. La suppression de compte purge users + identities + follows + conversations + subscriptions (RGPD), et anonymise les traces.

**Note canal.** C'est ici que le multi-canal devient réel : le web crée un compte via l'identité `email`. Quand Telegram arrivera, son adaptateur appellera `resolve_or_create("telegram", tg_user_id)` → si l'utilisateur a déjà lié Telegram à son compte web, **même `user_id`, même abonnement, mêmes suivis**. Sinon, nouveau compte, liable ensuite depuis le profil web.

**Tests.** Idempotence de `resolve_or_create` ; liaison/déliaison ; suppression RGPD complète ; deux providers → un user.

---

## 4. Module `auth` — authentification web

**Responsabilité.** Authentifier les utilisateurs **sur le canal web** et émettre des sessions. S'appuie sur `identity` pour le compte sous-jacent.

**Interface.**
```python
class AuthService(Protocol):
    async def register_email(self, email: str, password: str, locale: str) -> User: ...
    async def login_email(self, email: str, password: str) -> TokenPair: ...
    async def verify_email(self, token: str) -> None: ...
    async def request_password_reset(self, email: str) -> None: ...
    async def reset_password(self, token: str, new_password: str) -> None: ...
    async def oauth_callback(self, provider: str, code: str) -> TokenPair: ...
    async def refresh(self, refresh_token: str) -> TokenPair: ...
    async def logout(self, refresh_token: str) -> None: ...
```

**Données.**
- `credentials(user_id, email UNIQUE, password_hash, email_verified, created_at)` — hash **argon2id** (jamais de mot de passe en clair, jamais loggé).
- `sessions(id, user_id, refresh_token_hash, user_agent, ip, expires_at, revoked_at)`.
- `tokens(id, user_id, kind, token_hash, expires_at, used_at)` — `kind ∈ {email_verify, password_reset}`, usage unique, TTL court.

**Règles métier & sécurité.**
- Auth par **JWT court (access, ~15 min)** + **refresh opaque en base** (rotation à chaque refresh, révocable). Cookies `HttpOnly`, `Secure`, `SameSite=Lax` ; protection CSRF sur les mutations si cookies.
- **OAuth Google/Apple** : flux authorization-code ; à la fin, `identity.resolve_or_create(provider, sub)` + émission de tokens.
- Rate-limit des tentatives de login (par IP + par compte), verrouillage temporaire après N échecs.
- Emails (vérification, reset) via un `MailProvider` dans `providers/` (SMTP/API, clé en `.env`) ; liens à usage unique et expirants. Ne jamais révéler si un email existe (réponse identique).
- **Tous les secrets en `.env`** : `JWT_SECRET`, `OAUTH_GOOGLE_*`, `OAUTH_APPLE_*`, `MAIL_*`.

**Dégradation.** MailProvider down → l'inscription réussit mais l'email de vérification est mis en file de retry (superviseur) ; l'utilisateur peut redemander l'envoi. OAuth provider down → message clair, login email reste possible.

**Note canal.** `auth` est **spécifique au web**. Le cœur ne dépend jamais de `auth`, seulement d'un `user_id` résolu. Un canal à identité déléguée (Telegram) court-circuite `auth` et passe par `identity` directement.

**Tests.** Hash/verify ; cycle inscription→vérif→login ; rotation refresh + révocation ; reset password à usage unique ; OAuth mocké ; rate-limit login.

---

## 5. Module `billing` — abonnement et facturation

**Responsabilité.** Gérer les paliers (Free/Premium), la souscription via Stripe, et l'état d'abonnement de chaque compte. Source de vérité des **droits** consommés par `entitlements`.

**Étape d'exploration (comme pour API-Football).** Lire la doc Stripe courante (Checkout, Customer Portal, Webhooks, Subscriptions) avant d'implémenter ; ne rien coder en dur d'après la mémoire. Produire `docs/stripe-catalog.md` (endpoints/événements utilisés).

**Interface.**
```python
class SubscriptionService(Protocol):
    async def get_tier(self, user_id: str) -> Tier: ...              # Free | Premium
    async def start_checkout(self, user_id: str, plan: str) -> str: ...  # -> URL Checkout
    async def open_portal(self, user_id: str) -> str: ...            # -> URL Customer Portal
    async def handle_webhook(self, payload: bytes, sig: str) -> None: ...
    async def cancel(self, user_id: str) -> None: ...
```

**Données.**
- `subscriptions(user_id, tier, status, stripe_customer_id, stripe_sub_id, current_period_end, cancel_at_period_end, updated_at)`.
- `billing_events(id, user_id, type, stripe_event_id UNIQUE, received_at)` — **idempotence webhook**.

**Règles métier.**
- Les **limites par palier** sont pilotées par la config (pas en dur) :

| Palier | Messages/jour | Live | Alertes push | Analyse `pro` (deepseek-v4-pro) | Historique |
|---|---|---|---|---|---|
| Free | ex. 20 | lecture snapshot | 1 équipe | non | 7 jours |
| Premium | élevé/illimité | temps réel | illimité | oui | complet |

- **Webhooks idempotents** (clé `stripe_event_id`), signature vérifiée (`STRIPE_WEBHOOK_SECRET` en `.env`). Sur `subscription.updated/deleted`, mettre à jour le tier ; sur `payment_failed`, marquer `past_due` (grâce configurable avant downgrade).
- Secrets `.env` : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*`.

**Dégradation.** Stripe injoignable → servir le **dernier tier connu** depuis le cache (ne jamais verrouiller un utilisateur payant à cause d'une panne Stripe) ; les webhooks manqués sont rattrapés par une réconciliation périodique (job d'ingestion).

**Note canal.** Le tier est attaché au `user_id`, donc **partagé entre canaux** automatiquement. Le paiement se fait sur le web (Checkout) ; Telegram lira le même tier.

**Tests.** Webhook idempotent (même event 2× → 1 effet) ; signature invalide rejetée ; upgrade/downgrade → tier reflété ; Stripe down → tier servi depuis cache.

---

## 6. Module `entitlements` — quotas freemium et gating

**Responsabilité.** Décider, **avant** toute action coûteuse, si l'utilisateur y a droit (palier + quota du jour). Point d'application unique du freemium.

**Interface.**
```python
class Entitlements(Protocol):
    async def check(self, user_id: str, feature: str) -> Decision: ...   # allow | deny(reason) | upgrade_required
    async def consume(self, user_id: str, feature: str, n: int = 1) -> None: ...
    async def usage(self, user_id: str) -> UsageSnapshot: ...
```

**Données.** `usage_counters(user_id, day, feature, count)` — remise à zéro quotidienne (fenêtre UTC). Cache chaud pour la lecture rapide.

**Règles métier.** Le **pipeline appelle `check()` en tout début de traitement** (stage dédié, sous `guard`). Si `deny/upgrade_required`, renvoyer une `Response` cadrée (`degraded=False`, mais avec `suggested_actions=[{label:"Passer à Premium", ...}]`) — pas une erreur. `consume()` après une action réussie. Les features nommées : `chat_message`, `live_realtime`, `alert`, `deep_analysis`.

**Dégradation.** Compteur illisible (cache down) → politique « fail-open modérée » configurable (autoriser mais logguer), pour ne pas bloquer un utilisateur à cause d'une panne interne.

**Note canal.** Quotas par `user_id` → identiques quel que soit le canal. Un même utilisateur ne double pas son quota en passant du web à Telegram.

**Tests.** Dépassement du quota Free → `upgrade_required` ; reset quotidien ; Premium non bloqué ; gating `deep_analysis` réservé Premium.

---

## 7. Module `preferences` — suivis et réglages de notification

**Responsabilité.** Détenir ce que l'utilisateur suit (équipes/ligues/joueurs) et comment il veut être notifié. Alimente le **registre agrégé de pré-fetch** (ingestion) et le dispatcher (notifications).

**Interface.**
```python
class FollowService(Protocol):
    async def follow(self, user_id: str, kind: str, target_id: int) -> None: ...
    async def unfollow(self, user_id: str, kind: str, target_id: int) -> None: ...
    async def list_follows(self, user_id: str) -> list[Follow]: ...
    async def aggregated_registry(self) -> AggregatedFollows: ...   # union globale, pour l'ingestion

class NotificationSettings(Protocol):
    async def get(self, user_id: str) -> Settings: ...
    async def update(self, user_id: str, **fields) -> Settings: ...
```

**Données.** `follows(user_id, kind, target_id, created_at)` ; `notification_settings(user_id, prematch, result, lineup, live_goal, digest, quiet_hours, timezone)`.

**Règles métier.** `follow()` étend le périmètre de pré-fetch (effet de bord clé). `aggregated_registry()` = union de tous les follows → c'est **exactement** ce que l'ingestion pré-charge, rien de plus.

**Note canal.** Suivis et réglages par `user_id`. Les réglages incluront plus tard un champ « canal de livraison préféré » (web/email/telegram) sans changer la structure.

**Tests.** Follow/unfollow idempotents ; agrégation correcte ; réglages persistés et lus.

---

## 8. Module `conversations` — mémoire multi-tours et contexte

**Responsabilité.** Mémoriser le fil récent par utilisateur et **le contexte sélectionné dans l'UI** (pays/ligue/match/joueur), pour les questions de suivi (« et son prochain match ? »).

**Interface.**
```python
class ConversationService(Protocol):
    async def append(self, user_id: str, role: str, content: str) -> None: ...
    async def recent(self, user_id: str, limit: int = 20) -> list[Turn]: ...
    async def set_context(self, user_id: str, context: Context) -> None: ...
    async def get_context(self, user_id: str) -> Context: ...
    async def clear(self, user_id: str) -> None: ...
```

**Données.** `conversations(user_id, turns_json, updated_at)` ; `active_context(user_id, context_json, updated_at)`. Fenêtre bornée (troncature au-delà de N tours).

**Règles métier.** Le contexte (IDs résolus venant du sélecteur) **persiste** jusqu'à changement ; il est injecté dans l'orchestrateur pour éviter la re-résolution d'entités. L'historique alimente le prompt du LLM (borné pour le coût tokens).

**Note canal.** Le fil est par `user_id` : reprendre une conversation web sur Telegram deviendra trivial.

**Tests.** Persistance du contexte entre tours ; troncature ; effacement.

---

## 9. Cœur conversationnel — implémentation complète

L'ossature existait ; on la rend fonctionnelle. Le **pipeline** enchaîne, chacun sous `guard` + span :

1. **Entitlement stage.** `entitlements.check(user_id, "chat_message")` → si refus, réponse d'upgrade et fin.
2. **Pré-routeur** (`core/prerouter`). Templates déterministes pour la famille A (classement, prochain match, dernier résultat…) : lit directement les repos, **sans LLM**. Réponse immédiate si match.
3. **Orchestrateur** (`core/orchestrator`). Boucle function-calling `deepseek-v4-flash` : injecte le contexte résolu + la mémoire récente, expose les outils (`tools/`), **valide les arguments** produits par le LLM, exécute, ré-injecte, boucle jusqu'à réponse. `deepseek-v4-pro` (thinking) pour `deep_analysis` (Premium). N'expose jamais le `reasoning_content`.
4. **Synthèse** (`core/synthesis`). Rédige la réponse finale ; construit les `attachments` (fixture_card, table) ; renseigne `freshness` depuis `fetched_at` ; `degraded=True` si servi sur cache périmé.
5. **Consume + persist.** `entitlements.consume`, `conversations.append`.

**Streaming.** L'orchestrateur/synthèse peuvent produire une réponse **en flux** (async generator) ; l'adaptateur web la relaie en SSE. Le contrat `InboundPort` garde une variante `handle_message` (bloquante) **et** `stream_message` (générateur), les deux garantissant de ne jamais lever.

**Dégradation.** LLM down → pré-routeur/templates couvrent la famille A ; outil manquant → l'orchestrateur route sans lui ; tout échec de stage → repli, jamais d'exception vers l'adaptateur.

**Tests.** Pré-routeur répond sans LLM ; boucle d'outils avec args validés/hallucinés ; injection de contexte ; gating `deep_analysis` ; invariant « ne lève jamais » ; streaming produit un flux valide.

---

## 10. Données — tools, repositories, ingestion, live (complets)

**Tools + repositories.** Tous les outils football réels, cache-first, déjà cadrés par la couche API. Compléter les repos restants (injuries, lineups, odds, players, live) sur le même patron `BaseRepository`.

**Ingestion** (`ingestion/`, tâche supervisée). Jobs APScheduler pilotés par `preferences.aggregated_registry()` : classements 1–2×/jour, calendriers/matchs du jour groupés par ligue, stats/buteurs 1×/jour, compos ~45–60 min avant chaque match du périmètre, réconciliation billing. Ne pré-charge **que** le périmètre suivi.

**Live engine** (`liveengine/`, tâche supervisée). Un **poller unique partagé par match**, activé au coup d'envoi, coupé au statut terminé, fréquence adaptative, plafond de concurrence selon budget restant. Fan-out des événements (but, carton, fin) vers le bus → cache + notifications. Single-flight obligatoire.

**Dégradation.** Ingestion down → fetch à la demande (plus lent, pas de panne). Live down → capacité `live_scores` DOWN, le factuel/analyse continuent.

**Tests.** Ingestion pilotée par le registre ; live : 1 poller pour N abonnés ; arrêt au coup de sifflet ; plafond de concurrence respecté.

---

## 11. Module `notifications` — push et port sortant

**Responsabilité.** Router les événements proactifs (rappel avant-match, résultat, compo, but live, digest) vers le bon utilisateur, via l'`OutboundPort`, en **consommant le cache** déjà rempli (quasi zéro appel API dédié).

**Interface.**
```python
class NotificationDispatcher(Protocol):
    async def on_event(self, event: DomainEvent) -> None: ...   # abonné au bus
class OutboundPort(Protocol):
    async def send(self, user_id: str, message: Response) -> None: ...
```

**Règles métier.** À chaque événement : déterminer les abonnés (via `preferences`), filtrer par réglages + quiet hours + `entitlements` (alertes Premium), formater une `Response`, et pousser via l'`OutboundPort` du **canal préféré** de l'utilisateur. Idempotence (ne pas notifier deux fois le même but).

**Livraison web (maintenant).** Deux `OutboundPort` concrets : **email** (digests, résultats) et **web push / SSE** (alertes temps réel quand l'onglet est ouvert). 

**Dégradation.** Un canal de sortie down → retry supervisé + repli sur un canal alternatif (ex. email) ; jamais de perte silencieuse.

**Note canal.** Le dispatcher est **totalement agnostique** : ajouter Telegram = fournir un `TelegramOutboundPort.send()` et l'enregistrer. Zéro changement dans la logique de notification.

**Tests.** Fan-out correct ; respect quiet hours/réglages ; idempotence but ; repli de canal.

---

## 12. Surface API web (`adapters/web`)

Adaptateur **fin** : il traduit HTTP ↔ services applicatifs, gère l'authz (middleware session/JWT + garde admin), et le temps réel (SSE). Il ne contient **aucune** logique métier.

| Domaine | Endpoints (indicatifs) |
|---|---|
| Auth | `POST /auth/register` · `/auth/login` · `/auth/refresh` · `/auth/logout` · `/auth/verify` · `/auth/reset` · `GET /auth/oauth/{provider}` + callback |
| Compte | `GET/PATCH /me` · `DELETE /me` · `GET /me/identities` · `POST /me/identities/link` |
| Billing | `GET /billing/subscription` · `POST /billing/checkout` · `POST /billing/portal` · `POST /billing/webhook` (public, signé) |
| Chat | `POST /chat` (bloquant) · `POST /chat/stream` (SSE) |
| Suivis | `GET/POST/DELETE /follows` |
| Réglages | `GET/PATCH /settings/notifications` |
| Contexte | `GET /catalog/countries|leagues|teams|players` (peuple le sélecteur, **depuis le cache**) |
| Temps réel | `GET /live/{fixture_id}/stream` (SSE) |
| Santé publique | `GET /health` |
| Admin | `GET /admin/*` (voir §13), **derrière rôle admin** |

**Règles.** Validation d'entrée (pydantic) ; erreurs mappées proprement (jamais de stacktrace) ; CORS restreint ; le webhook billing est le seul endpoint mutant non authentifié (protégé par signature). Le `POST /chat` construit une `IncomingRequest{user_id (résolu par la session), text, context}` et appelle l'`InboundPort` — **exactement** ce qu'un futur adaptateur Telegram fera.

**Tests.** Authz (anonyme rejeté, admin requis sur `/admin`) ; SSE émet des chunks ; webhook signé ; le chat passe par le même `InboundPort` que la console.

---

## 13. Admin & monitoring (backend du dashboard)

**Responsabilité.** Donner une lecture **instantanée** de l'état de tous les modules et des goulots, et permettre la gestion des utilisateurs. Consomme le module `monitoring` et le `HealthRegistry` — **aucun appel API-Football**, **aucun secret** dans les réponses.

**Endpoints (rôle admin obligatoire, `ADMIN` via rôle en base ; `ADMIN_BOOTSTRAP_TOKEN` en `.env` pour le premier admin).**

| Endpoint | Contenu |
|---|---|
| `GET /admin/health` | Snapshot par module (up/degraded/down) + capacités |
| `GET /admin/metrics` | p50/p95/p99 par module/action, taux d'erreur, part de temps |
| `GET /admin/quota` | Quota API-Football (restant/limite, appels du jour), cache hit ratio/domaine, tokens LLM (flash/pro), état des breakers, fallbacks servis |
| `GET /admin/traces` · `/admin/trace/{id}` | Traces récentes + **waterfall** d'une requête |
| `GET /admin/bottlenecks` | Top des actions par part de temps / p95 / taux d'erreur |
| `GET /admin/live` | Pollers actifs + latence |
| `GET /admin/users` · `PATCH /admin/users/{id}` | Table (rôle, palier, statut), recherche, actions (suspendre, changer rôle) |

**Dégradation.** `monitoring` down → `/admin/health` et `/admin/quota` restent servis depuis le `HealthRegistry` (dégradés, sans les traces détaillées) ; l'admin voit toujours qui est up/down.

**Tests.** Accès refusé sans rôle admin ; aucun secret dans les payloads ; `/admin/trace/{id}` renvoie l'arbre de spans ; un goulot injecté apparaît dans `/admin/bottlenecks`.

---

## 14. Frontière multi-canal — check-list pour un futur canal

Pour que « ajouter Telegram/Discord » reste un simple branchement, tout nouveau canal doit fournir **uniquement** :

1. Un **adaptateur entrant** : reçoit l'événement du canal → `identity.resolve_or_create(provider, external_id)` → construit `IncomingRequest{user_id, text, context}` → appelle l'`InboundPort`.
2. Un **adaptateur sortant** : implémente `OutboundPort.send(user_id, Response)` au format du canal, et s'enregistre auprès du dispatcher.
3. Éventuellement une **liaison d'identité** depuis le profil web (« Connecter mon Telegram »).

Ce que le canal **ne touche jamais** : comptes, abonnement, quotas, pipeline, données, notifications (logique). Si un développement de canal exige de modifier un module du cœur, c'est le signe d'une fuite d'abstraction à corriger.

---

## 15. Sécurité transverse (non négociable)

- **Secrets uniquement en `.env`** via `Settings` : clés API, `JWT_SECRET`, OAuth, Stripe, mail, `ADMIN_BOOTSTRAP_TOKEN`. `.env` git-ignoré, `.env.example` documenté. Changer une clé = éditer `.env`, **zéro** changement de code. Un grep « clé en dur » doit être vide (test statique).
- **Mots de passe** : argon2id, jamais loggés, jamais renvoyés.
- **Authz** : chaque endpoint déclare son niveau (public / user / admin) ; défaut = refus.
- **Entrées** validées (pydantic) ; sorties admin expurgées de tout secret/PII non nécessaire.
- **RGPD** : suppression de compte = purge réelle + anonymisation des traces.
- **Rate-limiting** : login, reset, chat (via entitlements), webhooks.
- **Cookies** sécurisés, CSRF sur mutations à cookie, CORS restreint.

---

## 16. Modèle de données consolidé (SQLite, migrations versionnées)

Tables applicatives à ajouter aux tables de cache existantes (fixtures, standings, …) :
`users`, `identities`, `credentials`, `sessions`, `tokens`, `subscriptions`, `billing_events`, `usage_counters`, `follows`, `notification_settings`, `conversations`, `active_context`, plus les tables monitoring optionnelles (`spans`/`traces` si `MONITORING_PERSIST`).
Chaque migration est un fichier SQL versionné (`0002_accounts.sql`, `0003_billing.sql`, …), appliquée par le runner existant. Index sur les clés d'accès chaud (`identities(provider, external_id)`, `usage_counters(user_id, day)`, `follows(user_id)`).

---

## 17. Stratégie de test

- **Unitaire par module** (fakes des dépendances via `conftest.py`).
- **Intégration** : pipeline complet avec providers mockés (`respx`), du `POST /chat` à la `Response`.
- **Sécurité** : authz par endpoint, secrets absents des réponses, grep « pas de clé en dur ».
- **Résilience** (reprend §10 de la spec ossature) : LLM absent, API en panne (cache périmé), breaker, tâche crashée relancée, monitoring non intrusif, invariant « ne lève jamais ».
- **Multi-canal** : un test prouve que `console` et `web` passent par le **même** `InboundPort` et produisent la même `Response` pour une entrée équivalente.
- Cible : `mypy --strict`, `ruff` propres, **tout vert sans réseau**.

---

## 18. Ordre de construction (jalons, suite de M0–M7)

- **M8 — Identité & comptes.** `app/identity` + migrations `users`/`identities` + `DELETE /me` RGPD.
- **M9 — Auth web.** `app/auth` (email/password, vérif, reset), sessions/JWT, `MailProvider`, endpoints auth. OAuth Google/Apple.
- **M10 — Billing & entitlements.** Exploration Stripe → `app/billing` (checkout, portal, webhooks idempotents) + `app/entitlements` (quotas freemium) + gating branché dans le pipeline.
- **M11 — Préférences, suivis, mémoire.** `app/preferences` + `app/conversations` ; branchement ingestion sur le registre agrégé.
- **M12 — Cœur complet.** Pré-routeur (templates famille A), orchestrateur (boucle + validation + contexte + mémoire), synthèse, streaming SSE.
- **M13 — Données & live complets.** Repos restants, ingestion réelle pilotée par les follows, moteur live partagé/borné, événements sur le bus.
- **M14 — Notifications.** Dispatcher + `OutboundPort` email et web-push/SSE ; respect réglages/quiet hours/entitlements.
- **M15 — Surface web complète.** Tous les endpoints §12, authz, validation, SSE, temps réel live.
- **M16 — Admin & monitoring.** Endpoints `/admin/*` §13, gestion utilisateurs, gardes de rôle ; suite d'acceptation complète verte.

Chaque jalon est **compilable, testé, et laisse l'app fonctionnelle en mode dégradé** si le module est désactivé par flag.

---

## 19. Definition of done (application complète)

- Un utilisateur peut **s'inscrire, se connecter, souscrire Premium, suivre des équipes, poser des questions (chat + streaming), recevoir des notifications**, gérer son compte et son abonnement — le tout sur le web.
- Un admin dispose d'un **dashboard branché** sur des endpoints réels donnant l'état de tous les modules, le quota, les métriques, les traces (waterfall) et les goulots.
- **Aucune clé en dur** ; changer une clé dans `.env` suffit. `httpx` uniquement dans `providers/`. Aucun module ne dépend du concret d'un autre.
- L'app **reste debout et utile** avec n'importe quel module optionnel désactivé (LLM, live, ingestion, notifications, monitoring, billing en cache).
- Un futur canal (Telegram) s'ajouterait en implémentant **seulement** un adaptateur entrant + sortant, sans toucher au cœur — prouvé par le test « même `InboundPort` » entre console et web.
- `mypy --strict`, `ruff`, et toute la suite de tests **verts sans réseau**.
