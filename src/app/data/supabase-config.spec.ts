import { supabaseConfig } from './supabase-config.generated';

describe('supabaseConfig in unit tests', () => {
  it('is swapped for the fake values, so tests never reach the real project', () => {
    expect(supabaseConfig.url).toBe('https://test-project.supabase.co');
    expect(supabaseConfig.publishableKey).toBe('sb_publishable_test');
  });
});
