import { InjectionToken } from '@angular/core';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from './database.types';
import { supabaseConfig } from './supabase-config.generated';

/**
 * The only Supabase client of the app. Inject it only from services in `src/app/data/`:
 * components never talk to Supabase directly (see CLAUDE.md).
 */
export const SUPABASE = new InjectionToken<SupabaseClient<Database>>('SUPABASE', {
  providedIn: 'root',
  factory: () => createClient<Database>(supabaseConfig.url, supabaseConfig.publishableKey),
});
