# Audit & correction — Partie 5 : fiabilisation du parcours QR/PIN, iOS, vérification des sessions précédentes

Suite de `RAPPORT_AUDIT_HARMONISATION.md`, `PARTIE2`, `PARTIE3`, `PARTIE4` et `RAPPORT_AUDIT_QR_PIN.md`. Cette session a commencé par **relire et vérifier concrètement dans le code**, fichier par fichier, les correctifs déjà annoncés par les sessions précédentes plutôt que de repartir d'un audit vierge — le projet a clairement déjà fait l'objet d'un travail sérieux et itératif. Le détail de cette vérification est en section A. La section B couvre un bug réel trouvé cette session, non détecté par les sessions précédentes bien qu'elles aient examiné exactement ce mécanisme à trois reprises. Les sections C à E couvrent le reste des corrections.

**Environnement de travail : identique aux sessions précédentes sur un point important — aucun accès réseau, donc aucun `npm install`, aucun démarrage serveur, aucune base de données, aucun test réel sur téléphone.** Deux différences cette fois : `node --check` a été utilisé systématiquement sur les 54 fichiers `.js` du backend pour une vérification syntaxique fiable (au lieu d'un simple comptage d'accolades) ; et la recherche web a permis de vérifier des questions de compatibilité (versions Expo/RN, dépendances) qu'aucune session précédente ne pouvait trancher faute de connexion.

---

## A. Vérification des correctifs annoncés précédemment

Chaque affirmation ci-dessous a été vérifiée en lisant le fichier réel, pas seulement le rapport qui la décrit.

