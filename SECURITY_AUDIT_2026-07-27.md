# Audit de sécurité BeachGuard — 27/07/2026

Portée : `App.js`, tout `supabase/` (migrations SQL + Edge Functions),
`docs/report.html`, dépendances npm. Basé sur revue de code statique
uniquement — pas de test d'intrusion actif, pas d'accès à la base de
production au-delà de ce que l'app elle-même expose.

**Ce rapport ne constitue pas une garantie que l'app est sécurisée.** Il
liste des risques identifiés à un instant T, avec un niveau de confiance
variable selon les cas (certains points n'ont pas pu être vérifiés faute
d'accès aux policies RLS réellement actives en production — voir plus bas).
Avant un lancement public réel, ce projet mérite un **audit de sécurité
professionnel indépendant**, qui pourra notamment tester activement (pas
juste lire) les policies RLS en production, ce que cette revue n'a pas pu
faire.

---

## Résumé des gravités

| # | Gravité | Titre |
|---|---|---|
| 1 | 🔴 Critique | ✅ Corrigé (27/07) — `send-alert-email` ne vérifiait pas la propriété de `incident_id` |
| 2 | 🔴 Critique | ✅ Corrigé partiellement (27/07) — `send-alert-email` acceptait n'importe quel `to_email` (format validé ; limitation de débit toujours à faire) |
| 3 | 🟠 Important | Policies RLS de la table `incidents` non versionnées / non vérifiables |
| 4 | 🟠 Important | `incident_id` prévisible (horodatage, pas aléatoire) |
| 5 | 🟠 Important | Auto-liaison de contacts sans consentement du contact |
| 6 | 🟠 Important | Capture photo de tiers — risque juridique nécessitant avis externe |
| 7 | 🟠 Important | Pas de vérification d'âge / consentement parental (mineurs) |
| 8 | 🟠 Important | `acceptPhotoConsent` ignore l'échec potentiel de l'écriture DB |
| 9 | 🟠 Important | Confidentialité du bucket `beachguard-photos` non vérifiable depuis le repo |
| 10 | 🟡 Mineur | Comparaison de signature non "constant-time" dans `report-token.ts` |
| 11 | 🟡 Mineur | `CRON_SECRET` déjà exposé une fois dans une conversation (déjà tourné) |
| 12 | 🟡 Mineur | Logs de debug résiduels (lien de rapport signé en clair dans les logs) |
| 13 | 🟡 Mineur | `expo-notifications`/`expo-sharing` importés mais jamais utilisés |
| 14 | 🟡 Mineur | `.gitignore` ne couvre pas un fichier `.env` nu |
| 15 | 🟡 Mineur | `sensitivityValue` relu sans validation de plage |
| 16 | 🟡 Mineur | `removeContact` sans filtre de propriété côté client (défense en profondeur) |
| 17 | 🟡 Mineur | `pickContact` ne valide pas le numéro avant remplissage du champ |
| 18 | ℹ️ Info | 16 vulnérabilités npm, toutes dans l'outillage de build (pas le runtime) |

---

## 🔴 1 — `send-alert-email` ne vérifie pas la propriété de `incident_id`

**Fichier** : `supabase/functions/send-alert-email/index.ts`, lignes 64-81.

**Description** : la fonction authentifie bien l'appelant (JWT Supabase
valide requis), mais accepte ensuite n'importe quelle valeur `incident_id`
envoyée dans le body JSON et génère un token signé valide pour cet
incident, **sans jamais vérifier que `incidents.user_id` correspond à
l'utilisateur authentifié**. Le rapport pointé par ce token expose position
GPS + photos de l'incident.

**Vecteur d'attaque réaliste** : créer un compte BeachGuard (coût quasi nul
— juste un numéro capable de recevoir un SMS) est trivial. Un attaquant
authentifié peut appeler `send-alert-email` avec l'`incident_id` de
n'importe qui d'autre (voir finding #4 sur la prévisibilité de cet
identifiant) et son propre email en `to_email`, et recevoir un lien de
rapport valide 30 jours vers la position GPS et les photos prises lors de
l'incident d'un tiers.

**Recommandation** : avant de signer le token, vérifier
`select user_id from incidents where id = incident_id` et comparer à
`user.id` de l'appelant authentifié ; refuser (403) si ça ne correspond
pas ou si l'incident n'existe pas.

