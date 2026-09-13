// ═══════════════════════════════════════════════════════════════
// LIVI 2.0 — normalizeList (RAPPORT_UXUI_SESSION21, constat C0 — critique)
//
// apiRequest() (client.ts) déballe systématiquement l'enveloppe backend
// { success, data, request_id } et retourne directement `data` :
//   "LIVI backend responses are normalized as { success, data, request_id }
//    so every feature receives the domain payload rather than the
//    transport envelope." (client.ts, ligne 105-107)
//
// Or la quasi-totalité des routes de LISTE de ce backend appellent
// ok(res, rows) avec `rows` déjà un TABLEAU BRUT (vérifié dans
// routes/orders.js "/", routes/products.js "/", routes/compatibility.js
// pour /vendor/products, /vendor/orders, /users/me/wishlist — même
// pattern partout). Après déballage, l'appel renvoie donc le tableau
// directement, PAS un objet { data: [...] } ni { orders: [...] } etc.
//
// De nombreux écrans (au moins 14, voir le rapport) faisaient pourtant
// `réponse?.orders ?? réponse?.data ?? []` — sur un tableau, `.orders` et
// `.data` valent tous deux `undefined`, donc CE CODE RETOMBAIT TOUJOURS
// SUR [] MÊME QUAND IL Y AVAIT DE VRAIES DONNÉES. Écrans directement
// vérifiés comme touchés : commandes acheteur, wishlist, produits et
// commandes vendeur, catalogue. C'est un bug de rendu vide permanent, pas
// une question de hiérarchie visuelle — corrigé en priorité absolue.
//
// Cette fonction vérifie D'ABORD si la réponse est déjà un tableau avant
// de chercher une clé imbriquée, pour ne plus jamais retomber sur []
// silencieusement.
// ═══════════════════════════════════════════════════════════════

export function normalizeList<T = any>(response: unknown, keys: string[] = ['data', 'items']): T[] {
  if (Array.isArray(response)) return response as T[];
  if (response && typeof response === 'object') {
    for (const key of keys) {
      const value = (response as any)[key];
      if (Array.isArray(value)) return value as T[];
    }
  }
  return [];
}
