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
  private browseHall = 'all';
  constructor(app: HTMLElement) {
    app.insertAdjacentHTML('beforeend', `
      <section id="exhibition-controls" class="exhibition-controls" aria-label="Jewelry gallery controls" hidden>
        <span class="eyebrow">LIVIA ZAHARIA · JEWELRY GALLERY</span><strong id="poster-title"></strong>
        <button id="poster-info">1 · About this piece</button><button id="poster-browse">2 · Browse this collection</button>
        <button id="poster-view">Open photograph</button><button id="poster-lore">About this place</button><small>Click a poster photograph to enlarge it</small>
      </section>
      <section id="gallery" class="dialog gallery-dialog" role="dialog" aria-labelledby="gallery-title" hidden>
        <button class="close-button" data-action="close" aria-label="Close gallery">×</button>
        <div class="eyebrow">LIVIA ZAHARIA · STUDIO PHOTOGRAPHS</div><h2 id="gallery-title"></h2>
        <div id="piece-browser"><p>Each piece has a permanent home in Livistone. Select a photograph to inspect it.</p><div id="catalogue-filters" class="catalogue-filters"></div><p id="catalogue-count" aria-live="polite"></p><div id="piece-grid" class="piece-grid"></div><a href="${CATALOGUE_URL}" target="_blank" rel="noopener noreferrer">See the full collection on Livia’s website ↗</a></div>
        <div id="photo-viewer" hidden><div id="photo-stage" class="photo-stage" tabindex="0" aria-label="Photograph viewer. Drag to pan when enlarged; use plus and minus to zoom."><img id="viewer-image" draggable="false" alt=""><span id="photo-error" hidden>Photograph unavailable. Try another view.</span></div>
        <div class="viewer-controls" aria-label="Photograph controls"><button data-viewer="previous" aria-label="Previous photograph">←</button><span id="photo-count" aria-live="polite"></span><button data-viewer="next" aria-label="Next photograph">→</button><button data-viewer="out" aria-label="Zoom photograph out">−</button><output id="photo-zoom">100%</output><button data-viewer="in" aria-label="Zoom photograph in">+</button><button data-viewer="fit">Fit image</button></div>
        <button class="text-button" data-viewer="browse">Back to the collection</button><p id="viewer-facts"></p><a id="viewer-source" target="_blank" rel="noopener noreferrer">Catalogue source ↗</a><p class="viewer-help">Drag to pan · Scroll or pinch to zoom · ← / → photos · + / − zoom · 0 fit · Esc close</p></div>
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
  accessibleControls(id: string, exhibit: Exhibit): void {
    this.floating.hidden = false;
    this.floating.querySelector('#poster-title')!.textContent = exhibit.title;
    for (const [name, action] of [['info', 'info'], ['browse', 'browse'], ['view', 'photo'], ['lore', 'lore']])
      this.floating.querySelector<HTMLElement>('#poster-' + name)!.dataset.action = `exhibit:${action}:${id}`;
  }
  showCatalogue(): void { this.showBrowse('all', COLLECTION[0]); }
  showBrowse(hall: string, selected: Exhibit): void {
    this.pane = 'browse'; this.browseHall = hall; this.exhibit = selected;
    this.dialog.querySelector('#gallery-title')!.textContent = hall === 'all' ? 'The jewelry catalogue' : 'This place’s collection';
    this.dialog.querySelector<HTMLElement>('#piece-browser')!.hidden = false; this.dialog.querySelector<HTMLElement>('#photo-viewer')!.hidden = true;
    const filters = this.dialog.querySelector('#catalogue-filters')!; filters.replaceChildren();
    const collection = hall === 'all' ? COLLECTION : COLLECTION.filter((piece) => piece.location === hall);
    const searchLabel = document.createElement('label'), search = document.createElement('input'); searchLabel.textContent = 'Search'; search.type = 'search'; search.setAttribute('aria-label', 'Search jewelry'); search.placeholder = 'Title, material or story'; searchLabel.append(search); filters.append(searchLabel); search.addEventListener('input', () => render());
    const fields = ['collection', 'year', 'materials', 'type', 'location'] as const;
    const controls = fields.map((field) => {
      const label = document.createElement('label'), select = document.createElement('select'); label.textContent = field === 'materials' ? 'Material' : field[0].toUpperCase() + field.slice(1);
      select.setAttribute('aria-label', label.textContent); const all = new Option('All', ''); select.append(all);
      const values = [...new Set(collection.map((piece) => piece[field] ?? 'Studio archive'))].sort(); values.forEach((value) => select.append(new Option(value, value)));
      label.append(select); filters.append(label); select.addEventListener('change', () => render()); return select;
    });
    const render = (): void => {
      const grid = this.dialog.querySelector('#piece-grid')!; grid.replaceChildren();
      const pieces = collection.filter((piece) => [piece.title, piece.description, piece.materials, piece.collection].join(' ').toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase()) && fields.every((field, i) => !controls[i].value || (piece[field] ?? 'Studio archive') === controls[i].value));
      this.dialog.querySelector('#catalogue-count')!.textContent = `${pieces.length} of ${collection.length} works`;
      for (const piece of pieces) {
        const button = document.createElement('button'); button.className = 'piece-card'; button.dataset.action = hall === 'all' ? `exhibit-photo:${piece.discovery}:0` : `exhibit:select:${hall}:${piece.discovery}`;
        const image = document.createElement('img'); image.src = photoURL(piece.photos[0].thumb ?? piece.photos[0].file); image.alt = piece.photos[0].alt; image.loading = 'lazy';
        const title = document.createElement('strong'); title.textContent = piece.title;
        const details = document.createElement('span'); details.textContent = `${piece.type} · ${piece.year} · ${piece.location ?? 'Studio archive'}`;
        button.append(image, title, details); grid.append(button);
      }
    }; render();
  }
  showPhoto(exhibit: Exhibit, index = 0): void {
    this.pane = 'photo'; if (this.dialog.hidden) this.browseHall = exhibit.location ?? 'all'; this.exhibit = exhibit; this.index = index;
    this.dialog.querySelector<HTMLElement>('#piece-browser')!.hidden = true; this.dialog.querySelector<HTMLElement>('#photo-viewer')!.hidden = false;
    this.renderPhoto();
  }
  private renderPhoto(): void {
    const photo = this.exhibit.photos[this.index]; this.zoom = 1; this.pan = { x: 0, y: 0 }; this.pointers.clear();
    this.dialog.querySelector('#gallery-title')!.textContent = this.exhibit.title;
    this.dialog.querySelector('#viewer-facts')!.textContent = `${this.exhibit.type} · ${this.exhibit.year} · ${this.exhibit.materials} · ${this.exhibit.dimensions}. ${this.exhibit.story ?? this.exhibit.description}`;
    this.dialog.querySelector<HTMLAnchorElement>('#viewer-source')!.href = this.exhibit.source ?? CATALOGUE_URL;
    this.image.alt = photo.alt; this.image.src = photoURL(photo.file); this.image.hidden = false; this.dialog.querySelector<HTMLElement>('#photo-error')!.hidden = true;
    this.dialog.querySelector('#photo-count')!.textContent = `${this.index + 1} / ${this.exhibit.photos.length}`;
    this.transform(); this.stage.classList.remove('photo-unfold'); void this.stage.offsetWidth; this.stage.classList.add('photo-unfold');
    requestAnimationFrame(() => this.transform());
  }
  private control(command: string): void {
    if (command === 'browse') { this.showBrowse(this.browseHall, this.exhibit); return; }
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
