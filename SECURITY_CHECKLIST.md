# Check-list sécurité — BeachGuard

À suivre **avant de considérer terminée** toute fonctionnalité touchant à
l'authentification, aux paiements, à la localisation, aux photos de tiers,
ou plus généralement à toute donnée personnelle. Ce n'est pas une formalité
administrative : c'est la checklist qui aurait attrapé la faille trouvée le
27/07/2026 sur `send-alert-email` (voir `SECURITY_AUDIT_2026-07-27.md`) —
un utilisateur authentifié pouvait faire signer un lien de rapport pour
n'importe quel `incident_id`, y compris ceux d'un autre compte, parce que
personne n'avait vérifié explicitement "est-ce que cette valeur envoyée par
le client appartient bien à l'appelant ?".

---

## 1. Questions à se poser systématiquement

Pour toute nouvelle route, fonction, Edge Function ou champ de formulaire :

- **Moindre privilège** : cette fonction a-t-elle vraiment besoin du
  `service_role` / d'un accès admin, ou une clé utilisateur normale (RLS)
  suffit-elle ? Si `service_role` est nécessaire, la fonction est-elle
  documentée comme telle (commentaire en tête de fichier, comme
  `cleanup-old-incidents`) et son usage limité au strict périmètre requis ?

- **Propriété des données** : pour chaque identifiant reçu du client
  (`incident_id`, `relationId`, `user_id`, etc.), la fonction vérifie-t-elle
  explicitement qu'il appartient bien à l'appelant authentifié, ou se
  contente-t-elle de faire confiance à ce que le client envoie ? **Ne jamais
  supposer qu'un ID est "difficile à deviner" — vérifier la propriété
  explicitement, toujours.**

- **Échec à mi-chemin** : que se passe-t-il si cette opération échoue après
  avoir déjà fait la moitié du travail (ex : la ligne DB est écrite mais
  l'email échoue, la photo est uploadée mais l'entrée `incidents` non) ?
  Est-ce acceptable, ou faut-il une transaction / un état intermédiaire
  visible ?

- **Fail-open vs fail-closed** : si cette fonction lève une exception ou
  reçoit une réponse inattendue, le comportement par défaut est-il
  "refuser/bloquer" ou "autoriser/continuer" ? Pour tout ce qui touche à
  l'armement, au désarmement, ou à l'accès à des données d'un tiers, la
  réponse doit toujours être "refuser". (Voir `unlock()` dans `App.js`
  comme référence du bon pattern, avec son commentaire explicite.)

- **Secrets** : est-ce que je viens d'ajouter une clé, un token, ou un mot
  de passe en dur dans `App.js` ou tout autre fichier commité ? Si oui,
  doit-il vraiment être côté client, ou peut-il vivre dans une Edge
  Function via `Deno.env.get(...)` (secret Supabase) à la place ?

- **Validation des entrées** : les données reçues du client (formulaire,
  body JSON d'une Edge Function, valeur relue depuis `AsyncStorage`) sont-
  elles validées en forme *et* en plage de valeurs avant d'être utilisées
  (pas seulement "est-ce une string non vide") ?

- **Réponse ignorée** : le code lit-il vraiment le résultat d'un appel
  Supabase (`{ data, error }`) avant d'agir comme si l'opération avait
  réussi ? (Un `await supabase....update(...)` sans jamais lire `error`
  peut faire croire à l'app qu'une écriture a réussi alors qu'elle a été
  rejetée par une policy RLS.)

- **Rate limiting / abus** : cette route peut-elle être appelée en boucle
  par un compte authentifié normal (créer un compte par téléphone est bon
  marché) pour spammer un tiers, épuiser un quota (EmailJS, SMS...), ou
  faire de la reconnaissance (deviner des identifiants par force brute) ?

---

## 2. Tester les policies RLS activement, pas juste vérifier qu'elles existent

Après **toute** modification de schéma (nouvelle table, nouvelle colonne
sensible, nouvelle policy), ne pas se contenter de lire le SQL — le faire
échouer volontairement, avec un second compte de test :

1. Créer (ou avoir sous la main) deux comptes de test distincts, A et B.
2. Se connecter en tant que A (ou simuler son JWT), et essayer explicitement :
   - de lire une ligne appartenant à B (`select * from <table> where user_id = '<id de B>'`)
   - de modifier une ligne appartenant à B
   - de supprimer une ligne appartenant à B
   - d'insérer une ligne avec `user_id`/`payer_id` = l'id de B au lieu du sien
3. **Chacun de ces essais doit échouer** (0 ligne affectée ou erreur RLS).
   Si l'un d'eux réussit, la policy est cassée — même si elle "existe".
4. Documenter le résultat (capture d'écran ou copier-coller du résultat SQL)
   quelque part de traçable avant de considérer la migration terminée.

Rappel spécifique à ce projet : la table `incidents` (position GPS + dossier
photo de l'incident) est la plus sensible de l'app. Son SQL de création et
ses policies ne sont **pas actuellement versionnées dans ce dépôt** — avant
toute nouvelle fonctionnalité qui la touche, exporter et commiter d'abord
ses policies actuelles (`select * from pg_policies where tablename =
'incidents';` dans SQL Editor) pour qu'elles soient enfin auditables comme
le reste.

---

## 3. Checklist avant chaque soumission App Store / Google Play

Spécifique aux points sensibles de BeachGuard (capture photo de tiers,
localisation, mineurs) :

- [ ] La fiche App Store/Play Store déclare-t-elle explicitement la
      capture photo automatique et la collecte de localisation dans la
      section confidentialité (App Privacy / Data Safety) ?
- [ ] Le texte de consentement photo (écran bloquant) est-il toujours
      affiché avant toute première activation, sur un compte neuf ?
- [ ] La politique de confidentialité publique (lien requis par les deux
      stores) mentionne-t-elle explicitement : la capture photo de tiers
      sans leur consentement, la géolocalisation, la durée de rétention
      (15 jours), et le fait que l'utilisateur assume la responsabilité
      légale de l'usage de la fonction photo dans sa juridiction ?
- [ ] Un avis juridique a-t-il été pris (ou au moins envisagé) sur la
      légalité de la capture photo covert dans l'espace public, qui varie
      fortement d'un pays à l'autre (certains l'interdisent purement et
      simplement, d'autres imposent un avertissement visible) ?
- [ ] Le compte utilisé pour la revue Apple/Google a-t-il bien accepté le
      consentement photo et testé une activation complète (Apple en
      particulier teste les permissions caméra/localisation en revue) ?
- [ ] Rien dans le flux d'inscription ou d'usage ne cible ou ne collecte
      sciemment des données de mineurs sans mécanisme de consentement
      parental — si l'app est utilisable par des mineurs (cas explicite
      de ce projet), vérifier les exigences spécifiques du store visé
      (Apple Kids Category, Google Families Policy) même si l'app n'est
      pas volontairement positionnée comme une app "enfants".
- [ ] Les clés/secrets tiers (EmailJS, Supabase) utilisés en production
      sont bien les clés de prod, pas des clés de test, et les quotas
      (ex : plan gratuit EmailJS à 200 emails/mois) sont dimensionnés pour
      le volume réel attendu au lancement.
- [ ] Un audit de sécurité indépendant a-t-il eu lieu récemment (voir
      point ci-dessous) ?

---

## 4. Rappel permanent

Cette checklist réduit le risque, elle ne le supprime pas. Avant un
lancement public réel (pas juste des tests entre proches), ce projet
mérite un **audit de sécurité professionnel indépendant** — personne ne
s'auto-audite correctement, y compris cette checklist elle-même.
