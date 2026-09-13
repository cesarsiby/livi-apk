export type AdminRecord = {
  id: string;
  [key: string]: unknown;
};

export type AdminCollection = AdminRecord[] | {
  data?: AdminRecord[];
  items?: AdminRecord[];
  results?: AdminRecord[];
};

export type AdminDashboard = {
  [key: string]: unknown;
};
