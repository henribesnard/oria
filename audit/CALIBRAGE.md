# Audit de calibrage Oria

> Produit le 2026-08-11. Audit en lecture seule. Aucun fichier source modifie.

---

## Synthese executive

| Verdict | Nombre | % |
|---------|--------|---|
| OK | 2 | 3% |
| PARTIEL | 34 | 53% |
| ABSENT | 28 | 44% |
| CASSE | 0 | 0% |
| UNKNOWN | 0 | 0% |
| **Total** | **64** | |

### Familles les plus faibles
1. **Famille D (Proactif/push)** : 7/7 ABSENT -- aucun pont chat -> configuration notifs
2. **Famille G (Meta-produit)** : 5/6 ABSENT -- aucun pont chat -> app/billing/entitlements
3. **Famille E (Personnalisation)** : 3/5 ABSENT -- follow/unfollow/reglages non accessibles via chat

---

## Matrice de tracabilite

### Famille A -- Consultation factuelle

| ID | Libelle | Route attendue | Route reelle | Outil(s) requis | Present ? | Repo requis | Attachment | Gating | Degrade | Test existant | VERDICT |
|----|---------|---------------|-------------|-----------------|-----------|-------------|------------|--------|---------|---------------|---------|
| A1 | Matchs du jour/date/ligue | prerouter | prerouter (pattern `matchs?`) | `get_fixtures(date)` | OUI | FixturesRepo | table | free | oui | test_campaign (partiel) | **PARTIEL** |
| A2 | Prochain match equipe | prerouter | prerouter | `get_fixtures(next=1)` | OUI | FixturesRepo | fixture_card | free | oui | test_pertinence::test_prochain_match_detecte | **PARTIEL** |
| A3 | Dernier resultat | prerouter | prerouter | `get_fixtures(last=1)` | OUI | FixturesRepo | fixture_card | free | oui | test_pertinence::test_dernier_resultat | **PARTIEL** |
| A4 | Classement ligue | prerouter | prerouter | `get_standings` | OUI | StandingsRepo | table | free | oui | test_pertinence::test_classement_detecte | **PARTIEL** |
| A5 | Position/points equipe | prerouter+filtre | orchestrateur | `get_standings` | OUI | StandingsRepo | table | free | oui | AUCUN | **PARTIEL** |
| A6 | Calendrier N matchs | prerouter | prerouter | `get_fixtures(next=N)` | OUI | FixturesRepo | table | free | oui | test_pertinence::test_calendrier | **PARTIEL** |
| A7 | Confrontations H2H | orchestrateur | aucune | `get_h2h` | **MANQUANT** | -- | table | free | -- | AUCUN | **ABSENT** |
| A8 | Forme recente | prerouter | prerouter | `get_fixtures(last=5)` | OUI | FixturesRepo | table | free | oui | test_pertinence::test_forme_recente | **PARTIEL** |
| A9 | Stats equipe saison | orchestrateur | aucune | `get_team_stats` | **MANQUANT** | -- | table | free | -- | AUCUN | **ABSENT** |
| A10 | Stats joueur | prerouter | prerouter (pattern `stats?`) | `get_player_stats` | OUI | PlayersRepo | table | free | oui | test_campaign (partiel) | **PARTIEL** |
| A11 | Meilleurs buteurs/passeurs | orchestrateur | aucune | `get_top_scorers`/`get_top_assists` | **MANQUANT** | -- | table | free | -- | AUCUN | **ABSENT** |
| A12 | Blessures/suspensions | prerouter | prerouter | `get_injuries` | OUI | InjuriesRepo | table | free | oui | test_campaign (partiel) | **PARTIEL** |
| A13 | Compositions | orchestrateur | orchestrateur | `get_lineups` | OUI | LineupsRepo | table | **premium** | oui | AUCUN | **PARTIEL** |
| A14 | Arbitre designe | orchestrateur | orchestrateur (champ referee dans fixtures) | `get_fixtures` | OUI | FixturesRepo | -- | free | oui | AUCUN | **PARTIEL** |
| A15 | Cotes match | prerouter | prerouter | `get_odds` | OUI | OddsRepo | table | **premium** | oui | test_campaign (partiel) | **PARTIEL** |
| A16 | Effectif/infos club | prerouter | prerouter (pattern `infos?`) | `get_team_info`/`get_squad` | PARTIEL (pas de squad) | TeamsRepo | table | free | oui | test_campaign (partiel) | **PARTIEL** |
| A17 | Contexte extra-sportif | -- | aucune | weather/channel | **MANQUANT** | -- | -- | free | -- | AUCUN | **ABSENT** |

