import { TestBed } from '@angular/core/testing';

import { SUPABASE } from './supabase.client';
import {
  TaskCreateError,
  TaskDeleteError,
  TaskHasHoursError,
  TaskService,
  TaskUpdateError,
  type NewTask,
} from './task.service';

interface Result {
  data: unknown;
  error: unknown;
}

/** A fake supabase-js query builder: records every call, resolves to the given result. */
function setup(result: Result | Promise<never>) {
  const calls: [string, ...unknown[]][] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ['update', 'insert', 'delete', 'eq', 'neq', 'select', 'single']) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, ...args]);
      return builder;
    };
  }
  builder['then'] = (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  const from = vi.fn(() => builder);
  TestBed.configureTestingModule({
    providers: [
      { provide: TaskService, useClass: TaskService },
      { provide: SUPABASE, useValue: { from } },
    ],
  });
  return { service: TestBed.inject(TaskService), from, calls };
}

const NEW_TASK: NewTask = {
  projectId: 'p1',
  title: '  Preparare la demo  ',
  status: 'todo',
  impact: 'high',
  nextAction: '   ',
  dueDate: '2026-12-04',
};

describe('TaskService', () => {
  it('updates the status only, of that task, never of a GitHub task', async () => {
    const { service, from, calls } = setup({ data: [{ id: 't1' }], error: null });

    await service.setStatus('t1', 'in_progress');

    expect(from).toHaveBeenCalledWith('tasks');
    expect(calls).toContainEqual(['update', { status: 'in_progress' }]);
    expect(calls).toContainEqual(['eq', 'id', 't1']);
    expect(calls).toContainEqual(['neq', 'origin', 'github']);
  });

  it('fails when no task changed, e.g. a GitHub task', async () => {
    const { service } = setup({ data: [], error: null });

    await expect(service.setStatus('t1', 'done')).rejects.toBeInstanceOf(TaskUpdateError);
  });

  it('fails without database details on an error or a network failure', async () => {
    const withError = setup({ data: null, error: { message: 'secret detail' } });
    await expect(withError.service.setStatus('t1', 'done')).rejects.toThrow('Task update failed');

    TestBed.resetTestingModule();
    const offline = setup(Promise.reject(new Error('offline')));
    await expect(offline.service.setStatus('t1', 'todo')).rejects.toBeInstanceOf(TaskUpdateError);
  });

  describe('create', () => {
    it('inserts only the fields Simone filled in, trimmed, and returns the new id', async () => {
      const { service, from, calls } = setup({ data: { id: 'new' }, error: null });

      await expect(service.create(NEW_TASK)).resolves.toBe('new');

      expect(from).toHaveBeenCalledWith('tasks');
      // No origin, timestamps or last_changed_by: the database sets them.
      expect(calls).toContainEqual([
        'insert',
        {
          project_id: 'p1',
          title: 'Preparare la demo',
          status: 'todo',
          impact: 'high',
          next_action: null,
          due_date: '2026-12-04',
        },
      ]);
    });

    it('refuses an empty title without calling the database', async () => {
      const { service, from } = setup({ data: { id: 'new' }, error: null });

      await expect(service.create({ ...NEW_TASK, title: '  ' })).rejects.toBeInstanceOf(
        TaskCreateError,
      );
      expect(from).not.toHaveBeenCalled();
    });

    it('fails without database details on an error or a network failure', async () => {
      const withError = setup({ data: null, error: { message: 'secret detail' } });
      await expect(withError.service.create(NEW_TASK)).rejects.toThrow('Task create failed');

      TestBed.resetTestingModule();
      const offline = setup(Promise.reject(new Error('offline')));
      await expect(offline.service.create(NEW_TASK)).rejects.toBeInstanceOf(TaskCreateError);
    });
  });

  describe('delete', () => {
    it('deletes that task, never a GitHub one', async () => {
      const { service, from, calls } = setup({ data: [{ id: 't1' }], error: null });

      await service.delete('t1');

      expect(from).toHaveBeenCalledWith('tasks');
      expect(calls).toContainEqual(['delete']);
      expect(calls).toContainEqual(['eq', 'id', 't1']);
      expect(calls).toContainEqual(['neq', 'origin', 'github']);
    });

    it('says when the task has logged hours, which keep it in the database', async () => {
      const { service } = setup({ data: null, error: { code: '23503', message: 'secret detail' } });

      const error = await service.delete('t1').catch((e: unknown) => e);
      expect(error).toBeInstanceOf(TaskHasHoursError);
      expect(String(error)).not.toContain('secret detail');
    });

    it('fails when nothing was deleted, on an error or a network failure', async () => {
      await expect(setup({ data: [], error: null }).service.delete('t1')).rejects.toBeInstanceOf(
        TaskDeleteError,
      );
      TestBed.resetTestingModule();
      const offline = setup(Promise.reject(new Error('offline')));
      const error = await offline.service.delete('t1').catch((e: unknown) => e);
      expect(error).toBeInstanceOf(TaskDeleteError);
      expect(error).not.toBeInstanceOf(TaskHasHoursError);
    });
  });

  describe('update', () => {
    it('writes only the edited fields, trimmed', async () => {
      const { service, calls } = setup({ data: [{ id: 't1' }], error: null });

      await service.update('t1', { title: ' Nuovo ', nextAction: '  ', impact: 'low' }, false);

      expect(calls).toContainEqual([
        'update',
        { title: 'Nuovo', next_action: null, impact: 'low' },
      ]);
      expect(calls).toContainEqual(['eq', 'id', 't1']);
    });

    it('never sends the title of a GitHub task', async () => {
      const { service, calls } = setup({ data: [{ id: 'g1' }], error: null });

      await service.update('g1', { title: 'Altro', description: 'Note' }, true);

      expect(calls).toContainEqual(['update', { description: 'Note' }]);
    });

    it('refuses an empty title and fails when nothing changed', async () => {
      const { service, from } = setup({ data: [], error: null });
      await expect(service.update('t1', { title: ' ' }, false)).rejects.toBeInstanceOf(
        TaskUpdateError,
      );
      expect(from).not.toHaveBeenCalled();
      await expect(service.update('t1', { dueDate: null }, false)).rejects.toBeInstanceOf(
        TaskUpdateError,
      );
    });
  });
});
