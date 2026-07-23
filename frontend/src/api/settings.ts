import { api } from './client';

export interface NotificationSettings {
  user_id: string;
  prematch: boolean;
  result: boolean;
  lineup: boolean;
  live_goal: boolean;
  digest: boolean;
  quiet_start: string;
  quiet_end: string;
  timezone: string;
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  return api.get<NotificationSettings>('/settings/notifications');
}

export async function updateNotificationSettings(
  fields: Partial<NotificationSettings>,
): Promise<NotificationSettings> {
  return api.patch<NotificationSettings>('/settings/notifications', fields);
}

export async function clearConversations(): Promise<{ status: string }> {
  return api.del<{ status: string }>('/settings/conversations');
}
