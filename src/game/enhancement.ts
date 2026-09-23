export const ENHANCEMENT_URL = 'https://enhancement.bio/';
export type CategoryIcon = 'shield' | 'heartbeat' | 'sync' | 'globe' | 'eye' | 'brush';
export interface EnhancementCategory { name: string; color: string; icon: CategoryIcon; description: string; genes: string }
export interface EnhancementPoster { slug: string; title: string; body: string; credit: string; alt: string }

/** Colours, icons and descriptions follow CATEGORY_COLORS/ICONS/DESCRIPTIONS in the project source; genes are knowledgebase entries. */
export const ENHANCEMENT_CATEGORIES: EnhancementCategory[] = [
  { name: 'Regeneration', color: '#16a085', icon: 'sync', description: 'Repair and regrowth abilities for wounds, tissues, limbs, and organs.', genes: 'Lin28a (axolotl) · PIWI / SMEDWI (planarian) · telomere genes of the immortal jellyfish' },
  { name: 'Environmental Adaptation', color: '#2980b9', icon: 'globe', description: 'Body changes for unusual habitats such as underwater, low oxygen, or extreme climates.', genes: 'AFP / AFGP antifreeze (winter flounder) · CIRBP (bowhead whale) · EPAS1 (Tibetan high-altitude haplotype)' },
  { name: 'Expression', color: '#8e44ad', icon: 'brush', description: 'Visible biological traits such as color, light, texture, or other surface-level signals.', genes: 'GFP (crystal jellyfish) · luciferase (firefly) · reflectin (common cuttlefish)' },
  { name: 'Longevity & Genome', color: '#27ae60', icon: 'heartbeat', description: 'DNA repair, cancer resistance, and cellular maintenance for longer healthy life.', genes: 'TP53 (African elephant) · HAS2 (naked mole-rat) · Klotho (human and mouse)' },
  { name: 'Stress Resistance', color: '#e67e22', icon: 'shield', description: 'Protection against radiation, toxins, heat, cold, dryness, and other harsh conditions.', genes: 'Dsup (tardigrade) · PprI / PprA (Deinococcus bacterium) · SOD2 (naked mole-rat)' },
  { name: 'Perception', color: '#e84393', icon: 'eye', description: 'Expanded senses such as better vision, hearing, navigation, or environmental awareness.', genes: 'CRY4a (European robin) · prestin (bat and dolphin) · TRPA1 (rattlesnake)' },
];

/** Ordered from the arrival end of the row. Images are local derivatives; see public/images/enhancement/ATTRIBUTION.md. */
export const ENHANCEMENT_POSTERS: EnhancementPoster[] = [
  { slug: 'report', title: 'A character enhancement report', body: 'Pick real genes from real animals with 100 enhancement credits. The report lists the chosen categories, source organisms and genes, with front, side and back views of the crystal they grew.', credit: 'Screenshot · enhancement.bio report “Scinquisitor”, seed 2371', alt: 'Character enhancement report listing categories, crystal views, source organisms and genes' },
  { slug: 'printer', title: 'Grown from genes, then printed', body: 'Protein mass, exon count, system size and hydropathy of the chosen genes set the crystal’s size, layer spacing, surface complexity and relief. The result is a printable STL.', credit: 'Photo · Materialized Enhancements', alt: 'A 3D printer beside freshly printed crystals in blue, yellow and white' },
  { slug: 'livia', title: 'Livia Zaharia wears a crystal', body: 'Livia works on the project’s parametric geometry, the personal enhancement report and 3D printing. Wear the crystal, display it, or share the build.', credit: 'Photo · Materialized Enhancements', alt: 'Livia Zaharia wearing a printed crystal necklace' },
  { slug: 'visitors', title: 'Visitors and their crystals', body: 'Participants hold Materialized Enhancements crystals printed from character builds. Every crystal is unique to its gene choices and character name.', credit: 'Photos · Materialized Enhancements', alt: 'Nine visitors each holding a small printed crystal' },
  { slug: 'glow', title: 'A crystal in blue light', body: 'A printed crystal glows green under blue light. The same Voronoi cells shape the hill behind this row.', credit: 'Photo · Materialized Enhancements', alt: 'A printed Voronoi crystal glowing green on a blue background' },
  { slug: 'memes', title: 'Fear what you wish for', body: 'Project memes about Dsup, elephant TP53, Klotho and myostatin. Every gene card rates how far the evidence reached. Dsup shields human kidney cells from radiation but killed rat neurons outright.', credit: 'AI-assisted project illustrations · enhancement.bio', alt: 'Four illustrated memes about Dsup, TP53, Klotho and myostatin' },
];
export const enhancementImage = (slug: string): string => `/images/enhancement/${slug}.webp`;
