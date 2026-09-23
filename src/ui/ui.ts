import type { NearbyStory } from '../game/nearby';
import { GalleryUI } from './gallery';
import type { Exhibit } from '../game/exhibits';
import { DISCOVERIES, LANDMARKS } from '../game/content';
import { COLLECTION, CATALOGUE_URL, photoURL } from '../game/exhibits';
import type { Progress, Discovery } from '../game/content';
import { drawResearchFigure } from '../game/research-art';
export type Mode = 'welcome' | 'walking' | 'map' | 'lore' | 'journal' | 'paused' | 'gallery';
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
  readonly gallery: GalleryUI;
  readonly canvas: HTMLCanvasElement;
  readonly joystick: HTMLElement;
  private readonly app: HTMLElement;
  private lastFocus: HTMLElement | null = null;
  private readonly modeLabel: HTMLElement;
  private readonly location: HTMLElement;
  private readonly prompt: HTMLButtonElement;
  private readonly live: HTMLElement;
  private toastTimer = 0;
  private hasExplored = false;
  private nearbyId: string | null = null;
  private slide = 0;
  private openDiscovery: Discovery | null = null;
  constructor(private action: (id: string) => void) {
    this.app = document.querySelector('#app')!;
    this.app.innerHTML = [
      '<canvas id="world" aria-label="Livistone interactive 3D town" tabindex="0"></canvas>',
      '<div class="vignette" aria-hidden="true"></div>',
      '<header class="topbar"><div class="brand" aria-label="Livistone">' + icon('leaf') + '<span>LIVISTONE<span class="brand-sub">A LIVING WORLD</span></span></div><div class="top-center"><span class="status-dot"></span><span id="mode-label">ART, SCIENCE & NATURE</span></div><nav id="tools" aria-label="Explore Livistone"><button id="view-toggle" class="tool view-toggle" data-action="map" aria-label="First person" aria-keyshortcuts="M" disabled>' + icon('walk') + '<span>First person</span><kbd>M</kbd></button><button class="tool" data-action="journal" aria-label="Open discovery journal" aria-expanded="false" aria-controls="journal" disabled>' + icon('book') + '<span>Journal</span></button><button class="tool square" data-action="pause" aria-label="Open menu" aria-expanded="false" aria-controls="pause" disabled>' + icon('menu') + '</button></nav></header>',
      '<div id="welcome" class="loading-notice" role="status">Preparing Livistone…</div>',
      '<div id="crosshair" class="crosshair" aria-hidden="true" hidden></div>',
      '<footer id="walk-footer" class="walk-footer" hidden><div class="place-card"><span id="location" class="eyebrow">Riverside Gardens</span><div id="nearby-story" hidden><span class="nearby-label">NEARBY</span><strong id="nearby-title"></strong><p id="nearby-sentence"></p><button id="nearby-read" class="nearby-read" data-action="nearby-story">Read story ' + icon('arrow') + '</button></div><span id="discoveries" class="sr-only">0 discoveries</span></div><div class="controls-hint"><span><kbd>W A S D</kbd> Walk</span><span><kbd>← →</kbd> Turn</span><span id="look-hint">Hold left mouse to look</span><button id="discover-control" data-action="interact" disabled><kbd>E</kbd> Read story</button></div></footer>',
      '<button id="interact" class="interaction" data-action="interact" hidden><span class="interaction-key">E</span><span id="interact-label">Discover</span>' + icon('arrow') + '</button>',
      '<div id="touch-controls" class="touch-controls" hidden><div id="joystick" class="joystick" role="group" aria-label="Touch movement control"><div class="stick-knob"></div></div><span class="touch-look">Drag to look around</span></div>',
      '<section id="map-panel" class="map-panel" hidden aria-labelledby="map-title"><div class="eyebrow">THE CITY AT A GLANCE</div><h2 id="map-title">Find your wonder.</h2><p id="map-origins">Every stop is based on a real, existing piece of jewelry, artwork or research project. Follow the numbers from the station into the town.</p><button id="start-exploring" class="primary full map-start" data-action="walk" aria-label="Start exploring">' + icon('walk') + '<span><strong>Start exploring</strong><small>Walk in first person</small></span>' + icon('arrow') + '</button><div class="landmark-list">' + LANDMARKS.map((l, i) => '<button class="landmark-item" data-action="landmark:' + l.id + '" aria-label="Go to ' + l.name + '"><span class="landmark-number">' + String(i + 1).padStart(2, '0') + '</span><span><strong>' + l.name + '</strong><small>' + l.artifact + '</small></span>' + icon('arrow') + '</button>').join('') + '</div><div id="map-description" class="map-description" role="status">Choose a place to arrive at its entrance.</div></section>',
      '<div id="map-controls" class="map-controls" hidden><button class="tool square" data-action="zoom-in" aria-label="Zoom map in">+</button><button class="tool square" data-action="zoom-out" aria-label="Zoom map out">−</button><button class="tool square" data-action="reset-map" aria-label="Reset map view">' + icon('compass') + '</button><span>Drag to orbit · Pinch or scroll to zoom</span></div>',
      '<div id="map-markers" hidden>' + LANDMARKS.map((l, i) => '<button class="map-marker" id="marker-' + l.id + '" data-action="landmark:' + l.id + '" aria-label="Go to ' + l.name + '"><span>' + String(i + 1).padStart(2, '0') + '</span><b>' + l.name + '</b></button>').join('') + '<div id="player-marker" class="player-marker"><span></span>You are here</div></div>',
      '<div id="scrim" class="scrim" data-action="close" aria-hidden="true" hidden></div>',
      '<section id="lore" class="dialog lore" role="dialog" aria-labelledby="lore-title" hidden><button class="close-button" data-action="close" aria-label="Close discovery">' + icon('close') + '</button><div class="eyebrow" id="lore-category"></div><div id="lore-emblem" class="lore-emblem">✧</div><h2 id="lore-title"></h2><figure id="lore-figure" class="lore-figure" hidden><canvas id="lore-figure-canvas" width="720" height="280"></canvas></figure><div id="lore-slides" hidden><p id="lore-slide-title"></p><p id="lore-slide-body"></p><div class="slide-controls" aria-label="Chapter slides"><button data-action="slide-prev" aria-label="Previous slide">←</button><span id="lore-slide-count" aria-live="polite"></span><button data-action="slide-next" aria-label="Next slide">→</button></div><p class="viewer-help">← / → slides · Esc close</p></div><div id="exhibit-catalogue" hidden></div><p id="lore-body"></p><div class="lore-source">From Livia’s artifacts to a living town.</div><button class="text-button full" data-action="close">Continue exploring ' + icon('arrow') + '</button></section>',
      '<section id="journal" class="dialog journal" role="dialog" aria-labelledby="journal-title" hidden><button class="close-button" data-action="close" aria-label="Close journal">' + icon('close') + '</button><div class="eyebrow">YOUR FIELD NOTES</div><h2 id="journal-title">A little more wonder.</h2><p>Browse every story and photograph. Read in any order, or find them as you walk.</p><button class="primary full" data-action="catalogue">Browse the jewelry catalogue</button><div id="journal-list"></div></section>',
      '<section id="pause" class="dialog pause" role="dialog" aria-labelledby="pause-title" hidden><button class="close-button" data-action="close" aria-label="Close menu">' + icon('close') + '</button><div class="eyebrow">MAKE YOURSELF AT HOME</div><h2 id="pause-title">A moment of quiet.</h2><button class="primary full" data-action="close">Continue exploring ' + icon('arrow') + '</button><button class="menu-item" data-action="open-map">' + icon('map') + 'Open city map</button><button class="menu-item" data-action="reset-position">' + icon('compass') + 'Return to the river entrance</button><button class="menu-item" id="sound-toggle" data-action="sound" aria-pressed="false">' + icon('sound') + 'Livistone Radio: off</button><label class="quality-label">Time of day<select id="time-of-day"><option value="auto">Auto — local clock</option><option value="day">Day</option><option value="night">Night</option></select></label><label class="quality-label">Visual detail<select id="quality"><option value="low">Gentle — lower detail</option><option value="high">Rich — higher detail</option></select></label><p class="menu-note">Move forward/back with W/S or ↑/↓. Strafe with A/D. Turn with ←/→, or hold the left mouse button and drag to look. On touch screens, use the left stick and drag to look. Music: Livia Zaharia playing kalimba, recorded on her phone — informal personal recordings, not professional studio recordings. Your discoveries are saved on this device.</p></section>',
      '<div id="toast" class="toast" role="status" hidden></div><div id="live" class="sr-only" aria-live="polite"></div>',
      '<section id="error" class="error-screen" hidden><div class="eyebrow">LIVISTONE</div><h2>Let’s try that again.</h2><p id="error-message"></p><button class="primary" data-action="reload">Reload the town</button></section>',
    ].join('');
    this.gallery = new GalleryUI(this.app);
    this.canvas = this.app.querySelector('#world')!; this.joystick = this.app.querySelector('#joystick')!;
    this.modeLabel = this.app.querySelector('#mode-label')!; this.location = this.app.querySelector('#location')!; this.prompt = this.app.querySelector('#interact')!; this.live = this.app.querySelector('#live')!;
    const loading = document.querySelector<HTMLElement>('#boot-loading')!;
    this.app.querySelector('#welcome')!.replaceWith(loading); loading.id = 'welcome';
    this.app.addEventListener('click', (e) => {
      const button = (e.target as Element).closest<HTMLElement>('[data-action]');
      if (button) action(button.dataset.action!);
    });
    this.app.querySelector('#time-of-day')!.addEventListener('change', (e) => action('time-of-day:' + (e.target as HTMLSelectElement).value));
    this.app.querySelector('#quality')!.addEventListener('change', (e) => action('quality:' + (e.target as HTMLSelectElement).value));
    document.addEventListener('keydown', (e) => {
      const loreOpen = !this.app.querySelector<HTMLElement>('#lore')!.hidden && (this.openDiscovery?.slides?.length ?? 0) > 1;
      if (loreOpen && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); e.stopPropagation(); this.action(e.key === 'ArrowRight' ? 'slide-next' : 'slide-prev'); return; }
      if (e.key !== 'Tab') return;
      const dialog = this.app.querySelector<HTMLElement>('.dialog:not([hidden])');
      if (!dialog) return;
      const focusable = [...this.app.querySelectorAll<HTMLElement>('#tools button:not(:disabled), .dialog:not([hidden]) button:not(:disabled), .dialog:not([hidden]) a[href], .dialog:not([hidden]) select, .dialog:not([hidden]) [tabindex="0"]')].filter((el) => el.getClientRects().length > 0);
      const first = focusable[0], last = focusable.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    });
  }
  ready(): void {
    this.app.querySelectorAll<HTMLButtonElement>('#tools button').forEach((button) => { button.disabled = false; });
  }
  setMode(mode: Mode, mapView = mode === 'map' || mode === 'welcome'): void {
    const previousDialog = this.app.querySelector<HTMLElement>('.dialog:not([hidden])');
    if (!previousDialog) this.lastFocus = document.activeElement as HTMLElement;
    const visible: Record<string, boolean> = {
      welcome: mode === 'welcome', tools: true,
      'walk-footer': mode === 'walking', crosshair: mode === 'walking', 'touch-controls': mode === 'walking',
      'map-panel': mode === 'map', 'map-controls': mode === 'map', 'map-markers': mode === 'map',
      scrim: ['lore', 'journal', 'paused', 'gallery'].includes(mode), lore: mode === 'lore', journal: mode === 'journal', pause: mode === 'paused', gallery: mode === 'gallery',
    };
    Object.entries(visible).forEach(([id, value]) => { this.app.querySelector<HTMLElement>('#' + id)!.hidden = !value; });
    this.app.dataset.mode = mode; this.gallery.floating.hidden = true;
    if (mode === 'walking') this.hasExplored = true;
    const start = this.app.querySelector<HTMLButtonElement>('#start-exploring')!, startLabel = this.hasExplored ? 'Resume exploring' : 'Start exploring';
    start.querySelector('strong')!.textContent = startLabel; start.setAttribute('aria-label', startLabel);
    if (mode === 'map') this.mapStatus('Choose a place to arrive at its entrance.');
    this.app.querySelector<HTMLElement>('#toast')!.hidden = true;
    this.modeLabel.textContent = mode === 'welcome' ? 'ART, SCIENCE & NATURE' : mode === 'map' ? 'A DIFFERENT PERSPECTIVE' : 'EXPLORE AT YOUR OWN PACE';
    if (mode !== 'walking') this.prompt.hidden = true;
    const dialog = this.app.querySelector<HTMLElement>('.dialog:not([hidden])');
    this.canvas.inert = !!dialog;
    const toggle = this.app.querySelector<HTMLButtonElement>('#view-toggle')!, label = mapView ? 'First person' : 'Map';
    toggle.innerHTML = icon(mapView ? 'walk' : 'map') + '<span>' + label + '</span><kbd>M</kbd>'; toggle.setAttribute('aria-label', label);
    this.app.querySelector('[data-action="journal"]')!.setAttribute('aria-expanded', String(mode === 'journal'));
    this.app.querySelector('[data-action="pause"]')!.setAttribute('aria-expanded', String(mode === 'paused'));
    if (dialog) dialog.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
    else if (previousDialog) {
      const target = this.lastFocus?.isConnected && this.lastFocus.getClientRects().length ? this.lastFocus : toggle;
      target.focus({ preventScroll: true }); this.lastFocus = null;
    }
  }
  progress(progress: Progress): void {
    this.app.querySelector('#discoveries')!.textContent = progress.discovered.length + ' of ' + DISCOVERIES.length + ' stories read';
    const list = this.app.querySelector('#journal-list')!; list.replaceChildren();
    DISCOVERIES.forEach((d) => {
      const found = progress.discovered.includes(d.id), button = document.createElement('button');
      button.className = 'journal-item'; button.dataset.discovery = d.id;
      button.innerHTML = '<span class="discovery-status">' + (found ? '✧' : '○') + '</span><span><strong></strong><small></small></span>';
      button.querySelector('strong')!.textContent = d.title;
      button.querySelector('small')!.textContent = LANDMARKS.find((l) => l.id === d.landmark)!.name + (found ? ' · Read' : ' · Unread');
      button.addEventListener('click', () => this.action('discovery:' + d.id));
      list.append(button);
    });
  }
  showLore(discovery: Discovery, selected?: Exhibit): void {
    this.openDiscovery = discovery; this.slide = 0;
    const exhibit = selected ?? COLLECTION.find((e) => e.discovery === discovery.id);
    const jewelry = !!exhibit && !discovery.slides;
    const civic = !!exhibit && ['nut', 'mitoring', 'nanot'].includes(discovery.id);
    this.app.querySelector('#lore-title')!.textContent = jewelry ? exhibit.title : discovery.title;
    this.app.querySelector('#lore-category')!.textContent = jewelry ? (exhibit.collection ?? 'IN THE JEWELRY GALLERY') : discovery.category;
    this.app.querySelector<HTMLElement>('#lore-emblem')!.hidden = !!discovery.slides;
    this.app.querySelector<HTMLElement>('#lore-body')!.hidden = jewelry && !civic;
    this.app.querySelector('#lore-body')!.textContent = civic ? discovery.body : discovery.body;
    const attribution = this.app.querySelector<HTMLElement>('.lore-source')!;
    attribution.hidden = (jewelry && !civic) || discovery.id === 'about-livistone';
    attribution.textContent = discovery.id.startsWith('glucose-') ? 'Images and text from the supplied GlucoseDAO archive · September 2026. Research claims belong to the original authors. Architecture is Livistone fiction.' : discovery.links ? 'Public project sources · reviewed September 2026. Architecture is Livistone fiction.' : 'Artist stories from Livia’s public catalogue; Livistone fiction is labelled separately.';
    const catalogue = this.app.querySelector<HTMLElement>('#exhibit-catalogue')!;
    catalogue.replaceChildren(); catalogue.hidden = !exhibit;
    if (exhibit) {
      const gallery = document.createElement('div'); gallery.className = 'exhibit-photos';
      for (const [index, photo] of exhibit.photos.entries()) {
        const figure = document.createElement('figure'), image = document.createElement('img'), caption = document.createElement('figcaption');
        image.src = photoURL(photo.file); image.alt = photo.alt; image.loading = 'eager';
        caption.textContent = 'Livia Zaharia · Studio archive'; image.onerror = () => { image.hidden = true; caption.textContent = 'Photograph unavailable. The catalogue information remains below.'; };
        const open = document.createElement('button'); open.className = 'photo-open'; open.dataset.action = `exhibit-photo:${exhibit.discovery}:${index}`; open.setAttribute('aria-label', 'Enlarge photograph ' + (index + 1)); open.append(image);
        figure.append(open, caption); gallery.append(figure);
      }
      const heading = document.createElement('h3'); heading.textContent = 'The story of this piece';
      const description = document.createElement('p'); description.textContent = exhibit.story ?? exhibit.description;
      const table = document.createElement('table'); table.className = 'exhibit-facts'; table.setAttribute('aria-label', exhibit.title + ' catalogue information');
      for (const [key, value] of [['Artist', 'Livia Zaharia'], ['Object', exhibit.type], ['Materials', exhibit.materials], ['Dimensions', exhibit.dimensions], ['Year', exhibit.year]]) {
        const row = table.insertRow(), th = document.createElement('th'); th.scope = 'row'; th.textContent = key; row.append(th); row.insertCell().textContent = value;
      }
      const source = document.createElement('a'); source.href = exhibit.source ?? CATALOGUE_URL; source.target = '_blank'; source.rel = 'noopener noreferrer'; source.textContent = 'Read this work on Livia’s website ↗';
      const loreHeading = document.createElement('h3'); loreHeading.textContent = 'Livia Lore & Livistone fiction';
      catalogue.append(gallery, heading, description, table, source); if (civic) catalogue.append(loreHeading);
    }
    let sources = this.app.querySelector<HTMLElement>('#research-sources');
    if (!sources) { sources = document.createElement('div'); sources.id = 'research-sources'; sources.className = 'research-sources'; attribution.before(sources); }
    sources.replaceChildren(); sources.hidden = !discovery.links;
    for (const link of discovery.links ?? []) { const anchor = document.createElement('a'); anchor.href = link.url; anchor.textContent = link.label + ' ↗'; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; sources.append(anchor); }
    this.renderSlide();
    this.live.textContent = 'Discovered: ' + discovery.title;
  }
  turnSlide(step: number): void {
    const slides = this.openDiscovery?.slides; if (!slides?.length) return;
    this.slide = (this.slide + step + slides.length) % slides.length; this.renderSlide();
    this.app.querySelector<HTMLElement>('#lore')!.scrollTop = 0;
  }
  private renderSlide(): void {
    const slides = this.openDiscovery?.slides ?? [], pane = this.app.querySelector<HTMLElement>('#lore-slides')!, figure = this.app.querySelector<HTMLElement>('#lore-figure')!;
    pane.hidden = slides.length === 0; figure.hidden = slides.length === 0;
    if (!slides.length) return;
    const slide = slides[this.slide];
    this.app.querySelector('#lore-slide-title')!.textContent = slide.title;
    this.app.querySelector('#lore-slide-body')!.textContent = slide.body;
    this.app.querySelector('#lore-slide-count')!.textContent = `${this.slide + 1} / ${slides.length}`;
    this.app.querySelector<HTMLElement>('#lore-body')!.hidden = true;
    const canvas = this.app.querySelector<HTMLCanvasElement>('#lore-figure-canvas')!, ctx = canvas.getContext('2d')!;
    let source = figure.querySelector<HTMLAnchorElement>('.source-image');
    if (!source) { source = document.createElement('a'); source.className = 'source-image'; source.target = '_blank'; source.rel = 'noopener noreferrer'; source.append(document.createElement('img')); figure.prepend(source); }
    source.hidden = !slide.image; canvas.hidden = !!slide.image;
    if (slide.image) { source.href = slide.image; source.title = 'Open original image at full size'; const image = source.querySelector('img')!; image.src = slide.image; image.alt = slide.imageAlt ?? slide.title; figure.hidden = false; return; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (slide.figure) drawResearchFigure(ctx, slide.figure, 0, 0, canvas.width, canvas.height);
    else { figure.hidden = true; }
  }

  setLocation(name: string): void { if (this.location.textContent !== name) this.location.textContent = name; }
  setNearby(story: NearbyStory | null): void {
    this.app.querySelector<HTMLButtonElement>('#discover-control')!.disabled = !story;
    if (this.nearbyId === (story?.id ?? null)) return; this.nearbyId = story?.id ?? null;
    this.app.querySelector<HTMLElement>('#nearby-story')!.hidden = !story;
    if (!story) return;
    this.app.querySelector('#nearby-title')!.textContent = story.title;
    this.app.querySelector('#nearby-sentence')!.textContent = story.sentence;
    this.app.querySelector('#nearby-read')!.setAttribute('aria-label', 'Read story: ' + story.title);
  }
  setLookHint(text: string): void { this.app.querySelector("#look-hint")!.textContent = text; }
  setInteraction(id: string | null): void {
    this.prompt.hidden = !id;
    if (id) this.app.querySelector('#interact-label')!.textContent = DISCOVERIES.find((d) => d.id === id)?.title ?? 'Discover';
  }
  mapStatus(text: string): void { this.app.querySelector('#map-description')!.textContent = text; }
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
    button.innerHTML = icon('sound') + 'Livistone Radio: ' + (enabled ? 'on' : 'off'); button.setAttribute('aria-pressed', String(enabled));
  }
}
