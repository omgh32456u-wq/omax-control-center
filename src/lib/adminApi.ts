import { supabase } from './supabase';

export type AdminAction =
  | 'dashboard'
  | 'list_codes'
  | 'generate_codes'
  | 'update_code'
  | 'list_subscriptions'
  | 'list_users'
  | 'list_audit'
  | 'revoke_subscription';

export async function adminRequest<T = Record<string, unknown>>(
  action: AdminAction,
  payload: Record<string, unknown> = {},
): Promise<T> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) throw new Error('Your session has expired. Sign in again.');
  const { data, error } = await supabase.functions.invoke('admin-api', {
    body: { action, ...payload },
    headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
  });
  if (error) {
    const message = typeof data?.error === 'string' ? data.error : error.message;
    throw new Error(message);
  }
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}
