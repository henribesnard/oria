import { api } from './client';

export interface NotificationSettings {
  prematch: boolean;
  result: boolean;
  lineup: boolean;
  live_goal: boolean;
  digest: boolean;
  quiet_start: string | null;
  quiet_end: string | null;
  timezone: string;
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  return api.get<NotificationSettings>('/settings/notifications');
}

export async function updateNotificationSettings(settings: Partial<NotificationSettings>): Promise<NotificationSettings> {
  return api.patch<NotificationSettings>('/settings/notifications', settings);
}

export async function updateProfile(data: { display_name?: string; locale?: string; timezone?: string }): Promise<unknown> {
  return api.patch('/me', data);
}

export async function changePassword(data: { current_password: string; new_password: string }): Promise<unknown> {
  return api.post('/me/password', data);
}

export async function deleteAccount(): Promise<unknown> {
  return api.del('/me');
}
