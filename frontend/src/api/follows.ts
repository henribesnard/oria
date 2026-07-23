import { api } from './client';

export interface Follow {
  user_id: string;
  entity_type: 'league' | 'team' | 'player';
  entity_id: number;
  entity_name: string;
  created_at: number;
}

export async function listFollows(entityType?: string): Promise<Follow[]> {
  const params = entityType ? `?entity_type=${entityType}` : '';
  return api.get<Follow[]>(`/follows${params}`);
}

export async function follow(entityType: string, entityId: number, entityName: string): Promise<Follow> {
  return api.post<Follow>('/follows', { entity_type: entityType, entity_id: entityId, entity_name: entityName });
}

export async function unfollow(entityType: string, entityId: number): Promise<{ status: string }> {
  return api.del<{ status: string }>('/follows', { entity_type: entityType, entity_id: entityId });
}