**✅ Corrigé le 27/07/2026** : `send-alert-email` interroge maintenant
`incidents` (via `service_role`, pour ne pas dépendre de la correction des
policies RLS non vérifiées — voir finding #3) et compare `user_id` à
l'appelant authentifié avant de signer un token. Si l'incident n'existe
pas ou appartient à quelqu'un d'autre, aucun lien n'est émis (échec fermé)
— l'email part quand même, avec le message par défaut. La prévisibilité de
l'`incident_id` (finding #4) n'est plus exploitable pour ce vecteur
puisque deviner un ID ne suffit plus.

---

## 🔴 2 — `send-alert-email` accepte n'importe quel `to_email`

**Fichier** : même fonction, ligne 64-70.

**Description** : `to_email` vient directement du client, sans validation
de format ni de correspondance avec un email préalablement enregistré côté
serveur (les emails d'alerte sont stockés en local, `AsyncStorage`, jamais
envoyés à Supabase pour vérification).

**Vecteur d'attaque réaliste** : tout compte authentifié peut faire
envoyer un email à une adresse arbitraire, avec le nom "BeachGuard" et un
`maps_link`/`time` de son choix — utilisable pour du spam/phishing-adjacent
sous la marque BeachGuard, et épuise le quota EmailJS partagé (déjà atteint
une fois en usage normal, cf. session précédente).

**Recommandation** : au minimum, valider le format email côté serveur ;
idéalement, limiter le taux d'appel par utilisateur (ex: table
`profiles` ou compteur Redis-like via une colonne `last_alert_sent_at` +
un intervalle minimum), et/ou n'autoriser l'envoi que vers des adresses que
l'app a préalablement synchronisées côté serveur (ce qui demanderait de
stocker `alertEmail`/`alertEmail2` dans `profiles` au lieu de
`AsyncStorage` uniquement).

**✅ Partiellement corrigé le 27/07/2026** : le format de `to_email` est
désormais validé côté serveur (regex email basique), la fonction refuse
(400) toute valeur mal formée. **Non fait** : la limitation de débit et la
restriction aux adresses pré-enregistrées ("idéalement") — un compte
authentifié peut toujours envoyer un nombre illimité d'emails vers
n'importe quelle adresse valide. À traiter séparément si ce risque reste
jugé important (probable avant un lancement public réel).

---

## 🟠 3 — Policies RLS de `incidents` non versionnées

**Description** : `schema_beachguard.sql` ne contient ni la définition de
la table `incidents`, ni ses policies. Le code (`App.js`, les 3 Edge
Functions) suppose leur existence et leur correction, mais rien dans ce
dépôt ne permet de le vérifier — c'est un point aveugle de cet audit.

**Recommandation** : exporter les policies actuelles
(`select * from pg_policies where tablename = 'incidents';`) et les
commiter, pour qu'elles deviennent auditables comme le reste du schéma.
Puis les tester activement (voir `SECURITY_CHECKLIST.md`, section 2).

---

## 🟠 4 — `incident_id` prévisible

**Fichier** : `App.js`, fonction `triggerAlarm` — `const id =
\`incident_${Date.now()}\`;`

**Description** : identifiant = horodatage en millisecondes, pas un UUID
aléatoire. Sert à la fois de clé primaire `incidents.id` et de préfixe de
dossier dans le bucket `beachguard-photos`.

**Impact** : combiné au finding #1, un attaquant n'a même pas besoin de
connaître l'`incident_id` exact d'une victime — une fenêtre de quelques
minutes autour d'une heure approximative (déduite par exemple d'un réseau
social, "j'ai eu une alerte tout à l'heure") réduit l'espace de recherche à
quelques centaines de milliers de valeurs, tout à fait brute-forçable sans
limite de débit actuelle sur `send-alert-email`.

**Recommandation** : remplacer par un UUID v4 (`crypto.randomUUID()`,
disponible côté React Native moderne / via `expo-crypto` si besoin), tout
en gardant l'horodatage dans un champ séparé si utile pour le tri.

---

## 🟠 5 — Auto-liaison de contacts sans consentement du contact

**Fichier** : `schema_beachguard.sql`, fonction `link_pending_relations`.

**Description** : n'importe quel utilisateur payant peut ajouter
n'importe quel numéro de téléphone comme contact d'alerte
(`relations.insert`, seule contrainte : ne pas être soi-même). Si ce
numéro s'inscrit un jour sur BeachGuard, il est **automatiquement et
silencieusement lié** comme contact d'alerte de tous les comptes qui
l'avaient pré-ajouté — sans jamais avoir consenti à recevoir ces alertes.

