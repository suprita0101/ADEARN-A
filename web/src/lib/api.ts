import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Wallet API

export interface PoolBalances {
  liquid_balance: number;
  savings_balance: number;
  parent_balance: number;
  charity_balance: number;
  total_earned: number;
}

export interface WalletData {
  pool_balances: PoolBalances;
  withdrawal_eligible: boolean;
}

export interface CashbackTransaction {
  id: string;
  created_at: string;
  campaign_name: string;
  brand_name: string;
  cashback_amount: number;
  status: 'completed' | 'under_review';
}

export const getWallet = (): Promise<WalletData> =>
  api.get('/wallet').then((r) => r.data.data);

export interface WithdrawResult {
  withdrawn: number;
  method: string;
  destination: string;
  new_liquid_balance: number;
  status: string;
}

export const withdrawFromWallet = (
  amount: number,
  method: 'bank' | 'upi',
  destination: string,
): Promise<WithdrawResult> =>
  api.post('/wallet/withdraw', { amount, method, destination }).then((r) => r.data.data);

export const getTransactions = (): Promise<CashbackTransaction[]> =>
  api.get('/wallet/transactions').then((r) => r.data.data);

// Ad reviews

export interface AdReviewInput {
  campaign_id: string;
  transaction_id: string;
  relevance_score: number;
  honesty_score: number;
  value_score: number;
  flag_reason?: 'misleading_claim' | 'price_surge' | 'irrelevant' | 'spam';
}

export const submitAdReview = (
  input: AdReviewInput,
): Promise<{ composite_score: number; created: boolean }> =>
  api.post('/reviews', input).then((r) => r.data.data);

// Scratch card rewards

export interface ScratchCard {
  transaction_id: string;
  campaign_name: string;
  earned_at: string;
  scratched: boolean;
  reward_amount: number | null;
  scratched_at: string | null;
}

export const getScratchCards = (): Promise<ScratchCard[]> =>
  api.get('/rewards/scratch-cards').then((r) => r.data.data);

export const scratchCard = (
  transactionId: string,
): Promise<{ reward_amount: number; credited_to: string | null }> =>
  api.post(`/rewards/scratch-cards/${transactionId}/scratch`).then((r) => r.data.data);

// Charity impact (public — no auth)

export interface CharityImpact {
  total_raised: number;
  total_pending: number;
  total_disbursed: number;
  contributors: number;
  ngos: { id: string; name: string; cause: string; accumulated_balance: number }[];
  disbursements: {
    id: string;
    ngo_name: string | null;
    total_amount: number;
    user_count: number;
    disbursed_at: string;
    notes: string | null;
  }[];
}

export const getCharityImpact = (): Promise<CharityImpact> =>
  api.get('/charity/impact').then((r) => r.data.data);

// Advertiser API

export interface RecentConversion {
  id: string;
  created_at: string;
  cashback_amount: number;
  purchase_amount: number;
  status: string;
}

export interface CampaignStats {
  campaign: {
    id: string;
    name: string;
    status: string;
    cashback_rate: string;
    total_budget: string;
    spent_to_date: string;
    ends_at: string | null;
  };
  conversions_count: number;
  total_spent: number;
  avg_cashback: number;
  recent_conversions: RecentConversion[];
}

export interface AdvertiserAnalytics {
  total_campaigns: number;
  active_campaigns: number;
  total_spent: number;
  total_conversions: number;
  avg_conversion_rate: number;
}

export const setCampaignStatus = (
  campaignId: string,
  action: 'pause' | 'resume',
): Promise<{ id: string; status: string }> =>
  api.put(`/advertiser/campaigns/${campaignId}/status`, { action }).then((r) => r.data.data);

export const duplicateCampaign = (
  campaignId: string,
): Promise<{ campaign_id: string; status: string }> =>
  api.post(`/advertiser/campaigns/${campaignId}/duplicate`).then((r) => r.data.data);

export interface CampaignEditFields {
  name?: string;
  creative_url?: string;
  creative_type?: 'video' | 'banner' | 'audio';
  cashback_rate?: number;
  daily_cap?: number;
  total_budget?: number;
  ends_at?: string;
}

export const updateCampaign = (
  campaignId: string,
  fields: CampaignEditFields,
): Promise<{ id: string; updated: boolean }> =>
  api.put(`/advertiser/campaigns/${campaignId}`, fields).then((r) => r.data.data);

