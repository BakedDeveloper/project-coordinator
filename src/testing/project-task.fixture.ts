import type { ProjectTask } from '../app/data/project.service';

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
