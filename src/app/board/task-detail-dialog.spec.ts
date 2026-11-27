import { TestBed } from '@angular/core/testing';

import { boardTask } from '../../testing/board-task.fixture';
import type { BoardTask } from '../data/board.service';
import { TaskDetailService, type TaskDetail } from '../data/task-detail.service';
import { TaskService } from '../data/task.service';
import { TaskDetailDialog } from './task-detail-dialog';

const DETAIL: TaskDetail = {
  id: 't1',
  title: 'Preparare la demo',
  status: 'todo',
  projectId: 'p1',
  projectName: 'Reply - Fleet',
  fromGithub: false,
  nextAction: 'Chiedere i dati',
  description: null,
  impact: 'medium',
  dueDate: null,
  effectiveDueDate: null,
  checkpointName: null,
  blockedBy: ['Avere il contratto'],
  blocks: [],
  waiting: [
    { person: 'Marco', description: 'I numeri', kind: 'material', asked: false, askBy: null },
  ],
  hours: 2,
};

async function render(
  task: BoardTask,
  detail: TaskDetail = DETAIL,
  update = vi.fn(() => Promise.resolve()),
) {
  await TestBed.configureTestingModule({
    imports: [TaskDetailDialog],
    providers: [
      { provide: TaskDetailService, useValue: { load: () => Promise.resolve(detail) } },
      { provide: TaskService, useValue: { update } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(TaskDetailDialog);
  fixture.componentRef.setInput('task', task);
  const saved = vi.fn();
  fixture.componentInstance.saved.subscribe(saved);
  await fixture.whenStable();
  fixture.componentInstance.open();
  // The details arrive asynchronously.
  await fixture.whenStable();
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const field = (label: string) =>
    [...element.querySelectorAll('label.field')]
      .find((l) => l.querySelector('.field__label')?.textContent === label)!
      .querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        'input, textarea, select',
      )!;
  const type = (label: string, value: string) => {
    const f = field(label);
    f.value = value;
    f.dispatchEvent(new Event(f instanceof HTMLSelectElement ? 'change' : 'input'));
  };
  const save = async () => {
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  };
  return { fixture, element, update, saved, field, type, save };
}

describe('TaskDetailDialog', () => {
  it('shows every detail, with waiting items, blocks and hours', async () => {
    const { element, field } = await render(boardTask({ id: 't1' }));

    expect(field('Titolo').value).toBe('Preparare la demo');
    expect(field('Prossima azione').value).toBe('Chiedere i dati');
    const facts = [...element.querySelectorAll('.detail__facts dt')].map(
      (dt) => `${dt.textContent?.trim()}: ${dt.nextElementSibling?.textContent?.trim()}`,
    );
    expect(facts).toEqual([
      'Stato: Da fare',
      'Aspetta il task: Avere il contratto',
      'Domanda da fare a Marco: I numeri',
      'Ore registrate: 2',
    ]);
  });

  it('saves the edited fields and tells the board', async () => {
    const { update, saved, type, save } = await render(boardTask({ id: 't1' }));

    type('Titolo', 'Demo pronta');
    type('Descrizione', 'Con i dati veri');
    type('Scadenza', '2026-12-04');
    type('Importanza', 'high');
    await save();

    expect(update).toHaveBeenCalledWith(
      't1',
      {
        title: 'Demo pronta',
        nextAction: 'Chiedere i dati',
        description: 'Con i dati veri',
        dueDate: '2026-12-04',
        impact: 'high',
      },
      false,
    );
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('keeps the title of a GitHub task read-only and says why', async () => {
    const { element, field, update, save } = await render(
      boardTask({ id: 't1', fromGithub: true }),
      {
        ...DETAIL,
        fromGithub: true,
      },
    );

    expect((field('Titolo') as HTMLInputElement).readOnly).toBe(true);
    expect(element.querySelector('#detail-github')?.textContent).toContain('GitHub');
    await save();
    expect(update).toHaveBeenCalledWith('t1', expect.anything(), true);
  });

  it('keeps what was typed and shows a message when saving fails', async () => {
    const { element, saved, type, save, field } = await render(
      boardTask({ id: 't1' }),
      DETAIL,
      vi.fn(() => Promise.reject(new Error('offline'))),
    );

    type('Prossima azione', 'Telefonare');
    await save();

    expect(saved).not.toHaveBeenCalled();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Non sono riuscito a salvare',
    );
    expect(field('Prossima azione').value).toBe('Telefonare');
  });
});
