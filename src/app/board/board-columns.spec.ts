import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { boardTask } from '../../testing/board-task.fixture';
import type { BoardTask } from '../data/board.service';
import { TaskService } from '../data/task.service';
import { CLOCK } from '../shared/clock';
import { BoardColumns } from './board-columns';
import { buildColumns, doneSince } from './board.model';

// 25 November 2026, 9:00 local time.
const NOW = new Date(2026, 10, 25, 9, 0);

async function render(tasks: BoardTask[], setStatus = vi.fn(() => Promise.resolve())) {
  await TestBed.configureTestingModule({
    imports: [BoardColumns],
    providers: [
      provideRouter([]),
      { provide: TaskService, useValue: { setStatus } },
      { provide: CLOCK, useValue: () => NOW },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(BoardColumns);
  fixture.componentRef.setInput(
    'columns',
    buildColumns(tasks, { scope: 'all', projectId: null }, doneSince(NOW)),
  );
  fixture.componentRef.setInput('today', '2026-11-25');
  const moved = vi.fn();
  fixture.componentInstance.moved.subscribe(moved);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  return { fixture, element, setStatus, moved };
}

function column(element: HTMLElement, key: string): string[] {
  return [...element.querySelectorAll(`[data-column="${key}"] .card__title`)].map(
    (e) => e.textContent ?? '',
  );
}

function button(element: HTMLElement, text: string): HTMLButtonElement {
  const found = [...element.querySelectorAll('button')].find((b) =>
    (b.textContent ?? '').trim().startsWith(text),
  );
  if (!found) {
    throw new Error(`No button "${text}"`);
  }
  return found;
}

/** An entry of the open "Sposta in…" menu. */
function target(element: HTMLElement, label: string): HTMLButtonElement {
  const found = [...element.querySelectorAll<HTMLButtonElement>('.move__target')].find(
    (b) => (b.textContent ?? '').trim() === label,
  );
  if (!found) {
    throw new Error(`No menu entry "${label}"`);
  }
  return found;
}

describe('BoardColumns', () => {
  it('moves a card with the "Sposta in…" menu and tells the page', async () => {
    const { fixture, element, setStatus, moved } = await render([
      boardTask({ id: 't1', title: 'Preventivo' }),
    ]);

    const trigger = button(element, 'Sposta in…');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    trigger.click();
    await fixture.whenStable();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    // Bloccato is never offered, nor the column the card is in.
    const targets = [...element.querySelectorAll('.move__target')].map((b) =>
      b.textContent?.trim(),
    );
    expect(targets).toEqual(['In corso', 'Fatto']);

    target(element, 'In corso').click();
    await fixture.whenStable();

    expect(setStatus).toHaveBeenCalledWith('t1', 'in_progress');
    expect(column(element, 'in_progress')).toEqual(['Preventivo']);
    expect(column(element, 'todo')).toEqual([]);
    expect(moved).toHaveBeenCalledTimes(1);
  });

  it('closes the menu with Escape and gives the focus back to its button', async () => {
    const { fixture, element } = await render([boardTask({ id: 't1' })]);

    const trigger = button(element, 'Sposta in…');
    trigger.click();
    await fixture.whenStable();
    element
      .querySelector('.move__target')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();

    expect(element.querySelector('.move__menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('cannot move a GitHub task: no menu, no drag, and says why', async () => {
    const { element } = await render([boardTask({ id: 'g1', fromGithub: true })]);

    expect(element.querySelector('.move__trigger')).toBeNull();
    expect(element.querySelector('.item')!.classList).toContain('cdk-drag-disabled');
    expect(element.querySelector('.move__locked')?.textContent).toContain('GitHub');
  });

  it('puts the card back and shows a message when the write fails', async () => {
    const { fixture, element, moved } = await render(
      [boardTask({ id: 't1', title: 'Preventivo' })],
      vi.fn(() => Promise.reject(new Error('offline'))),
    );

    button(element, 'Sposta in…').click();
    await fixture.whenStable();
    target(element, 'Fatto').click();
    await fixture.whenStable();

    expect(column(element, 'todo')).toEqual(['Preventivo']);
    expect(column(element, 'done')).toEqual([]);
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Non sono riuscito a spostare «Preventivo»',
    );
    expect(moved).not.toHaveBeenCalled();
  });

  it('shows the card already moved while the database is written', async () => {
    let finish: () => void = () => undefined;
    const { fixture, element } = await render(
      [boardTask({ id: 't1', title: 'Preventivo' })],
      vi.fn(() => new Promise<void>((resolve) => (finish = resolve))),
    );

    button(element, 'Sposta in…').click();
    await fixture.whenStable();
    target(element, 'Fatto').click();
    fixture.detectChanges();

    expect(column(element, 'done')).toEqual(['Preventivo']);
    expect(element.querySelector('.move__pending')?.textContent).toContain('Salvo');
    finish();
    await fixture.whenStable();
  });
});
