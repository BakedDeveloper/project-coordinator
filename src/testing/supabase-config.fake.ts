// Fake Supabase configuration for unit tests. angular.json swaps it in for
// supabase-config.generated.ts, so tests never reach the real project and never
// overwrite the configuration the dev server is using.
export const supabaseConfig = {
  url: 'https://test-project.supabase.co',
  publishableKey: 'sb_publishable_test',
} as const;