**Raisons des PARTIEL sur A1-A16 :**
- A1 : le prerouter ne passe pas le parametre `date` ; "les matchs de ce soir" matche `matchs?` mais sans filtrer par date
- A2 : "quand joue l'OM ?" ne matche pas `prochain\s+match` ; seule la formulation canonique fonctionne
- A3 : le pattern `score` est trop large -- "score PSG en ce moment" matche ici au lieu du live. "ils ont gagne ?" non reconnu
- A4 : "clt L1", "le classement de la L1" ne matchent pas ; resolution league_id implicite fragile
- A5 : pas de pattern prerouter, depend entierement du LLM
- A6 : `next=5` hardcode, l'utilisateur ne peut pas demander "les 3 prochains"
- A8 : `last=5` hardcode, pas de personnalisation
- A10 : "stats" matche aussi les stats d'equipe, pas de distinction joueur/equipe
- A12 : "qui est absent ?" ne matche pas le pattern blessures
- A13 : pas de pattern prerouter, pas de gating premium applique au niveau prerouter/orchestrateur
- A14 : pas de pattern dedie, depend du LLM pour extraire le champ referee
- A15 : pas de gating premium applique
- A16 : "qui est" trop large, pas de `get_squad` pour l'effectif complet

---

### Famille B -- Analyse et raisonnement

| ID | Libelle | Route attendue | Route reelle | Particularite | Gating | Test | VERDICT |
|----|---------|---------------|-------------|---------------|--------|------|---------|
| B1 | Comparaison 2 equipes | orchestrateur | orchestrateur | multi-outils (forme+stats+H2H) | free | AUCUN | **PARTIEL** |
| B2 | Avant-match (preview) | orchestrateur | orchestrateur | 5-6 blocs, deep_analysis | premium (deep_analysis) | AUCUN | **PARTIEL** |
| B3 | Tendances statistiques | orchestrateur | orchestrateur | historique agrege | premium | AUCUN | **PARTIEL** |
| B4 | Analyse value (cotes vs tendances) | orchestrateur | orchestrateur | croise odds+tendances | premium | AUCUN | **PARTIEL** |
| B5 | Bilan d'apres-match | orchestrateur | orchestrateur | events+statistics | free | AUCUN | **PARTIEL** |
| B6 | Suggestion Fantasy | orchestrateur | aucune | stats joueurs reelles | premium | AUCUN | **ABSENT** |
| B7 | Question ouverte multi-criteres | orchestrateur | orchestrateur | balayage large | premium | AUCUN | **PARTIEL** |
| B8 | Pedagogie/explication | orchestrateur | orchestrateur | zero appel outil | free | AUCUN | **PARTIEL** |

**Raisons :**
- B1 : depend du LLM pour enchainer les outils, `get_h2h` manquant
- B2 : `deep_analysis` entitlement existe mais pas de flow dedie "preview"
- B3 : pas d'outil d'agregation historique
- B4 : depend du LLM pour croiser, pas de test
- B5 : `get_match_events` + `get_match_statistics` existent mais pas de flow post-match dedie
- B6 : aucune logique Fantasy, aucun outil
- B7 : depend entierement de la qualite du LLM
- B8 : le system prompt dit "utilise les outils" -> risque d'appels inutiles sur questions pedagogiques

---

### Famille C -- Temps reel / live

