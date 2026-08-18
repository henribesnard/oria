# Dettes techniques — Oria

> Issues de la revue du 2026-08-17, non traitees dans les lots 1-5.
> Chaque item indique sa severite (P1/P2), le contexte et les fichiers concernes.

---

## P1 — Stripe reel (Lot 5.1)

Le billing est encore stub : `start_checkout()` et `open_portal()` renvoient des URL fictives,
et la verification webhook accepte `sig == "stub"`.

**Fichiers concernes :**
- `src/oria/app/billing/service.py:62-69` (stubs checkout/portal)
- `src/oria/app/billing/service.py:135-149` (verification webhook)
- `src/oria/app/billing/repository.py:60-73` (catch-all sur record_event)

**A faire :**
- Integrer le SDK Stripe (`stripe.checkout.Session.create`, `stripe.billing_portal.Session.create`)
- Utiliser `Webhook.construct_event` pour la signature
- Supprimer le bypass `stub` hors tests
- Enregistrer l'evenement et appliquer l'effet metier dans une transaction
- Ne catcher que l'erreur d'unicite attendue pour l'idempotence

---

## P1 — DTO /billing/usage (Lot 5.3)

Le backend renvoie `UsageSnapshot{user_id, day, counters}` mais le frontend attend
`messages_today`, `messages_limit`, `live_today`, etc.

**Fichiers concernes :**
- `src/oria/app/entitlements/service.py` (format backend)
- `frontend/src/hooks/useBilling.ts` (format attendu cote frontend)

**A faire :**
- Creer un DTO `/billing/usage` qui expose les champs attendus par le frontend
- Aligner les noms de champs entre backend et frontend
- Exposer les limites depuis le backend plutot que les coder en dur dans le frontend

---

## P1 — Tokens localStorage vers cookies httpOnly (Lot 4.3)

Les tokens web sont stockes en `localStorage`, ce qui les expose a toute XSS.

**Fichiers concernes :**
- `frontend/src/hooks/useAuth.ts:56-61` (stockage localStorage)
- `src/oria/adapters/web/dependencies.py` (lecture cookie deja supportee cote backend)

**A faire :**
- Cote backend : setter le refresh token en cookie `HttpOnly Secure SameSite=Lax` sur les reponses login/register/refresh
- Cote frontend : supprimer le stockage localStorage, garder l'access token en memoire uniquement
- Ajouter un header CSRF pour les mutations cookie-based
- Conserver Bearer token uniquement pour mobile/natif

---

## P2 — Notifications incompletes (Lot 5.5)

Le `NotificationDispatcher` recoit `follow_service` et `entitlements` mais ne les utilise
pas reellement pour filtrer les destinataires.

**Fichiers concernes :**
- `src/oria/notifications/dispatcher.py:45-52, 91-103`

**A faire :**
- Filtrer par follows (team/league/player) avant envoi
- Appliquer `entitlements.check(user_id, "alert")` pour respecter les droits Premium
- Persister les notifications sortantes et leur statut (retry queue)
- Tester l'idempotence des evenements goal, les quiet hours, et le fallback de canal

---

## ~~P2 — Streaming LLM reel (Lot 5.6)~~ TRAITE

> Resolu dans le commit `feat(streaming): vrai streaming LLM avec chunks progressifs`.
> `Orchestrator.run_stream()` stream la reponse finale via `complete_stream()`,
> les rounds function-calling restent non-streaming.

---

## P2 — OAuth et mail reels (Lot 5.9)

OAuth Google/Apple et l'envoi mail sont des stubs. Les secrets OAuth existent dans
`Settings` mais ne sont pas utilises.

**Fichiers concernes :**
- `src/oria/config.py:46-49` (secrets OAuth declares mais non cables)
- `src/oria/providers/mail.py` (stub SMTP)
- `src/oria/adapters/web/auth_routes.py` (pas de routes OAuth)

**A faire :**
- Implementer les flows OAuth Google et Apple (redirect + callback)
- Brancher le `MailProvider` sur un vrai serveur SMTP ou un service transactionnel
- Implementer le flow change-password avec envoi de mail

---

## P2 — Mobile ScoresScreen incomplet

Les onglets "Completed" et "Upcoming" du `ScoresScreen` mobile sont vides :
seul le live est charge.

**Fichiers concernes :**
- `mobile/app/(tabs)/scores.tsx`

**A faire :**
- Charger les fixtures terminees et a venir depuis l'API
- Implementer les filtres par onglet