export const deleteCampaign = (campaignId: string): Promise<{ id: string; deleted: boolean }> =>
  api.delete(`/advertiser/campaigns/${campaignId}`).then((r) => r.data.data);

export const archiveCampaign = (campaignId: string): Promise<{ id: string; status: string }> =>
  api.put(`/advertiser/campaigns/${campaignId}/archive`).then((r) => r.data.data);

export const getCampaignStats = (campaignId: string): Promise<CampaignStats> =>
  api.get(`/advertiser/campaigns/${campaignId}/stats`).then((r) => r.data.data);

export const getAdvertiserAnalytics = (): Promise<AdvertiserAnalytics> =>
  api.get('/advertiser/analytics').then((r) => r.data.data);

// Admin API

export interface FraudQueueRow {
  id: string;
  user_id: string;
  user_mobile: string;
  campaign_name: string;
  purchase_amount: string;
  cashback_amount: string;
  fraud_score: string;
  created_at: string;
}

export interface AdminUserRow {
  id: string;
  mobile: string;
  name: string;
  role: string;
  kyc_status: string;
  is_active: boolean;
  fraud_flags: number;
  created_at: string;
}

export interface PendingAdvertiserRow {
  id: string;
  company_name: string;
  status: string;
  quality_score: string;
  contact_email: string;
  created_at: string;
}

export interface AdminFinancials {
  total_cashback_paid: string;
  total_under_review: string;
  total_liquid: string;
  total_savings: string;
  total_parent_pending: string;
  total_charity_pending: string;
  active_users: number;
}

export const getFraudQueue = (): Promise<FraudQueueRow[]> =>
  api.get('/admin/fraud-queue').then((r) => r.data.data);

export const resolveFraudCase = (id: string, approved: boolean): Promise<void> =>
  api.put(`/admin/fraud-queue/${id}/approve`, { approved }).then((r) => r.data);

export const getAdminUsers = (): Promise<AdminUserRow[]> =>
  api.get('/admin/users').then((r) => r.data.data);

export const suspendUser = (id: string, suspended: boolean): Promise<void> =>
  api.put(`/admin/users/${id}/suspend`, { suspended }).then((r) => r.data);

export const getPendingAdvertisers = (): Promise<PendingAdvertiserRow[]> =>
  api.get('/admin/advertisers').then((r) => r.data.data);

export const approveAdvertiser = (id: string, approved: boolean): Promise<void> =>
  api.put(`/admin/advertisers/${id}/approve`, { approved }).then((r) => r.data);

export const getAdminFinancials = (): Promise<AdminFinancials> =>
  api.get('/admin/financials').then((r) => r.data.data);

export interface AuditLogRow {
  id: string;
  actor_id: string | null;
  actor_mobile: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface AdminCampaignRow {
  id: string;
  name: string;
  status: string;
  company_name: string;
  creative_url: string;
  creative_type: string;
  cashback_rate: string;
  created_at: string;
}

export const getAdminCampaigns = (): Promise<AdminCampaignRow[]> =>
  api.get('/admin/campaigns').then((r) => r.data.data);

export const updateCampaignCreative = (
  id: string,
  creative_url: string,
  creative_type: 'video' | 'banner' | 'audio' = 'video',
): Promise<void> =>
  api.put(`/admin/campaigns/${id}/creative`, { creative_url, creative_type }).then((r) => r.data);

export interface NgoRow {
  id: string;
  name: string;
  registration_no: string;
  cause: string;
  accumulated_balance: string;
  is_active: boolean;
}

export const getNgos = (): Promise<NgoRow[]> =>
  api.get('/admin/ngos').then((r) => r.data.data);

export const createNgo = (
  name: string,
  registration_no: string,
  cause: string,
): Promise<{ id: string }> =>
  api.post('/admin/ngos', { name, registration_no, cause }).then((r) => r.data.data);

export const setNgoActive = (id: string, is_active: boolean): Promise<void> =>
  api.put(`/admin/ngos/${id}/active`, { is_active }).then((r) => r.data);

export const getAuditLog = (params: { action?: string; entity_type?: string }): Promise<AuditLogRow[]> => {
  const query = new URLSearchParams();
  if (params.action) query.set('action', params.action);
  if (params.entity_type) query.set('entity_type', params.entity_type);
  const qs = query.toString();
  return api.get(`/admin/audit-log${qs ? `?${qs}` : ''}`).then((r) => r.data.data);
};