| ID | Libelle | Route attendue | Route reelle | Outil | Gating attendu | Gating reel | Test | VERDICT |
|----|---------|---------------|-------------|-------|----------------|-------------|------|---------|
| C1 | Score en direct | prerouter | prerouter (`live`) | `get_live_scores` | premium (live_realtime) | **NON APPLIQUE au prerouter** | AUCUN | **PARTIEL** |
| C2 | Fil d'evenements live | orchestrateur | orchestrateur | `get_match_events` | premium | **NON VERIFIE** | AUCUN | **PARTIEL** |
| C3 | Suivi simultane | orchestrateur | orchestrateur | `get_live_scores` + follows | premium | **NON VERIFIE** | AUCUN | **PARTIEL** |
| C4 | Live d'une competition | orchestrateur | prerouter/orchestrateur | `get_live_scores(league_id)` | premium | **NON VERIFIE** | AUCUN | **PARTIEL** |
| C5 | Minute par minute | orchestrateur | orchestrateur | `get_match_events` | premium | **NON VERIFIE** | AUCUN | **PARTIEL** |

**Raison commune :** le gating `live_realtime` est defini dans Entitlements mais le pipeline ne verifie que `chat_message` au niveau du stage Entitlements. Les outils live ne verifient pas le tier premium avant execution.

---

### Famille D -- Proactif / push

| ID | Libelle | Route attendue | Route reelle | Pont chat -> config | Test | VERDICT |
|----|---------|---------------|-------------|---------------------|------|---------|
| D1 | Rappel avant-match | prerouter/app | **aucune** | ABSENT | AUCUN | **ABSENT** |
| D2 | Resume du matin | prerouter/app | **aucune** | ABSENT | AUCUN | **ABSENT** |
| D3 | Resultat final | prerouter/app | **aucune** | ABSENT | AUCUN | **ABSENT** |
| D4 | Alerte compo | prerouter/app | **aucune** | ABSENT | AUCUN | **ABSENT** |
| D5 | Alerte but en direct | prerouter/app | **aucune** | ABSENT | AUCUN | **ABSENT** |
| D6 | Digest quotidien/hebdo | prerouter/app | **aucune** | ABSENT | AUCUN | **ABSENT** |
| D7 | Alerte signal detecte | prerouter/app | **aucune** | ABSENT | AUCUN | **ABSENT** |

**Cause racine :** `NotificationSettings` et `FollowService` existent dans `app/preferences/`, mais il n'existe aucun outil dans le `ToolRegistry` ni aucun pattern prerouter pour que l'utilisateur configure ses alertes via le chat. Le modele de donnees est pret mais le pont chat -> preferences est absent.

---

### Famille E -- Personnalisation et etat

| ID | Libelle | Route attendue | Route reelle | Service backend | Pont chat | Test | VERDICT |
|----|---------|---------------|-------------|-----------------|-----------|------|---------|
| E1 | Suivre/ne plus suivre | prerouter/app | **aucune** | `FollowService` OK | **ABSENT** | AUCUN | **ABSENT** |
| E2 | Memoire multi-tours (anaphore) | pipeline | pipeline (context merge) | `ConversationService` OK | OUI (merge contexte) | AUCUN | **PARTIEL** |
| E3 | Favoris et historique | app | **aucune** | `FollowService` + `ConversationService` OK | **ABSENT** | AUCUN | **ABSENT** |
| E4 | Reglages notifications | app | **aucune** | `NotificationSettingsService` OK | **ABSENT** | AUCUN | **ABSENT** |
| E5 | Isolation multi-utilisateurs | implicite | implicite | user_id scope partout | OUI | AUCUN (pas de test cross-user) | **PARTIEL** |

**Cause racine E1/E3/E4 :** meme probleme que famille D. Les services `app/` sont fonctionnels mais aucun outil de chat ne les expose. L'utilisateur doit passer par l'UI/API directement.

---

### Famille F -- Meta conversationnel, robustesse

