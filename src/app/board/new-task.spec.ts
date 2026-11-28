import { TestBed } from '@angular/core/testing';

import type { ProjectLink } from '../data/project.service';
import { ProjectService } from '../data/project.service';
import { TaskService } from '../data/task.service';
import { NewTask } from './new-task';

const PROJECTS: ProjectLink[] = [
  { id: 'p1', name: 'Reply - Fleet', status: 'active', color: null },
  { id: 'p2', name: 'Vecchio', status: 'closed', color: null },
];

async function render(projectId: string | null, create = vi.fn(() => Promise.resolve('new'))) {
  await TestBed.configureTestingModule({
    imports: [NewTask],
    providers: [
      { provide: TaskService, useValue: { create } },
      { provide: ProjectService, useValue: { list: () => Promise.resolve(PROJECTS) } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(NewTask);
  fixture.componentRef.setInput('projectId', projectId);
  const created = vi.fn();
  fixture.componentInstance.created.subscribe(created);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  document.body.appendChild(element);

  const open = async () => {
    element.querySelector<HTMLButtonElement>('.new-task__trigger')!.click();
    await fixture.whenStable();
  };
  const type = (id: string, value: string) => {
    const field = element.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)!;
    field.value = value;
    field.dispatchEvent(new Event(field instanceof HTMLSelectElement ? 'change' : 'input'));
  };
  const save = async () => {
    element.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  };
  return { fixture, element, create, created, open, type, save };
}

describe('NewTask', () => {
  afterEach(() => document.body.querySelectorAll('app-new-task').forEach((e) => e.remove()));

  it('creates a task on the chosen active project with the fields filled in', async () => {
    const { element, create, created, open, type, save } = await render(null);

    await open();
    const options = [...element.querySelectorAll('#new-task-project option')].map((o) =>
      o.textContent?.trim(),
    );
    expect(options).toEqual(['Scegli un progetto', 'Reply - Fleet']);
    // Every field has a label.
    for (const field of element.querySelectorAll('input, select')) {
      expect(element.querySelector(`label[for="${field.id}"]`)).not.toBeNull();
    }

    type('new-task-project', 'p1');
    type('new-task-name', 'Preparare la demo');
    type('new-task-status', 'on_hold');
    type('new-task-impact', 'high');
    type('new-task-due', '2026-12-04');
    type('new-task-next', 'Chiedere i dati');
    await save();

    expect(create).toHaveBeenCalledWith({
      projectId: 'p1',
      title: 'Preparare la demo',
      status: 'on_hold',
      impact: 'high',
      nextAction: 'Chiedere i dati',
      dueDate: '2026-12-04',
    });
    expect(created).toHaveBeenCalledTimes(1);
    expect(element.querySelector('form')).toBeNull();
  });

  it('needs a title and a project, and says which is missing', async () => {
    const { element, create, open, save } = await render(null);

    await open();
    await save();

    expect(create).not.toHaveBeenCalled();
    expect(element.querySelector('#new-task-name')!.getAttribute('aria-invalid')).toBe('true');
    expect(element.querySelector('#new-task-name-error')?.textContent).toContain('titolo');
    expect(element.querySelector('#new-task-project-error')?.textContent).toContain('progetto');
  });

  it('uses the project of the board and starts from the title', async () => {
    const { element, create, open, type, save } = await render('p9');

    await open();
    expect(element.querySelector('#new-task-project')).toBeNull();
    expect(document.activeElement?.id).toBe('new-task-name');

    type('new-task-name', 'Rivedere il piano');
    await save();

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'p9', status: 'todo', impact: 'medium', dueDate: null }),
    );
  });

  it('keeps the form filled and shows a message when the task cannot be created', async () => {
    const { element, created, open, type, save } = await render(
      'p9',
      vi.fn(() => Promise.reject(new Error('offline'))),
    );

    await open();
    type('new-task-name', 'Rivedere il piano');
    await save();

    expect(created).not.toHaveBeenCalled();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Non sono riuscito a creare il task',
    );
    expect(element.querySelector<HTMLInputElement>('#new-task-name')!.value).toBe(
      'Rivedere il piano',
    );
  });

  it('closes with Escape and gives the focus back to the button', async () => {
    const { fixture, element, open } = await render('p9');

    await open();
    element
      .querySelector('#new-task-name')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();

    expect(element.querySelector('form')).toBeNull();
    expect(document.activeElement).toBe(element.querySelector('.new-task__trigger'));
  });
});
