import { Injectable, signal } from '@angular/core';

const SHOW_RANK_KEY = 'coordinator.showRank';
const SIDEBAR_COLLAPSED_KEY = 'coordinator.sidebarCollapsed';
const CARD_STYLE_KEY = 'coordinator.cardStyle';
const MENU_SCOPE_KEY = 'coordinator.menuScope';

/** The projects listed in the side menu: all, work or personal. */
export type MenuScope = 'all' | 'work' | 'personal';

/** The look of the board cards: border in the project colour, or plain (sketch A). */
export type CardStyle = 'project' | 'clean';

/**
 * Small display choices kept on this device only (issue #66): the priority number on the
 * cards, their style and the reduced side menu. Storage can be missing or blocked: the defaults apply.
 */
@Injectable({ providedIn: 'root' })
export class LocalSettings {
  private readonly rank = signal(read(SHOW_RANK_KEY) !== 'false');
  private readonly collapsed = signal(read(SIDEBAR_COLLAPSED_KEY) === 'true');
  private readonly scope = signal<MenuScope>(readScope());
  private readonly style = signal<CardStyle>(
    read(CARD_STYLE_KEY) === 'clean' ? 'clean' : 'project',
  );

  /** The priority number on the board cards; shown until Simone hides it. */
  readonly showRank = this.rank.asReadonly();
  /** The side menu reduced to icons. */
  readonly sidebarCollapsed = this.collapsed.asReadonly();
  /** The look of the board cards. */
  readonly cardStyle = this.style.asReadonly();
  /** The projects listed in the side menu. */
  readonly menuScope = this.scope.asReadonly();

  setShowRank(show: boolean): void {
    this.rank.set(show);
    write(SHOW_RANK_KEY, String(show));
  }

  setCardStyle(style: CardStyle): void {
    this.style.set(style);
    write(CARD_STYLE_KEY, style);
  }

  setMenuScope(scope: MenuScope): void {
    this.scope.set(scope);
    write(MENU_SCOPE_KEY, scope);
  }

  setSidebarCollapsed(collapsed: boolean): void {
    this.collapsed.set(collapsed);
    write(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  }
}

function readScope(): MenuScope {
  const value = read(MENU_SCOPE_KEY);
  return value === 'work' || value === 'personal' ? value : 'all';
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not saved: the choice still applies until the page is reloaded.
  }
}