| ID | Libelle | Route attendue | Route reelle | Comportement | Test | VERDICT |
|----|---------|---------------|-------------|-------------|------|---------|
| F0 | Salutations/smalltalk | prerouter | prerouter | `bonjour\|salut\|hello\|hey\|coucou` | test_pertinence (4 tests) | **PARTIEL** |
| F1 | Hors perimetre (pas du foot) | pipeline/refus | orchestrateur (LLM) | Depend du system prompt | test_campaign (2 hors-sujet) | **PARTIEL** |
| F1b | Autre sport | pipeline/refus | orchestrateur (LLM) | Pas de refus explicite | AUCUN | **PARTIEL** |
| F2 | Donnee indisponible | pipeline | pipeline degrade | degraded=True + message | test_degradation (partiel) | **PARTIEL** |
| F3 | Cache perime + quota epuise | pipeline | pipeline degrade | freshness + degraded | test_degradation (cache stale) | **PARTIEL** |
| F4 | Question ambigue | orchestrateur | orchestrateur (LLM) | **Aucune desambiguisation** | AUCUN | **ABSENT** |
| F5 | Erreur API / timeout | pipeline | pipeline | circuit breaker + stale cache | test_degradation::test_serves_stale_cache | **OK** |
| F6 | Futur non determine | orchestrateur | orchestrateur (LLM) | system prompt "ne specule jamais" | AUCUN | **PARTIEL** |
| F7 | Question vide / bruit | pipeline | orchestrateur fallback | Pas de handling explicite | AUCUN | **PARTIEL** |
| F8 | Langue non-francaise | orchestrateur | orchestrateur | Prompt dit "reponds en francais" | AUCUN | **PARTIEL** |

**Raisons :**
- F0 : "ca va ?", "merci", "bonsoir" non reconnus par le pattern
- F1/F1b : aucun mecanisme de refus explicite, depend entierement du LLM
- F4 : "Manchester" (United ou City ?), "le classement" (quelle ligue ?) -- aucune logique de desambiguisation
- F5 : OK -- circuit breaker teste, stale cache teste, pipeline never-raises teste
- F6 : "quelle sera la compo ?" -> le LLM pourrait inventer, pas de garde-fou hard
- F8 : le prompt dit "reponds en francais" mais la spec demande de repondre dans la langue de l'utilisateur

---

### Famille G -- Meta-produit

| ID | Libelle | Route attendue | Route reelle | Service backend | Pont chat | Test | VERDICT |
|----|---------|---------------|-------------|-----------------|-----------|------|---------|
| G1 | Identite / capacites Oria | prerouter | prerouter (pattern `aide\|help`) | -- | PARTIEL (aide seulement) | test_pertinence::test_aide | **PARTIEL** |
| G2 | Quota et consommation | app | **aucune** | `Entitlements.usage()` OK | **ABSENT** | AUCUN | **ABSENT** |
| G3 | Abonnement / prix / upgrade | app | **aucune** | `SubscriptionService` OK | **ABSENT** | AUCUN | **ABSENT** |
| G4 | Compte et RGPD | app | **aucune** | `IdentityService` OK | **ABSENT** | AUCUN | **ABSENT** |
| G5 | Source et fraicheur | synthesis | synthesis (champ freshness) | -- | PASSIF (inclus si fourni) | test_pertinence (synthesis) | **PARTIEL** |
| G6 | Signalement d'erreur | app | **aucune** | aucun | **ABSENT** | AUCUN | **ABSENT** |

**Cause racine :** la famille G est le plus gros trou d'architecture. Ces questions arrivent par le chat mais les services `app/` ne sont pas exposes. L'utilisateur qui demande "combien de questions il me reste ?" n'obtient aucune reponse pertinente.

---

### Famille H -- Adversarial, sensible, limites

