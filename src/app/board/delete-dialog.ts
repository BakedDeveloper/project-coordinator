import { Component, ElementRef, input, output, viewChild } from '@angular/core';

import type { BoardTask } from '../data/board.service';

/**
 * The confirmation before deleting a task for good: a modal `<dialog>` that names the task.
 * The focus starts on Annulla; Escape closes it. The board does the deleting.
 */
@Component({
  selector: 'app-delete-dialog',
  templateUrl: './delete-dialog.html',
  styleUrl: './delete-dialog.css',
})
export class DeleteDialog {
  readonly task = input<BoardTask | null>(null);
  readonly deleting = input(false);
  readonly error = input<string | null>(null);
  /** The task has logged hours: it cannot be deleted, only cancelled. */
  readonly hasHours = input(false);

  readonly confirm = output<BoardTask>();
  readonly cancelInstead = output<BoardTask>();
  /** The dialog closed, by a button or Escape. */
  readonly closed = output<void>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  /** Opens the dialog as a modal; where showModal is missing (jsdom in tests), just opens it. */
  open(): void {
    const dialog = this.dialog().nativeElement;
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  close(): void {
    const dialog = this.dialog().nativeElement;
    if (!dialog.open) {
      return;
    }
    if (typeof dialog.close === 'function') {
      dialog.close(); // fires close, which emits closed
    } else {
      dialog.removeAttribute('open');
      this.closed.emit();
    }
  }
}
