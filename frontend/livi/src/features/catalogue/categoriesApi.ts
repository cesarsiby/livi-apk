import { apiRequest } from '../../services/api/client';

export type Category = { id: string; name: string; slug: string };

export const categoriesApi = {
  list: () => apiRequest<Category[]>('/categories'),
};
