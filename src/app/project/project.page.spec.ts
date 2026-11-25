import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter, type ParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { ProjectService, type Project, type ProjectDetail } from '../data/project.service';
import { CLOCK } from '../shared/clock';
import { doneProjectTask, projectTask as task } from '../../testing/project-task.fixture';
import { ProjectPage } from './project.page';

const PROJECT: Project = {
  id: 'p1',
  name: 'Casa',
  scope: 'personal',
  status: 'active',
  color: '#2f5f93',
  weeklyHours: null,
};

function detail(overrides: Partial<ProjectDetail> = {}): ProjectDetail {
  return { project: PROJECT, tasks: [], doneTasks: [], checkpoints: [], ...overrides };
}

/** Opens the Cronologia tab unless told otherwise: most tests are about the dated view. */
async function setup(
  load: (id: string) => Promise<ProjectDetail | null>,
  query: Record<string, string> = { vista: 'cronologia' },
) {
  const projects = { load: vi.fn(load) };
  const params = new BehaviorSubject<ParamMap>(convertToParamMap({ id: 'p1' }));
  const queryParams = new BehaviorSubject<ParamMap>(convertToParamMap(query));
  await TestBed.configureTestingModule({
    imports: [ProjectPage],
    providers: [
      provideRouter([]),
      { provide: ProjectService, useValue: projects },
      { provide: ActivatedRoute, useValue: { paramMap: params, queryParamMap: queryParams } },
      { provide: CLOCK, useValue: () => new Date(2026, 10, 25, 9, 0) },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(ProjectPage);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  return { fixture, element, projects, params, queryParams, title: TestBed.inject(Title) };
}

const text = (element: Element | null) => element?.textContent?.replace(/\s+/g, ' ').trim();

/** The page from top to bottom: lines and the titles of the cards. */
const timeline = (element: HTMLElement) =>
  Array.from(element.querySelectorAll('.timeline > li')).map((li) =>
    li.classList.contains('row')
      ? Array.from(li.querySelectorAll('h3'))
          .map((h) => h.textContent)
          .join(',')
      : text(li),
  );

describe('ProjectPage', () => {
  it('shows the header with name, colour, scope and status, and sets the title', async () => {
    const { element, title, projects } = await setup(async () => detail({ tasks: [task()] }));

    expect(projects.load).toHaveBeenCalledWith('p1', new Date(2026, 10, 12, 0, 0));
    expect(text(element.querySelector('h1 .badge__name'))).toBe('Casa');
    const tag = element.querySelector<HTMLElement>('h1 .badge__tag')!;
    expect(tag.style.backgroundColor).toBe('rgb(47, 95, 147)');
    expect(text(element.querySelector('.page-header__meta'))).toBe('Personale · Attivo');
    expect(title.getTitle()).toBe('Casa · Coordinatore');
  });

  it('says when the project does not exist', async () => {
    const { element, title } = await setup(async () => null);

    expect(text(element.querySelector('h1'))).toBe('Progetto non trovato');
    expect(title.getTitle()).toBe('Progetto non trovato · Coordinatore');
  });

  it('shows an error without details and retries', async () => {
    let fail = true;
    const { fixture, element, projects } = await setup(async () => {
      if (fail) throw new Error('secret detail');
      return detail({ tasks: [task()] });
    });

    expect(text(element.querySelector('[role="alert"] p'))).toBe(
      'Non riesco a caricare il progetto.',
    );
    expect(element.textContent).not.toContain('secret');

    fail = false;
    element.querySelector<HTMLButtonElement>('.retry')!.click();
    await fixture.whenStable();
    expect(projects.load).toHaveBeenCalledTimes(2);
    expect(element.querySelector('.board')).not.toBeNull();
  });

  it('says when there are no open tasks', async () => {
    const { element } = await setup(async () => detail());

    expect(text(element.querySelector('.message'))).toBe('Nessun task aperto.');
  });

  it('puts each task in its column, blocked overriding the status', async () => {
    const { element } = await setup(async () =>
      detail({
        tasks: [
          task({
            id: 'a',
            title: 'In corso',
            status: 'in_progress',
            effectiveDueDate: '2026-12-01',
          }),
          task({ id: 'b', title: 'Da fare', effectiveDueDate: '2026-12-01' }),
          task({
            id: 'c',
            title: 'Fermo',
            status: 'in_progress',
            isBlocked: true,
            effectiveDueDate: '2026-12-01',
          }),
        ],
      }),
    );

    const cell = (column: string) =>
      Array.from(element.querySelectorAll(`.row .cell.col--${column} h3`)).map(
        (h) => h.textContent,
      );
    expect(cell('in_progress')).toEqual(['In corso']);
    expect(cell('todo')).toEqual(['Da fare']);
    expect(cell('blocked')).toEqual(['Fermo']);
    // The status label on each card, for phones and screen readers.
    expect(text(element.querySelector('.col--blocked .cell__status'))).toBe('Bloccato');
    // No project tag on the project's own page.
    expect(element.querySelector('.card__project')).toBeNull();
  });

  it('places today and the checkpoints between the rows by date', async () => {
    const { element } = await setup(async () =>
      detail({
        tasks: [
          task({ id: 'o', title: 'Scaduto', effectiveDueDate: '2026-11-20' }),
          task({ id: 'x', title: 'Dicembre', effectiveDueDate: '2026-12-01' }),
        ],
        checkpoints: [{ id: 'c1', name: 'Consegna', dueDate: '2026-11-28' }],
      }),
    );

    expect(timeline(element)).toEqual([
      'Scaduto',
      'Oggi · 25 nov',
      'Checkpoint · Consegna · 28 nov',
      'Dicembre',
    ]);
    expect(element.querySelector('.line--checkpoint')).not.toBeNull();
  });

  it('lists the undated tasks below, by priority_rank', async () => {
    const { element } = await setup(async () =>
      detail({
        tasks: [
          task({ id: 'b', title: 'Secondo', priorityRank: 2 }),
          task({ id: 'a', title: 'Primo', priorityRank: 1 }),
          task({ id: 'd', title: 'Con data', effectiveDueDate: '2026-12-01' }),
        ],
      }),
    );

    const undated = element.querySelector('.undated')!;
    expect(text(undated.querySelector('h2'))).toBe(
      'Senza data · non collegati a nessun checkpoint',
    );
    expect(Array.from(undated.querySelectorAll('h3')).map((h) => h.textContent)).toEqual([
      'Primo',
      'Secondo',
    ]);
  });

  it('names the next task to start when nothing is in progress', async () => {
    const { element } = await setup(async () =>
      detail({
        tasks: [
          task({ id: 'u', title: 'Senza data' }),
          task({ id: 'd', title: 'Il più vicino', effectiveDueDate: '2026-12-01' }),
        ],
      }),
    );

    expect(text(element.querySelector('.board__head.col--in_progress .board__hint'))).toBe(
      'Niente in corso. Il prossimo da iniziare: Il più vicino',
    );
  });

  it('shows no hint when a task is in progress', async () => {
    const { element } = await setup(async () =>
      detail({ tasks: [task({ status: 'in_progress' })] }),
    );

    expect(element.querySelector('.board__hint')).toBeNull();
  });

  it('orders a paused project by creation and says so', async () => {
    const { element } = await setup(async () =>
      detail({
        project: { ...PROJECT, status: 'paused' },
        tasks: [
          task({ id: 'n', title: 'Nuovo', priorityRank: null, createdAt: '2026-11-10' }),
          task({ id: 'v', title: 'Vecchio', priorityRank: null, createdAt: '2026-11-02' }),
        ],
      }),
    );

    expect(text(element.querySelector('.notice'))).toBe(
      'Progetto in pausa (o chiuso): i task non hanno priorità, sono in ordine di creazione.',
    );
    expect(text(element.querySelector('.page-header__meta'))).toBe('Personale · In pausa');
    expect(Array.from(element.querySelectorAll('.undated h3')).map((h) => h.textContent)).toEqual([
      'Vecchio',
      'Nuovo',
    ]);
  });

  it('has no priority notice for an active project', async () => {
    const { element } = await setup(async () => detail({ tasks: [task()] }));

    expect(element.querySelector('.notice')).toBeNull();
  });

  it('says the plan map will come later for a project with weekly hours', async () => {
    const { element } = await setup(async () =>
      detail({ project: { ...PROJECT, weeklyHours: 10 }, tasks: [task()] }),
    );

    expect(text(element.querySelector('.notice'))).toContain('la mappa con le ore (vista E)');
  });

  it('reloads when the id changes and drops a late answer for the previous project', async () => {
    let resolveFirst!: (d: ProjectDetail) => void;
    const { fixture, element, projects, params } = await setup((id) =>
      id === 'p1'
        ? new Promise((resolve) => (resolveFirst = resolve))
        : Promise.resolve(detail({ project: { ...PROJECT, id: 'p2', name: 'Lavoro' } })),
    );

    params.next(convertToParamMap({ id: 'p2' }));
    await fixture.whenStable();
    resolveFirst(detail());
    await fixture.whenStable();

    expect(projects.load).toHaveBeenLastCalledWith('p2', expect.any(Date));
    expect(text(element.querySelector('h1 .badge__name'))).toBe('Lavoro');
  });

  describe('tabs', () => {
    const tabs = (element: HTMLElement) =>
      Array.from(element.querySelectorAll<HTMLAnchorElement>('nav.tabs a')).map((a) => ({
        text: text(a),
        href: a.getAttribute('href'),
        current: a.getAttribute('aria-current'),
      }));

    it('opens on the board, with the project tasks in their columns and no project tag', async () => {
      const { element, fixture } = await setup(
        async () =>
          detail({
            tasks: [
              task({ id: 'a', title: 'Da iniziare', status: 'todo', priorityRank: 2 }),
              task({ id: 'b', title: 'Bloccato', status: 'in_progress', isBlocked: true }),
            ],
          }),
        {},
      );

      expect(tabs(element)).toEqual([
        { text: 'Board', href: '/progetti/p1', current: 'page' },
        { text: 'Cronologia', href: '/progetti/p1?vista=cronologia', current: null },
      ]);
      const column = (key: string) =>
        Array.from(element.querySelectorAll(`[data-column="${key}"] h3`)).map((h) => h.textContent);
      expect(column('todo')).toEqual(['Da iniziare']);
      expect(column('blocked')).toEqual(['Bloccato']);
      expect(element.querySelector('.card__project')).toBeNull();
      expect(element.querySelector('.timeline')).toBeNull();
      expect((fixture.nativeElement as HTMLElement).classList).not.toContain('narrow');
    });

    it('shows the done tasks of the project in Fatto', async () => {
      const { element } = await setup(
        async () =>
          detail({
            doneTasks: [
              doneProjectTask({ id: 'd', title: 'Finito', completedAt: '2026-11-24T16:00:00Z' }),
            ],
          }),
        {},
      );

      const done = element.querySelector('[data-column="done"]')!;
      expect(text(done.querySelector('h3'))).toBe('Finito');
      expect(text(done.querySelector('.card__done'))).toBe('fatto il 24 nov');
    });

    it('switches to Cronologia from the address without reloading the project', async () => {
      const { element, fixture, projects, queryParams } = await setup(
        async () =>
          detail({ tasks: [task({ title: 'Con data', effectiveDueDate: '2026-11-30' })] }),
        {},
      );

      queryParams.next(convertToParamMap({ vista: 'cronologia' }));
      await fixture.whenStable();

      expect(tabs(element).map((t) => t.current)).toEqual([null, 'page']);
      expect(element.querySelector('.timeline')).not.toBeNull();
      expect(element.querySelector('app-board-columns')).toBeNull();
      expect((fixture.nativeElement as HTMLElement).classList).toContain('narrow');
      expect(projects.load).toHaveBeenCalledTimes(1);
    });
  });
});
