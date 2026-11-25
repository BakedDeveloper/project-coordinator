import { TestBed } from '@angular/core/testing';

import { ProjectService, ProjectUnavailableError } from './project.service';
import { SUPABASE } from './supabase.client';

interface Result {
  data: unknown;
  error: unknown;
}

const ID = '0b7c1f3e-2a4d-4c6e-8f10-1a2b3c4d5e6f';

/**
 * A fake query builder: every filter returns the builder, awaiting it gives the result of
 * its table. It records the calls, to check the filters.
 */
function setup(results: Record<string, Result | 'reject'>) {
  const calls: Record<string, [string, unknown[]][]> = {};
  const from = vi.fn((table: string) => {
    calls[table] = [];
    const result = results[table];
    const settle = () =>
      result === 'reject' ? Promise.reject(new Error('network')) : Promise.resolve(result);
    const builder: Record<string, unknown> = {
      then: (ok: (r: unknown) => unknown, ko: (e: unknown) => unknown) => settle().then(ok, ko),
    };
    for (const method of ['select', 'eq', 'in', 'is', 'order']) {
      builder[method] = (...args: unknown[]) => {
        calls[table].push([method, args]);
        return builder;
      };
    }
    builder['maybeSingle'] = () => builder;
    return builder;
  });
  TestBed.configureTestingModule({ providers: [{ provide: SUPABASE, useValue: { from } }] });
  return { service: TestBed.inject(ProjectService), from, calls };
}

const project = (overrides: Record<string, unknown> = {}) => ({
  id: ID,
  name: 'Casa',
  scope: 'personal',
  status: 'active',
  color: '#2f5f93',
  weekly_hours: null,
  ...overrides,
});

const taskRow = (overrides: Record<string, unknown> = {}) => ({
  id: 't1',
  title: 'Chiamare l’idraulico',
  next_action: 'Cercare il numero',
  status: 'todo',
  effective_due_date: '2026-11-30',
  checkpoint_name: 'Trasloco',
  blocks_others: false,
  is_blocked: true,
  is_waiting: false,
  has_question_to_ask: false,
  waiting_on: null,
  created_at: '2026-11-20T10:00:00Z',
  ...overrides,
});

const ok = (data: unknown): Result => ({ data, error: null });

describe('ProjectService', () => {
  it('reads the project, its open tasks with their rank and its open checkpoints', async () => {
    const { service, calls } = setup({
      projects: ok(project()),
      v_tasks: ok([taskRow()]),
      checkpoints: ok([{ id: 'c1', name: 'Trasloco', due_date: '2026-12-01' }]),
      v_priorities: ok([{ id: 't1', priority_rank: 4 }]),
    });

    const detail = await service.load(ID);

    expect(calls['v_tasks']).toContainEqual(['eq', ['project_id', ID]]);
    expect(calls['v_tasks']).toContainEqual(['in', ['status', ['todo', 'in_progress']]]);
    expect(calls['checkpoints']).toContainEqual(['is', ['completed_at', null]]);
    expect(calls['v_priorities']).toContainEqual(['eq', ['project_id', ID]]);
    expect(detail).toEqual({
      project: {
        id: ID,
        name: 'Casa',
        scope: 'personal',
        status: 'active',
        color: '#2f5f93',
        weeklyHours: null,
      },
      tasks: [
        {
          id: 't1',
          title: 'Chiamare l’idraulico',
          nextAction: 'Cercare il numero',
          projectId: ID,
          projectName: 'Casa',
          projectColor: '#2f5f93',
          status: 'todo',
          effectiveDueDate: '2026-11-30',
          checkpointName: 'Trasloco',
          blocksOthers: false,
          isBlocked: true,
          isWaiting: false,
          hasQuestionToAsk: false,
          waitingOn: null,
          createdAt: '2026-11-20T10:00:00Z',
          priorityRank: 4,
        },
      ],
      checkpoints: [{ id: 'c1', name: 'Trasloco', dueDate: '2026-12-01' }],
    });
  });

  it('leaves the rank null when v_priorities has no row (project not active)', async () => {
    const { service } = setup({
      projects: ok(project({ status: 'paused' })),
      v_tasks: ok([taskRow()]),
      checkpoints: ok([]),
      v_priorities: ok([]),
    });

    const detail = await service.load(ID);

    expect(detail?.tasks[0].priorityRank).toBeNull();
  });

  it('returns null for an unknown project', async () => {
    const { service } = setup({
      projects: ok(null),
      v_tasks: ok([]),
      checkpoints: ok([]),
      v_priorities: ok([]),
    });

    expect(await service.load(ID)).toBeNull();
  });

  it('returns null without asking the database when the id is not a uuid', async () => {
    const { service, from } = setup({});

    expect(await service.load('non-esiste')).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it('throws an error without database data when a query fails', async () => {
    const { service } = setup({
      projects: ok(project()),
      v_tasks: { data: null, error: { message: 'secret detail' } },
      checkpoints: ok([]),
      v_priorities: ok([]),
    });

    const error = await service.load(ID).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProjectUnavailableError);
    expect((error as Error).message).not.toContain('secret');
  });

  it('throws when the network fails', async () => {
    const { service } = setup({
      projects: 'reject',
      v_tasks: ok([]),
      checkpoints: ok([]),
      v_priorities: ok([]),
    });

    await expect(service.load(ID)).rejects.toBeInstanceOf(ProjectUnavailableError);
  });
});
