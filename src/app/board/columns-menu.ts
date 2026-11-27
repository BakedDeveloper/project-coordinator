import { Component, input, output, signal } from '@angular/core';

import { BOARD_COLUMNS, type ColumnKey } from './board.model';

/** One change in the "Colonne" menu. */
export interface ColumnToggle {
  key: ColumnKey;
  show: boolean;
}

/**
 * The "Colonne" button and its checkboxes, to choose the board columns to show. The board
 * keeps the choice and saves it; the last visible column cannot be unchecked.
 */
@Component({
  selector: 'app-columns-menu',
  templateUrl: './columns-menu.html',
  styleUrl: './columns-menu.css',
})
export class ColumnsMenu {
  /** The columns shown now, in board order. */
  readonly visible = input.required<readonly ColumnKey[]>();
  readonly toggled = output<ColumnToggle>();

  protected readonly columns = BOARD_COLUMNS;
  protected readonly open = signal(false);

  protected isVisible(key: ColumnKey): boolean {
    return this.visible().includes(key);
  }

  /** The last visible column cannot be hidden: the board would be empty. */
  protected isLastVisible(key: ColumnKey): boolean {
    const visible = this.visible();
    return visible.length === 1 && visible[0] === key;
  }

  protected close(trigger: HTMLButtonElement): void {
    this.open.set(false);
    trigger.focus();
  }
}
