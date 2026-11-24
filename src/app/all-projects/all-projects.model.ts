import type { PriorityLevel, PriorityTask, ProjectScope } from '../data/priorities.service';

export type ScopeFilter = 'all' | ProjectScope;

export const SCOPE_FILTERS: readonly { value: ScopeFilter; label: string }[] = [
  { value: 'all', label: 'Tutti' },
  { value: 'work', label: 'Lavoro' },
  { value: 'personal', label: 'Personale' },
];

/** The rule of each level, as `v_priorities` applies it. */
export const LEVEL_RULES: Record<PriorityLevel, string> = {
  1: 'Sbloccano altri o scadono entro 7 giorni',
  2: 'Hanno una domanda ancora da fare',
  3: 'Il resto, per impatto',
};

export interface ProjectSummary {
  projectId: string;
  projectName: string;
  projectColor: string;
  tasks: PriorityTask[];
}

export interface PriorityGroup {
  level: PriorityLevel;
  rule: string;
  count: number;
  /** Levels 1 and 2: the tasks, open. */
  tasks: PriorityTask[];
  /** Level 3: one collapsed summary per project. */
  projects: ProjectSummary[];
}

/**
 * Groups the tasks by level, keeping the order they come in (`priority_rank`).
 * Empty levels are left out. Level 3 is split by project, in order of each project's
 * first task.
 */
export function groupByLevel(tasks: readonly PriorityTask[], filter: ScopeFilter): PriorityGroup[] {
  const visible = filter === 'all' ? tasks : tasks.filter((t) => t.projectScope === filter);
  const groups: PriorityGroup[] = [];

  for (const level of [1, 2, 3] as const) {
    const levelTasks = visible.filter((t) => t.priorityLevel === level);
    if (levelTasks.length === 0) {
      continue;
    }
    groups.push({
      level,
      rule: LEVEL_RULES[level],
      count: levelTasks.length,
      tasks: level === 3 ? [] : levelTasks,
      projects: level === 3 ? summarizeByProject(levelTasks) : [],
    });
  }
  return groups;
}

function summarizeByProject(tasks: readonly PriorityTask[]): ProjectSummary[] {
  const byProject = new Map<string, ProjectSummary>();
  for (const task of tasks) {
    let summary = byProject.get(task.projectId);
    if (!summary) {
      summary = {
        projectId: task.projectId,
        projectName: task.projectName,
        projectColor: projectColor(task.projectId, task.projectColor),
        tasks: [],
      };
      byProject.set(task.projectId, summary);
    }
    summary.tasks.push(task);
  }
  return [...byProject.values()];
}

/**
 * Dark colours for projects without `projects.color`: white text on each of them is at
 * least 6:1 (the minimum is 4.5:1).
 */
export const FALLBACK_PROJECT_COLORS = [
  '#7a3b69',
  '#2f6b5e',
  '#5a4b8a',
  '#8a4a2f',
  '#3d5f7a',
  '#6b5a2a',
  '#7a4b5a',
  '#4f6b2f',
] as const;

/** The project colour from the database, or a fallback that is stable for the project id. */
export function projectColor(projectId: string, color: string | null): string {
  if (color) {
    return color;
  }
  let hash = 0;
  for (const char of projectId) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return FALLBACK_PROJECT_COLORS[hash % FALLBACK_PROJECT_COLORS.length];
}

/** "domanda da fare · X" or "aspetta X", never both: a question to ask is also a wait. */
export function waitingLabel(task: PriorityTask): string | null {
  if (task.hasQuestionToAsk) {
    return task.waitingOn ? `domanda da fare · ${task.waitingOn}` : 'domanda da fare';
  }
  if (task.isWaiting) {
    return task.waitingOn ? `aspetta ${task.waitingOn}` : 'in attesa';
  }
  return null;
}

export interface DueLabel {
  text: string;
  overdue: boolean;
}

const SHORT_DATE = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' });

/** "24 nov" from an ISO date (`YYYY-MM-DD`), read as a calendar day with no time zone. */
export function formatShortDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return SHORT_DATE.format(new Date(year, month - 1, day));
}

/** Today as an ISO date in the local time zone. */
export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** "scade 24 nov", or "scaduto il 24 nov" once the day has passed. */
export function dueLabel(isoDate: string | null, todayIso: string): DueLabel | null {
  if (!isoDate) {
    return null;
  }
  const date = formatShortDate(isoDate);
  return isoDate < todayIso
    ? { text: `scaduto il ${date}`, overdue: true }
    : { text: `scade ${date}`, overdue: false };
}