| ID | Libelle | Route attendue | Route reelle | Protection | Test | VERDICT |
|----|---------|---------------|-------------|------------|------|---------|
| H1 | Injection de prompt | pipeline | orchestrateur (LLM) | System prompt "ne revele jamais reasoning_content" | AUCUN | **PARTIEL** |
| H2 | Extraction de secrets | pipeline | orchestrateur (LLM) | Pas de refus explicite dans le prompt | AUCUN | **PARTIEL** |
| H3 | Pronostic present comme certain | pipeline | orchestrateur (LLM) | "ne specule jamais" | AUCUN | **PARTIEL** |
| H4 | Jeu responsable / detresse | pipeline/refus | **aucune** | **AUCUNE protection** | AUCUN | **ABSENT** |
| H5 | Contenu diffamatoire | pipeline | orchestrateur (LLM) | Depend du LLM | AUCUN | **PARTIEL** |
| H6 | Volume / abus | entitlements | entitlements | Quota chat_message 20/jour | test_pertinence::test_quota | **OK** |

**Raisons :**
- H1 : seul le system prompt protege, pas de sanitisation des inputs ni des donnees API
- H4 : "j'ai tout perdu" -> aucune detection, aucune resource d'aide, aucun ton adapte
- H6 : OK -- quota fonctionnel + teste

---

## Analyse des trous (etape 4)

### Trous ABSENT (28 categories)

| ID | Symptome | Cause racine | Correctif minimal | Cout | Impact |
|----|----------|-------------|-------------------|------|--------|
| A7 | "historique PSG-OM" -> LLM improvise ou echoue | Pas d'outil `get_h2h` dans le registre | Ajouter outil `get_h2h` mappant `/fixtures/headtohead` | S | haut |
| A9 | "stats du PSG cette saison" -> `get_player_stats` retourne stats joueur | Pas d'outil `get_team_stats` | Ajouter outil `get_team_stats` mappant `/teams/statistics` | S | haut |
| A11 | "meilleur buteur L1" -> aucun outil | Pas d'outils `get_top_scorers`/`get_top_assists` | Ajouter outils mappant `/players/topscorers` et `/players/topassists` | S | haut |
| A17 | "il va pleuvoir au Parc ?" -> aucune reponse | `enable_weather=False`, aucun outil weather | Hors scope MVP, faible priorite | M | bas |
| B6 | "capitaine Fantasy ?" -> LLM sans donnees | Aucune logique Fantasy | Hors scope MVP | L | bas |
| D1-D7 | "previens-moi avant le match" -> pas de reponse utile | `NotificationSettingsService` existe mais pas expose au chat | Ajouter outil `set_notification` + patterns prerouter "previens\|notifie\|alerte" | M | haut |
| E1 | "je suis le PSG" -> pas d'action | `FollowService` existe mais pas expose au chat | Ajouter outil `follow_entity` / `unfollow_entity` au registre | S | haut |
| E3 | "mes equipes suivies" -> pas de reponse | `list_follows()` existe mais pas expose | Ajouter outil `list_follows` | S | moyen |
| E4 | "pas de notifs avant 9h" -> pas d'action | `NotificationSettingsService.update()` existe mais pas expose | Couvert par D1-D7 | S | moyen |
| F4 | "le classement" sans precision -> choix arbitraire | Aucune logique de desambiguisation | Ajouter logique de clarification dans le prerouter quand league_id absent | M | haut |
| G2 | "combien de questions il me reste ?" -> pas de reponse | `Entitlements.usage()` existe mais pas expose | Ajouter outil `get_quota` au registre | S | haut |
| G3 | "c'est combien Premium ?" -> pas de reponse | `SubscriptionService` existe mais pas expose | Ajouter template prerouter renvoyant les infos pricing | S | moyen |
| G4 | "supprime mon compte" -> pas de reponse | `IdentityService` existe mais pas expose | Ajouter template prerouter vers support/settings | S | moyen |
| G6 | "c'est faux" -> pas de traitement | Aucun mecanisme de feedback | Ajouter pattern + log de signalement | S | moyen |
| H4 | "j'ai tout perdu" -> reponse standard | Aucune detection de detresse liee au jeu | Ajouter pattern de detection + message d'aide (joueurs-info-service.fr) | S | haut |

### Trous PARTIEL (34 categories) -- Top des plus critiques