**Impact réaliste** : une personne (ex-conjoint, connaissance
malveillante) peut ajouter le numéro d'une autre sans son accord ; si
cette dernière installe un jour BeachGuard pour sa propre protection, elle
devient de fait "contact de confiance" de quelqu'un dont elle ne veut
peut-être rien recevoir. Aujourd'hui l'impact reste limité (les
notifications push contacts ne sont pas encore implémentées), mais le
design doit être corrigé **avant** leur mise en place.

**Recommandation** : ajouter une étape de confirmation explicite côté
contact (accepter/refuser d'être ajouté) avant que `contact_user_id` soit
considéré actif pour l'envoi de notifications.

---

## 🟠 6 — Capture photo de tiers : risque juridique

**Description** : l'app photographie automatiquement, sans consentement
de la personne photographiée, potentiellement sur la voie publique. Le
consentement recueilli (écran bloquant) ne couvre que le propriétaire du
compte, pas la personne photographiée — c'est un choix de conception
assumé (la responsabilité légale est explicitement transférée au
propriétaire du compte dans le texte de consentement), mais la légalité de
ce transfert varie selon les juridictions (enregistrement covert en lieu
public, droit à l'image, RGPD sur les données biométriques si un visage
est identifiable).

**Recommandation** : **avis juridique externe recommandé avant tout
lancement public**, spécifiquement sur ce point — ce n'est pas un problème
que la revue de code peut résoudre.

---

## 🟠 7 — Pas de vérification d'âge / consentement parental

**Description** : le contexte du projet indique explicitement que l'app
peut être utilisée par des mineurs. Aucun mécanisme de vérification d'âge
ou de consentement parental n'existe (inscription par simple numéro de
téléphone + OTP, sans déclaration d'âge).

**Recommandation** : selon les marchés visés, ceci peut relever de
COPPA (US, <13 ans) ou de l'article 8 du RGPD (UE, seuil entre 13 et 16
ans selon le pays). **Avis juridique externe recommandé.**

---

## 🟠 8 — `acceptPhotoConsent` ignore l'échec potentiel de l'écriture

**Fichier** : `App.js`, fonction `acceptPhotoConsent`.

**Description** : le résultat de
`supabase.from('profiles').update(...)` n'est jamais lu — ni `error`, ni
confirmation. L'état local (`photoConsentGiven = true`) est appliqué
inconditionnellement après l'`await`, que l'écriture ait réellement réussi
ou non (ex : rejet par une policy RLS, coupure réseau qui résout sans
throw).

