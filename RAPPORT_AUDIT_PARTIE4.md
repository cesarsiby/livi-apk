# Audit & correction — Partie 4 : authentification, responsive, nettoyage

Suite de `RAPPORT_AUDIT_HARMONISATION.md`, `RAPPORT_AUDIT_PARTIE2.md` et `RAPPORT_AUDIT_PARTIE3.md`, qui couvraient la cohérence des contrats frontend/backend (KYC, escrow, chat, litiges, notifications, fil social, live, panneau admin). Cette partie traite deux bugs concrets signalés — la déconnexion quelques secondes après connexion, et le texte affiché caractère par caractère sur certaines cartes — plus le nettoyage Cashback/Fidélité et la fiabilisation de l'URL API de production. Aucun changement d'architecture, de schéma DB ni de secret.

---

## 1. Problèmes trouvés

1. **Déconnexion quelques secondes après OTP** : la session pouvait être effacée (retour à Login) alors que l'authentification était en réalité valide.
2. **Texte affiché lettre par lettre** sur les cartes du dashboard Transporteur (ex. "Missions", "Aujourd'hui"), et le même risque, moins sévère, sur Vendeur (Dashboard + Statistiques).
3. **Écran d'inscription** : le formulaire (sélecteur de rôle + 3 champs + case à cocher + 2 boutons) n'était pas défilable — le clavier pouvait masquer les derniers champs/boutons.
4. **Cashback / Fidélité** : deux écrans acheteur non branchés à un backend (le backend n'a jamais eu de route dédiée) et inatteignables depuis l'interface, mais encore déclarés dans le navigateur.
5. **URL API** : la valeur par défaut du code (si la variable d'environnement n'est pas injectée au build) pointait vers `localhost`, inutilisable sur un téléphone réel ; le profil `production` d'`eas.json` ne définissait pas l'URL Render du tout (seul `preview` le faisait).

## 2. Causes

**Bug d'authentification — trois causes distinctes, cumulatives :**

- `client.ts` appelait `refreshHandler()` séparément pour chaque requête qui recevait un 401. Les refresh tokens sont à usage unique côté backend (`rotateRefresh` révoque l'ancien dès qu'il est utilisé — `services/auth.js:72`). Dès que deux requêtes 401 arrivaient au même moment (typique : un dashboard qui charge plusieurs cartes/API en parallèle au montage, `NotificationsProvider` qui rafraîchit sa liste en même temps), chacune tentait son propre `/auth/refresh` avec le même token : une seule réussissait, les autres échouaient sur un token déjà tourné — et chaque échec effaçait entièrement la session, même si une autre venait de la renouveler correctement.
- `AuthProvider.tsx` enregistrait ses callbacks token/refresh dans un `useEffect([session])` : entre le moment où `session` change en React et celui où cet effet s'exécute, un écran qui vient de monter (ex. le dashboard, juste après vérification OTP) pouvait lire l'ancienne fermeture (session = null) et partir sans jeton.
- `authApi.refresh()` n'avait pas `retry401: false`. Si `/auth/refresh` répondait lui-même 401 ("déjà utilisé ou expiré"), `client.ts` tentait de le rafraîchir *via le même mécanisme* — un refresh qui essaie de se rafraîchir lui-même.

**Cartes trop étroites :** `Card` applique `padding: spacing[6]` (24px) par défaut. Le dashboard Transporteur utilisait ce padding par défaut sur des cartes à `width: '47%'` (donc ~150px sur un écran de 360dp) sans le réduire — il ne restait qu'environ 100px de large pour le texte. Sans `flexShrink`/limite d'échelle de police, un mot comme "Aujourd'hui" ou "Missions", en accessibilité "grand texte" activée ou sur un téléphone étroit, ne tenait plus sur une largeur de mot — Android bascule alors sur une coupure caractère par caractère. Vendeur utilisait déjà un padding réduit (16px), donc moins exposé, mais avec le même manque de garde-fou.

## 3. Fichiers modifiés

Uniquement frontend — le contrat backend était déjà correct (voir section 4). 12 fichiers touchés, 2 supprimés :

| Fichier | Nature |
|---|---|
| `frontend/livi/src/services/api/client.ts` | Correction auth (refresh partagé) |
| `frontend/livi/src/features/auth/authApi.ts` | Correction auth (`retry401: false`) |
| `frontend/livi/src/features/auth/AuthProvider.tsx` | Correction auth (ref, échecs réseau) |
| `frontend/livi/src/screens/transporter/TransporterDashboardScreen.tsx` | Correction responsive |
| `frontend/livi/src/screens/seller/SellerDashboardScreen.tsx` | Correction responsive |
| `frontend/livi/src/screens/seller/AnalyticsScreen.tsx` | Correction responsive |
| `frontend/livi/src/screens/auth/RegisterScreen.tsx` | Correction responsive (clavier) |
| `frontend/livi/src/navigation/BuyerNavigator.tsx` | Nettoyage Cashback/Fidélité |
| `frontend/livi/src/screens/buyer/CashbackScreen.tsx` | **Supprimé** |
| `frontend/livi/src/screens/buyer/LoyaltyScreen.tsx` | **Supprimé** |
| `frontend/livi/src/config/env.ts` | Correction API |
| `frontend/livi/eas.json` | Correction API |

## 4. Corrections backend

**Aucune.** Le contrat `/auth/otp/verify`, `/auth/refresh`, `/users/me` a été relu en entier (`services/auth.js`, `middleware/auth.js`, `routes/users.js`) et est correct : la rotation à usage unique des refresh tokens est un choix de sécurité délibéré et sain, pas un bug. Le problème était entièrement dans la façon dont le frontend gérait des rafraîchissements concurrents — donc entièrement corrigé côté frontend, sans toucher à la logique métier, aux migrations ni aux secrets.

## 5. Corrections frontend

Voir sections 6 et 10 (auth et responsive) — ce sont les deux familles de correctifs frontend de cette session, plus le nettoyage Cashback/Fidélité (section 13) et la correction d'URL API (section 12).

## 6. Corrections authentification

Trois correctifs coordonnés, chacun ferme une brèche distincte identifiée en section 2 :

1. **`client.ts`** — un seul refresh en vol à la fois : `refreshInFlight` partagé, toute requête 401 concurrente attend la *même* tentative au lieu d'en déclencher une nouvelle.
2. **`AuthProvider.tsx`** — les callbacks token/refresh lisent désormais un `useRef` mis à jour de façon synchrone à chaque rendu (au lieu d'un `useEffect([session])`), donc plus jamais de fermeture obsolète. Et un échec de refresh n'efface la session que si le serveur l'a explicitement rejetée (401/403) — une erreur réseau ou un timeout ne déconnecte plus personne, conformément à la consigne de la mission ("une erreur réseau ne doit pas être interprétée comme authentification requise"). Le même principe a été appliqué à la restauration de session au démarrage à froid : si le jeton stocké a expiré (cas courant après 15+ minutes d'inactivité — durée de vie de l'access token), le refresh token stocké est maintenant réellement essayé au lieu d'échouer immédiatement faute de session en mémoire ; et une erreur réseau à ce moment-là conserve les jetons stockés au lieu de les supprimer.
3. **`authApi.ts`** — `retry401: false` sur l'appel `/auth/refresh` lui-même, pour qu'un rejet reparte directement en échec propre plutôt que de déclencher un nouveau rafraîchissement en cascade.

La chaîne FRONTEND → SERVICE API → ENDPOINT → LOGIQUE MÉTIER → DB → RÉPONSE → FRONTEND a été vérifiée à chaque étape pour ces trois routes ; le contrat de champs (`token`, `refresh_token`, `user`) est identique des deux côtés.

## 7. Corrections Acheteur

Aucune correction dédiée cette session au-delà des correctifs transverses (auth, nettoyage Cashback/Fidélité, URL API). `BuyerDashboardScreen` a été relu en détail dans le cadre du diagnostic auth (son `Promise.all` de 5 appels parallèles au montage est l'un des déclencheurs concrets du bug de rafraîchissement concurrent) — aucune anomalie propre à l'écran n'a été trouvée au-delà de ça.

## 8. Corrections Vendeur

`SellerDashboardScreen` et `AnalyticsScreen` : même correctif responsive que Transporteur (section 10) — ils utilisaient déjà un padding réduit donc étaient moins exposés, mais partageaient exactement le même manque de garde-fou (pas de limite d'échelle de police, pas de `flexShrink`/`flexWrap` explicites) sur des libellés tout aussi longs ("Chiffre d'affaires", "Panier moyen").

## 9. Corrections Transporteur

`TransporterDashboardScreen` : correction complète du bug de cartes signalé (section 10). Le flux dashboard lui-même (un seul appel `transporterApi.dashboard()`, pas d'appels parallèles) a été vérifié et n'ajoute rien au risque de rafraîchissement concurrent au-delà de ce que d'autres parties de l'app déclenchent déjà globalement au login (notifications, etc.).

## 10. Corrections responsive

- **Cartes de statistiques** (Transporteur Dashboard, Vendeur Dashboard, Vendeur Statistiques) : padding réduit à une valeur cohérente sur les trois écrans, `minWidth` de sécurité sur la carte, `flexShrink`/`flexWrap` explicites sur les textes, `maxFontSizeMultiplier={1.6}` (l'accessibilité peut toujours agrandir le texte, mais sans pouvoir casser la grille à deux colonnes), `numberOfLines={2}` sur le libellé et `numberOfLines={1} adjustsFontSizeToFit` sur la valeur comme filet de sécurité ultime pour les cas extrêmes (au lieu du rendu vertical lettre par lettre).
- **Recherche exhaustive** de tout autre motif de grille identique (`width: '4x%'`, `'3x%'`, `'2x%'`, usage de `Dimensions.get`) dans `screens/` et `design/` : aucune autre occurrence trouvée — le bug était isolé à ces trois écrans, pas généralisé à toute l'app.
- **`RegisterScreen`** : formulaire enveloppé dans un vrai `ScrollView` (`contentContainerStyle` avec `flexGrow: 1` pour conserver le centrage visuel quand le contenu tient à l'écran, tout en permettant le défilement quand le clavier réduit l'espace disponible). Écran vérifié concrètement à risque : c'est le formulaire le plus long du flux non authentifié (sélecteur de rôle + 3 champs + case à cocher + 2 boutons), sans aucun défilement auparavant.
- **Périmètre non couvert cette session**, voir section 14.

## 11. Corrections navigation

`RootNavigator.tsx` relu en entier : le routage par rôle (`client` → Acheteur, `vendor` → Vendeur, `transporter` → Transporteur, `admin` → Admin) est correct, et `session.user.role` est bien disponible immédiatement après vérification OTP (le backend le renvoie directement, pas besoin d'un aller-retour supplémentaire). Le mécanisme qui renvoyait l'utilisateur vers Login — `if (!session) { ...Login... }` — est resté inchangé ; c'est la correction en section 6 qui garantit que `session` ne devient plus `null` par erreur.

## 12. Corrections API

- `env.ts` : la valeur par défaut (utilisée uniquement si `EXPO_PUBLIC_API_BASE_URL` n'est pas injectée au build) pointait vers `localhost:3000`, inutilisable sur un téléphone réel. Changée pour l'URL Render de production — un profil de build qui oublierait de définir la variable pointera désormais vers le vrai backend au lieu d'échouer silencieusement.
- `eas.json` : le profil `production` (build `app-bundle`) ne définissait cette variable nulle part, contrairement au profil `preview` (build `apk`). Ajoutée pour la cohérence entre les deux profils.
- Recherche exhaustive de `localhost`, `127.0.0.1` et d'anciennes URLs Render dans tout le frontend (code, `app.json`, `eas.json`) : aucune autre occurrence.
- Aucun usage de WebSocket dans le projet (ni frontend ni backend) — rien à vérifier de ce côté.

## 13. Nettoyage effectué

- Suppression de `CashbackScreen.tsx` et `LoyaltyScreen.tsx`, et de leurs 2 imports + 2 déclarations de route dans `BuyerNavigator.tsx`. Vérifié avant suppression : aucun bouton ni lien dans toute l'app ne naviguait vers ces deux écrans (`navigate('Cashback')` / `navigate('Loyalty')` : zéro résultat) — ils n'étaient déjà accessibles depuis aucun menu. Le composant `SiteParityInfoScreen` qu'ils utilisaient est conservé : il est partagé avec `SupportCenterScreen` (écran admin), qui n'a rien à voir avec Cashback/Fidélité.
- Recherche confirmée : zéro référence à cashback/fidélité côté backend (la fonctionnalité n'y a jamais existé — rien à supprimer là-bas), zéro référence restante côté frontend après suppression.
- Équilibre accolades/parenthèses/crochets vérifié sur les 9 fichiers `.ts`/`.tsx` modifiés — aucune anomalie. `eas.json` revérifié comme JSON valide après modification.

## 14. Problèmes qui restent éventuellement

- **Rien n'a été exécuté** : pas de build, pas d'émulateur, pas de téléphone dans ce bac à sable (ni réseau, ni `node_modules` installé). Tout a été vérifié par lecture de code et recoupement exact du contrat entre les fichiers concernés — un passage réel sur téléphone reste nécessaire pour confirmer, en particulier le comportement du rafraîchissement de session sous charge réelle.
- **Clavier masquant des champs — périmètre partiel.** Au-delà de `RegisterScreen` (corrigé, cas confirmé le plus à risque), une recherche a identifié une douzaine d'écrans avec formulaires à plusieurs champs sans `ScrollView` ni `FlatList` : `PaymentMethodsScreen`, `WithdrawScreen`, `DepositScreen`, `CreateDisputeScreen`, `MissionDetailsScreen`, `VideoUploadScreen`, `QRValidationScreen` (Transporteur et Acheteur), `TwoFactorAuthScreen`, `ForgotPasswordScreen`, `SecurityScreen`, `InventoryScreen`, `PayoutsScreen`. La plupart sont des formulaires courts (1 à 3 champs) ou des modales compactes où le risque réel est faible ; ils n'ont pas été modifiés cette session faute de pouvoir vérifier visuellement lesquels sont réellement affectés. Le correctif, si besoin, est le même que pour `RegisterScreen` : envelopper le contenu dans un `ScrollView`.
- **Autres anomalies responsive potentielles non liées au bug signalé** (marges, tailles fixes ponctuelles, alignements) : une recherche ciblée sur les motifs les plus risqués (grilles à pourcentage, `Dimensions.get`, largeurs fixes < 100px) n'a rien trouvé d'autre à corriger, mais les 74 écrans du projet n'ont pas fait l'objet d'une relecture visuelle exhaustive un par un — seule une revue générale par recherche de motifs a été faite au-delà des écrans directement concernés par les bugs signalés.
- **Acheteur/Vendeur/Transporteur/Admin — cohérence des contrats de données** (endpoints, noms de champs, permissions) : déjà couverte de façon approfondie par les parties 1 à 3 (voir `RAPPORT_AUDIT_HARMONISATION.md`, `PARTIE2`, `PARTIE3`) ; non refaite cette session pour rester concentré sur les deux bugs signalés et les points explicitement demandés (responsive global, Cashback/Fidélité, URL API). Si de nouvelles anomalies de ce type sont observées sur téléphone, elles n'ont pas de lien avec les correctifs de cette session.
- **Live/Vidéo/Social/Chat** : non ré-audités cette session (déjà traités en profondeur en parties 1 à 3) ; seule la recherche Cashback/Fidélité les a traversés, sans rien y trouver.
- Les limites déjà connues des sessions précédentes restent valables : connecteur mobile money non branché, mécanisme de redirection interne QR/PIN transporteur non testé en conditions réelles (voir `RAPPORT_AUDIT_PARTIE3.md`, section C).