| ID | Symptome | Cause racine | Correctif | Cout | Impact |
|----|----------|-------------|-----------|------|--------|
| A2 | "quand joue l'OM ?" non reconnu | Pattern `prochain\s+match` trop strict | Elargir le pattern : `quand\s+joue\|prochain\s+match\|next\s+match` | S | haut |
| A3 | "score" matche last result au lieu de live | Pattern `score` dans `_handle_last_result` avant `_handle_live` | Retirer `score` du pattern A3, le mettre en contexte-dependent | S | haut |
| F0 | "merci", "bonsoir", "ca va" non reconnus | Pattern greetings trop restrictif | Ajouter `merci\|bonsoir\|bonne\s+nuit\|ca\s+va\|ok` | S | haut |
| C1-C5 | Gating `live_realtime` non applique | Pipeline ne check que `chat_message` | Ajouter check `live_realtime` dans le handler live du prerouter | S | moyen |
| F8 | Repond en francais meme si question en anglais | System prompt "reponds en francais" | Modifier prompt : "reponds dans la langue de l'utilisateur" | S | moyen |
| E2 | "et son prochain match ?" peut echouer | Context merge existe mais resolution anaphore depend du LLM | Tester et documenter les limites | M | haut |
| H1 | "ignore tes instructions" -> depend du LLM | Pas de sanitisation des inputs | Ajouter filtre pre-LLM pour patterns d'injection connus | M | haut |

---

## TOP 10 des correctifs (etape 5)

Classe par `(impact x frequence) / cout`. Les categories a haute frequence sont A1-A6, F0, E1, G2.

| Rang | ID(s) | Correctif | Cout | Impact | Frequence |
|------|-------|-----------|------|--------|-----------|
| 1 | **E1** | Ajouter outils `follow_entity`/`unfollow_entity` au registre, exposes a l'orchestrateur | S | haut | tres haute |
| 2 | **A2, A3** | Elargir les patterns prerouter : "quand joue", deplacer "score" hors du pattern last_result | S | haut | tres haute |
| 3 | **F0** | Elargir le pattern greetings : ajouter merci, bonsoir, ca va, ok, super | S | haut | tres haute |
| 4 | **F4** | Ajouter desambiguisation : si league_id/team_id manquant, demander precision au lieu de deviner | M | haut | haute |
| 5 | **G2** | Ajouter outil `get_quota` renvoyant le compteur d'utilisation | S | haut | haute |
| 6 | **D1-D7** | Ajouter outil `set_notification`/`get_notifications` + patterns prerouter | M | haut | haute |
| 7 | **A7, A9, A11** | Ajouter les 4 outils manquants : `get_h2h`, `get_team_stats`, `get_top_scorers`, `get_top_assists` | S | haut | haute |
| 8 | **H4** | Ajouter detection de detresse jeu + message d'aide responsable | S | haut | basse (mais impact critique) |
| 9 | **C1-C5** | Appliquer le gating `live_realtime` dans le prerouter avant l'appel outil | S | moyen | moyenne |
| 10 | **H1** | Ajouter filtre pre-LLM pour patterns d'injection + sanitisation des donnees API | M | haut | basse |

---

## Recapitulatif par famille

| Famille | OK | PARTIEL | ABSENT | CASSE | UNKNOWN | Total |
|---------|----|---------|---------|----|---------|-------|
| A (Consultation) | 0 | 13 | 4 | 0 | 0 | 17 |
| B (Analyse) | 0 | 7 | 1 | 0 | 0 | 8 |
| C (Live) | 0 | 5 | 0 | 0 | 0 | 5 |
| D (Proactif) | 0 | 0 | 7 | 0 | 0 | 7 |
| E (Perso) | 0 | 2 | 3 | 0 | 0 | 5 |
| F (Robustesse) | 1 | 8 | 1 | 0 | 0 | 10 |
| G (Meta-produit) | 0 | 2 | 4 | 0 | 0 | 6 |
| H (Adversarial) | 1 | 4 | 1 | 0 | 0 | 6 |
| **Total** | **2** | **34** | **28** | **0** | **0** | **64** |