| Correctif annoncé | Rapport source | Vérifié dans le code réel |
|---|---|---|
| Déconnexion quelques secondes après OTP (refresh partagé, `useRef` au lieu de `useEffect([session])`, réseau ≠ session invalide) | PARTIE4 | **Confirmé.** `client.ts` a bien `refreshInFlight` partagé ; `AuthProvider.tsx` et `authApi.ts` correspondent à la description. |
| Cashback/Fidélité supprimés du runtime | PARTIE4 | **Confirmé.** Recherche exhaustive (`cashback\|loyalty\|fidélit[é]`) sur tout `frontend/src` et `backend/src` : zéro occurrence. |
| URL API production (`env.ts`, `eas.json`) | PARTIE4 | **Confirmé.** `env.ts` pointe vers `https://livi-apk.onrender.com/api/v1` par défaut ; `eas.json` définit `EXPO_PUBLIC_API_BASE_URL` sur les profils `preview` **et** `production`. |
| `createProofs()` branché sur l'acceptation de mission | RAPPORT_AUDIT_QR_PIN | **Confirmé.** `compatibility.js`, route `/transporter/missions/:id/accept` : appel réel dans la transaction. |
| Nouvelles routes de lecture `GET /orders/:id/{pickup,delivery}-proof` | RAPPORT_AUDIT_QR_PIN | **Confirmé.** Présentes, avec vérification de propriété (`vendor_id`/`buyer_id`) et `Cache-Control: no-store`. |
| Écrans `SellerPickupProofScreen` et `BuyerQRValidationScreen` complété | RAPPORT_AUDIT_QR_PIN | **Confirmé présents** dans `screens/seller/` et `screens/buyer/`. Non re-testés visuellement (pas d'émulateur disponible). |
| `react-native-svg@^15.8.0` / `react-native-qrcode-svg@^6.3.0` ajoutés | RAPPORT_AUDIT_QR_PIN | **Confirmé présents** dans `frontend/livi/package.json`. Compatibilité vérifiée cette session — voir section D. |

Aucune des affirmations vérifiées ci-dessus n'était fausse. Le travail des sessions précédentes est cohérent avec ce qui a réellement été livré dans cette archive.

---

## B. Bug réel trouvé et corrigé cette session : la prise en charge transporteur ne pouvait pas réussir

### Constat

`POST /transporter/missions/:id/pickup` (`routes/compatibility.js`) reformulait `req.body` en `{credential, latitude, longitude}` puis renvoyait une redirection HTTP 307 vers `/api/v1/deliveries/:id/pickup-proof/verify` :

```js
req.body={credential,...};
return res.redirect(307,`/api/v1/deliveries/${req.params.id}/pickup-proof/verify`)
```

**Une redirection HTTP ne peut pas transporter un corps recalculé côté serveur.** Un 307 indique au *client* de renvoyer sa requête *originale* (même méthode, même corps) vers la nouvelle URL — c'est le client qui rejoue ce qu'il a déjà envoyé, pas le serveur qui lui fournit un nouveau corps. `client.ts` utilise `fetch()` sans configuration `redirect` particulière (donc le comportement par défaut, `follow`), et l'appelant (`transporterApi.pickup(id,{pin})` ou `{qr_token}`) envoie `{pin: "..."}` ou `{qr_token: "..."}` — jamais `{credential: "..."}`. La ligne `req.body={credential,...}` juste avant le `redirect` n'a donc **aucun effet** sur la requête que le client renverra : celle-ci arrivera sur `/pickup-proof/verify` avec `{pin:...}` ou `{qr_token:...}`, sans champ `credential`, et `z.object({credential:z.string().min(4)...})` la rejettera systématiquement.

Concrètement : **un transporteur ne pouvait jamais valider une prise en charge**, quel que soit le PIN ou QR fourni — pas à cause d'un mauvais code, mais parce que la requête redirigée n'avait jamais la bonne forme. Ce point avait été identifié comme « non testé en conditions réelles » par trois rapports différents (`RAPPORT_AUDIT_HARMONISATION.md`, `PARTIE3`, `QR_PIN`) sans qu'aucun n'aille jusqu'à dérouler ce que fait réellement un 307 — ce n'est pas une question d'environnement de test, c'est la sémantique HTTP standard, vérifiable sans réseau. Combiné au correctif de la partie précédente (`createProofs()` maintenant branché), ce bug aurait **entièrement neutralisé** le déblocage du parcours de livraison : les preuves auraient enfin existé en base, mais la validation de la remise vendeur aurait continué à échouer à 100 %.

`.../deliver` et `/transporter/qr/scan` n'avaient pas ce bug précis (ils utilisent un `fetch()` interne serveur→serveur avec le corps correctement reconstruit), mais partageaient la fragilité signalée à plusieurs reprises : dépendance à `req.protocol`/`req.get('host')` pour se rappeler eux-mêmes, aucun timeout, un aller-retour réseau évitable pour appeler du code qui tourne dans le même processus.

### Correction

Recommandation déjà faite trois fois (« éventuellement remplacer par un appel de fonction direct ») : implémentée. `delivery.js` exporte maintenant trois fonctions (`resolveProof`, `verifyPickupProof`, `verifyDeliveryProof`) contenant exactement la même logique SQL/transaction/autorisation qu'avant — seuls `req.user.role`/`req.user.sub`/`req.id`/`req.ip`/`req.get('user-agent')` sont devenus des paramètres explicites. `compatibility.js` les importe et les appelle directement dans ses trois routes mobiles (`/transporter/missions/:id/pickup`, `.../deliver`, `/transporter/qr/scan`) — plus de redirection, plus de boucle réseau interne, plus aucune dépendance au comportement de suivi de redirection du client mobile.

- **Fichiers modifiés :** `backend/livi/src/routes/delivery.js` (fonctions extraites), `backend/livi/src/routes/compatibility.js` (3 routes converties en appel direct).
- **Ce qui n'a pas changé :** aucune requête SQL, aucune règle d'autorisation, aucun message d'erreur, aucun schéma de validation. `asyncHandler` capture les erreurs de la même façon que l'appel vienne d'ici ou de `delivery.js` lui-même.
- **Vérification effectuée :** `node --check` sur les 54 fichiers `.js` du backend (0 erreur) ; recherche exhaustive confirmant qu'aucun `res.redirect` ni `fetch()` interne ne subsiste sur ces trois routes ; recherche de collision de nom (aucune) ; relecture ligne à ligne pour confirmer l'identité stricte de la logique déplacée.
- **Non vérifiable ici :** comme pour toutes les sessions précédentes, aucun test d'exécution réelle (pas de réseau, pas de base). Un test manuel réel — accepter une mission, scanner/saisir un PIN de prise en charge, puis de livraison — reste la seule confirmation définitive, mais désormais sur du code qui n'a plus besoin de faire d'hypothèse sur le comportement réseau du client.

---

## C. iOS : messages de permission manquants (app.json)

`app.json` déclarait déjà `ios.bundleIdentifier` et les plugins `expo-camera`/`expo-location`, mais sans texte de permission associé. Sans `NSCameraUsageDescription`/`NSLocationWhenInUseUsageDescription` dans l'Info.plist généré, iOS **refuse silencieusement l'accès ou fait planter l'app** dès la première demande de permission (caméra pour le scan QR, position pour le suivi transporteur) — contrairement à Android qui tolère l'absence de description.

**Correction :** les deux plugins sont passés en forme configurée avec un message en français, conforme à l'usage réel de l'app :

```json
"plugins": [
  ["expo-camera", { "cameraPermission": "LIVI a besoin d'accéder à l'appareil photo pour scanner les QR codes de livraison." }],
  ["expo-location", { "locationWhenInUsePermission": "LIVI a besoin de votre position pour le suivi des livraisons en cours." }]
]
```

`locationWhenInUsePermission` (et non `locationAlways...`) a été choisi délibérément : l'app ne demande que `ACCESS_COARSE_LOCATION`/`ACCESS_FINE_LOCATION` côté Android (pas `ACCESS_BACKGROUND_LOCATION`), donc pas de localisation en arrière-plan — demander la permission « Always » côté iOS aurait été disproportionné par rapport à l'usage réel et aurait compliqué la revue App Store sans raison. `android.permissions`, `ios.bundleIdentifier` et tout le reste de `app.json` sont inchangés. JSON revérifié valide après modification.

`eas.json` n'a pas été modifié : ses profils `preview`/`production` fonctionnent tels quels pour `eas build -p ios` (EAS gère les identifiants Apple séparément, hors `eas.json`) ; aucune clé `ios` spécifique n'était nécessaire pour ces deux profils.

---

## D. Dépendances QR (react-native-svg / react-native-qrcode-svg) : compatibilité vérifiée

Le rapport QR/PIN avait ajouté ces deux dépendances sans pouvoir les installer (pas de réseau). Vérification faite cette session par recherche externe :

- Le projet utilise `expo: ^54.0.0`, `react-native: 0.81.5`.
- `react-native-svg@^15.8.0` : la plage `>=15.0.0` de cette librairie exige `react-native >=0.70.0` — largement satisfait. Des projets réels tournant sous Expo SDK 54 / React Native 0.81.4 utilisent concrètement `react-native-svg@15.12.1`, une version comprise dans la plage `^15.8.0` du projet.
- `react-native-qrcode-svg@^6.3.0` déclare `peerDependencies: { "react-native": ">=0.63.4", "react-native-svg": ">=14.0.0" }` (vérifié sur le `package.json` réel du paquet) — les deux bornes sont largement satisfaites par les versions du projet.
- Aucun changement nécessaire sur ces deux versions. Ce point, laissé ouvert par la session précédente, est maintenant résolu sur le papier — `npm install` reste la confirmation finale, mais rien n'indique aujourd'hui un conflit de versions.

---

## E. `MissionDetailsScreen.tsx` : champ PIN partagé + absence de ScrollView

Cet écran est la porte d'entrée réelle du correctif QR/PIN (section B) côté transporteur — sa fiabilité conditionne directement le bénéfice du reste de cette session. Deux problèmes trouvés en le relisant en détail :

1. **Pas de `ScrollView`** (confirmé : `PARTIE4` l'avait listé parmi les écrans non vérifiés). L'écran empile 3 cartes (prise en charge, acheminement, remise) dans une simple `View` — cela dépasse déjà la hauteur d'un écran courant sans clavier, et le clavier numérique masque une partie du formulaire pendant la saisie du PIN.
2. **Un seul état `pin` partagé entre les deux champs** (« PIN vendeur » et « PIN acheteur »). Comme les deux cartes s'affichent en permanence quel que soit le statut de la mission, taper dans l'un des deux champs faisait apparaître le même texte dans l'autre — source de confusion réelle, même si le backend refuse correctement toute tentative hors séquence (`INVALID_PICKUP_STATE`/`INVALID_DELIVERY_STATE`) donc sans risque financier.

**Correction :** écran enveloppé dans un `ScrollView` (`keyboardShouldPersistTaps="handled"`, même motif que `RegisterScreen`) ; état scindé en `pickupPin`/`deliveryPin` indépendants, chacun réinitialisé après sa propre action réussie. Aucune autre logique touchée (même API, mêmes libellés, même style visuel).

**Vérification :** TypeScript/JSX ne peut pas être passé à `node --check` (extension non supportée) ; vérifié à la place par équilibrage systématique des parenthèses/accolades/crochets (84/84, 117/117, 20/20) et par comptage un-à-un de chaque balise JSX (`View`, `ScrollView`, `Text`, `Card`, `TextInput`) ouvrante/fermante sur le fichier réel. Pas de test visuel possible (pas d'émulateur).

**Non traité cette session, par manque de temps plutôt que par choix :** la même vérification (`ScrollView` manquant) reste à faire sur les 11 autres écrans déjà listés par `PARTIE4` : `PaymentMethodsScreen`, `WithdrawScreen`, `DepositScreen`, `CreateDisputeScreen`, `VideoUploadScreen`, `QRValidationScreen` (Transporteur et Acheteur), `TwoFactorAuthScreen`, `ForgotPasswordScreen`, `SecurityScreen`, `InventoryScreen`, `PayoutsScreen`. `MissionDetailsScreen` a été traité en priorité parce qu'il est directement lié au correctif de la section B.

---

## F. Ce qui reste ouvert (hérité des sessions précédentes, toujours vrai)

- **Aucune exécution réelle** de tout le projet, cumulée sur 5 sessions — reste la limite de fond. `npm install`, build, test sur appareil réel restent à faire avant production, en particulier pour rejouer un cycle complet accepter → prise en charge → livraison maintenant que la section B est corrigée.
- `socialApi.comments()` non relié à un écran (fonctionnalité incomplète, pas un bug).
- Activation multi-rôles (`/users/me/roles`) prête côté backend, aucun écran pour l'utiliser.
- Connecteur mobile money non branché (dépendance externe assumée, documentée de longue date).
- `MATRICE_FRONTEND_BACKEND.csv` (203 lignes) date d'avant les parties 2 à 5 : les nouvelles routes `pickup-proof`/`delivery-proof` (lecture) n'y figurent pas encore. Non régénérée cette session — nécessiterait de rejouer l'extraction automatique sur l'ensemble du projet, pas fait faute de temps.
- 11 écrans à vérifier pour le clavier (liste complète en section E).
- `CHANGELOG_SESSION.md` ne couvre que les parties 1 à 3 ; parties 4, QR/PIN et 5 n'y sont pas résumées (voir note ajoutée à la fin de ce fichier).

## G. Fichiers modifiés cette session

| Fichier | Nature |
|---|---|
| `backend/livi/src/routes/delivery.js` | Logique extraite en fonctions exportées (`resolveProof`, `verifyPickupProof`, `verifyDeliveryProof`) |
| `backend/livi/src/routes/compatibility.js` | 3 routes : redirection/loopback → appel direct des fonctions ci-dessus |
| `frontend/livi/app.json` | Messages de permission iOS caméra/localisation |
| `frontend/livi/src/screens/transporter/MissionDetailsScreen.tsx` | `ScrollView` + séparation des états PIN pickup/delivery |
| `CHANGELOG_SESSION.md` | Note de continuité ajoutée (pointeur vers parties 4/5) |
| `RAPPORT_AUDIT_PARTIE5.md` | Ce document (nouveau) |

Aucune migration, aucun schéma, aucun secret modifié. Aucune fonctionnalité supprimée.
