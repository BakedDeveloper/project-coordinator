import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter, type ParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { ProjectService, type Project, type ProjectDetail } from '../data/project.service';
import { CLOCK } from '../shared/clock';
import { projectTask as task } from '../../testing/project-task.fixture';
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
  return { project: PROJECT, tasks: [], checkpoints: [], ...overrides };
}

async function setup(load: (id: string) => Promise<ProjectDetail | null>) {
  const projects = { load: vi.fn(load) };
  const params = new BehaviorSubject<ParamMap>(convertToParamMap({ id: 'p1' }));
  await TestBed.configureTestingModule({
    imports: [ProjectPage],
    providers: [
      provideRouter([]),
      { provide: ProjectService, useValue: projects },
      { provide: ActivatedRoute, useValue: { paramMap: params } },
      { provide: CLOCK, useValue: () => new Date(2026, 10, 25, 9, 0) },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(ProjectPage);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  return { fixture, element, projects, params, title: TestBed.inject(Title) };
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

    expect(projects.load).toHaveBeenCalledWith('p1');
    const tag = element.querySelector<HTMLElement>('h1 .project-tag')!;
    expect(tag.textContent).toBe('Casa');
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

    expect(projects.load).toHaveBeenLastCalledWith('p2');
    expect(text(element.querySelector('h1'))).toBe('Lavoro');
  });
});
