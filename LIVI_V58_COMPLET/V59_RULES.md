# LIVI V59 — règles de cohérence appliquées

- Préparation minimale vendeur : 1 h, 2 h, 3 h, 4 h, 12 h ou 24 h.
- Le compteur de préparation commence à la confirmation effective du paiement.
- « Prête » ne signifie pas « en transit ». Le transit urbain/interville commence à la prise en charge physique.
- Livraison et commande terminée sont deux états distincts. La livraison prouvée laisse l’escrow financé jusqu’à confirmation de l’acheteur ou libération automatique existante.
- Le même PIN/QR de remise ne doit pas être consommé deux fois. La confirmation acheteur est une action authentifiée séparée.
- Interville : la garantie partenaire est 10 % de la valeur de la marchandise et reste séparée du paiement de l’acheteur. Le minimum 1 000 FCFA concerne le transport, pas la garantie.
- Coût de transport interville : carburant + minimum de livraison 1 000 FCFA + charges configurées.
- Perte interville : la garantie passe dans un cycle séparé de réclamation ; elle ne doit pas être débloquée par une écriture comptable dans l’escrow acheteur.
- Périssables : la base de conservation est explicite (récolte, production, conditionnement, préparation). Pour la base « préparation », la préparation ne consomme pas la durée déclarée ; le temps d’attente après préparation et le transit comptent.
- Les vérifications de compatibilité périssable doivent être rejouées à la création du devis, au paiement et avant expédition.

- Interville : le point d’arrivée partenaire ne clôt pas la livraison. Une remise physique au client doit encore être validée (`partner-deliver`), puis l’acheteur confirme séparément.
- Les routes d’administration de garantie enregistrent des références de règlement externe ; elles ne créent pas de faux mouvement financier lorsqu’aucun fournisseur réel n’est branché.