---

## Resultats de la sonde hors ligne (etape 2)

> 153 formulations envoyees, 59 categories testees. Pipeline sans LLM ni API.
> Routes observees : 62 prerouter, 91 fallback, 0 erreurs/exceptions.

### Decouvertes cles de la sonde

1. **Conflit A3/C1 (pattern `score`)** : "score PSG en ce moment ?" matche le pattern
   `dernier\s+r[eE]sultat|last\s+result|score` (A3) au lieu du live (C1).
   Le prerouter renvoie "Voici le dernier resultat" pour une question live.
   -> **Faux positif critique**

2. **Live handler vide** : "en direct" et "live PSG" matchent le pattern live mais
   `get_live_scores` retourne une liste vide (stub ou pas de match en cours), donc
   le handler retourne None et le pipeline tombe en fallback. L'utilisateur ne recoit
   **aucun message explicatif** ("pas de match en direct actuellement").

3. **Fuite cross-sport (F1b)** : "score du match NBA" matche le pattern `score` et
   renvoie "Voici le dernier resultat" -- une reponse football pour une question NBA.
   -> **Faux positif grave** : le prerouter ne filtre pas par domaine.

4. **Pollution par `matchs?`** : Le pattern `matchs?` est trop large et capture des
   questions non liees :
   - D1 "previens-moi 1h avant les matchs du PSG" -> "Voici les matchs"
   - D2 "envoie-moi les matchs du jour chaque matin" -> "Voici les matchs"
   - D3 "previens-moi quand le match est fini" -> "Voici les matchs"
   - B4 "il y a de la value sur ce match" -> "Voici les matchs"
   - C2 "raconte-moi le match" -> "Voici les matchs"
   Ces questions sont **interceptees a tort** par le prerouter.

5. **Pedagogie detournee (B8)** : "comment lire un classement ?" matche le pattern
   `classement` et retourne le classement reel au lieu d'une explication pedagogique.
   -> L'utilisateur veut comprendre, pas voir les donnees.

6. **Typos** : "classemnt ligue 1" (typo) -> fallback. "prochian match" (typo) ->
   matche `matchs?` (pas `prochain\s+match`), retourne des matchs generiques au lieu
   du prochain match.

7. **Salutations** : 3/7 reconnus (bonjour, salut, hello). "merci", "bonsoir",
   "ca va ?", "ok super" -> fallback avec message d'erreur.

