import { TestBed } from '@angular/core/testing';

import { SUPABASE } from './supabase.client';

describe('SUPABASE', () => {
  it('provides a single client for the whole app', () => {
    const first = TestBed.inject(SUPABASE);
    const second = TestBed.inject(SUPABASE);

    expect(first).toBeTruthy();
    expect(second).toBe(first);
  });
});
