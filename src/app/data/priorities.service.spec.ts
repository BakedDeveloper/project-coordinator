import { TestBed } from '@angular/core/testing';

import { PrioritiesService, PrioritiesUnavailableError } from './priorities.service';
import { SUPABASE } from './supabase.client';

interface Result {
  data: unknown[] | null;
  error: unknown;
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 't1',
    title: 'Scrivere il preventivo',
    next_action: 'Chiedere i numeri a Marco',
    project_id: 'p1',
    project_name: 'Reply - Fleet',
    project_scope: 'work',
    priority_level: 1,
    priority_rank: 1,
    effective_due_date: '2026-11-26',
    checkpoint_name: 'Consegna',
    blocks_others: true,
    is_blocked: false,
    is_waiting: true,
    has_question_to_ask: true,
    waiting_on: 'Marco',
    ...overrides,
  };
}

function setup(priorities: Result | Promise<never>, projects: Result) {
  const order = vi.fn(() => priorities);
  const select = vi.fn((columns: string) =>
    columns.startsWith('id, title') ? { order } : projects,
  );
  const from = vi.fn(() => ({ select }));
  TestBed.configureTestingModule({ providers: [{ provide: SUPABASE, useValue: { from } }] });
  return { service: TestBed.inject(PrioritiesService), from, select, order };
}

describe('PrioritiesService', () => {
  it('reads v_priorities ordered by priority_rank and adds the project colour', async () => {
    const { service, from, order } = setup(
      { data: [row()], error: null },
      { data: [{ id: 'p1', color: '#2f5f93' }], error: null },
    );

    const tasks = await service.load();

    expect(from).toHaveBeenCalledWith('v_priorities');
    expect(from).toHaveBeenCalledWith('projects');
    expect(order).toHaveBeenCalledWith('priority_rank');
    expect(tasks).toEqual([
      {
        id: 't1',
        title: 'Scrivere il preventivo',
        nextAction: 'Chiedere i numeri a Marco',
        projectId: 'p1',
        projectName: 'Reply - Fleet',
        projectScope: 'work',
        projectColor: '#2f5f93',
        priorityLevel: 1,
        priorityRank: 1,
        effectiveDueDate: '2026-11-26',
        checkpointName: 'Consegna',
        blocksOthers: true,
        isBlocked: false,
        isWaiting: true,
        hasQuestionToAsk: true,
        waitingOn: 'Marco',
      },
    ]);
  });

  it('keeps the database order', async () => {
    const { service } = setup(
      {
        data: [
          row({ id: 'a', priority_rank: 1 }),
          row({ id: 'b', priority_rank: 2 }),
          row({ id: 'c', priority_rank: 3 }),
        ],
        error: null,
      },
      { data: [], error: null },
    );

    expect((await service.load()).map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('leaves the colour null when the project has none', async () => {
    const { service } = setup(
      { data: [row()], error: null },
      { data: [{ id: 'p1', color: null }], error: null },
    );

    expect((await service.load())[0].projectColor).toBeNull();
  });

  it('skips malformed rows', async () => {
    const { service } = setup(
      {
        data: [
          row({ id: null }),
          row({ priority_level: 4 }),
          row({ project_scope: 'other' }),
          row({ id: 'ok' }),
        ],
        error: null,
      },
      { data: [], error: null },
    );

    expect((await service.load()).map((t) => t.id)).toEqual(['ok']);
  });

  it('turns query errors into an error without database data', async () => {
    const { service } = setup(
      { data: null, error: { message: 'permission denied for view v_priorities' } },
      { data: [], error: null },
    );

    const error = await service.load().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PrioritiesUnavailableError);
    expect((error as Error).message).toBe('Priorities unavailable');
  });

  it('turns network failures into the same error', async () => {
    const { service } = setup(Promise.reject(new TypeError('Failed to fetch')), {
      data: [],
      error: null,
    });

    await expect(service.load()).rejects.toBeInstanceOf(PrioritiesUnavailableError);
  });
});
