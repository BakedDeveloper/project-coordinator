import {
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  LucideDynamicIcon,
  LucideLayoutGrid,
  LucideListOrdered,
  LucideLogOut,
  LucideMenu,
  LucidePalette,
  LucidePanelLeftClose,
  LucidePanelLeftOpen,
  LucideSquareKanban,
} from '@lucide/angular';

import { LOGIN_PATH } from '../auth/auth.guards';
import { AuthService } from '../data/auth.service';
import { LocalSettings } from '../shared/local-settings';
import { ThemeService } from '../theme/theme.service';
import { SidebarProjects } from './sidebar-projects';

/** The sections of the side menu, in order. */
const SECTIONS = [
  { path: '/', label: 'Board', icon: LucideSquareKanban },
  { path: '/priorita', label: 'Priorità', icon: LucideListOrdered },
] as const;

/** Wide screens have the side menu; narrower ones open it as a drawer. */
const WIDE = '(min-width: 48rem)';

/**
 * Frame of every protected page (issue #66): the side menu with the sections, the projects,
 * Personalizza and Esci, then the page. On wide screens the menu can be reduced to icons;
 * on a phone it opens over the page from the button in the top bar.
 */
@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    SidebarProjects,
    LucideDynamicIcon,
    LucideLayoutGrid,
    LucideLogOut,
    LucideMenu,
    LucidePalette,
    LucidePanelLeftClose,
    LucidePanelLeftOpen,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
  host: { '(document:keydown.escape)': 'closeDrawer(true)' },
})
export class Shell implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly theme = inject(ThemeService);
  protected readonly settings = inject(LocalSettings);
  private readonly menuButton = viewChild.required<ElementRef<HTMLButtonElement>>('menuButton');

  protected readonly sections = SECTIONS;
  protected readonly signingOut = signal(false);
  protected readonly drawerOpen = signal(false);
  private readonly wide = signal(matches(WIDE));
  /** Reduced only where there is a side menu: the phone drawer always has the labels. */
  protected readonly collapsed = computed(() => this.wide() && this.settings.sidebarCollapsed());

  constructor() {
    const subscription = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.drawerOpen.set(false);
      }
    });
    const media = typeof window.matchMedia === 'function' ? window.matchMedia(WIDE) : null;
    const onChange = (event: MediaQueryListEvent) => this.wide.set(event.matches);
    media?.addEventListener('change', onChange);
    inject(DestroyRef).onDestroy(() => {
      subscription.unsubscribe();
      media?.removeEventListener('change', onChange);
    });
  }

  ngOnInit(): void {
    // The shell appears after every sign-in: the saved theme then replaces the cached one.
    void this.theme.syncFromDatabase();
  }

  protected closeDrawer(focusButton = false): void {
    if (!this.drawerOpen()) {
      return;
    }
    this.drawerOpen.set(false);
    if (focusButton) {
      this.menuButton().nativeElement.focus();
    }
  }

  protected async signOut(): Promise<void> {
    if (this.signingOut()) {
      return;
    }
    this.signingOut.set(true);
    await this.auth.signOut();
    this.signingOut.set(false);
    await this.router.navigateByUrl(LOGIN_PATH);
  }
}

function matches(query: string): boolean {
  return typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : true;
}
