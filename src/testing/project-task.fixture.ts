import type { DoneProjectTask, ProjectTask } from '../app/data/project.service';

/** An open task of a project for tests: neutral values, override what the test is about. */
export function projectTask(overrides: Partial<ProjectTask> = {}): ProjectTask {
  return {
    id: 't',
    title: 'Task',
    nextAction: null,
    projectId: 'p1',
    projectName: 'Progetto 1',
    projectColor: '#2f5f93',
    status: 'todo',
    effectiveDueDate: null,
    checkpointName: null,
    blocksOthers: false,
    isBlocked: false,
    isWaiting: false,
    hasQuestionToAsk: false,
    waitingOn: null,
    createdAt: '2026-11-01T09:00:00Z',
    priorityRank: 1,
    ...overrides,
  };
}

/** A task of a project done recently, for tests. */
export function doneProjectTask(overrides: Partial<DoneProjectTask> = {}): DoneProjectTask {
  return {
    id: 'd',
    title: 'Task fatto',
    nextAction: null,
    projectId: 'p1',
    projectName: 'Progetto 1',
    projectColor: '#2f5f93',
    status: 'done',
    effectiveDueDate: null,
    checkpointName: null,
    blocksOthers: false,
    isBlocked: false,
    isWaiting: false,
    hasQuestionToAsk: false,
    waitingOn: null,
    createdAt: '2026-11-01T09:00:00Z',
    completedAt: '2026-11-24T16:00:00Z',
    ...overrides,
  };
}
