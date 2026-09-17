import { DISCOVERIES, LANDMARKS } from '../game/content';
import { EXHIBITS, CATALOGUE_URL, photoURL } from '../game/exhibits';
import type { Progress, Discovery, Landmark } from '../game/content';
export type Mode = 'welcome' | 'walking' | 'map' | 'lore' | 'journal' | 'paused';
const icons: Record<string, string> = {
  map: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Z"/><path d="M9 3v16M15 5v16"/>',
  book: '<path d="M12 5v16M12 5C9 3 5 3 2 4v15c4-1 7 0 10 2 3-2 6-3 10-2V4c-3-1-7-1-10 1Z"/>',
  walk: '<circle cx="13" cy="4" r="2"/><path d="m7 21 3-7m7 7-3-8V8l-4 2-2 4M14 8l3 5h3"/>',
  menu: '<path d="M5 7h14M5 12h14M5 17h14"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6 6-2Z"/>',
  leaf: '<path d="M20 3C7 2 2 8 5 16c7 5 15 0 15-13ZM5 20 16 8"/>',
  sound: '<path d="M4 9v6h4l5 4V5L8 9H4ZM17 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
};
export function icon(name: string): string { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + icons[name] + '</svg>'; }
export class UI {
  readonly canvas: HTMLCanvasElement;
  readonly joystick: HTMLElement;
  private readonly app: HTMLElement;
  private lastFocus: HTMLElement | null = null;
  private readonly modeLabel: HTMLElement;
  private readonly location: HTMLElement;
  private readonly prompt: HTMLButtonElement;
  private readonly live: HTMLElement;
  private toastTimer = 0;
  constructor(private action: (id: string) => void) {
    this.app = document.querySelector('#app')!;
    this.app.innerHTML = [
      '<canvas id="world" aria-label="Livistone interactive 3D town" tabindex="0"></canvas>',
      '<div class="vignette" aria-hidden="true"></div>',
      '<header class="topbar"><a class="brand" href="#" aria-label="Livistone home">' + icon('leaf') + '<span>LIVISTONE<span class="brand-sub">A LIVING WORLD</span></span></a><div class="top-center"><span class="status-dot"></span><span id="mode-label">ART, SCIENCE & NATURE</span></div><nav id="tools" aria-label="Explore Livistone" hidden><button class="tool" data-action="map" aria-label="City map">' + icon('map') + '<span>City map</span><kbd>M</kbd></button><button class="tool" data-action="journal" aria-label="Open discovery journal">' + icon('book') + '<span>Journal</span></button><button class="tool square" data-action="pause" aria-label="Open menu">' + icon('menu') + '</button></nav></header>',
      '<section id="welcome" class="welcome" aria-labelledby="welcome-title"><div class="eyebrow"><span class="tiny-line"></span>A TOWN LIKE NO OTHER</div><h1 id="welcome-title">Welcome to<br><em>Livistone.</em></h1><p>A place where jewelry becomes architecture,<br class="desktop-break"> science sparks wonder, and nature feels like home.</p><div class="welcome-actions"><button id="enter" class="primary" data-action="enter" disabled><span>Preparing your visit</span>' + icon('arrow') + '</button><button id="preview-map" class="text-button" data-action="preview-map" disabled>' + icon('map') + 'Look around from above</button></div><div class="welcome-foot"><span class="status-dot"></span>TAKE YOUR TIME. THERE IS MUCH TO DISCOVER.</div></section>',
      '<div id="welcome-caption" class="welcome-caption"><span>01 / THE CIVIC GARDENS</span><p>Small artifacts.<br>Extraordinary places.</p><span class="caption-rule"></span></div>',
      '<div id="crosshair" class="crosshair" aria-hidden="true" hidden></div>',
      '<footer id="walk-footer" class="walk-footer" hidden><div class="place-card"><span class="eyebrow">YOU ARE EXPLORING</span><strong id="location">Riverside Gardens</strong><span id="discoveries">0 of 6 discoveries</span></div><div class="controls-hint"><span><kbd>W A S D</kbd> Walk</span><span><kbd>← →</kbd> Turn</span><span id="look-hint">Hold left mouse to look</span><span><kbd>E</kbd> Discover</span></div></footer>',
      '<button id="interact" class="interaction" data-action="interact" hidden><span class="interaction-key">E</span><span id="interact-label">Discover</span>' + icon('arrow') + '</button>',
      '<div id="touch-controls" class="touch-controls" hidden><div id="joystick" class="joystick" role="group" aria-label="Touch movement control"><div class="stick-knob"></div></div><span class="touch-look">Drag to look around</span></div>',
      '<section id="map-panel" class="map-panel" hidden aria-labelledby="map-title"><div class="eyebrow">THE CITY AT A GLANCE</div><h2 id="map-title">Find your wonder.</h2><p>Three extraordinary buildings.<br>A town of possibilities between them.</p><div class="landmark-list">' + LANDMARKS.map((l, i) => '<button class="landmark-item" data-action="landmark:' + l.id + '"><span class="landmark-number">0' + (i + 1) + '</span><span><strong>' + l.name + '</strong><small>' + l.artifact + '</small></span>' + icon('arrow') + '</button>').join('') + '</div><div id="map-description" class="map-description">Select a landmark to learn more.</div><button class="primary full" data-action="walk">' + icon('walk') + 'Return to walking</button></section>',
      '<div id="map-controls" class="map-controls" hidden><button class="tool square" data-action="zoom-in" aria-label="Zoom map in">+</button><button class="tool square" data-action="zoom-out" aria-label="Zoom map out">−</button><button class="tool square" data-action="reset-map" aria-label="Reset map view">' + icon('compass') + '</button><span>Drag to orbit · Pinch or scroll to zoom</span></div>',
      '<div id="map-markers" hidden>' + LANDMARKS.map((l, i) => '<button class="map-marker" id="marker-' + l.id + '" data-action="landmark:' + l.id + '" aria-label="View ' + l.name + '"><span>0' + (i + 1) + '</span><b>' + l.name + '</b></button>').join('') + '<div id="player-marker" class="player-marker"><span></span>You are here</div></div>',
      '<div id="scrim" class="scrim" hidden></div>',
      '<section id="lore" class="dialog lore" role="dialog" aria-modal="true" aria-labelledby="lore-title" hidden><button class="close-button" data-action="close" aria-label="Close discovery">' + icon('close') + '</button><div class="eyebrow" id="lore-category"></div><div id="lore-emblem" class="lore-emblem">✧</div><h2 id="lore-title"></h2><div id="exhibit-catalogue" hidden></div><p id="lore-body"></p><div class="lore-source">From Livia’s artifacts to a living town.</div><button id="artifact-action" class="primary full" hidden></button><button class="text-button full" data-action="close">Continue exploring ' + icon('arrow') + '</button></section>',
      '<section id="journal" class="dialog journal" role="dialog" aria-modal="true" aria-labelledby="journal-title" hidden><button class="close-button" data-action="close" aria-label="Close journal">' + icon('close') + '</button><div class="eyebrow">YOUR FIELD NOTES</div><h2 id="journal-title">A little more wonder.</h2><p>Discover the stories held within the city.</p><div id="journal-list"></div></section>',
      '<section id="pause" class="dialog pause" role="dialog" aria-modal="true" aria-labelledby="pause-title" hidden><button class="close-button" data-action="close" aria-label="Close menu">' + icon('close') + '</button><div class="eyebrow">MAKE YOURSELF AT HOME</div><h2 id="pause-title">A moment of quiet.</h2><button class="primary full" data-action="close">Continue exploring ' + icon('arrow') + '</button><button class="menu-item" data-action="map">' + icon('map') + 'Open city map</button><button class="menu-item" data-action="reset-position">' + icon('compass') + 'Return to the river entrance</button><button class="menu-item" id="sound-toggle" data-action="sound" aria-pressed="false">' + icon('sound') + 'Ambient sound: off</button><label class="quality-label">Visual detail<select id="quality"><option value="low">Gentle — lower detail</option><option value="high">Rich — higher detail</option></select></label><p class="menu-note">Move forward/back with W/S or ↑/↓. Strafe with A/D. Turn with ←/→, or hold the left mouse button and drag to look. On touch screens, use the left stick and drag to look. Your discoveries are saved on this device.</p></section>',
      '<div id="toast" class="toast" role="status" hidden></div><div id="live" class="sr-only" aria-live="polite"></div>',
      '<section id="error" class="error-screen" hidden><div class="eyebrow">LIVISTONE</div><h2>Let’s try that again.</h2><p id="error-message"></p><button class="primary" data-action="reload">Reload the town</button></section>',
    ].join('');
    this.canvas = this.app.querySelector('#world')!; this.joystick = this.app.querySelector('#joystick')!;
    this.modeLabel = this.app.querySelector('#mode-label')!; this.location = this.app.querySelector('#location')!; this.prompt = this.app.querySelector('#interact')!; this.live = this.app.querySelector('#live')!;
    this.app.addEventListener('click', (e) => {
      const button = (e.target as Element).closest<HTMLElement>('[data-action]');
      if (button) action(button.dataset.action!);
      if ((e.target as Element).closest('.brand')) { e.preventDefault(); action('pause'); }
    });
    this.app.querySelector('#quality')!.addEventListener('change', (e) => action('quality:' + (e.target as HTMLSelectElement).value));
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const dialog = this.app.querySelector<HTMLElement>('.dialog:not([hidden])');
      if (!dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not([hidden]), a[href], select, [tabindex="0"]')];
      const first = focusable[0], last = focusable.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    });
  }
  ready(): void {
    const button = this.app.querySelector<HTMLButtonElement>('#enter')!; button.disabled = false; button.querySelector('span')!.textContent = 'Enter Livistone';
    this.app.querySelector<HTMLButtonElement>('#preview-map')!.disabled = false;
  }
  setMode(mode: Mode): void {
    const visible: Record<string, boolean> = {
      welcome: mode === 'welcome', 'welcome-caption': mode === 'welcome', tools: mode !== 'welcome',
      'walk-footer': mode === 'walking', crosshair: mode === 'walking', 'touch-controls': mode === 'walking',
      'map-panel': mode === 'map', 'map-controls': mode === 'map', 'map-markers': mode === 'map',
      scrim: ['lore', 'journal', 'paused'].includes(mode), lore: mode === 'lore', journal: mode === 'journal', pause: mode === 'paused',
    };
    Object.entries(visible).forEach(([id, value]) => { this.app.querySelector<HTMLElement>('#' + id)!.hidden = !value; });
    this.app.dataset.mode = mode;
    this.modeLabel.textContent = mode === 'welcome' ? 'ART, SCIENCE & NATURE' : mode === 'map' ? 'A DIFFERENT PERSPECTIVE' : 'EXPLORE AT YOUR OWN PACE';
    if (mode !== 'walking') this.prompt.hidden = true;
    const dialog = this.app.querySelector<HTMLElement>('.dialog:not([hidden])');
    this.app.querySelector<HTMLElement>('.topbar')!.inert = !!dialog;
    if (dialog) { this.lastFocus = document.activeElement as HTMLElement; dialog.querySelector<HTMLElement>('button')?.focus(); }
    else if (this.lastFocus?.isConnected) { this.lastFocus.focus(); this.lastFocus = null; }
  }
  progress(progress: Progress): void {
    this.app.querySelector('#discoveries')!.textContent = progress.discovered.length + ' of ' + DISCOVERIES.length + ' discoveries';
    const list = this.app.querySelector('#journal-list')!; list.replaceChildren();
    DISCOVERIES.forEach((d) => {
      const found = progress.discovered.includes(d.id), button = document.createElement('button');
      button.className = 'journal-item'; button.disabled = !found;
      button.innerHTML = '<span class="discovery-status">' + (found ? '✧' : '○') + '</span><span><strong></strong><small></small></span>';
      button.querySelector('strong')!.textContent = found ? d.title : 'A story waiting to be found';
      button.querySelector('small')!.textContent = LANDMARKS.find((l) => l.id === d.landmark)!.name;
      if (found) button.addEventListener('click', () => this.action('discovery:' + d.id));
      list.append(button);
    });
  }
  showLore(discovery: Discovery): void {
    this.app.querySelector('#lore-category')!.textContent = discovery.category;
    this.app.querySelector('#lore-title')!.textContent = discovery.title;
    this.app.querySelector('#lore-body')!.textContent = discovery.body;
    const catalogue = this.app.querySelector<HTMLElement>('#exhibit-catalogue')!, exhibit = EXHIBITS.find((e) => e.discovery === discovery.id);
    catalogue.replaceChildren(); catalogue.hidden = !exhibit;
    if (exhibit) {
      const gallery = document.createElement('div'); gallery.className = 'exhibit-photos';
      for (const photo of exhibit.photos) {
        const figure = document.createElement('figure'), image = document.createElement('img'), caption = document.createElement('figcaption');
        image.src = photoURL(photo.file); image.alt = photo.alt; image.width = image.height = 1024;
        caption.textContent = 'Livia Zaharia · Studio archive'; image.onerror = () => { image.hidden = true; caption.textContent = 'Photograph unavailable. The catalogue information remains below.'; };
        figure.append(image, caption); gallery.append(figure);
      }
      const heading = document.createElement('h3'); heading.textContent = 'The original jewelry';
      const description = document.createElement('p'); description.textContent = exhibit.description;
      const table = document.createElement('table'); table.className = 'exhibit-facts'; table.setAttribute('aria-label', exhibit.title + ' catalogue information');
      for (const [key, value] of [['Artist', 'Livia Zaharia'], ['Object', exhibit.type], ['Materials', exhibit.materials], ['Dimensions', exhibit.dimensions], ['Year', exhibit.year]]) {
        const row = table.insertRow(), th = document.createElement('th'); th.scope = 'row'; th.textContent = key; row.append(th); row.insertCell().textContent = value;
      }
      const source = document.createElement('a'); source.href = CATALOGUE_URL; source.target = '_blank'; source.rel = 'noopener noreferrer'; source.textContent = 'View Livia’s jewelry catalogue ↗';
      const loreHeading = document.createElement('h3'); loreHeading.textContent = 'Livia Lore & Livistone fiction';
      catalogue.append(gallery, heading, description, table, source, loreHeading);
    }
    const button = this.app.querySelector<HTMLButtonElement>('#artifact-action')!;
    button.hidden = !discovery.action; button.textContent = discovery.action ?? ''; button.dataset.action = 'activate:' + discovery.id;
    this.live.textContent = 'Discovered: ' + discovery.title;
  }
  setLocation(name: string): void { if (this.location.textContent !== name) this.location.textContent = name; }
  setLookHint(text: string): void { this.app.querySelector("#look-hint")!.textContent = text; }
  setInteraction(id: string | null): void {
    this.prompt.hidden = !id;
    if (id) this.app.querySelector('#interact-label')!.textContent = DISCOVERIES.find((d) => d.id === id)!.title;
  }
  selectLandmark(landmark: Landmark): void {
    this.app.querySelector('#map-description')!.textContent = landmark.description;
    this.app.querySelectorAll<HTMLElement>('.landmark-item').forEach((b) => b.classList.toggle('selected', b.dataset.action === 'landmark:' + landmark.id));
  }
  toast(message: string): void {
    const toast = this.app.querySelector<HTMLElement>('#toast')!; toast.textContent = message; toast.hidden = false;
    window.clearTimeout(this.toastTimer); this.toastTimer = window.setTimeout(() => { toast.hidden = true; }, 4000);
  }
  error(message: string): void {
    this.app.querySelector<HTMLElement>('#error')!.hidden = false;
    this.app.querySelector('#error-message')!.textContent = message;
  }
  setSound(enabled: boolean): void {
    const button = this.app.querySelector<HTMLButtonElement>('#sound-toggle')!;
    button.innerHTML = icon('sound') + 'Ambient sound: ' + (enabled ? 'on' : 'off'); button.setAttribute('aria-pressed', String(enabled));
  }
}
