import { COLLECTION, CATALOGUE_URL, photoSize, photoURL } from '../game/exhibits';
import type { Exhibit } from '../game/exhibits';

export class GalleryUI {
  readonly floating: HTMLElement;
  readonly dialog: HTMLElement;
  private readonly stage: HTMLElement;
  private readonly image: HTMLImageElement;
  private exhibit: Exhibit = COLLECTION[0];
  private index = 0;
  private zoom = 1;
  private pan = { x: 0, y: 0 };
  private pointers = new Map<number, { x: number; y: number }>();
  private pane: 'photo' | 'browse' = 'browse';
  constructor(app: HTMLElement) {
    app.insertAdjacentHTML('beforeend', `
      <section id="exhibition-controls" class="exhibition-controls" aria-label="Photo cylinder controls" hidden>
        <span class="eyebrow">LIVIA ZAHARIA · JEWELRY GALLERY</span><strong id="cylinder-title"></strong>
        <button id="cylinder-info">1 · About this piece</button><button id="cylinder-browse">2 · Explore other pieces</button>
        <div class="cylinder-turn"><button id="cylinder-left" aria-label="Rotate cylinder left">↶</button><button id="cylinder-pause">Pause rotation</button><button id="cylinder-right" aria-label="Rotate cylinder right">↷</button></div>
        <button id="cylinder-view">Open photograph</button><button id="cylinder-lore">About this place</button><small>Click a curved photo to enlarge it</small>
      </section>
      <section id="gallery" class="dialog gallery-dialog" role="dialog" aria-modal="true" aria-labelledby="gallery-title" hidden>
        <button class="close-button" data-action="close" aria-label="Close gallery">×</button>
        <div class="eyebrow">LIVIA ZAHARIA · STUDIO PHOTOGRAPHS</div><h2 id="gallery-title"></h2>
        <div id="piece-browser"><p>Select a piece to put its photographs on this building’s cylinder.</p><div id="piece-grid" class="piece-grid"></div><a href="${CATALOGUE_URL}" target="_blank" rel="noopener noreferrer">See the full collection on Livia’s website ↗</a></div>
        <div id="photo-viewer" hidden><div id="photo-stage" class="photo-stage" tabindex="0" aria-label="Photograph viewer. Drag to pan when enlarged; use plus and minus to zoom."><img id="viewer-image" draggable="false" alt=""><span id="photo-error" hidden>Photograph unavailable. Try another view.</span></div>
        <div class="viewer-controls" aria-label="Photograph controls"><button data-viewer="previous" aria-label="Previous photograph">←</button><span id="photo-count" aria-live="polite"></span><button data-viewer="next" aria-label="Next photograph">→</button><button data-viewer="out" aria-label="Zoom photograph out">−</button><output id="photo-zoom">100%</output><button data-viewer="in" aria-label="Zoom photograph in">+</button><button data-viewer="fit">Fit image</button></div>
        <p class="viewer-help">Drag to pan · Scroll or pinch to zoom · ← / → photos · + / − zoom · 0 fit · Esc close</p></div>
      </section>`);
    this.floating = app.querySelector('#exhibition-controls')!; this.dialog = app.querySelector('#gallery')!;
    this.stage = app.querySelector('#photo-stage')!; this.image = app.querySelector('#viewer-image')!;
    this.dialog.addEventListener('click', (event) => {
      const command = (event.target as Element).closest<HTMLElement>('[data-viewer]')?.dataset.viewer;
      if (command) this.control(command);
    });
    this.dialog.addEventListener('keydown', (event) => {
      if (this.pane !== 'photo') return;
      const command = ({ ArrowLeft: 'previous', ArrowRight: 'next', '+': 'in', '=': 'in', '-': 'out', '0': 'fit' } as Record<string, string>)[event.key];
      if (command) { event.preventDefault(); event.stopPropagation(); this.control(command); }
    });
    this.stage.addEventListener('wheel', (event) => { event.preventDefault(); this.setZoom(this.zoom * Math.exp(-event.deltaY * .002)); }, { passive: false });
    this.stage.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); this.stage.setPointerCapture(event.pointerId); this.stage.focus();
    });
    this.stage.addEventListener('pointermove', (event) => {
      const old = this.pointers.get(event.pointerId); if (!old) return;
      const other = [...this.pointers.entries()].find(([id]) => id !== event.pointerId)?.[1];
      if (other) {
        const before = Math.hypot(old.x - other.x, old.y - other.y), after = Math.hypot(event.clientX - other.x, event.clientY - other.y);
        if (before > 5) this.setZoom(this.zoom * after / before);
      } else { this.pan.x += event.clientX - old.x; this.pan.y += event.clientY - old.y; this.transform(); }
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) this.stage.addEventListener(event, (e) => this.pointers.delete((e as PointerEvent).pointerId));
    window.addEventListener('blur', () => this.pointers.clear()); window.addEventListener('resize', () => this.transform());
    this.image.onload = () => { this.image.hidden = false; this.dialog.querySelector<HTMLElement>('#photo-error')!.hidden = true; this.transform(); };
    this.image.onerror = () => { this.image.hidden = true; this.dialog.querySelector<HTMLElement>('#photo-error')!.hidden = false; };
  }
  accessibleControls(id: string, exhibit: Exhibit, paused: boolean): void {
    this.floating.hidden = false;
    this.floating.querySelector('#cylinder-title')!.textContent = exhibit.title;
    for (const [name, action] of [['info', 'info'], ['browse', 'browse'], ['left', 'left'], ['pause', 'pause'], ['right', 'right'], ['view', 'photo'], ['lore', 'lore']])
      this.floating.querySelector<HTMLElement>('#cylinder-' + name)!.dataset.action = `exhibit:${action}:${id}`;
    const pause = this.floating.querySelector('#cylinder-pause')!; pause.textContent = paused ? 'Resume rotation' : 'Pause rotation'; pause.setAttribute('aria-pressed', String(paused));
  }
  showBrowse(hall: string, selected: Exhibit): void {
    this.pane = 'browse'; this.dialog.querySelector('#gallery-title')!.textContent = 'Choose another piece';
    this.dialog.querySelector<HTMLElement>('#piece-browser')!.hidden = false; this.dialog.querySelector<HTMLElement>('#photo-viewer')!.hidden = true;
    const grid = this.dialog.querySelector('#piece-grid')!; grid.replaceChildren();
    for (const piece of COLLECTION) {
      const button = document.createElement('button'); button.className = 'piece-card'; button.dataset.action = `exhibit:select:${hall}:${piece.discovery}`; button.setAttribute('aria-pressed', String(piece === selected));
      const image = document.createElement('img'); image.src = photoURL(piece.photos[0].file); image.alt = piece.photos[0].alt; image.loading = 'lazy';
      const title = document.createElement('strong'); title.textContent = piece.title;
      const details = document.createElement('span'); details.textContent = `${piece.type} · ${piece.year}${piece === selected ? ' · On display' : ''}`;
      button.append(image, title, details); grid.append(button);
    }
  }
  showPhoto(exhibit: Exhibit, index = 0): void {
    this.pane = 'photo'; this.exhibit = exhibit; this.index = index;
    this.dialog.querySelector<HTMLElement>('#piece-browser')!.hidden = true; this.dialog.querySelector<HTMLElement>('#photo-viewer')!.hidden = false;
    this.renderPhoto();
  }
  private renderPhoto(): void {
    const photo = this.exhibit.photos[this.index]; this.zoom = 1; this.pan = { x: 0, y: 0 }; this.pointers.clear();
    this.dialog.querySelector('#gallery-title')!.textContent = this.exhibit.title;
    this.image.alt = photo.alt; this.image.src = photoURL(photo.file); this.image.hidden = false; this.dialog.querySelector<HTMLElement>('#photo-error')!.hidden = true;
    this.dialog.querySelector('#photo-count')!.textContent = `${this.index + 1} / ${this.exhibit.photos.length}`;
    this.transform(); this.stage.classList.remove('photo-unfold'); void this.stage.offsetWidth; this.stage.classList.add('photo-unfold');
    requestAnimationFrame(() => this.transform());
  }
  private control(command: string): void {
    if (command === 'previous' || command === 'next') { this.index = (this.index + (command === 'next' ? 1 : -1) + this.exhibit.photos.length) % this.exhibit.photos.length; this.renderPhoto(); }
    else if (command === 'fit') { this.pan = { x: 0, y: 0 }; this.setZoom(1); }
    else this.setZoom(this.zoom * (command === 'in' ? 1.3 : 1 / 1.3));
  }
  private setZoom(value: number): void { this.zoom = Math.max(1, Math.min(5, value)); this.transform(); }
  private transform(): void {
    const box = this.stage.getBoundingClientRect(), size = photoSize(this.image.naturalWidth, this.image.naturalHeight, box.width, box.height);
    const limitX = Math.max(0, (size.width * this.zoom - box.width) / 2), limitY = Math.max(0, (size.height * this.zoom - box.height) / 2);
    this.pan.x = Math.max(-limitX, Math.min(limitX, this.pan.x)); this.pan.y = Math.max(-limitY, Math.min(limitY, this.pan.y));
    this.image.style.transform = `translate(${this.pan.x}px,${this.pan.y}px) scale(${this.zoom})`;
    this.dialog.querySelector('#photo-zoom')!.textContent = Math.round(this.zoom * 100) + '%';
    this.stage.dataset.zoomed = String(this.zoom > 1);
  }
}
