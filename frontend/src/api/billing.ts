import { api } from './client';

export interface Subscription {
  user_id: string;
  tier: 'free' | 'premium';
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_start: number | null;
  current_period_end: number | null;
  status: string;
}

export interface UsageSnapshot {
  user_id: string;
  messages_today: number;
  messages_limit: number;
  live_today: number;
  live_limit: number;
  alerts_today: number;
  alerts_limit: number;
  deep_analysis_today: number;
  deep_analysis_limit: number;
}

export async function getSubscription(): Promise<Subscription> {
  return api.get<Subscription>('/billing/subscription');
}

export async function startCheckout(plan: string = 'premium'): Promise<{ checkout_url: string }> {
  return api.post<{ checkout_url: string }>('/billing/checkout', { plan });
}

export async function openPortal(): Promise<{ portal_url: string }> {
  return api.post<{ portal_url: string }>('/billing/portal');
}

export async function getUsage(): Promise<UsageSnapshot> {
  return api.get<UsageSnapshot>('/billing/usage');
}
