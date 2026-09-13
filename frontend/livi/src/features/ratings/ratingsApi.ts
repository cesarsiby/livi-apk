import { apiRequest } from '../../services/api/client';

export type Rating = { rating: number; comment: string | null; created_at: string; rater_id: string };
export type Reputation = { average: number; count: number; recent: Rating[] };

export const ratingsApi = {
  // POST /ratings (src/routes/ratings.js) — order_id proves the interaction
  // actually happened; the backend derives rater/rated roles from their
  // real relationship to that order, so this can't be used to rate someone
  // arbitrarily.
  submit: (orderId: string, ratedId: string, rating: number, comment?: string) =>
    apiRequest<any>('/ratings', { method: 'POST', body: JSON.stringify({ order_id: orderId, rated_id: ratedId, rating, comment }) }),
  reputation: (userId: string) => apiRequest<Reputation>(`/ratings/${encodeURIComponent(userId)}`),
};
