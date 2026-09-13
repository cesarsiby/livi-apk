export type DisputeStatus = string;

export type Dispute = {
  id: string;
  order_id?: string;
  mission_id?: string;
  opened_by?: string;
  buyer_id?: string;
  vendor_id?: string;
  reason?: string;
  description?: string;
  status?: DisputeStatus;
  created_at?: string;
  updated_at?: string;
  resolution?: string;
  messages?: DisputeMessage[];
  metadata?: Record<string, unknown>;
};

export type DisputeMessage = {
  id: string;
  sender_id?: string;
  content?: string;
  created_at?: string;
};

export type DisputeListResponse = Dispute[] | {
  data?: Dispute[];
  items?: Dispute[];
  disputes?: Dispute[];
};

export type CreateDisputePayload = {
  order_id: string;
  reason: string;
};

// Matches the Zod schema in backend/livi/src/routes/compatibility.js's
// POST /disputes/:id/messages — it requires `content`, not `message`.
export type ReplyDisputePayload = { content: string };
// Matches disputes.js's POST /:id/resolve — `resolution` is a closed enum
// and `note` is required, not a free-text `resolution`/optional `decision`.
export type ResolveDisputePayload = { resolution: 'release' | 'refund'; note: string };
