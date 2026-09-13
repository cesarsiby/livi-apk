import { HttpError } from './http.js';

export function assertOwner(actualUserId, authenticatedUserId, resource='ressource') {
  if (actualUserId !== authenticatedUserId) throw new HttpError(403, `${resource} non autorisée`, 'RESOURCE_FORBIDDEN');
}

export function assertParty(role, resource='ressource') {
  if (!['client','vendor','transporter','admin'].includes(role)) throw new HttpError(403, `${resource} non autorisée`, 'RESOURCE_FORBIDDEN');
}
