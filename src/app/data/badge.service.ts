import { Injectable, inject } from '@angular/core';

import { SUPABASE } from './supabase.client';

/** What the badge of a project shows, besides its colour. */
export interface ProjectBadgeData {
  name: string;
  /** `projects.short_name`; null: the badge shows the full name. */
  shortName: string | null;
  /** `projects.icon`, a Lucide name, used when the project has no logo; the app may not know it. */
  icon: string | null;
  /** The real logo of the project, as an image data URL; null when it has none. */
  logo: string | null;
  /** The logo of its client (work projects), as an image data URL; null when there is none. */
  clientLogo: string | null;
}

/** Read again after this long, so logos sent by the projects show up without a reload. */
const REFRESH_MS = 10 * 60 * 1000;

/**
 * Reads the badges of every project: short name, icon, project logo and client logo. The
 * logos are image data URLs stored in the database (the projects send them with their
 * updates). The result is shared by every badge on the page.
 */
@Injectable({ providedIn: 'root' })
export class BadgeService {
  private readonly supabase = inject(SUPABASE);
  private cached: {
    at: number;
    badges: Promise<ReadonlyMap<string, ProjectBadgeData>>;
  } | null = null;

  badges(now = Date.now()): Promise<ReadonlyMap<string, ProjectBadgeData>> {
    if (this.cached === null || now - this.cached.at > REFRESH_MS) {
      const badges = this.load();
      this.cached = { at: now, badges };
      // A failed read is not kept: the next badge asks again.
      badges.catch(() => {
        if (this.cached?.badges === badges) {
          this.cached = null;
        }
      });
    }
    return this.cached.badges;
  }

  private async load(): Promise<ReadonlyMap<string, ProjectBadgeData>> {
    const [projects, clients] = await Promise.all([
      this.supabase.from('projects').select('id, name, short_name, icon, logo, client'),
      this.supabase.from('clients').select('name, logo'),
    ]);
    if (projects.error || clients.error) {
      throw new Error('Badges unavailable');
    }

    const clientLogos = new Map(clients.data.map((c) => [c.name, imageDataUrl(c.logo)]));
    return new Map(
      projects.data.map((p) => [
        p.id,
        {
          name: p.name,
          shortName: p.short_name,
          icon: p.icon,
          logo: imageDataUrl(p.logo),
          clientLogo: p.client === null ? null : (clientLogos.get(p.client) ?? null),
        },
      ]),
    );
  }
}

/**
 * The value when it is an image data URL, else null. The database already checks the
 * format; this keeps any other URL out of an `<img src>`.
 */
function imageDataUrl(value: string | null): string | null {
  return value !== null && /^data:image\/(svg\+xml|png|webp);base64,/.test(value) ? value : null;
}