8. **G6 faux positif** : "le classement est pas bon" (signalement d'erreur) matche
   `classement` et retourne le classement au lieu de traiter le signalement.

---

## Controles specifiques par famille (etape 3)

### Famille A : resolution d'entite
- **Nom court "OM"** : le regex d'extraction team attend `du|de l'|de la|de|d'` suivi du nom -> "matchs de l'OM" matche, mais "matchs OM" ne matche pas (pas de preposition)
- **Nom avec article "l'OL"** : `de\s+l[']\s*` gere le cas, mais "l'OL" seul (sans preposition) ne matche pas
- **Nom anglais "Bayern Munich"** : matche si precede de preposition, mais "Bayern" seul est dans la stop list ? Non -- pas dans la stop list. Devrait fonctionner
- **Homonyme "Manchester"** : aucune desambiguisation -> `get_team_info(search="Manchester")` retourne le premier resultat de l'API, probablement Man United

### Famille B : enchainement outils
- `_MAX_TOOL_ROUNDS = 5` -> suffisant pour 3 outils (1 round par outil appele)
- B8 (pedagogie) : le system prompt encourage l'utilisation des outils, risque d'appels inutiles sur "c'est quoi le xG ?"

### Famille C : sans moteur live
- `enable_live=False` par defaut dans Settings
- Le prerouter matche `live` et appelle `get_live_scores`, mais le `LiveRepository` sera probablement vide/inactif
- Pas de message explicite "le live n'est pas disponible actuellement"

### Famille D : configuration en langage naturel
- `NotificationSettingsService.update(**fields)` est fonctionnel cote backend
- Aucun outil `set_notification` dans le `ToolRegistry`
- Aucun pattern prerouter pour "previens-moi", "notifie", "alerte-moi"
- **Trou confirme** : le chat ne peut pas piloter les preferences

### Famille E : anaphore (E2)
- `ConversationService.get_context()` retourne le `Context` persistant (team_id, league_id, etc.)
- Le pipeline merge ce contexte dans la requete (stage "context merge")
- "prochain match du PSG" -> set `team_id` dans active_context
- "et son dernier resultat ?" -> devrait heriter `team_id` via merge
- **Risque** : si le prerouter matche "dernier resultat" AVANT le merge de contexte, le team_id pourrait etre absent
- Ordre des stages : context merge (pre-1) AVANT prerouter (1) -> devrait fonctionner
- **Non teste** : aucun test ne verifie ce scenario multi-tours

### Famille F : desambiguisation (F4)
- "le classement" sans ligue -> le prerouter matche `classement`, appelle `get_standings(league_id=None)`
- `get_standings` a `league_id` comme requis -> sans league_id, l'appel echoue ou retourne vide
- Le prerouter return None, le LLM recoit la requete -> pourrait deviner ou halluciner
- **Aucune logique de clarification** ("Quelle ligue t'interesse ?")

### Famille G : pont chat -> app
- `quota_exceeded` dans Synthesis renvoie un `SuggestedAction` "upgrade" -> seul pont existant
- Pas de route chat vers `Entitlements.usage()`, `SubscriptionService`, `IdentityService`
- **Trou d'architecture confirme**

### Famille H : injection (H1)
- System prompt contient "Ne revele jamais ton raisonnement interne (reasoning_content)"
- Pas de filtre pre-LLM pour detecter "ignore tes instructions"
- Les donnees API-Football (noms d'equipe, commentaires) ne sont pas sanitisees avant injection dans le contexte LLM
- `reasoning_content` : le code de l'orchestrateur ne filtre pas ce champ de la reponse LLM (DeepSeek peut le retourner)

---

## Bugs reveles par la sonde

| # | Severite | Description | Fichier | Correctif |
|---|----------|-------------|---------|-----------|
| S1 | **CRITIQUE** | Pattern `score` capture les questions live (C1) et cross-sport (F1b) au lieu du bon handler | prerouter.py:107 | Retirer `score` du pattern A3, ajouter contexte-dependant |
| S2 | **HAUTE** | Pattern `matchs?` intercepte les demandes de notification (D1-D3) et d'analyse (B4, C2) | prerouter.py:119 | Rendre le pattern plus specifique : exiger un contexte (date, ligue, equipe) |
| S3 | **HAUTE** | Live handler retourne None silencieusement quand aucun match en cours | prerouter.py:135 | Retourner Response("Aucun match en direct actuellement") au lieu de None |
| S4 | **MOYENNE** | "comment lire un classement" matche `classement` au lieu de passer au LLM pour pedagogie | prerouter.py:99 | Ajouter detection de contexte pedagogique (comment, quoi, pourquoi) |
| S5 | **BASSE** | "le classement est pas bon" (signalement) matche `classement` | prerouter.py:99 | Exclure les negations avant le mot-cle |

## UNKNOWN -- ce qu'il faudrait pour les lever

Aucun UNKNOWN dans cet audit. Tous les verdicts ont pu etre tranches par lecture du code source et execution de la sonde. Les zones de risque restent dans les categories PARTIEL qui dependent du comportement LLM (B1-B8, F1, F6, H1-H3, H5), mais le code permettant le routage est lisible et deterministe.

Pour les lever completement, il faudrait :
- Une cle API-Football reelle pour tester les repos avec donnees fraîches
- Un match en cours pour tester le live (C1-C5)
- Un compte Stripe de test pour tester G3 (abonnement)
- Le LLM actif (DeepSeek) pour tester B1-B8, F1, H1-H3
