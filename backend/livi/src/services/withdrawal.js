export function calculateWithdrawalFee(amount, bps=0, minFee=0, maxFee=null) {
  const gross = BigInt(amount);
  const raw = (gross * BigInt(bps)) / 10000n;
  let fee = raw < BigInt(minFee) ? BigInt(minFee) : raw;
  if (maxFee !== null && fee > BigInt(maxFee)) fee = BigInt(maxFee);
  if (fee >= gross) throw new Error('La commission de retrait ne peut pas être égale ou supérieure au montant retiré');
  return { fee, net: gross - fee };
}
