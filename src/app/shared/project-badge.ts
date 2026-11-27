import { Component, computed, inject, input, signal } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';

import { BadgeService, type ProjectBadgeData } from '../data/badge.service';
import { projectIcon } from './project-icons';

/**
 * The badge of a project: for work projects the client logo on a white tile, then, in the
 * project colour, the real project logo (or its drawn icon, or a generic one) and the short
 * name. Never initials.
 *
 * Screen readers get the full project name; the logo and the icon are decorative.
 */
@Component({
  selector: 'app-project-badge',
  imports: [LucideDynamicIcon],
  templateUrl: './project-badge.html',
  styleUrl: './project-badge.css',
})
export class ProjectBadge {
  private readonly badges = inject(BadgeService);

  readonly projectId = input.required<string>();
  /** Full project name, shown until the badge data arrives and read by screen readers. */
  readonly name = input.required<string>();
  /** Background of the coloured part: the project colour, already resolved. */
  readonly color = input.required<string>();
  /** Larger badge, for the page header. */
  readonly large = input(false);

  private readonly all = signal<ReadonlyMap<string, ProjectBadgeData> | null>(null);
  private readonly badge = computed(() => this.all()?.get(this.projectId()) ?? null);

  protected readonly label = computed(() => this.badge()?.shortName ?? this.name());
  /** True when the visible label is not the full name: screen readers get the full one. */
  protected readonly shortened = computed(() => this.label() !== this.name());
  protected readonly logo = computed(() => this.badge()?.logo ?? null);
  protected readonly clientLogo = computed(() => this.badge()?.clientLogo ?? null);
  /** The project icon, else the generic one: never initials. */
  protected readonly icon = computed(() => projectIcon(this.badge()?.icon ?? null));

  constructor() {
    this.badges.badges().then(
      (all) => this.all.set(all),
      // No badge data: the badge stays a coloured tag with the name and the generic icon.
      () => undefined,
    );
  }
}