**Impact** : dans un cas d'échec silencieux, l'utilisateur croit avoir
consenti (l'app le laisse armer), mais rien n'est persisté côté serveur —
sur un autre appareil ou après réinstallation, la modale réapparaîtrait
(incohérence), et surtout la "preuve" de consentement n'existerait pas
réellement en base malgré l'usage effectif de la fonction photo.

**Recommandation** : lire `{ error }`, et en cas d'erreur, ne pas mettre
à jour l'état local — afficher une erreur et laisser la modale bloquante
active.

---

## 🟠 9 — Confidentialité du bucket `beachguard-photos` non vérifiable

**Description** : le code suppose que le bucket est privé (accès
uniquement via URLs signées générées côté serveur). Rien dans le repo ne
confirme que le bucket n'est pas configuré en lecture publique dans le
dashboard Supabase — un réglage qui, s'il était activé par erreur,
rendrait toutes les photos accessibles par simple connaissance du chemin
(lui-même prévisible, voir #4).

**Recommandation** : vérifier manuellement dans Dashboard → Storage →
`beachguard-photos` → Settings que "Public bucket" est bien désactivé, et
documenter ce réglage quelque part de versionné (capture d'écran ou note
dans ce repo) pour qu'il soit vérifiable sans dépendre de la mémoire.

---

## 🟡 Findings mineurs (10-17)

- **10 — Comparaison non constant-time** (`report-token.ts`,
  `expectedSig !== sig`) : risque théorique de timing attack, impact
  pratique très faible (jitter réseau, durée de vie courte du token).
  Corrigible facilement avec une comparaison en temps constant si vous
  voulez être rigoureux, mais pas urgent.
- **11 — `CRON_SECRET` déjà exposé** dans cette conversation (collé en
  clair par erreur), déjà tourné une fois depuis. Rappel : ce dépôt est
  **public** — ne jamais coller de valeur de secret réelle dans un canal
  qui pourrait être journalisé ou partagé, toujours passer par l'éditeur
  SQL/CLI directement.
- **12 — Logs de debug résiduels** : `send-alert-email` logue
  `report_link` (URL signée complète) à chaque appel ; `App.js` logue le
  détail de chaque upload photo. Utile en développement, mais à retirer
  ou réduire avant une mise en production sérieuse (les logs Supabase ne
  sont visibles que par vous aujourd'hui, mais ce n'est pas une raison
  pour laisser des tokens valides traîner en clair dans des logs
  indéfiniment conservés).
- **13 — Imports inutilisés** : `expo-notifications` et `expo-sharing`
  sont importés mais jamais appelés dans `App.js`. `expo-notifications` en
  particulier peut déclencher des questions inutiles en revue de
  confidentialité (Apple/Google) pour une capacité déclarée mais non
  utilisée. À retirer si vraiment inutilisés, ou à documenter si prévus
  pour bientôt.
- **14 — `.gitignore`** ne couvre que `.env*.local`, pas un `.env` nu. Pas
  de fichier `.env` présent actuellement (vérifié), mais correction
  préventive simple à faire.
- **15 — `sensitivityValue`** relu depuis `AsyncStorage` via `parseFloat`
  sans validation de plage — une valeur corrompue localement pourrait
  pousser le seuil de déclenchement de l'accéléromètre hors des bornes
  prévues par l'UI.
- **16 — `removeContact`** filtre uniquement par `id` de la relation, pas
  par propriétaire, côté client — défense en profondeur manquante (repose
  entièrement sur RLS, non vérifiable ici, voir #3).
- **17 — `pickContact`** ne valide pas le numéro importé du carnet
  d'adresses avant de remplir le champ (revalidé seulement à la
  soumission via `addContact` — donc sans risque réel, juste un manque de
  cohérence UX/validation).

---

## ℹ️ 18 — Dépendances npm

`npm audit` : 16 vulnérabilités (11 modérées, 4 hautes, 1 critique — la
vulnérabilité "tar" DoS). **Toutes proviennent de l'outillage de build
`@expo/cli`/`@expo/config-plugins`/Metro** (manipulation de projets Xcode,
parsing YAML de config, PostCSS pour le web, etc.) — aucune n'est un
package réellement embarqué dans le bundle JS exécuté sur le téléphone
(vérifié : aucun de `tar`, `js-yaml`, `shell-quote`, `postcss`, `xcode`,
`brace-expansion` n'est importé où que ce soit dans `App.js`). Risque
réel aujourd'hui : faible, ces failles ne sont exploitables que via
l'environnement de build lui-même (votre Mac), pas via l'app installée par
un utilisateur final.

Correctif disponible pour la plupart via une mise à jour majeure d'`expo`
(SDK 54 → 57), qui n'est pas un correctif "gratuit" (implique de retester
toute l'app sur un nouveau SDK) — à planifier plutôt qu'à faire en urgence.

**Dependabot** : `.github/dependabot.yml` ajouté (mises à jour npm
hebdomadaires, groupées pour les paquets `expo*`). Reste à activer
manuellement les **alertes de sécurité** (différent des mises à jour
automatiques) : Dépôt GitHub → Settings → Security → "Dependabot alerts" →
Enable. Cette bascule ne peut pas être faite depuis ce repo/CLI, seulement
depuis l'interface GitHub par vous.

---

## Ce qui a été corrigé

**Sur validation explicite ("Corrige"), le 27/07/2026** :
- **Finding #1** (critique) : corrigé entièrement — vérification de
  propriété ajoutée dans `send-alert-email` avant de signer un lien de
  rapport.
- **Finding #2** (critique) : corrigé partiellement — format de
  `to_email` validé côté serveur. La limitation de débit (partie
  "idéalement" de la recommandation) n'a pas été implémentée, à décider
  séparément.

Ajout non-invasif fait sans validation préalable (config pure, aucun
changement de comportement) : `.github/dependabot.yml`.

## Ce qui nécessite encore votre décision

Findings 3 à 17, plus la partie non traitée du finding #2 (limitation de
débit / restriction aux emails pré-enregistrés). Ordre de priorité
recommandé : **3, 8, 9 d'abord** (vérifications/corrections rapides), puis
**4, 5** (changements plus structurels), puis **6, 7** (nécessitent un
avis juridique, pas juste du code), puis le reste (mineurs, au fil de
l'eau).
