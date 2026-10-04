# Jewelry STL archive — what exists and how to use it (3 October 2026)

Livia Zaharia's Drive export (`drive-folder`) holds 695 STL files, 19.0 GB, for 93 works, studies and third-party models. This page identifies the **latest version** of each work, lists the parts of multi-part pieces, and records what it would take to bring a piece into Livistone, either directly or as inspiration for new architecture. Facts about the pieces come from the artist's website ([livia.glucosedao.org/pieces](https://livia.glucosedao.org/pieces/)); everything else is measured from the files. It extends [concepts/02-jewelry-models/notes.md](../concepts/02-jewelry-models/notes.md), which analysed the first two STLs (Mitoring and Nanot) that the town already uses.

The files themselves are not in this repository and must not be committed (`data/models/` is git-ignored; see [docs/3d-game-plan.md](3d-game-plan.md) on keeping originals offline and shipping only derived assets).

## At a glance

- **695 STL files → 93 works and studies.** 71 of the website's 97 works have at least one STL here; the other 22 groups are unlisted (new 2026 work, contest and competition pieces, studies, third-party models).
- **The newest files are from 2026.** Eye of Winter, Eyelense and Deep Sea Pearl belong to RJW 2026 and are on the website; Cloud Agate, Emerald Stillness, Thunderstone and Moldavite are not. The oldest of the artist's own files is the Cheesecake pendant (31 October 2017).
- **Most works were saved many times.** 695 files collapse into 166 "latest" bodies (everything else is an earlier save or an identical copy: 51 files are byte-identical to another).
- **Units are millimetres, 1:1** (checked against 22 published dimensions below), not "ten times life size" as the first note guessed.
- **Weight varies by six orders of magnitude**, from a 16-triangle crystal blank to the 14.9 M-triangle, 745 MB `sparanghel1.stl`. The heaviest current piece is Eye of Winter's base (10.3 M triangles, 513 MB). Nothing here loads in a browser as-is; [what is inside the meshes and how far each shape reduces](jewelry-stl-inclusion-analysis.md) is analysed separately.
- **Already in the town:** only Mitoring and Nanot, as extracted wire strands. Everything else appears as photographs.
- **Not for the town without asking:** private commissions (wedding, engagement, portrait medallions), the IESF trophy (apparently a commission for another organisation) and the three third-party models. See [Check before use](#check-before-use).

## Contents

- [How to read this catalogue](#how-to-read-this-catalogue): folders, units, naming, "latest" rules, confidence
- [The works at a glance](#the-works-at-a-glance): one table, then one section per period
- [2024–2026](#period-2024)
- [2023](#period-2023)
- [2022](#period-2022)
- [2021](#period-2021)
- [2020](#period-2020)
- [2019](#period-2019)
- [2017–2018](#period-2018)
- [Studies, reliefs, commissions and third-party models](#period-S)
- [Website works with no STL here](#website-works-with-no-stl-here)
- [Heaviest files](#heaviest-files)
- [Livistone: what is used, what could be](#livistone-what-is-used-what-could-be)
- [Check before use](#check-before-use)
- [How the numbers were produced](#how-the-numbers-were-produced)

## How to read this catalogue

### Folders

Paths are relative to the root of `drive-folder`. The year folders are `02_PARAM 2018` (260 STLs) through `07.PARAM 2023`, then `09.PARAM 2025` (there is no 08) and `10.PARAM 2026`, which holds only photographs. Alongside them sit working folders: `complete` (final models), `to be sent` (batches sent to exhibitions and contests), and one folder per new 2026 project (`eye of winter`, `thunderstone`, `moldavit`, `cloud agate`). The `rjw*`, `rjw 2026`, `tincall 2025`, `spotlight`, `diffcomp` and `the jewelery code` folders contain photographs and documents but no STL, and `weird shape mircea` only Rhino files.

Next to the STLs are **959 Rhino (`.3dm`) and Grasshopper (`.gh`) files**: the parametric sources the STLs were exported from. They are outside this page, but they matter for any serious extension: a Grasshopper definition regenerates a piece at any resolution or parameter, while an STL is one frozen, usually very dense, export. Most works have both in the same folder. (`docs/3d-game-plan.md` already notes that Rhino geometry must be supplied or baked if a definition needs plug-ins.)

### Units and axes

Every file is in **millimetres at life size**: the bounding boxes of the latest versions agree with the dimensions printed on the website to within about 15 % for 18 of the 22 works where both exist.

| Work | Website size (cm) | STL bounding box (mm, long → short) | STL ÷ website (longest side) |
| --- | --- | --- | ---: |
| Amberear Ring | 2.4 × 2.6 × 2.4 cm | 25.9 × 23.7 × 23.4 | 1.00 |
| Beanut (fasolaluna) Pendant | 1.9 × 1.5 × 6.8 cm | 67.4 × 19.5 × 12.4 | 0.99 |
| Ceartari Earings | 1.9 × 1.9 × 2 cm | 20.2 × 19.0 × 19.0 | 1.01 |
| Deep Sea Pearl (Karmazina) Ring | 4.1 × 3.5 × 2.5 cm | 40.3 × 32.8 × 24.7 | 0.98 |
| Eye of Winter Double Ring and Pendant | 4.2 × 4 × 3.5 cm | 40.1 × 32.3 × 24.2 | 0.95 |
| Eyelense Pendant | 7 × 3 × 2.5 cm | 70.0 × 53.4 × 16.8 | 1.00 |
| Hessonite Ring | 2.3 × 1.8 × 1.5 cm | 25.4 × 18.3 × 15.4 | 1.10 |
| Ice Pendant | 3.5 × 3.5 × 3.0 cm | 35.4 × 33.9 × 30.0 | 1.01 |
| Inline Ring | 2.2 × 2.1 × 9.4 cm | 24.6 × 23.7 × 9.1 | 0.26 |
| King's Chapel Double Ring | 3 × 5 × 1.5 cm | 50.2 × 33.0 × 15.2 | 1.00 |
| La Navette Pendant | 4.5 × 3.5 × 1.2 cm | 44.7 × 33.6 × 12.0 | 0.99 |
| Mitoring (Mitochondria) Ring | 3.2 × 2.2 cm | 34.5 × 31.5 × 24.3 | 1.08 |
| Mountain of Gold Double Ring | 2.5 × 5.0 × 4.0 cm | 50.5 × 30.1 × 24.6 | 1.01 |
| Mycelium Ring | 2.1 × 2.0 × 2.8 cm | 28.1 × 21.1 × 19.9 | 1.00 |
| Nanot Pendant | 3.2 × 3.2 cm | 46.3 × 41.1 × 39.5 | 1.45 |
| Nocciola Ring | 5 × 3.2 × 3.2 cm | 42.9 × 32.5 × 31.8 | 0.86 |
| Nucalong Pendant | 2.4 × 1.3 × 6.4 cm | 64.0 × 25.0 × 13.7 | 1.00 |
| Piguen Nonaltra Pendant | 4.95 × 3.2 × 2.5 cm | 49.2 × 25.3 × 23.3 | 0.99 |
| Splash Pendant | 2.4 × 2.4 × 4.5 cm | 35.4 × 24.4 × 23.9 | 0.79 |
| Sticks and Stones Pendant | 6.5 × 4.6 × 3.5 cm | 65.8 × 45.6 × 31.4 | 1.01 |
| Sunfinder Pendant | 7.5 × 4 × 4 cm | 72.2 × 48.3 × 48.3 | 0.96 |
| Vittoria Amazonica Pendant | 4.5 × 4.5 × 1.0 cm | 36.4 × 36.2 × 2.4 | 0.81 |

The four outliers differ for reasons the files cannot settle. **Nanot** (1.45): the STL includes the bail and the strand tips, and may be scaled for printing. **Inline** (0.26): the website lists 2.2 × 2.1 × 9.4 cm but the STL is a 24.6 × 23.7 × 9.1 mm ring, so either the website's last figure is 9.4 mm or the STL is an earlier form. **Splash** (0.79) and **Vittoria Amazonica** (0.81) are 4–10 mm smaller than listed, plausibly because the website measures the finished piece with its bail or chain. The earlier note's "about ten times life size or tenths of a millimetre" reading of the Mitoring and Nanot files should be taken as **1 unit = 1 mm** (Mitoring 31.5 × 24.3 mm for a published 3.2 × 2.2 cm ring).

Axes are whatever Rhino exported. Rings usually stand with the finger hole along one horizontal axis and the stone seat up, but this is not consistent, so read the bounding box before placing a model. Coordinates are rarely centred on the origin.

### Which file is the latest

File **modification times survive intact** in this export (to the second), so the newest save is simply the newest timestamp. They are interpreted with the author's naming habits, inferred from comparing names, sizes and times:

| Pattern | Meaning | Example |
| --- | --- | --- |
| leading `+` | A processed twin saved minutes after the raw export: same model, mesh cleaned/closed, typically 0.5–3 % fewer triangles. Counted as the same version and preferred as the print-ready file. **Exception:** in `tag2` and `victoria lily` the `+` copy is a *rescaled* model | `3mito.stl` → `+3mito.stl` |
| trailing `+`, `++`, `+++` | Successive saves of the same design | `shimeji+`, `shimeji++` |
| leading digit | Revision counter, often with `+` on both sides | `bulet` → `1bulet` → `2bulet`; `++2+amberear` |
| `trimis` / `trimise` | "sent": the snapshot that went to the printer or foundry | `swiss blue+trimis`, `02 GAURIRE/trimise/` |
| `last`, `FINAL`, `complete`, `to be sent`, `USED` | The author's own markers for the final or sent set | `cercel covrig/last/`, `LOGODNA FINAL` |
| `old`, `uzate` ("worn out"), `archive(n)`, `New folder` | Superseded or copied-aside material | `MNAR Inspira-scara/uzate/` |
| `-1`, `-2`, `1`, `2` after a name; `stanga`/`dreapta`; `STG`/`DRP`; `EA`/`EL` | Parts of a set, left/right earrings, "she"/"he" ring pairs | `m1-1`/`m1-2`, `helixEA`/`helixEL` |

Rules used for every work: (1) take the newest timestamp among the work's files; (2) identical copies count once and keep their **earliest** date (so `complete/` copies made in November 2025 do not look newer than the October originals); (3) for a set or pair, take the newest file of each part separately, because parts are often revised independently (Woven Wedding Rings: `EA` stops at version 3 while `EL` reaches 4); (4) zero-length files are never "latest". Where the newest file is a lighter re-save of a heavier one (Emerald Stillness) both are listed.

Some timestamps are not edit dates: every file of the **IESF trophy** shows 2026-10-03, the day it was unzipped; the copies in `HELIX/archive(2)` (2022-02-13) and `01.trofeu2/2021-06-27` (2022-05-24) were re-copied from older sets.

### Romanian words in the names

| Word | Meaning | Word | Meaning |
| --- | --- | --- | --- |
| `inel` | ring | `cercel / cercei` | earring(s) |
| `pandantiv` | pendant | `logodna` | engagement |
| `floare` | flower | `perla` | pearl |
| `nuca` | nut / walnut | `bila` | ball |
| `covrig` | pretzel | `ciopercute` | little mushrooms |
| `viermele` | little worms | `sparanghel` | asparagus |
| `bolta` | vault | `coaste` | ribs |
| `cadru` | frame | `piatra` | stone |
| `aripioara` | small wing | `baza` | base |
| `capat` | end / cap | `surub` | screw |
| `mot` | motif | `petala / cupa` | petal / cup |
| `gaurire / cu gauri / ciuruit` | perforation / with holes / pierced | `masca / prindere` | mask / fastening |
| `munte` | mountain | `lamela` | blade / lamella |
| `scris` | lettering | `rasina` | resin |
| `trofeu` | trophy | `stanga / dreapta` | left / right |
| `ea / el / fiica` | she / he / daughter | `micsorat` | reduced / shrunk |
| `pt` | for (e.g. `pt ceramica` = for ceramics) | `masea / ciob / frunza / ghioaga / solz` | molar / shard / leaf / club / scale |
| `poze` | photographs | `trimis` | sent |
| `safir` | sapphire | `ametist` | amethyst |
| `scara` | staircase / ladder | `uzate` | worn out |

### How sure each match is

Each entry says which website work it is. **sure**: file name, date and published dimensions agree. **probable**: two of the three. **guess**: only the shape or the date, so verify visually before relying on it. Entries with no website work are labelled *not on the website* (the 2026 new work, contest entries, studies). The website snapshot used is the one in the sibling `livia` repository and does not yet list any 2026 STL work except the RJW 2026 pieces.

## The works at a glance

One row per work. "Parts" counts the printable bodies of the latest version; **heaviest part** is its largest triangle count. Detail entries follow in the period sections.

| Work | Year | Kind | Collection / context | Parts | Heaviest part | In Livistone |
| --- | --- | --- | --- | ---: | ---: | --- |
| [Emerald Stillness (STL spelling `stilness`)](#emerald-stilness) | 2026 | multi-part set | (new, not on the site yet) | 3 | 2.56 M | — |
| [Nanot of Power (Nanot Pendant)](#nanot) | 2024-26 | single body | It's just a cell life (RJW 2025) | 1 | 2.25 M | Ministry of Science |
| [Cloud Agate](#cloud-agate) | 2026 | multi-part set | (new, not on the site yet) | 7 | 1.42 M | — |
| [Moldavite (VLATIV) ring](#moldavit) | 2026 | single body | (new, not on the site yet) | 1 | 241 k | — |
| ["sperecels" spiral dome](#spere-dome) | 2025-26 | multi-part set | (unplaced) | 1 (3 studies) | 485 k | — |
| [Thunderstone](#thunderstone) | 2026 | multi-part set | (new, not on the site yet) | 3 | 456 k | — |
| [Eye of Winter Double Ring and Pendant](#eye-of-winter) | 2026 | multi-part set | A world for everyone (RJW 2026) | 4 | 10.26 M | Photo poster (Ministry of Energy hall) |
| [Eyelense Pendant](#eyelense) | 2025-26 | multi-part set | A world for everyone (RJW 2026) | 2 | 57 k | Photo poster in Future House; source crescent also enlarged into the playable Eyelense E gate in the east meadow |
| [Supernova Ring](#supernova) | 2025 | single body | Shine bright like a star (Osmium 2025) | 1 | 50 k | — |
| [Deep Sea Pearl (Karmazina) Ring](#deep-sea-pearl) | 2025-26 | single body | A world for everyone (RJW 2026) | 1 | 9.66 M | Photo poster in Future House |
| [Frog Ring (frog remake)](#frog) | 2025 | single body | — | 1 | 543 k | — |
| [Wavy Circle Pendant](#wavy-circle) | 2025 | single body | — | 1 | 501 k | — |
| [Lines ring (justline / pill)](#lines) | 2025 | single body | (Hexa / lines) | 1 | 622 k | — |
| [Hexa Ring family (Hexa → exhexa → not so hexa)](#hexa) | 2024-25 | multi-part set | (Hexa / lines) | 2 | 891 k | — |
| [Sound of Stars Earrings](#sound-of-stars) | 2025 | pair | Shine bright like a star (Osmium 2025) | 2 | 665 k | — |
| [White Dwarf Pendant](#white-dwarf) | 2025 | single body | Shine bright like a star (Osmium 2025) | 1 | 1.27 M | — |
| [Mitoring (Mitochondria Ring)](#mitoring) | 2024-25 | single body | It's just a cell life (RJW 2025) | 1 | 985 k | Ministry of Energy; photo exhibit in the hall |
| ["2securea" (Jan 2025)](#securea) | 2025 | single body | (January 2025 batch) | 1 | 336 k | — |
| [IESF trophy (mountain + crystal, ~60 cm)](#iesf-trophy) | 2023 | multi-part set | (apparent commission – not jewelry) | ≈ 14 | 3.43 M | — |
| [Nocciola Ring](#nocciola) | 2023 | multi-part set | Beloved food (RJW 2024) | 2 | 656 k | Photo poster in City Hall |
| [Cloudstone Pendant](#cloudstone) | 2023 | single body | — | 1 | 278 k | — |
| [Brain Ring](#brain) | 2022-23 | single body | — | 1 | 190 k | — |
| [Funghi Ring Series](#funghi) | 2022 | multi-part set | — | 4 rings | 910 k | — |
| [Vittoria Amazonica Pendant](#vittoria) | 2022 | multi-part set | Survival (RJW 2023) | 2 | 84 k | Photo poster in Ministry of Science; also the lake garden stand |
| [Hessonite Ring](#hessonite) | 2022 | single body | Survival (RJW 2023) | 1 | 222 k | Photo poster in Ministry of Science |
| [Switch ring (probable Slider Ring)](#switch) | 2022 | single body | — | 1 | 244 k | — |
| ["pathfinder" cage (probable Sunfinder)](#sunfinder) | 2022 | single body | Paths. Memories. Guides (RJW 2022) | 1 | 18 k | Sunfinder photo poster in Embryo Station |
| [Piguen Nonaltra Pendant](#piguen) | 2022 | multi-part set | Paths. Memories. Guides (RJW 2022) | 2 (or 1 merged) | 368 k | Photo poster in Embryo Station |
| [Inline Ring](#inline) | 2022 | single body | Paths. Memories. Guides (RJW 2022) | 1 | 200 k | Photo poster in Embryo Station |
| [Tilia Earrings (+ piramid, m)](#tilia) | 2022 | multi-part set | — | 3 designs | 274 k | — |
| [Trophy 2021 (lattice bloom)](#trophy-2021) | 2021 | single body | (trophy design) | 1 | 248 k | — |
| [Sticks and Stones Pendant](#sticks-and-stones) | 2021-22 | multi-part set | Paths. Memories. Guides (RJW 2022) | ≈ 6 | 659 k | Photo poster in Embryo Station |
| [Solid Tourmaline Ring](#solid-tourmaline) | 2021 | single body | — | 1 | 19 k | — |
| [King's Chapel Double Ring](#kings-chapel) | 2021 | single body | Paths. Memories. Guides (RJW 2022) | 1 | 1.14 M | Arch gateway at the town entrance; photo poster in Embryo Station |
| [Flute (concept, insulin-vial token)](#flute) | 2021 | multi-part set | Flute (Concept 2021) | 2 | 282 k | — |
| [Amberear Ring](#amberear) | 2021 | single body | Paths. Memories. Guides (RJW 2022) | 1 | 397 k | Photo poster in Ministry of Energy |
| [Fistic Ring ("bullet")](#fistic-ring) | 2021 | single body | — | 1 | 305 k | — |
| [Half Fistic Earrings](#half-fistic) | 2021 | pair | — | 2 | 141 k | — |
| [Soft Art Nouveau Railing Ring](#railing) | 2021 | single body | — | 1 | 365 k | — |
| [La Navette Pendant](#la-navette) | 2021 | multi-part set | Paths. Memories. Guides (RJW 2022) | 4 | 122 k | Photo poster in Embryo Station |
| [Mountain of Gold Double Ring](#mountain-of-gold) | 2021 | single body | Parametric (by) nature (RJW 2021) | 1 | 595 k | Photo poster in Ministry of Science |
| [Mycelium Ring](#mycelium) | 2021 | single body | Parametric (by) nature (RJW 2021) | 1 | 364 k | Photo poster in Ministry of Science; the lake garden mushroom crowns follow its photographs |
| [Yellow Submarine Pendant](#yellow-submarine) | 2021 | single body | — | 1 | 232 k | — |
| [Bubble Ring](#bubble) | 2020 | single body | — | 1 | 348 k | — |
| [Rotary Ring (Rotary Magnetic ancestor)](#rotary) | 2020 | multi-part set | (2025: A world for everyone) | 2 | 502 k | Rotary Magnetic photo poster in Ministry of Energy |
| [Hardata / cylinder](#cylinder-stick) | 2020 | single body | Hardata (Timișoara 2021) | 1 | 1.98 M | — |
| [Ice Pendant](#ice) | 2020 | single body | Parametric (by) nature (RJW 2021) | 1 | 589 k | Photo poster in Ministry of Energy |
| [Wormy Ring / Red Wormy Little Apple](#wormy) | 2020 | single body | — | 1 | 307 k | Timeface/archive collection (photo) |
| [Woven Wedding Rings (Brancovenesc)](#woven) | 2020 | pair | — | 2 | 308 k | — |
| [Merlusca (denisa) Ring](#merlusca-denisa) | 2020 | single body | — | 1 | 660 k | — |
| [Peas in Pod Ring](#peas) | 2020 | single body | — | 1 | 258 k | Timeface/archive collection (photo) |
| [The Link Pin (MNAR "Inspira-scara")](#the-link) | 2020 | single body | The Link (MNAR 2020) | 1 | 153 k | — |
| [Ceartari Earrings](#ceartari) | 2020 | pair | Parametric (by) nature (RJW 2021) | 2 | 153 k | Photo poster in Ministry of Science |
| [Helix Wedding Rings](#helix) | 2020 | pair | — | 2 | 116 k | — |
| [Blooming Pins](#blooming-pins) | 2020 | multi-part set | — | 6 | 213 k | — |
| [Nucalong Pendant (from `sparanghel`)](#nucalong) | 2018-24 | single body | Beloved food (RJW 2024) | 1 | 165 k | Photo poster in City Hall |
| [Beanut (Fasolaluna) Pendant](#beanut) | 2019 | single body | Parametric (by) nature (RJW 2021) | 1 | 444 k | Photo poster in Ministry of Science |
| [Peony Ring](#peony-ring) | 2019 | single body | — | 1 | 221 k | — |
| [Art Nouveau Ring (amethyst)](#art-nouveau-ring) | 2019 | single body | Earlier explorations | 1 | 220 k | Timeface/archive collection (photo) |
| [Pretzel Earrings](#pretzel) | 2019 | pair | — | 2 | 330 k | — |
| [War and Peace Ring](#war-and-peace) | 2019 | single body | — | 1 | 377 k | — |
| [Dewdrop Ring](#dewdrop) | 2019 | single body | — | 1 | 213 k | Dewdrop garden stand (lake) |
| [Engagement Ring (sapphire series, private)](#engagement-2019) | 2019 | single body | (private commission) | 1 | 33 k | — |
| [Wrap Ring](#wrap) | 2019 | single body | — | 1 | 169 k | — |
| [Roots Ring](#roots) | 2019 | single body | — | 1 | 213 k | — |
| [The Eye Pendant](#the-eye) | 2019 | single body | — | 1 | 379 k | — |
| [Greentooth Ring](#greentooth) | 2019 | single body | — | 1 | 350 k | — |
| [Mr Bean Masca Pendant](#mr-bean-masca) | 2019 | multi-part set | — | 2 | 4.86 M | — |
| [Colour Window Spring Edition Ring](#colour-window) | 2018-19 | single body | — | 1 | 526 k | — |
| [Florine Ring](#florine) | 2018 | single body | — | 1 | 4 k | — |
| [Splash Pendant](#splash) | 2018 | single body | Parametric (by) nature (RJW 2021) | 1 | 398 k | Photo poster in Ministry of Energy |
| [Black pearl ring ("perla neagra")](#black-pearl) | 2018 | single body | — | 1 | 130 k | — |
| [Pearl Earrings](#pearl-earrings) | 2018 | single body | — | 1 | 243 k | — |
| [Art Nouveau Earrings](#art-nouveau-earrings) | 2018 | single body | — | 1 | 962 k | — |
| [Vera Ring](#vera) | 2018 | single body | — | 1 | 1 k | — |
| [First Ring (probable: `inel_propriu_test4livia`)](#first-ring) | 2018 | single body | Earlier explorations | 1 | 990 | First Ring photo in the Timeface archive collection |
| [Daggers earrings (cercel2)](#daggers-earrings) | 2018 | single body | — | 1 | 340 k | — |
| [Nut sphere (`nucasfera`)](#nucasfera) | 2018 | single body | (precursor study) | 1 | 302 k | — |
| [Little Trumpet / second cabochon series](#little-trumpet) | 2018 | single body | — | 1 | 16 k | — |
| [Cabochon Ring](#cabochon) | 2018 | single body | — | 1 | 71 k | — |
| ["bila capat" bulb](#cap-sphere) | 2018 | single body | — | 1 | 30 k | — |
| [Engagement Ring 2 (2018 series, private)](#engagement-2018) | 2018 | single body | (private commission) | 1 | 339 k | — |
| [Moldavian Vault Ring](#moldavian-vault) | 2018 | single body | Earlier explorations | 1 | 19 k | Timeface/archive collection (photo) |
| [Mushroom Ring](#mushroom-ring) | 2018 | single body | — | 1 | 448 k | — |
| [Interchangeable Flower Pendant](#interchangeable-flower) | 2018 | multi-part set | — | 4 | 49 k | — |
| [Merlusca Ring](#merlusca) | 2017 | single body | — | 1 | 625 k | — |
| [Cheesecake Pendant](#cheesecake) | 2017 | single body | — | 1 | 14 k | — |
| [Wedding Rings 2018 (private)](#wedding-2018) | 2018 | pair | (private commission) | 2 | 21 k | — |
| [Frog scan (third party)](#frog-scan) | 2025 | third-party model | — | 1 | 11 k | — |
| [Portrait relief medallions (ea / el / ea-fiica)](#family-medallions) | 2021 | study | (private commission) | 1 | 1.23 M | — |
| [Spine (vertebrae C1–L5, sacrum)](#spine) | 2017-18 | third-party model | — | 1 | 1.93 M | — |
| [Relief dishes: BOB, CUCUTENI, GOLESTI (2017)](#tag-reliefs) | 2017 | study | (early experiments) | 1 | 2.01 M | — |
| [Vertebra / tooth form studies ("pt ceramica")](#vertebre-ceramics) | 2018 | study | (ceramics studies) | 1 | 499 k | — |

<a id="period-2024"></a>

## 2024–2026 — It's just a cell life, Osmium, Hexa, A world for everyone and the new 2026 work

### Emerald Stillness (STL spelling `stilness`)
<a id="emerald-stilness"></a>*multi-part set · 2026 · (new, not on the site yet)* · not on the website

Sits in the `cloud agate` folder; the Rhino file is `09.PARAM 2025/sperecels/emeraldstillness.3dm` and the Grasshopper file `cloud agate/emerald stillness.gh` (both 2026-09-19), so the work is spelled "stillness" there. `+1emerald stilness1` (382 k) is the reduced re-save of `+emerald stilness1` (2.56 M); `ems2`/`ems3` are small 24 mm parts.

| Part | Latest file | Triangles | Size (mm) | Saved |
| --- | --- | ---: | ---: | --- |
| main body, light (Sep 20) | `cloud agate/+1emerald stilness1.stl` | 382 k | 24.7 × 22.3 × 64.9 | 2026-09-20 |
| main body, full (Sep 19, 128 MB) | `cloud agate/+emerald stilness1.stl` | 2.56 M | 26.1 × 24.2 × 63.8 | 2026-09-19 |
| settings 2 | `cloud agate/+ems2.stl` | 29 k | 24.0 × 12.0 × 21.6 | 2026-09-19 |
| settings 3 | `cloud agate/+ems3.stl` | 29 k | 24.0 × 12.0 × 21.6 | 2026-09-19 |

- **In Livistone:** not in the town yet

### Nanot of Power (Nanot Pendant)
<a id="nanot"></a>*single body · 2024-26 · It's just a cell life (RJW 2025)* · website: **Nanot Pendant** (sure)

`bila` = ball. 2.2 M triangles; the sea-urchin strut sphere with doubled-back hairpin strands and the bail. `NANOTICS2` (Jul 2024) is the earlier, smaller form (36.8 mm, 1.8 M tris) that was in the January 2025 `to be sent` batch; `bila.stl` (Sep 2026) is the current final. Already analysed in `concepts/02-jewelry-models/notes.md`.

| Part | Latest file | Triangles | Size (mm) | Saved |
| --- | --- | ---: | ---: | --- |
| final sphere pendant | `complete/bila.stl` | 2.25 M | 39.5 × 41.1 × 46.3 | 2026-09-16 |
| print variant with extra supports | `complete/bila cu extra suporti.stl` | 2.25 M | 39.5 × 41.1 × 46.3 | 2026-04-20 |
| predecessor (NANOTICS2, 2024) | `to be sent/STL_IANUARIE/+NANOTICS2.stl` (+1 copy) | 1.83 M | 36.8 × 37.2 × 35.9 | 2024-07-09 |

- **In Livistone:** Ministry of Science (strands extracted to `src/world/strands/nanot.json`)

### Cloud Agate
<a id="cloud-agate"></a>*multi-part set · 2026 · (new, not on the site yet)* · not on the website

September 2026: elongated almond-shaped pods 122 mm long, each in two grades, a plain pierced **basic** shell (44 k tris) and an ornate spiral-cage **complex** one (1.4 M tris) with two small bases and a slice insert. Files `1` and `2` of each grade have identical sizes (a pair, or two copies). A large piece: the biggest jewelry body in the archive.

| Part | Latest file | Triangles | Size (mm) | Saved |
| --- | --- | ---: | ---: | --- |
| complex cloud agate, no. 1 | `cloud agate/+complex cloud agate1.stl` | 1.42 M | 122.0 × 28.5 × 45.0 | 2026-09-13 |
| complex cloud agate, no. 2 | `cloud agate/+complex cloud agate2.stl` | 1.40 M | 122.0 × 28.5 × 45.0 | 2026-09-13 |
| complex base 1 | `cloud agate/complex cloud agat base1.stl` | 6 k | 17.5 × 15.9 × 21.3 | 2026-09-13 |
| complex base 2 | `cloud agate/complex cloud agat base2.stl` | 6 k | 17.5 × 15.9 × 21.3 | 2026-09-13 |
| complex slice (decorative insert) | `cloud agate/complex cloud agat slice.stl` | 4 k | 64.0 × 7.6 × 6.6 | 2026-09-13 |
| basic cloud agate, no. 1 | `cloud agate/basic cloud agate1.stl` | 44 k | 122.0 × 17.0 × 42.0 | 2026-09-13 |
| basic cloud agate, no. 2 | `cloud agate/basic cloud agate2.stl` | 44 k | 122.0 × 17.0 × 42.0 | 2026-09-13 |

- **Reduction, measured** (error vs wire radius, at 1 mm = 0.5 m): 30 k: 0.54 MB per part, worst error 1 % (2.6 cm); 10 k: 0.18 MB per part, worst error 4 % (9.4 cm); 3 k: 0.05 MB per part, collapses. The plain `basic` pod (44 k triangles) is within 1 % at 30 k and 2.3 cm at 3 k, so it is the far LOD. At 0.5 m/mm the pods would be 61 m long; about 0.15 m/mm gives 18 m.
- **In Livistone:** not in the town yet

### Moldavite (VLATIV) ring
<a id="moldavit"></a>*single body · 2026 · (new, not on the site yet)* · not on the website

July 2026; tangled looped wire cage for a moldavite stone (20 × 41 × 36 mm).

- **Latest:** `moldavit/+5+VLATIV.stl` — 241 k triangles, 20.3 × 41.3 × 35.8 mm, 12 MB, 2026-07-20
- **Reduction, measured** (error vs wire radius, at 1 mm = 0.5 m): 30 k: 0.54 MB per part, worst error 3 % (1.1 cm); 10 k: 0.18 MB per part, worst error 7 % (2.9 cm); 3 k: 0.05 MB per part, worst error 24 % (9.6 cm).
- **In Livistone:** not in the town yet

### "sperecels" spiral dome
<a id="spere-dome"></a>*multi-part set · 2025-26 · (unplaced)* · not on the website

Hemispherical shell wound with spiral ribs (the same language as the `not so hexa` ring) and a spire topped by a small knob; triangular settings round the rim. Not matched to a published work. The `sperecels` folder also holds the Eyelense Grasshopper definition (`theyelense.gh`) and the Rhino source of Emerald Stillness, so it groups the 2025-26 lens and dome studies. Candidate for a lookout or dome building.

| Part | Latest file | Triangles | Size (mm) | Saved |
| --- | --- | ---: | ---: | --- |
| dome, newest (Jun 2026) | `09.PARAM 2025/+sperecels2-1.stl` | 485 k | 30.3 × 28.4 × 16.5 | 2026-06-08 |
| dome study 1 (Jun 2025) | `to be sent/work in progress/sperecels/+spere1.stl` | 439 k | 32.8 × 28.5 × 21.0 | 2025-06-12 |
| dome study 2 (Jun 2025) | `to be sent/work in progress/sperecels/+spere2.stl` | 433 k | 30.3 × 28.4 × 16.5 | 2025-06-12 |

- **Reduction, measured** (error vs wire radius, at 1 mm = 0.5 m): 30 k: 0.54 MB per part, worst error 2 % (0.7 cm); 10 k: 0.18 MB per part, worst error 5 % (2.0 cm); 3 k: 0.05 MB per part, worst error 15 % (5.9 cm).
- **In Livistone:** not in the town yet

### Thunderstone
<a id="thunderstone"></a>*multi-part set · 2026 · (new, not on the site yet)* · not on the website

May 2026. A looped-wire base with a threaded post, a triangulated cage that sits over it and a small nut; the upper part was later shrunk (`MICSORAT1`).

Paths in this table are inside `thunderstone/`.

| Part | Latest file | Triangles | Size (mm) | Saved |
| --- | --- | ---: | ---: | --- |
| base | `+thunderstone base.stl` | 394 k | 11.8 × 26.8 × 28.5 | 2026-05-02 |
| upper part, reduced ("MICSORAT1") | `+MICSORAT1thunderstone up.stl` | 456 k | 20.3 × 43.5 × 19.2 | 2026-05-12 |
| nut (fastener) | `thunderstone nut.stl` | 20 k | 5.7 × 5.7 × 4.5 | 2026-05-02 |

- **Reduction, measured** (error vs wire radius, at 1 mm = 0.5 m): 30 k: 0.54 MB per part, worst error 3 % (1.1 cm); 10 k: 0.18 MB per part, worst error 6 % (2.4 cm); 3 k: 0.05 MB per part, worst error 15 % (6.2 cm).
- **In Livistone:** not in the town yet

### Eye of Winter Double Ring and Pendant
<a id="eye-of-winter"></a>*multi-part set · 2026 · A world for everyone (RJW 2026)* · website: **Eye of Winter Double Ring and Pendant** (sure)

A looped-wire ring base, two variants of a honeycomb half-shell cover (fine "complex" cells, coarse "simple" cells) and a 4 mm screw: the parts of the "double ring and pendant". The base alone is 10.3 M triangles / 513 MB.

Paths in this table are inside `eye of winter/`.

| Part | Latest file | Triangles | Size (mm) | Saved |
| --- | --- | ---: | ---: | --- |
| base (looped-wire ring) | `+EOW-base.stl` | 10.26 M | 40.1 × 32.3 × 24.2 | 2026-01-29 |
| complex half (honeycomb half-shell, fine cells) | `+EOW-complex half.stl` | 681 k | 28.4 × 17.7 × 25.2 | 2026-01-29 |
| simple half (honeycomb half-shell, coarse cells) | `+EOW-simple half.stl` | 409 k | 29.6 × 19.5 × 20.7 | 2026-01-29 |
| assembly screw | `EOW screw.stl` | 2 k | 4.0 × 4.0 × 21.0 | 2026-01-28 |

- **Reduction, measured** (error vs wire radius, at 1 mm = 0.5 m): 30 k: 0.54 MB per part, worst error 5 % (1.8 cm); 10 k: 0.18 MB per part, worst error 12 % (4.3 cm); 3 k: 0.05 MB per part, worst error 36 % (10.8 cm). One body each for base and one half; base + half + screw is about 62 k triangles at 30 k each, 22 k at 10 k each.
- **In Livistone:** Photo poster (Ministry of Energy hall)

### Eyelense Pendant
<a id="eyelense"></a>*multi-part set · 2025-26 · A world for everyone (RJW 2026)* · website: **Eyelense Pendant** (sure)

"Story of a broken lens": two faces threaded together with silver screws; the ring version re-uses the first two faces plus only the base. Root-level files are the newest (2025-12-02); `sperecels/eyelens.stl` (80.8 mm) is the earlier study.

| Part | Latest file | Triangles | Size (mm) | Saved |
| --- | --- | ---: | ---: | --- |
| face 1 (crescent plate with screw studs) | `+eyelens1-1.stl` | 55 k | 70.0 × 53.4 × 16.8 | 2025-12-02 |
| face 2 (crescent plate) | `+eyelens1-2.stl` | 57 k | 70.0 × 53.4 × 16.8 | 2025-12-02 |

- *Earlier:* 1 file — earlier single-body lens study (2025-11-07)
- **In Livistone:** Photo poster in Future House

### Supernova Ring
<a id="supernova"></a>*single body · 2025 · Shine bright like a star (Osmium 2025)* · not on the website

Ring of the Osmium contest series: a core protected by outward-flaring plates. Feb 2025 form is larger (28.9 mm); May–June forms are 23.5 mm.

| Part | Latest file | Triangles | Size (mm) | Saved |
| --- | --- | ---: | ---: | --- |
| latest print batch (Jun 2025) | `to be sent/work in progress/2025-batch to print/++supernova_.stl` | 48 k | 23.5 × 23.5 × 25.2 | 2025-06-11 |
| May 2025 form | `complete/+supernova.stl` (+2 copy) | 50 k | 23.5 × 23.5 × 25.2 | 2025-05-04 |
| contest submission form (Feb 2025) | `to be sent/osmium/supernova/+superenova.stl` (+1 copy) | 25 k | 28.9 × 28.9 × 25.9 | 2025-02-22 |

- **In Livistone:** not in the town yet

### Deep Sea Pearl (Karmazina) Ring
<a id="deep-sea-pearl"></a>*single body · 2025-26 · A world for everyone (RJW 2026)* · website: **Deep Sea Pearl (Karmazina) Ring** (sure)

**9.66 M triangles / 483 MB** – by far the heaviest piece (`deepsea (3)`); the 245 k-triangle `deepsea (2)` has the same loops and a 40.3 mm span and is the practical web source. Tube loops fan around the pearl seat. Identical copies in `09.PARAM 2025/deepsea/` and `complete/`.

- **Latest:** `complete/+deepsea (3).stl` — 9.66 M triangles, 40.3 × 32.8 × 24.7 mm, 483 MB, 2025-11-09
- *Earlier:* 4 files — lighter earlier forms (2025-10-14 → 2025-11-06)
- **Reduction, measured** (error vs wire radius, at 1 mm = 0.5 m): 30 k: 0.54 MB per part, worst error 4 % (1.7 cm); 10 k: 0.18 MB per part, worst error 9 % (3.7 cm); 3 k: 0.05 MB per part, worst error 22 % (9.0 cm).
- **In Livistone:** Photo poster in Future House

### Frog Ring (frog remake)
<a id="frog"></a>*single body · 2025* · website: **Frog Ring** (probable)

`fro_re` = frog re(make). Built on the third-party frog scan (next entry).

- **Latest:** `to be sent/work in progress/2025-batch to print/+fro_re.stl` — 543 k triangles, 20.5 × 23.4 × 33.7 mm, 27 MB, 2025-07-01
- **In Livistone:** not in the town yet

### Wavy Circle Pendant
<a id="wavy-circle"></a>*single body · 2025* · website: **Wavy Circle Pendant** (probable)

A flat wreath of looped wave tubes, 32.8 × 32.8 × 15.7 mm; the website only has photographs.

- **Latest:** `to be sent/work in progress/2025-batch to print/+1wavy.stl` — 501 k triangles, 32.8 × 32.8 × 15.7 mm, 25 MB, 2025-06-24
- **Reduction, measured** (error vs wire radius, at 1 mm = 0.5 m): 30 k: 0.54 MB per part, worst error 3 % (1.4 cm); 10 k: 0.18 MB per part, worst error 8 % (3.4 cm); 3 k: 0.05 MB per part, worst error 21 % (8.9 cm).
- **In Livistone:** not in the town yet

### Lines ring (justline / pill)
<a id="lines"></a>*single body · 2025 · (Hexa / lines)* · not on the website

Single-body ring: a flat pill-shaped platform on a lattice tower of tubes. `justline` → `1line-justline` → `line-pill2` (27.4 mm). One body, no top.

| Part | Latest file | Triangles | Size (mm) | Saved |
| --- | --- | ---: | ---: | --- |
| line-pill2 (Jun 2025) | `to be sent/work in progress/2025-batch to print/line-pill2.stl` | 619 k | 27.4 × 14.8 × 35.1 | 2025-06-23 |
| 1line-justline (May 2025, `complete/`) | `complete/1line-justline.stl` | 622 k | 27.9 × 15.8 × 35.1 | 2025-05-04 |
| line-justline (Apr 2025) | `2025-lines(ex-hexa)/01-lines/line-justline.stl` | 504 k | 27.9 × 15.8 × 35.1 | 2025-04-22 |

- **In Livistone:** not in the town yet

### Hexa Ring family (Hexa → exhexa → not so hexa)
<a id="hexa"></a>*multi-part set · 2024-25 · (Hexa / lines)* · website: **Hexa Ring** (probable)

A ring in two printed pieces: a base (from `not so hexa` on, a ring carrying a spiral-ribbed hemispherical cage) and a small band-and-pins top. Each generation re-skins the same idea: `HEXA` (hexagonal cell wall) → `exhexa` ("ex-hexa", the 00-folder carries "Rostock") → `not so hexa` (irregular cells) → `rsbi` (same 24.3 × 29.4 mm base, 2025-06-11, the print-batch name; the Grasshopper files call the family `line-and-sphere-hexa-derived` / `…-rsbi-derived`). `complete/` holds the not-so-hexa pair as final. Base ≈ 0.8 M triangles, top ≈ 40–70 k.

| Part | Latest file | Triangles | Size (mm) | Saved |
| --- | --- | ---: | ---: | --- |
| Hexa v1 base (Jan 2025) | `to be sent/STL_IANUARIE/+2HEXA.stl` | 819 k | 30.4 × 22.6 × 34.5 | 2025-01-10 |
| Hexa v1 top (Dec 2024) | `to be sent/STL_IANUARIE/+1HEXATOP.stl` | 32 k | 25.1 × 14.1 × 5.9 | 2024-12-07 |
| exhexa base ("Rostock", Apr 2025) | `2025-lines(ex-hexa)/00-exhexa(Rostock)/+exhexa-base.stl` | 891 k | 32.7 × 25.2 × 34.5 | 2025-04-23 |
| exhexa top | `2025-lines(ex-hexa)/00-exhexa(Rostock)/+exhexa-top.stl` | 42 k | 26.9 × 13.9 × 8.6 | 2025-04-23 |
| not so hexa base (Apr 2025, `complete/`) | `complete/+not so hexa-base.stl` (+1 copy) | 764 k | 24.3 × 29.4 × 35.8 | 2025-04-23 |
| not so hexa top | `complete/+not so hexa-top.stl` (+1 copy) | 42 k | 13.9 × 27.5 × 8.6 | 2025-04-23 |
| rsbi base (Jun 2025, print batch) | `to be sent/work in progress/2025-batch to print/rsbi_base.stl` | 780 k | 24.3 × 29.4 × 35.0 | 2025-06-11 |
| rsbi top | `to be sent/work in progress/2025-batch to print/+rsbi_top.stl` | 72 k | 13.8 × 27.4 × 8.6 | 2025-06-11 |

- *Earlier:* 4 files — other saves in the same folders (2025-04-22 → 2025-04-23)
- **Reduction, measured** (error vs wire radius, at 1 mm = 0.5 m): 30 k: 0.54 MB per part, worst error 5 % (1.9 cm); 10 k: 0.18 MB per part, worst error 12 % (4.6 cm); 3 k: 0.05 MB per part, worst error 32 % (12.1 cm).
- **In Livistone:** not in the town yet

### Sound of Stars Earrings
<a id="sound-of-stars"></a>*pair · 2025 · Shine bright like a star (Osmium 2025)* · not on the website

"Tiny bells": ripples of light and sound. Two near-identical files (the `fp-` one is 2.7 mm taller); only the Feb 2025 submission files exist.

| Part | Latest file | Triangles | Size (mm) | Saved |
| --- | --- | ---: | ---: | --- |
| earring A (`soundofstars`) | `to be sent/osmium/sound of stars/soundofstars.stl` (+1 copy) | 665 k | 19.8 × 19.3 × 20.5 | 2025-02-22 |
| earring B (`fp-soundofstars`) | `to be sent/osmium/sound of stars/fp-soundofstars.stl` (+1 copy) | 658 k | 19.8 × 19.3 × 22.2 | 2025-02-22 |

- **In Livistone:** not in the town yet

### White Dwarf Pendant
<a id="white-dwarf"></a>*single body · 2025 · Shine bright like a star (Osmium 2025)* · not on the website

"Dense and heavy" late-star pendant, 34.9 mm cube, 1.27 M triangles.

- **Latest:** `to be sent/osmium/whitedwarf/+whitedwarf.stl` — 1.27 M triangles, 34.9 × 34.8 × 34.1 mm, 64 MB, 2025-02-22 (+1 identical copy)
- **Reduction, measured** (error vs wire radius, at 1 mm = 0.5 m): 30 k: 0.54 MB per part, worst error 7 % (2.9 cm); 10 k: 0.18 MB per part, worst error 18 % (7.1 cm); 3 k: 0.05 MB per part, worst error 48 % (19.3 cm).
- **In Livistone:** not in the town yet

### Mitoring (Mitochondria Ring)
<a id="mitoring"></a>*single body · 2024-25 · It's just a cell life (RJW 2025)* · website: **Mitoring (Mitochondria) Ring** (sure)

The ring behind the Ministry of Energy. Basket of wavy wire rows, hairpin loops over the amber seat, two-band shank. Already analysed in `concepts/02-jewelry-models/notes.md`. First saved Jan 14 2025 in `to be sent/STL_IANUARIE` (a "January" batch, probably the RJW 2025 application); `09.PARAM 2025` holds an identical copy dated Oct 2025.

- **Latest:** `to be sent/STL_IANUARIE/+3mito.stl` — 985 k triangles, 31.5 × 24.3 × 34.5 mm, 49 MB, 2025-01-14 (+1 identical copy)
- **In Livistone:** Ministry of Energy (strands extracted to `src/world/strands/mitoring.json`); photo exhibit in the hall

### "2securea" (Jan 2025)
<a id="securea"></a>*single body · 2025 · (January 2025 batch)* · not on the website

A single tall piece of parallel looped tubes joined by a crossbar (38 × 25 × 50 mm). It sits in the January 2025 batch with Hexa, Mitoring and Nanot but is not matched to a named work.

- **Latest:** `to be sent/STL_IANUARIE/2securea.stl` — 336 k triangles, 38.2 × 25.4 × 50.4 mm, 17 MB, 2025-01-09
- **In Livistone:** not in the town yet

<a id="period-2023"></a>

## 2023

### IESF trophy (mountain + crystal, ~60 cm)
<a id="iesf-trophy"></a>*multi-part set · 2023 · (apparent commission – not jewelry)* · not on the website

Largest object in the archive: 230 × 222 × 604 mm, a tall tapering column on a round base crowned with a crystal burst. Split into a printed base, eight tall blades, lettering and a mountain/crystal in resin. Files dated 2026-10-03 are extraction dates, not edit dates. Low-poly (6 k) whole-trophy assemblies make it the most browser-ready sculpture. The newest Rhino file, `IESF Trophy/++IESF Trophy (OBJ).3dm`, is from 2024-01-25, later than every trophy STL. "IESF" is the folder name; the commission is not described on the website.

Paths in this table are inside `07.PARAM 2023/trofeu/`.

| Part | Latest file | Triangles | Size (mm) | Saved |
| --- | --- | ---: | ---: | --- |
| whole trophy, print mesh | `000-used/3dprinted/trofeu_print-20230822T195419Z-001/trofeu_print/trofeu complet.stl` | 3.43 M | 230.7 × 221.9 × 603.7 | 2023-08-22 |
| base | `000-used/3dprinted/trofeu_print-20230822T195419Z-001/trofeu_print/baza_print.stl` | 3.32 M | 221.9 × 221.9 × 145.7 | 2023-08-22 |
| lettering (newest, Aug 30) | `000-used/3dprinted/trofeu_print-20230822T195419Z-001/trofeu_print/+scris_print.stl` | 83 k | 31.0 × 76.6 × 14.9 | 2023-08-30 |
| 8 blades `lamela1..8_print` | `000-used/3dprinted/trofeu_print-20230822T195419Z-001/trofeu_print/` — 8 files (e.g. `lamela1_print.stl`) | 972–3 k | 38–91 × 38–65 × 389–536 | n/a |
| mountain core | `000-used/3dprinted/trofeu_print-20230822T195419Z-001/trofeu_print/munte_baza.stl` | 68 | 47.8 × 47.6 × 270.4 | n/a |
| whole-trophy low-poly assemblies (`doar metal` / `cu de toate`) | `000-used/general/` — `trofeu cu de toate.stl`, `trofeu doar metal.stl` | 6 k | 222 × 222 × 604 | n/a |
| resin parts (mountain upper/lower, crystal top) | `000-used/rasina/` — `cristal top.stl`, `munte_jos.stl`, `munte_sus.stl`, `munte_jos.stl` | 16–6 k | 48–222 × 48–222 × 103–605 | n/a |

- *Earlier:* 1 file — old crystal (n/a)
- *Earlier:* 1 file — other saves in the same folders (2023-08-22)
- **In Livistone:** not in the town yet

### Nocciola Ring
<a id="nocciola"></a>*multi-part set · 2023 · Beloved food (RJW 2024)* · website: **Nocciola Ring** (sure)

Hazelnut (nocciola) ring in two printed parts: the main body (42.9 × 31.8 × 32.5 mm, a double-loop shank with a flared, ribbed husk) and `base`. Identical copies in `nuca/`, `base/` and `2023-08-28/`. How the two parts assemble around the agate geode is not recorded in the files.

| Part | Latest file | Triangles | Size (mm) | Saved |
| --- | --- | ---: | ---: | --- |
| main body: ring with flared ribbed husk (`nocciola`) | `07.PARAM 2023/nuca/+nocciola.stl` (+1 copy) | 656 k | 42.9 × 31.8 × 32.5 | 2023-08-25 |
| second ring part (`base`: band with ribbed cone) | `07.PARAM 2023/base/base.stl` (+1 copy) | 120 k | 34.0 × 22.8 × 16.0 | 2023-08-25 |

- *Earlier:* 1 file — other saves in the same folders (2023-08-24)
- **In Livistone:** Photo poster in City Hall

### Cloudstone Pendant
<a id="cloudstone"></a>*single body · 2023* · website: **Cloudstone Pendant** (sure)

18.8 × 19.8 × 16.2 mm, 278 k tris. A second copy sits in `pt floricic` (`pt` = for: a folder prepared for someone, together with `++1brain`).

- **Latest:** `07.PARAM 2023/Cloud stone/cloud stone.stl` — 278 k triangles, 18.8 × 19.8 × 16.2 mm, 14 MB, 2023-01-08 (+1 identical copy)
- **In Livistone:** not in the town yet

<a id="period-2022"></a>

## 2022 — Paths. Memories. Guides

### Brain Ring
<a id="brain"></a>*single body · 2022-23* · website: **Brain Ring** (sure)

Seven files: a 4.3 M-triangle first form (`brain.stl`, 213 MB) then `1brain` → `4brain`. `4brain` (Feb 2023) is the newest.

- **Latest:** `06_PARAM 2022/brain/4brain.stl` — 190 k triangles, 21.0 × 21.3 × 12.3 mm, 9 MB, 2023-02-04
- **In Livistone:** not in the town yet

### Funghi Ring Series
<a id="funghi"></a>*multi-part set · 2022* · website: **Funghi Ring Series** (sure)

A series of four distinct rings (all 2022-12-26). Not versions of one another – each has a `+` twin except 1 and 2. `cabouchon/funghi1.stl` is an older-folder copy of ring 1 (different size).

Paths in this table are inside `06_PARAM 2022/funghi/`.

| Part | Latest file | Triangles | Size (mm) | Saved |
| --- | --- | ---: | ---: | --- |
| ring 1 | `funghi1.stl` | 48 k | 8.8 × 23.3 × 23.0 | 2022-12-26 |
| ring 2 | `funghi2.stl` | 221 k | 9.8 × 25.3 × 25.2 | 2022-12-26 |
| ring 3 | `funghi3.stl` | 887 k | 8.3 × 20.1 × 20.1 | 2022-12-26 |
| ring 4 | `+funghi4.stl` | 910 k | 8.8 × 20.8 × 20.8 | 2022-12-26 |

- **In Livistone:** not in the town yet

### Vittoria Amazonica Pendant
<a id="vittoria"></a>*multi-part set · 2022 · Survival (RJW 2023)* · website: **Vittoria Amazonica Pendant** (sure)

Giant-water-lily leaf (36 mm disc) plus a water-drop stone. `+victoria_amazonica_water` is the same shape scaled ×10 (127 mm), not a repaired copy.

Paths in this table are inside `06_PARAM 2022/sound manipulation/victoria lily/`.

| Part | Latest file | Triangles | Size (mm) | Saved |
| --- | --- | ---: | ---: | --- |
| leaf disc (base) | `victoria_amazonica_base.stl` | 84 k | 36.2 × 36.4 × 2.4 | 2022-11-03 |
| water drop stone | `victoria_amazonica_water.stl` | 24 k | 12.8 × 12.7 × 9.0 | 2022-11-03 |
| water drop ×10 scaled copy | `+victoria_amazonica_water.stl` | 24 k | 127.6 × 127.5 × 89.7 | 2022-11-03 |

- **In Livistone:** Photo poster in Ministry of Science; also the lake garden stand (Vittoria)

### Hessonite Ring
<a id="hessonite"></a>*single body · 2022 · Survival (RJW 2023)* · website: **Hessonite Ring** (sure)

Folder name `HESSOINTE EYE`. 25.4 × 18.3 × 15.4 mm for the Sep 2022 revision (`1hse`).

- **Latest:** `06_PARAM 2022/HESSOINTE EYE/+1hse.stl` — 222 k triangles, 25.4 × 18.3 × 15.4 mm, 11 MB, 2022-09-04
- **In Livistone:** Photo poster in Ministry of Science

### Switch ring (probable Slider Ring)
<a id="switch"></a>*single body · 2022* · website: **Slider Ring** (guess)

Looped-wire ring that slides along a rail (27.9 × 21.3 × 28.9 mm). The website has a Slider Ring with photographs only; the match is by shape.

- **Latest:** `06_PARAM 2022/switch/+3SWITCH.stl` — 244 k triangles, 27.9 × 21.3 × 28.9 mm, 12 MB, 2022-09-04
- **In Livistone:** not in the town yet

### "pathfinder" cage (probable Sunfinder)
<a id="sunfinder"></a>*single body · 2022 · Paths. Memories. Guides (RJW 2022)* · website: **Sunfinder Pendant** (probable)

Flat plates (the plexiglass of the finished piece) crossing a sphere; 48 × 48 × 72 mm, only 18 k tris. Matches Sunfinder (7.5 cm tall, plexiglass + Iceland spar) by size and material; the name is `pathfinder` after the RJW 2022 theme.

- **Latest:** `06_PARAM 2022/others/pathfinder.stl` — 18 k triangles, 48.3 × 48.3 × 72.2 mm, 919 kB, 2022-07-30
- **In Livistone:** Sunfinder photo poster in Embryo Station

### Piguen Nonaltra Pendant
<a id="piguen"></a>*multi-part set · 2022 · Paths. Memories. Guides (RJW 2022)* · website: **Piguen Nonaltra Pendant** (sure)

"Meteorite" pendant: a clamshell of two halves around the meteorite (`m1-1`, `m1-2`), later merged into `meteorite++`. Latest = the merged body.

Paths in this table are inside `06_PARAM 2022/`.

| Part | Latest file | Triangles | Size (mm) | Saved |
| --- | --- | ---: | ---: | --- |
| combined single body (Jul 30) | `others/meteorite++.stl` | 368 k | 23.3 × 25.3 × 49.2 | 2022-07-30 |
| half 1 (May 4) | `meteorite/+1-m1-1.stl` | 187 k | 23.3 × 16.2 × 49.2 | 2022-05-04 |
| half 2 (May 4) | `meteorite/+1-m1-2.stl` | 179 k | 23.3 × 15.5 × 49.2 | 2022-05-04 |

- *Earlier:* 6 files — other saves in the same folders (2022-04-22 → 2022-05-04)
- **In Livistone:** Photo poster in Embryo Station

### Inline Ring
<a id="inline"></a>*single body · 2022 · Paths. Memories. Guides (RJW 2022)* · website: **Inline Ring** (sure)

Four files, latest `+2inline` (Jul 2022).

- **Latest:** `06_PARAM 2022/sound manipulation/INLINE/+2inline.stl` — 200 k triangles, 23.7 × 9.1 × 24.6 mm, 10 MB, 2022-07-28
- **In Livistone:** Photo poster in Embryo Station

### Tilia Earrings (+ piramid, m)
<a id="tilia"></a>*multi-part set · 2022* · website: **Tilia Earings** (probable)

"cercei particles" = earrings. `TILIA` (linden) and `piramid` each exist as v1 and a May 2022 "remastered" copy; `m` is a separate lattice design, never revised.

Paths in this table are inside `06_PARAM 2022/sound manipulation/cercei particles/`.

| Part | Latest file | Triangles | Size (mm) | Saved |
| --- | --- | ---: | ---: | --- |
| TILIA remastered | `+TILIA-remastered.stl` | 150 k | 19.5 × 19.5 × 36.5 | 2022-05-08 |
| piramid remastered | `+piramid-remastered.stl` | 128 k | 13.5 × 13.5 × 32.6 | 2022-05-07 |
| m (lattice pineapple, Mar 31) | `m.stl` | 274 k | 22.7 × 25.1 × 49.5 | 2022-03-31 |

- *Earlier:* 3 files — other saves in the same folders (2022-03-31 → 2022-04-17)
- **In Livistone:** not in the town yet

<a id="period-2021"></a>

## 2021 — Parametric (by) nature and its aftermath

### Trophy 2021 (lattice bloom)
<a id="trophy-2021"></a>*single body · 2021 · (trophy design)* · not on the website

Conical lattice flower, 33 × 38.8 × 33 mm. `3DC_Trofeu_6` is the June 24 first form; the 2021-06-27 folder's files carry 2022 timestamps.

- **Latest:** `05_PARAM 2021/01.trofeu2/2021-06-27/+trofeu+.stl` — 248 k triangles, 33.0 × 38.8 × 33.0 mm, 12 MB, 2022-05-24
- *Earlier:* 4 files — other versions (2021-06-24 → 2022-05-24)
- **In Livistone:** not in the town yet

### Sticks and Stones Pendant
<a id="sticks-and-stones"></a>*multi-part set · 2021-22 · Paths. Memories. Guides (RJW 2022)* · website: **Sticks and Stones Pendant** (sure)

Folder `la defence citta stato`. The parts (ribs `coaste`, two `stones` bodies, a screw and a cap) were designed separately in Oct–Nov 2021; `sticks and stones.stl` (65.8 × 31.4 × 45.6 mm, Jan 2022) is the assembled pendant. Part of the "Listen to your heart" series with Amberear.

Paths in this table are inside `05_PARAM 2021/la defence citta stato/`.

| Part | Latest file | Triangles | Size (mm) | Saved |
| --- | --- | ---: | ---: | --- |
| assembled pendant (Jan 2022) | `sticks and stones.stl` | 659 k | 65.8 × 31.4 × 45.6 | 2022-01-07 |
| ribs `2coaste` | `+2coaste.stl` | 212 k | 53.1 × 17.5 × 37.4 | 2021-10-14 |
| the two `stones` bodies `1stones-1/-2` (31 mm) | `+1stones-1.stl` | 239 k | 31.3 × 31.4 × 15.9 | 2021-10-13 |
| screw `2surub` and cap `2capat` | `2capat.stl` | 3 k | 7.0 × 7.0 × 3.4 | 2021-11-14 |

- *Earlier:* 7 files — older ribs, stones, screw (2021-10-09 → 2021-10-14)
- **In Livistone:** Photo poster in Embryo Station

### Solid Tourmaline Ring
<a id="solid-tourmaline"></a>*single body · 2021* · website: **Solid Tourmaline Ring** (sure)

Only 19 k triangles (23 × 17 × 7 mm).

- **Latest:** `05_PARAM 2021/solid tourmaline/solid tourmaline.stl` — 19 k triangles, 23.4 × 17.4 × 7.3 mm, 970 kB, 2021-12-20
- **In Livistone:** not in the town yet

### King's Chapel Double Ring
<a id="kings-chapel"></a>*single body · 2021 · Paths. Memories. Guides (RJW 2022)* · website: **King's Chapel Double Ring** (sure)

`king college` = King's College (Cambridge) chapel. 50.2 × 15.2 × 33 mm, 1.14 M tris. The gateway of the town is based on this ring.

- **Latest:** `05_PARAM 2021/king college/+king college.stl` — 1.14 M triangles, 50.2 × 15.2 × 33.0 mm, 57 MB, 2021-12-20
- **In Livistone:** Arch gateway at the town entrance (concept 07); photo poster in Embryo Station

### Flute (concept, insulin-vial token)
<a id="flute"></a>*multi-part set · 2021 · Flute (Concept 2021)* · not on the website

The website calls it a concept for reusing insulin vials as a token for people with diabetes. Slender 16 × 13 × 69 mm body with `laterala` (side) variants; `2head.STL` is a downloaded Baroque-flute head (not original).

Paths in this table are inside `05_PARAM 2021/flute/`.

| Part | Latest file | Triangles | Size (mm) | Saved |
| --- | --- | ---: | ---: | --- |
| latest repaired body | `+flute2_fixed.stl` | 282 k | 16.0 × 13.3 × 68.6 | 2021-12-10 |
| mouthpiece `suflatoare` | `3d parts/suflatoare.stl` | 58 k | 14.0 × 15.5 × 51.9 | 2021-12-06 |
| side body `laterala` studies | `3d parts/+++3laterala1_fixed.stl` | 193 k | 15.6 × 13.6 × 67.4 | 2021-12-08 |

- *Earlier:* 7 files — other saves (2020-08-18 → 2021-12-10)
- **In Livistone:** not in the town yet

### Amberear Ring
<a id="amberear"></a>*single body · 2021 · Paths. Memories. Guides (RJW 2022)* · website: **Amberear Ring** (sure)

Twelve saves over three days (Oct 17-20 2021); `+++2+amberear` is the last. The "ears" around the amber stone; a 131 MB ASCII twin (`+++amberear`) exists.

- **Latest:** `05_PARAM 2021/amberear/+++2+amberear.stl` — 397 k triangles, 23.7 × 23.4 × 25.9 mm, 20 MB, 2021-10-20
- **In Livistone:** Photo poster in Ministry of Energy

### Fistic Ring ("bullet")
<a id="fistic-ring"></a>*single body · 2021* · website: **Fistic Ring** (sure)

Folder `bullet` (the bullet-cut peridot); `+2bulet` (Jun 5 2021) is the last.

- **Latest:** `05_PARAM 2021/bullet/+2bulet.stl` — 305 k triangles, 23.8 × 13.2 × 28.5 mm, 15 MB, 2021-06-05
- **In Livistone:** not in the town yet

### Half Fistic Earrings
<a id="half-fistic"></a>*pair · 2021* · website: **Half Fistic Earings** (sure)

Earring pair; two generations (May 30, Jun 4 2021), `+1` is the latest.

| Part | Latest file | Triangles | Size (mm) | Saved |
| --- | --- | ---: | ---: | --- |
| left (`stanga`) | `05_PARAM 2021/fistic/+1fistic stanga.stl` | 141 k | 23.1 × 13.5 × 12.2 | 2021-06-04 |
| right (`dreapta`) | `05_PARAM 2021/fistic/+1fistic dreapta.stl` | 141 k | 23.1 × 13.5 × 12.2 | 2021-06-04 |

- *Earlier:* 6 files — other saves in the same folders (2021-05-30 → 2021-06-04)
- **In Livistone:** not in the town yet

### Soft Art Nouveau Railing Ring
<a id="railing"></a>*single body · 2021* · website: **Soft Art Nouveau Railing Ring** (sure)

`+1RAILING` (Jun 3 2021).

- **Latest:** `05_PARAM 2021/railing/+1RAILING.stl` — 365 k triangles, 18.7 × 30.1 × 28.7 mm, 18 MB, 2021-06-03
- **In Livistone:** not in the town yet

### La Navette Pendant
<a id="la-navette"></a>*multi-part set · 2021 · Paths. Memories. Guides (RJW 2022)* · website: **La Navette Pendant** (sure)

Free-rotating pendant around a navette-cut alexandrite: frame, stone and two wings. Two generations (May 30 and Jun 2 2021); `+1…`/`1…` (Jun 2) are the latest. There is no `+` twin of the stone, so `1lanavette-piatra` is the latest stone.

Paths in this table are inside `05_PARAM 2021/la navette/`.

| Part | Latest file | Triangles | Size (mm) | Saved |
| --- | --- | ---: | ---: | --- |
| frame `cadru` | `+1lanavette-cadru.stl` | 122 k | 12.0 × 33.6 × 44.7 | 2021-06-02 |
| stone `piatra` | `1lanavette-piatra.stl` | 21 k | 12.6 × 27.6 × 6.8 | 2021-06-02 |
| small wing, left `aripioara stanga` | `+1lanavette-aripioara stanga.stl` | 86 k | 17.6 × 17.3 × 10.1 | 2021-06-02 |
| small wing, right `aripioara dreapta` | `+1lanavette-aripioara dreapta.stl` | 86 k | 17.6 × 17.3 × 10.1 | 2021-06-02 |

- *Earlier:* 11 files — other saves in the same folders (2021-05-30 → 2021-06-02)
- **Reduction, measured** (error vs wire radius, at 1 mm = 0.5 m): 30 k: 0.54 MB per part, worst error 1 % (0.6 cm); 10 k: 0.18 MB per part, worst error 3 % (1.6 cm); 3 k: 0.05 MB per part, worst error 8 % (4.7 cm). All four parts at 10 k each: about 40 k triangles.
- **In Livistone:** Photo poster in Embryo Station

### Mountain of Gold Double Ring
<a id="mountain-of-gold"></a>*single body · 2021 · Parametric (by) nature (RJW 2021)* · website: **Mountain of Gold Double Ring** (sure)

Citrine two-finger ring that can be worn as a pendant. Newest `+MG3` (Feb 22 2021).

- **Latest:** `05_PARAM 2021/mountain of gold, mycelium, yellow submarine/+MG3.stl` — 595 k triangles, 50.5 × 24.6 × 30.1 mm, 30 MB, 2021-02-22
- *Earlier:* 4 files — earlier forms (2021-02-13 → 2021-02-22)
- **Reduction, measured** (error vs wire radius, at 1 mm = 0.5 m): 30 k: 0.54 MB per part, worst error 5 % (1.7 cm); 10 k: 0.18 MB per part, worst error 13 % (4.1 cm); 3 k: 0.05 MB per part, worst error 35 % (11.5 cm).
- **In Livistone:** Photo poster in Ministry of Science

### Mycelium Ring
<a id="mycelium"></a>*single body · 2021 · Parametric (by) nature (RJW 2021)* · website: **Mycelium Ring** (sure)

Opal ring with drainage channels shaped like fungal mycelium. Folder `opal fungi` (Feb 13-14) then `mycelium2` (Feb 22).

- **Latest:** `05_PARAM 2021/mountain of gold, mycelium, yellow submarine/+mycelium2.stl` — 364 k triangles, 19.9 × 21.1 × 28.1 mm, 18 MB, 2021-02-22
- *Earlier:* 5 files — earlier forms (2021-02-13 → 2021-02-22)
- **Reduction, measured** (error vs wire radius, at 1 mm = 0.5 m): 30 k: 0.54 MB per part, worst error 6 % (1.5 cm); 10 k: 0.18 MB per part, worst error 14 % (3.7 cm); 3 k: 0.05 MB per part, worst error 39 % (10.5 cm).
- **In Livistone:** Photo poster in Ministry of Science; the lake garden mushroom crowns follow its photographs

### Yellow Submarine Pendant
<a id="yellow-submarine"></a>*single body · 2021* · website: **Yellow Submarine Pendant** (sure)

Slim vessel for yellow jade beads (11.8 × 37 × 15.5 mm). Newest is the unprefixed Feb 22 file.

- **Latest:** `05_PARAM 2021/mountain of gold, mycelium, yellow submarine/yellowsubmarine.stl` — 232 k triangles, 11.8 × 37.0 × 15.5 mm, 12 MB, 2021-02-22
- *Earlier:* 2 files — earlier (2021-02-20)
- **In Livistone:** not in the town yet

<a id="period-2020"></a>

## 2020

### Bubble Ring
<a id="bubble"></a>*single body · 2020* · website: **Bubble Ring** (sure)

A bubble inside a bubble grid between two rings. `+bubble_Miruna.stl` (2022) is a later per-client resize; `++1bubble` is a 137 MB ASCII twin.

| Part | Latest file | Triangles | Size (mm) | Saved |
| --- | --- | ---: | ---: | --- |
| ring (Nov 12 2020) | `04_PARAM 2020/BUBBLE/+1bubble.stl` | 337 k | 25.4 × 24.1 × 10.0 | 2020-11-12 |
| client-sized re-save (Nov 2022) | `04_PARAM 2020/BUBBLE/+bubble_Miruna.stl` | 348 k | 25.2 × 24.0 × 10.5 | 2022-11-01 |

- *Earlier:* 4 files — other saves (2020-11-07 → 2020-11-12)
- **In Livistone:** not in the town yet

### Rotary Ring (Rotary Magnetic ancestor)
<a id="rotary"></a>*multi-part set · 2020 · (2025: A world for everyone)* · website: **Rotary Ring** (probable)

Two parts, `rotary1-1` and `rotary1-2`; the website describes the ring as having moving parts. Part `1-2` was revised nine times between Sep 11 and Nov 20 2020 (`4rotary1-2` and `+3rotary1-2` are identical in size). **The 2025 Rotary Magnetic ring (3.5 × 3.2 × 3.2 cm, amber) has no STL in this folder.**

| Part | Latest file | Triangles | Size (mm) | Saved |
| --- | --- | ---: | ---: | --- |
| part `rotary1-1` | `04_PARAM 2020/rotary/+rotary1-1.stl` | 211 k | 20.0 × 25.2 × 12.6 | 2020-09-11 |
| part `rotary1-2`, 4th revision | `04_PARAM 2020/rotary/4rotary1-2.stl` | 502 k | 23.5 × 25.1 × 15.8 | 2020-11-20 |

- *Earlier:* 7 files — earlier revisions of part `1-2` (2020-09-11 → 2020-11-20)
- **In Livistone:** Rotary Magnetic photo poster in Ministry of Energy

### Hardata / cylinder
<a id="cylinder-stick"></a>*single body · 2020 · Hardata (Timișoara 2021)* · not on the website

Hollow noise-textured cylinder, 93 × 93 × 163 mm, 1.98 M tris. The website says Hardata won first prize in the 2021 Hyper Form 3D-printable sculpture open call (Timișoara); the file name `hard data` and the October 2020 date fit, but the match is not stated anywhere. A copy of `cylinder.stl` sits in the 2021 `MOTOCICLIST/OLD STICK` folder.

- **Latest:** `04_PARAM 2020/cylinder/hard data.stl` — 1.98 M triangles, 93.2 × 93.4 × 162.9 mm, 99 MB, 2020-10-19
- *Earlier:* 2 files — first save `cylinder` (2020-10-10)
- **Reduction, measured** (error vs wire radius, at 1 mm = 0.5 m): 30 k: 0.54 MB per part, worst error 2 % (6.9 cm); 10 k: 0.18 MB per part, worst error 4 % (17.8 cm); 3 k: 0.05 MB per part, worst error 14 % (56.2 cm). At 0.5 m/mm it is 47 × 47 × 81 m with a 4 m thick wall.
- **In Livistone:** not in the town yet

### Ice Pendant
<a id="ice"></a>*single body · 2020 · Parametric (by) nature (RJW 2021)* · website: **Ice Pendant** (sure)

Polygonal cocoon for a rock-crystal tip; `+1ice` (Jul 6 2020).

- **Latest:** `04_PARAM 2020/ice/+1ice.stl` — 589 k triangles, 33.9 × 35.4 × 30.0 mm, 29 MB, 2020-07-06
- *Earlier:* 3 files — earlier (2020-06-27 → 2020-07-06)
- **Reduction, measured** (error vs wire radius, at 1 mm = 0.5 m): 30 k: 0.54 MB per part, worst error 13 % (2.9 cm); 10 k: 0.18 MB per part, worst error 28 % (6.1 cm); 3 k: 0.05 MB per part, worst error 62 % (13.8 cm). The thinnest wire of the candidates (0.44 mm radius): give it about 60 k triangles.
- **In Livistone:** Photo poster in Ministry of Energy

### Wormy Ring / Red Wormy Little Apple
<a id="wormy"></a>*single body · 2020* · website: **Wormy Ring** (probable)

`viermele` = little worms. The `vierme_cati` form (34.5 × 26.9 × 18.6 mm) is the latest.

- **Latest:** `04_PARAM 2020/viermele/+vierme_cati.stl` — 307 k triangles, 34.5 × 26.9 × 18.6 mm, 15 MB, 2020-07-03
- *Earlier:* 5 files — earlier `perla3` series (Jan-Feb 2020) (2020-01-06 → 2020-07-03)
- **In Livistone:** Timeface/archive collection (photo)

### Woven Wedding Rings (Brancovenesc)
<a id="woven"></a>*pair · 2020* · website: **Woven Wedding Rings** (sure)

Woven-pattern gold wedding rings (private commission). The pair did not advance together: `EA` stops at version 3 (Feb 24), `EL` continues to 4 (May 26).

| Part | Latest file | Triangles | Size (mm) | Saved |
| --- | --- | ---: | ---: | --- |
| ring EA (she), 3rd version | `04_PARAM 2020/woven series/+WOVENEA3.stl` | 212 k | 18.0 × 18.0 × 4.0 | 2020-02-24 |
| ring EL (he), 4th version | `04_PARAM 2020/woven series/+WOVENEL4.stl` | 308 k | 22.6 × 22.7 × 4.3 | 2020-05-26 |

- *Earlier:* 13 files — earlier versions and `0woven` (2020-01-28 → 2020-05-26)
- **In Livistone:** not in the town yet

### Merlusca (denisa) Ring
<a id="merlusca-denisa"></a>*single body · 2020* · website: **Merlusca (denisa) Ring** (sure)

Custom-order adaptation of Merlusca. `perla_d1` and `perla_denisa` are byte-identical.

- **Latest:** `04_PARAM 2020/perla denisa/+perla_d1.stl` — 660 k triangles, 20.4 × 24.0 × 13.2 mm, 33 MB, 2020-05-18
- *Earlier:* 3 files — earlier (2020-05-03 → 2020-05-18)
- **In Livistone:** not in the town yet

### Peas in Pod Ring
<a id="peas"></a>*single body · 2020* · website: **Peas in Pod Ring** (sure)

Housing for loose jade beads; `+peas` (May 8 2020).

- **Latest:** `04_PARAM 2020/peas in pod/+peas.stl` — 258 k triangles, 31.3 × 24.5 × 13.0 mm, 13 MB, 2020-05-08
- *Earlier:* 2 files — earlier (2020-05-01 → 2020-05-08)
- **In Livistone:** Timeface/archive collection (photo)

### The Link Pin (MNAR "Inspira-scara")
<a id="the-link"></a>*single body · 2020 · The Link (MNAR 2020)* · website: **The Link Pin** (probable)

The National Museum of Art of Romania competition entry (staircase = `scara`). `uzate` = obsolete.

- **Latest:** `04_PARAM 2020/MNAR Inspira-scara/+scara-1.stl` — 153 k triangles, 19.9 × 19.5 × 20.3 mm, 8 MB, 2020-05-07
- *Earlier:* 3 files — worn-out (`uzate`) earlier forms (2020-03-07 → 2020-05-07)
- **In Livistone:** not in the town yet

### Ceartari Earrings
<a id="ceartari"></a>*pair · 2020 · Parametric (by) nature (RJW 2021)* · website: **Ceartari Earings** (sure)

Maple-seed earrings that also work as rings. `STG`/`DRP` = stânga/dreapta (left/right).

| Part | Latest file | Triangles | Size (mm) | Saved |
| --- | --- | ---: | ---: | --- |
| left `STG` | `04_PARAM 2020/ceartari/ceartar_STG.stl` | 153 k | 19.0 × 19.0 × 20.2 | 2020-05-01 |
| right `DRP` | `04_PARAM 2020/ceartari/ceartar_DRP.stl` | 153 k | 19.0 × 19.0 × 20.2 | 2020-05-01 |

- **In Livistone:** Photo poster in Ministry of Science

### Helix Wedding Rings
<a id="helix"></a>*pair · 2020* · website: **Helix Wedding Rings** (sure)

A wedding-ring pair (`EA`/`EL` = she/he). Private commission; keep out of the town.

| Part | Latest file | Triangles | Size (mm) | Saved |
| --- | --- | ---: | ---: | --- |
| ring EA (she) | `04_PARAM 2020/HELIX/+helixEA.stl` (+1 copy) | 70 k | 19.3 × 19.2 × 3.1 | 2020-02-28 |
| ring EL (he) | `04_PARAM 2020/HELIX/+helixEL.stl` (+1 copy) | 116 k | 20.4 × 20.2 × 4.4 | 2020-02-28 |

- **In Livistone:** not in the town yet

### Blooming Pins
<a id="blooming-pins"></a>*multi-part set · 2020* · website: **Blooming Pins** (sure)

Six pins: **peony** ×4 (`floare1mica`, `floare1+mica`, `floare1++mica`, `floare1+mare`) and **spiral** ×2 (`floare2mica`, `floare2mare`); `mica`/`mare` = small/large. Files `1.stl`…`6.stl` are the same six renamed (identical bounding boxes). All 5 Feb 2020. 12–18 mm wide.

| Part | Latest file | Triangles | Size (mm) | Saved |
| --- | --- | ---: | ---: | --- |
| peony pins `floare1…` (4 different pins) | `04_PARAM 2020/floare pin/` — `floare1++mica.stl`, `floare1+mare.stl`, `floare1+mica.stl`, `floare1mica.stl` | 113 k–213 k | 12–16 × 12–16 × 15–16 | 2020-02-05 |
| spiral pins `floare2…` (2 sizes) | `04_PARAM 2020/floare pin/` — `floare2mare.stl`, `floare2mica.stl` | 89 k–145 k | 12–18 × 12–18 × 16–16 | 2020-02-05 |

- *Earlier:* 6 files — numbered copies 1–6 (2020-02-05)
- **In Livistone:** not in the town yet

<a id="period-2019"></a>

## 2019

### Nucalong Pendant (from `sparanghel`)
<a id="nucalong"></a>*single body · 2018-24 · Beloved food (RJW 2024)* · website: **Nucalong Pendant** (sure)

The long curved nut pendant evolved from a brain-coral-like "asparagus" (`sparanghel1`, 14.9 M triangles, the single largest file) in Sep 2018 and was re-saved in March 2024 for RJW 2024.

| Part | Latest file | Triangles | Size (mm) | Saved |
| --- | --- | ---: | ---: | --- |
| pendant, newest (2024-03-06) | `03_PARAM 2019/pt ceramica/+nucalong.stl` | 165 k | 25.0 × 64.0 × 13.7 | 2024-03-06 |
| ancestor `sparanghel1` (asparagus, 745 MB) | `03_PARAM 2019/sparanghel/sparanghel1.stl` | 14.90 M | 21.1 × 55.4 × 13.7 | 2018-09-16 |

- *Earlier:* 2 files — 2018 form (2018-09-18)
- **In Livistone:** Photo poster in City Hall

### Beanut (Fasolaluna) Pendant
<a id="beanut"></a>*single body · 2019 · Parametric (by) nature (RJW 2021)* · website: **Beanut (fasolaluna) Pendant** (sure)

Folder `epiperen` (epidote + prehnite). 12.4 × 19.5 × 67.4 mm.

- **Latest:** `03_PARAM 2019/epiperen/fasolaluna+.stl` — 444 k triangles, 12.4 × 19.5 × 67.4 mm, 22 MB, 2019-12-11
- *Earlier:* 1 file — earlier (2019-12-11)
- **In Livistone:** Photo poster in Ministry of Science

### Peony Ring
<a id="peony-ring"></a>*single body · 2019* · website: **Peony Ring** (sure)

All six saves on 2019-12-08.

- **Latest:** `03_PARAM 2019/peony ring/peony ring2+.stl` — 221 k triangles, 24.1 × 21.9 × 12.1 mm, 11 MB, 2019-12-08
- *Earlier:* 5 files — earlier (2019-12-08)
- **In Livistone:** not in the town yet

### Art Nouveau Ring (amethyst)
<a id="art-nouveau-ring"></a>*single body · 2019 · Earlier explorations* · website: **Art Nouveau Ring** (probable)

`inelam` = inel ametist (amethyst ring), the matching set to the Pretzel earrings. Latest `inelam1+` (Oct 31 2019).

- **Latest:** `03_PARAM 2019/cercel covrig/last/inelam1+.stl` — 220 k triangles, 21.8 × 19.4 × 12.4 mm, 11 MB, 2019-10-31
- *Earlier:* 3 files — earlier (2019-10-31)
- **In Livistone:** Timeface/archive collection (photo)

### Pretzel Earrings
<a id="pretzel"></a>*pair · 2019* · website: **Pretzel Earings** (sure)

`covrig` = pretzel. The author left the final pair in a folder literally called `last`. Each earring holds two amethyst cabochons.

| Part | Latest file | Triangles | Size (mm) | Saved |
| --- | --- | ---: | ---: | --- |
| right (`dreapta`) – folder `last` | `03_PARAM 2019/cercel covrig/last/+1cercel dreapta.stl` | 327 k | 10.4 × 28.4 × 27.7 | 2019-10-23 |
| left (`stanga`) – folder `last` | `03_PARAM 2019/cercel covrig/last/1+cercel stanga.stl` | 330 k | 10.5 × 28.4 × 27.8 | 2019-10-23 |

- *Earlier:* 21 files — earlier saves (3 generations Aug 20–Oct 23 2019) (2019-08-20 → 2019-10-23)
- **In Livistone:** not in the town yet

### War and Peace Ring
<a id="war-and-peace"></a>*single body · 2019* · website: **War and Peace Ring** (sure)

Folder `labradorit`. Three-finger labradorite ring, 35.6 × 28.8 × 18.5 mm.

- **Latest:** `03_PARAM 2019/labradorit/labradorit+++.stl` — 377 k triangles, 35.6 × 28.8 × 18.5 mm, 19 MB, 2019-08-21
- *Earlier:* 3 files — earlier (2019-08-20 → 2019-08-21)
- **In Livistone:** not in the town yet

### Dewdrop Ring
<a id="dewdrop"></a>*single body · 2019* · website: **Dewdrop Ring** (sure)

Swiss blue topaz ring. Eight saves in 7 hours (Jul 17–18); `+trimis` ("sent") is the one that went to casting, `swiss blue2` was saved 13 minutes later.

| Part | Latest file | Triangles | Size (mm) | Saved |
| --- | --- | ---: | ---: | --- |
| ring, newest (`swiss blue2`) | `03_PARAM 2019/swiss blue/swiss blue2.stl` | 213 k | 23.6 × 19.3 × 12.2 | 2019-07-18 |
| the file sent for casting `+trimis` | `03_PARAM 2019/swiss blue/swiss blue+trimis.stl` | 209 k | 23.5 × 19.2 × 12.1 | 2019-07-18 |

- *Earlier:* 6 files — other saves (2019-07-17 → 2019-07-18)
- **In Livistone:** Dewdrop garden stand (lake)

### Engagement Ring (sapphire series, private)
<a id="engagement-2019"></a>*single body · 2019 · (private commission)* · website: **Engagement Ring** (probable)

`logodna` = engagement, `safir` = sapphire. 13 saves May 12–27 2019 (heavy outliers: `+++safir` 571 k tris). Private commission – not for the town.

- **Latest:** `03_PARAM 2019/logodna 2/New folder/safir.stl` — 33 k triangles, 15.1 × 22.8 × 18.8 mm, 9 MB, 2019-05-27
- *Earlier:* 1 file — numbered series to `++5safir` (May 17) (2019-05-17)
- *Earlier:* 11 files — other saves (2019-05-12 → 2019-05-17)
- **In Livistone:** not in the town yet

### Wrap Ring
<a id="wrap"></a>*single body · 2019* · website: **Wrap Ring** (sure)

One file (May 6 2019).

- **Latest:** `03_PARAM 2019/wrap/wrap.stl` — 169 k triangles, 18.8 × 23.8 × 10.5 mm, 8 MB, 2019-05-06
- **In Livistone:** not in the town yet

### Roots Ring
<a id="roots"></a>*single body · 2019* · website: **Roots Ring** (sure)

`ciopercute` = little mushrooms; the same base as the Mushroom Ring with a different algorithm.

- **Latest:** `03_PARAM 2019/roots/ciopercute.stl` — 213 k triangles, 25.5 × 21.2 × 15.5 mm, 11 MB, 2019-04-06 (+1 identical copy)
- **In Livistone:** not in the town yet

### The Eye Pendant
<a id="the-eye"></a>*single body · 2019* · website: **The Eye Pendant** (sure)

Concentric-ring dished eye, 39.6 × 26.7 × 11.5 mm.

- **Latest:** `03_PARAM 2019/the eye/the eye.stl` — 379 k triangles, 39.6 × 26.7 × 11.5 mm, 19 MB, 2019-04-06
- **In Livistone:** not in the town yet

### Greentooth Ring
<a id="greentooth"></a>*single body · 2019* · website: **Greentooth Ring** (sure)

One file (Feb 21 2019). Script-generated flower edge protecting a peridot.

- **Latest:** `03_PARAM 2019/greentooth/greentooth.stl` — 350 k triangles, 23.9 × 13.0 × 27.1 mm, 18 MB, 2019-02-21
- **In Livistone:** not in the town yet

### Mr Bean Masca Pendant
<a id="mr-bean-masca"></a>*multi-part set · 2019* · website: **Mr Bean Masca Pendant** (sure)

Custom order, the largest cast ever made by the artist (≈ 7 cm, 120 g); model built by script from a client image. `masca` = mask, 30 files, several above 100 MB (up to 243 MB, 4.8 M tris). `USED/` holds 5, 6 and 7 cm scalings. Private commission.

Paths in this table are inside `03_PARAM 2019/masca/`.

| Part | Latest file | Triangles | Size (mm) | Saved |
| --- | --- | ---: | ---: | --- |
| mask body, newest (Jan 25) | `+5.stl` | 3.01 M | 54.4 × 68.7 × 13.2 | 2019-01-25 |
| fastening `prindere` | `3-PRINDEREA.stl` | 14 k | 21.1 × 20.5 × 7.8 | 2019-01-22 |
| mask + fastening combined | `3- COMBINATE.stl` | 4.86 M | 84.5 × 20.5 × 54.6 | 2019-01-22 |

- *Earlier:* 29 files — earlier saves and size studies (`USED/`: 5/6/7 cm) (2019-01-03 → 2019-01-25)
- **In Livistone:** not in the town yet

<a id="period-2018"></a>

## 2017–2018 — the first parametric rings and earrings

### Colour Window Spring Edition Ring
<a id="colour-window"></a>*single body · 2018-19* · website: **Colour Window Spring Edition Ring** (sure)

Four saves Dec 29 2018 – Jan 7 2019.

- **Latest:** `02_PARAM 2018/color window/colour window1++.stl` — 526 k triangles, 18.3 × 24.4 × 23.7 mm, 26 MB, 2019-01-07
- *Earlier:* 3 files — earlier (2018-12-29 → 2019-01-07)
- **In Livistone:** not in the town yet

### Florine Ring
<a id="florine"></a>*single body · 2018* · website: **Florine Ring** (sure)

First square ring, shaped for an octahedral fluorite crystal (3.7 k triangles).

- **Latest:** `02_PARAM 2018/florine/florine.stl` — 4 k triangles, 34.0 × 16.1 × 19.7 mm, 184 kB, 2018-12-31
- **In Livistone:** not in the town yet

### Splash Pendant
<a id="splash"></a>*single body · 2018 · Parametric (by) nature (RJW 2021)* · website: **Splash Pendant** (sure)

Dec 22 2018, 24.4 × 23.9 × 35.4 mm; the website dates the piece 2019.

- **Latest:** `02_PARAM 2018/splash/splash.stl` — 398 k triangles, 24.4 × 23.9 × 35.4 mm, 20 MB, 2018-12-22
- **In Livistone:** Photo poster in Ministry of Energy

### Black pearl ring ("perla neagra")
<a id="black-pearl"></a>*single body · 2018* · not on the website

Open ring of two overlapping loops with a peg for a pearl (19 × 26 × 7 mm, 131 k tris). A second pearl-fixing study; not matched to a named work. The latest file carries a client's first name.

- **Latest:** `02_PARAM 2018/perla neagra/perla neagra mariana.stl` — 130 k triangles, 19.3 × 26.4 × 7.0 mm, 7 MB, 2018-12-22
- *Earlier:* 1 file — first save (2018-11-25)
- **In Livistone:** not in the town yet

### Pearl Earrings
<a id="pearl-earrings"></a>*single body · 2018* · website: **Pearl Earrings** (probable)

12.4 × 14.2 × 52.5 mm; a finer pearl fixture.

- **Latest:** `02_PARAM 2018/cercel perla/cercel perla.stl` — 243 k triangles, 12.4 × 14.2 × 52.5 mm, 12 MB, 2018-11-25
- **In Livistone:** not in the town yet

### Art Nouveau Earrings
<a id="art-nouveau-earrings"></a>*single body · 2018* · website: **Art Nouveau Earings** (guess)

Nov 24 2018, 962 k tris, a fine wire-spray around two stones. Match by date and shape only.

- **Latest:** `02_PARAM 2018/cerceii+.stl/cerceii+.stl` — 962 k triangles, 17.5 × 25.0 × 32.1 mm, 48 MB, 2018-11-24
- **In Livistone:** not in the town yet

### Vera Ring
<a id="vera"></a>*single body · 2018* · website: **Vera Ring** (sure)

Voronoi-polygon open ring adapted from the First Ring (1.4 k triangles, low poly). Custom order; file saved Nov 24 2018.

- **Latest:** `02_PARAM 2018/vera2+.stl/vera2+.stl` — 1 k triangles, 23.6 × 20.4 × 19.1 mm, 70 kB, 2018-11-24
- **In Livistone:** not in the town yet

### First Ring (probable: `inel_propriu_test4livia`)
<a id="first-ring"></a>*single body · 2018 · Earlier explorations* · website: **First Ring** (guess)

"ring own test for Livia": a 23.7 × 22 × 16.5 mm open ring of variable-height polygons, the exact recipe the website gives for the First Ring. Saved the same day as `vera2+`. Match is by shape and description only.

- **Latest:** `02_PARAM 2018/inel_propriu_test4livia.stl/inel_propriu_test4livia.stl` — 990 triangles, 23.7 × 22.0 × 16.5 mm, 50 kB, 2018-11-24
- **In Livistone:** First Ring photo in the Timeface archive collection

### Daggers earrings (cercel2)
<a id="daggers-earrings"></a>*single body · 2018* · website: **Daggers Earings** (guess)

Long looped-wire earring with a teardrop terminal (52.6 × 31.4 × 10.7 mm). Eight saves Sep 8 – Oct 10 2018. The match to "Daggers" is by shape only.

- **Latest:** `02_PARAM 2018/cercel2/cercel2+1.stl` — 340 k triangles, 52.6 × 31.4 × 10.7 mm, 17 MB, 2018-10-10
- *Earlier:* 7 files — earlier saves (incl. `cercel2trimis`, the file sent) (2018-09-08 → 2018-09-11)
- **In Livistone:** not in the town yet

### Nut sphere (`nucasfera`)
<a id="nucasfera"></a>*single body · 2018 · (precursor study)* · not on the website

Sep 24 2018, 31 × 31 × 50 mm. A walnut-textured sphere with a bail; a distant sibling of the Nut of Power but the Nut of Power itself has no STL here.

- **Latest:** `03_PARAM 2019/sparanghel/nucasfera.stl` — 302 k triangles, 30.9 × 31.1 × 50.2 mm, 15 MB, 2018-09-24 (+1 identical copy)
- **In Livistone:** not in the town yet

### Little Trumpet / second cabochon series
<a id="little-trumpet"></a>*single body · 2018* · website: **The Little Trumpet Ring** (guess)

"cabochon2" (Aug 16–22 2018): a ring whose open loops end in a trumpet-like cup. Matched to the Little Trumpet Ring by shape and date only.

- **Latest:** `02_PARAM 2018/cabochon2/c2+3+.stl` — 16 k triangles, 20.8 × 25.9 × 19.4 mm, 4 MB, 2018-08-22
- *Earlier:* 7 files — earlier saves (2018-08-16 → 2018-08-22)
- **In Livistone:** not in the town yet

### Cabochon Ring
<a id="cabochon"></a>*single body · 2018* · website: **Cabochon Ring** (probable)

Adaptive ring that opens by pressing; flared cup holds the cabochon. Ten saves May 27–Jun 15 2018 (`cab+` is a 108 MB, 2.2 M-triangle outlier). The folder also holds `kings college cambridge.gh/.3dm` (Jun 2018), an early version of the King's College idea that returns in the 2021 King's Chapel ring.

- **Latest:** `02_PARAM 2018/cabouchon/cab7.stl` — 71 k triangles, 28.7 × 19.2 × 16.0 mm, 4 MB, 2018-06-15
- *Earlier:* 9 files — earlier saves (2018-05-27 → 2018-06-14)
- **In Livistone:** not in the town yet

### "bila capat" bulb
<a id="cap-sphere"></a>*single body · 2018* · not on the website

A 14 mm perforated organic ball (30 k tris); likely the end cap of another piece.

- **Latest:** `02_PARAM 2018/bila capat/capat.stl` — 30 k triangles, 14.1 × 13.3 × 13.1 mm, 2 MB, 2018-05-27
- **In Livistone:** not in the town yet

### Engagement Ring 2 (2018 series, private)
<a id="engagement-2018"></a>*single body · 2018 · (private commission)* · website: **Engagement Ring 2** (probable)

`logodna` = engagement. 21 saves Mar 21 – May 16 2018, incl. gold-casting forms (`aur`) and a 153 MB first export. Private commission – not for the town.

- **Latest:** `02_PARAM 2018/logodna/LOGODNA FINAL.stl` — 339 k triangles, 25.8 × 22.0 × 8.0 mm, 17 MB, 2018-05-16
- *Earlier:* 20 files — other saves (round, elliptic, gold, fire, burgiu) (2018-03-21 → 2018-05-05)
- **In Livistone:** not in the town yet

### Moldavian Vault Ring
<a id="moldavian-vault"></a>*single body · 2018 · Earlier explorations* · website: **Moldavian Vault Ring** (sure)

`bolta moldoveneasca` = Moldavian vault. The folder also holds `logodna eliptic.stl`, a copy of an engagement-ring file.

- **Latest:** `02_PARAM 2018/bolta moldov/bolta moldoveneasca+.stl` — 19 k triangles, 21.2 × 11.1 × 25.0 mm, 944 kB, 2018-05-05
- *Earlier:* 3 files — earlier (2018-04-28 → 2018-05-05)
- **In Livistone:** Timeface/archive collection (photo)

### Mushroom Ring
<a id="mushroom-ring"></a>*single body · 2018* · website: **Mushroom Ring** (sure)

Shimeji mushrooms from Voronoi cell centres: 21 saves over Mar 3–10 2018 (`shimeji9+`: 130 MB ASCII). Final form is a hexagonal band with mushroom caps.

- **Latest:** `02_PARAM 2018/shimeji/shimeji17.stl` — 448 k triangles, 25.3 × 23.5 × 12.5 mm, 22 MB, 2018-03-10
- *Earlier:* 20 files — earlier saves (2018-03-03 → 2018-03-10)
- **In Livistone:** not in the town yet

### Interchangeable Flower Pendant
<a id="interchangeable-flower"></a>*multi-part set · 2018* · website: **Interchangable Flower Pendant** (sure)

January–March 2018, among the earliest parametric work. The flower is assembled from a **cup**, a central **motif**, several **petals** and **balls**. The perforated (`gaurire`) set in `02 GAURIRE/trimise` ("sent", Feb 9–11 2018) is the final; `archive(1)` repeats it on Mar 6. The cup was never perforated (last revised Jan 5).

Paths in this table are inside `02_PARAM 2018/floare/`.

| Part | Latest file | Triangles | Size (mm) | Saved |
| --- | --- | ---: | ---: | --- |
| cup `floare-cupa` / `cupa` | `New folder/floare-cupa.stl` | 49 k | 31.3 × 31.9 × 23.3 | 2018-01-05 |
| motif with holes `mot cu gauri` | `02 GAURIRE/trimise/mot cu gauri.stl` | 35 k | 12.8 × 12.9 × 31.5 | 2018-02-10 |
| petal with holes `petala cu gauri` | `02 GAURIRE/trimise/petala cu gauri.stl` | 3 k | 11.2 × 11.2 × 18.6 | 2018-02-11 |
| reduced ball `bila redusa` | `02 GAURIRE/trimise/bila redusa.stl` | 7 k | 10.0 × 10.0 × 7.4 | 2018-02-09 |

- *Earlier:* 58 files — earlier versions (`FINAL 1/2/3`, `01 INITIALE`, `02 GAURIRE`, `archive(1)`) (2018-01-05 → 2018-03-06)
- **In Livistone:** not in the town yet

### Merlusca Ring
<a id="merlusca"></a>*single body · 2017* · website: **Merlusca Ring** (sure)

Pearl + mollusc ring; 18 saves Nov 10 – Dec 7 2017 (`perla4`: 391 MB, 7.8 M triangles).

- **Latest:** `02_PARAM 2018/perla/perla12.stl` — 625 k triangles, 21.3 × 24.1 × 15.2 mm, 31 MB, 2017-12-07
- *Earlier:* 17 files — earlier saves (2017-11-10 → 2017-12-07)
- **In Livistone:** not in the town yet

### Cheesecake Pendant
<a id="cheesecake"></a>*single body · 2017* · website: **Cheesecacke Pendant** (sure)

`pandantiv` = pendant; six saves Oct 31 – Nov 2 2017, the **oldest files in the archive**. Flat 35 mm disc with a perforated edge.

- **Latest:** `02_PARAM 2018/cheesecake/pandantiv6.stl` — 14 k triangles, 35.5 × 35.5 × 3.7 mm, 713 kB, 2017-11-02
- *Earlier:* 5 files — earlier (2017-10-31 → 2017-11-02)
- **In Livistone:** not in the town yet

### Wedding Rings 2018 (private)
<a id="wedding-2018"></a>*pair · 2018 · (private commission)* · website: **Weddiing Rings** (probable)

Custom wedding rings (14 kt gold, bronze trials). 20 files Apr–Aug 2018; the last pair is `D.stl`/`M+.stl` (Aug 16). Private – not for the town.

| Part | Latest file | Triangles | Size (mm) | Saved |
| --- | --- | ---: | ---: | --- |
| final pair `D` / `M+` (Aug 16) | `02_PARAM 2018/wedding/` — `D.stl`, `M+.stl` | 16 k–21 k | 21–22 × 21–22 × 5–7 | 2018-08-16 |

- *Earlier:* 18 files — other trials `w1…w6`, `wd`, `wm`, `denis`, `mateea` (2018-04-22 → 2018-08-16)
- **In Livistone:** not in the town yet

<a id="period-S"></a>

## Studies, reliefs, commissions and third-party models

### Frog scan (third party)
<a id="frog-scan"></a>*third-party model · 2025* · not on the website

KIRIScene scan export (`3DModel` and `3DModel_LowPoly` are byte-identical, 10.9 k triangles) in an arbitrary unit system, not millimetres (0.38 × 0.15 × 0.12 units). Reference only.

- **Latest:** `09.PARAM 2025/frog/220bc66b80bf4f8ca60ee6cf50ccfba1/3DModel.stl` — 11 k triangles, 0.38 × 0.15 × 0.12 scan units (not mm), 3 MB, 2025-05-27 (+1 identical copy)
- **In Livistone:** not in the town yet

### Portrait relief medallions (ea / el / ea-fiica)
<a id="family-medallions"></a>*study · 2021 · (private commission)* · not on the website

Oval height-map reliefs (≈ 30 × 46 × 5.5 mm) derived from photographs, a set for one family (`ea` = she, `el` = he, `ea-fiica` = she + daughter). Private; keep out of the town.

- **Latest:** `05_PARAM 2021/01.poze/+ea-fiica.stl` — 1.23 M triangles, 33.7 × 44.4 × 5.8 mm, 62 MB, 2021-11-22
- **In Livistone:** not in the town yet

### Spine (vertebrae C1–L5, sacrum)
<a id="spine"></a>*third-party model · 2017-18* · not on the website

Downloaded anatomical models (a CT-research spine and a "vertebrae and disks" set); individual vertebrae are 1.7–4.3 k triangles. Source model for the `vertebre` form studies. Third-party – check licences before any use.

| Part | Latest file | Triangles | Size (mm) | Saved |
| --- | --- | ---: | ---: | --- |
| vertebra set `C1…L5`, `T1…T12`, `SACRUM` | `02_PARAM 2018/coloana/` — 27 files (e.g. `C1.stl`) | 2 k–50 k | 29–114 × 25–86 × 14–135 | 2018-10-28 |
| whole-spine scans | `02_PARAM 2018/coloana/Spine Part - Copy.STL` | 1.93 M | 104.8 × 587.6 × 136.4 | 2018-10-28 |

- **In Livistone:** not in the town yet

### Relief dishes: BOB, CUCUTENI, GOLESTI (2017)
<a id="tag-reliefs"></a>*study · 2017 · (early experiments)* · not on the website

November 2017. Heavily detailed relief dishes (1.3–2 M triangles): an oval bowl (`BOB`), a round dish with spiral relief (`CUCUTENI`, after the Neolithic culture) and a low-poly house (`GOLESTI`). `+` here marks a **rescaled** copy (×0.5 or ×0.65), not a repair. `golesti++.stl` is an empty file.

Paths in this table are inside `02_PARAM 2018/tag2/`.

| Part | Latest file | Triangles | Size (mm) | Saved |
| --- | --- | ---: | ---: | --- |
| BOB | `BOB/bob+.stl` | 1.47 M | 30.4 × 46.8 × 18.4 | 2017-11-24 |
| CUCUTENI | `CUCUTENI/cucteni++.stl` | 1.30 M | 36.0 × 36.0 × 18.0 | 2017-11-24 |
| GOLESTI | `golestii/golesti+.stl` | 2.01 M | 23.0 × 62.9 × 24.7 | 2017-11-24 |

- **In Livistone:** not in the town yet

### Vertebra / tooth form studies ("pt ceramica")
<a id="vertebre-ceramics"></a>*study · 2018 · (ceramics studies)* · not on the website

Organic bone- and tooth-shaped solids (`masea` = molar, `canin`, `incisiv`, `ciob` = shard, `frunza` = leaf, `ghioaga` = club, `solz` = scale, `pestle`) with perforations, all exported on 2018-11-18 and copied into `pt ceramica` ("for ceramics"). 100 – 136 MB ASCII files. Not jewelry; sculptural references.

| Part | Latest file | Triangles | Size (mm) | Saved |
| --- | --- | ---: | ---: | --- |
| studies (30 files, 2018-11-18) | `02_PARAM 2018/vertebre/` — 29 files (e.g. `13holes.stl`) | 11 k–499 k | 30–102 × 35–99 × 23–105 | 2018-11-18 |

- **In Livistone:** not in the town yet

## Website works with no STL here

26 of the website's 97 works have no STL in this export. Some may exist only as Rhino or Grasshopper files, as photographs, or in an earlier export; this page does not look further, since the brief was to ignore files that are not listed as works.

- **Romanian Jewelry Week 2026 — A world for everyone:** Berrynova Ring; Hollywood Pendant; Timeface Pendant; Rotary Magnetic Ring (only its 2020 ancestor, the `rotary` set, is here)
- **RJW 2025 — It's just a cell life:** Nut of Power Pendant; The Dark Nut of Power Pendant; Embryo Ring (the website gives Embryo and Mitoring the same size and materials; `+3mito.stl` is the only 3.2 × 2.2 cm model, so the two names may share one file)
- **RJW 2024 — Beloved food:** Bubinga Heart Pendant; Ammonite Ring; The Nest Ring
- **RJW 2023 — Survival:** Amberbow Ring; Ludisia Ring; Toxic Ring
- **Earlier and other works:** Blooming Ring; Bracelet Extension; Brancovenesc Wedding Rings (probably the pair listed as Woven Wedding Rings, whose text says it is named Brancovenesc); Cafe Au Lait Ring; Cat Wire Ring; Dream Catcher Pendant; Horn Earings; Mirror Ring; Mountain Earings; Red Wormy Little Apple Ring (adapted from Wormy; probably `viermele/+vierme_cati.stl`, Jul 2020); Star Earings; Tulip Ring; Vita (b)orum Pendant

The consequence for the town: the City Hall (Nut of Power) and the Embryo Station ring are built from photographs, as before, and no STL here would replace that. Timeface Tower (a gallery, not the pendant) and the Nest, Toxic and Ludisia exhibits have nothing to import either.

## Heaviest files

Latest files above 50 MB. All are far beyond what a browser should download; each needs decimation, strand extraction or a procedural stand-in, and several have a lighter sibling.

| File | Size | Triangles | Work | Lighter alternative |
| --- | ---: | ---: | --- | --- |
| `03_PARAM 2019/sparanghel/sparanghel1.stl` | 745 MB | 14.90 M | Nucalong Pendant (from `sparanghel`) | `+nucalong.stl` (165 k) is the pendant; this file is its ancestor |
| `eye of winter/+EOW-base.stl` | 513 MB | 10.26 M | Eye of Winter Double Ring and Pendant | `+EOW-complex half.stl` (681 k) and `simple half` (409 k) are the covers; the base has no light form |
| `complete/+deepsea (3).stl` | 483 MB | 9.66 M | Deep Sea Pearl (Karmazina) Ring | `09.PARAM 2025/deepsea/deepsea (2).stl` (245 k) |
| `03_PARAM 2019/masca/3- COMBINATE.stl` | 243 MB | 4.86 M | Mr Bean Masca Pendant | — |
| `07.PARAM 2023/trofeu/000-used/3dprinted/trofeu_print-20230822T195419Z-001/trofeu_print/trofeu complet.stl` | 172 MB | 3.43 M | IESF trophy (mountain + crystal, ~60 cm) | `trofeu cu de toate.stl` (6 k, the whole trophy in low poly) |
| `07.PARAM 2023/trofeu/000-used/3dprinted/trofeu_print-20230822T195419Z-001/trofeu_print/baza_print.stl` | 166 MB | 3.32 M | IESF trophy (mountain + crystal, ~60 cm) | `trofeu cu de toate.stl` (6 k, the whole trophy in low poly) |
| `03_PARAM 2019/masca/+5.stl` | 151 MB | 3.01 M | Mr Bean Masca Pendant | — |
| `cloud agate/+emerald stilness1.stl` | 128 MB | 2.56 M | Emerald Stillness (STL spelling `stilness`) | `+1emerald stilness1.stl` (382 k) |
| `complete/bila cu extra suporti.stl` | 112 MB | 2.25 M | Nanot of Power (Nanot Pendant) | already reduced to strands (`src/world/strands/nanot.json`) |
| `complete/bila.stl` | 112 MB | 2.25 M | Nanot of Power (Nanot Pendant) | already reduced to strands (`src/world/strands/nanot.json`) |
| `02_PARAM 2018/tag2/golestii/golesti+.stl` | 101 MB | 2.01 M | Relief dishes: BOB, CUCUTENI, GOLESTI (2017) | — |
| `04_PARAM 2020/cylinder/hard data.stl` | 99 MB | 1.98 M | Hardata / cylinder | — |
| `02_PARAM 2018/coloana/Spine Part - Copy.STL` | 97 MB | 1.93 M | Spine (vertebrae C1–L5, sacrum) | — |
| `to be sent/STL_IANUARIE/+NANOTICS2.stl` | 91 MB | 1.83 M | Nanot of Power (Nanot Pendant) | already reduced to strands (`src/world/strands/nanot.json`) |
| `02_PARAM 2018/tag2/BOB/bob+.stl` | 73 MB | 1.47 M | Relief dishes: BOB, CUCUTENI, GOLESTI (2017) | — |
| `cloud agate/+complex cloud agate1.stl` | 71 MB | 1.42 M | Cloud Agate | the plain grade, `basic cloud agate1.stl` (44 k) |
| `cloud agate/+complex cloud agate2.stl` | 70 MB | 1.40 M | Cloud Agate | the plain grade, `basic cloud agate1.stl` (44 k) |
| `02_PARAM 2018/tag2/CUCUTENI/cucteni++.stl` | 65 MB | 1.30 M | Relief dishes: BOB, CUCUTENI, GOLESTI (2017) | — |
| `to be sent/osmium/whitedwarf/+whitedwarf.stl` | 64 MB | 1.27 M | White Dwarf Pendant | — |
| `05_PARAM 2021/01.poze/+ea-fiica.stl` | 62 MB | 1.23 M | Portrait relief medallions (ea / el / ea-fiica) | — |
| `05_PARAM 2021/king college/+king college.stl` | 57 MB | 1.14 M | King's Chapel Double Ring | — |

## Livistone: what is used, what could be

### Already derived from this archive

- **Mitoring** (`+3mito.stl`) and **Nanot** (`bila.stl`) became wire centrelines (80 and 378 strands) in `src/world/strands/`, rebuilt in code as cast-silver ribbons around the Ministry of Energy and Ministry of Science. The extractor script is lost; the parameters (voxel size 0.6 and 0.9 units, max degree 14) are recorded in the [model notes](../concepts/02-jewelry-models/notes.md).
- **Photographs** of 41 works hang in the halls, the station, the lake garden stands, Timeface Tower and Future House ([src/game/jewelry-catalogue.json](../src/game/jewelry-catalogue.json), [archive-catalogue.json](../src/game/archive-catalogue.json)). STLs exist here for 27 of those 41 (two of the 27 matches are only probable); the other 14 are in the list above, apart from the camel.
- The **King's Chapel gateway** follows the approved ring concept (`concepts/07-bridge-monument/`) and was drawn from photographs; `+king college.stl` (1.14 M triangles) is the 3D source if the arch ever needs refining.
- Not from this archive: the Enhancement hill (its own Voronoi STL in `data/enhancement/`) and the glucose pavilion (PDB 1TRZ).

### Three ways a piece can enter the town

1. **Strand extraction** — for thin, looped, wire-like pieces: voxelise, thin to centrelines, ship a few hundred polylines, rebuild as ribbons. This is how the two ministries work and it keeps the download tiny. Good matches among the latest files (they are tubes or wire cages): Deep Sea Pearl, Switch, Moldavite, 2securea, the Hexa family and Lines, Tilia and piramid, Wrap, The Eye, the Daggers/cercel2 earring and the little-trumpet ring. The extractor has to be rewritten first.
2. **Decimated mesh** — works for almost every piece, wire cages included: measured with the town's own `meshoptimizer`, 30 k triangles stay within about 6 % of the wire radius for 90 % of the latest bodies, and 10 k within 14 % (see the [inclusion analysis](jewelry-stl-inclusion-analysis.md)). Reduce offline, store as GLB, load as its own lazy chunk like the Enhancement crystals, and push matching `ColliderSpec`s by hand. The catch is the print leftovers (supports, debris, duplicate faces), not the density.
3. **Architecture inspired by the piece** — as for City Hall and the station: take the structural idea (an interchangeable cover, a rotor in a frame, a cup of petals), build it in code, keep to the three device profiles, and label the story as Livistone fiction, separate from the artist's own text.

Whatever the route, the existing rules apply: create everything in `Town.create`, give walkable geometry a collider, reserve planting clearance in `landscape.ts`, add a mobile and a CPU path, and check the cost with `bun scripts/frame-budget.ts` before merging.

### Candidates (ideas, not decisions)

The last column gives measured decimation results (worst error as a percentage of the wire radius; full method and tables in the [inclusion analysis](jewelry-stl-inclusion-analysis.md#7-numbers-for-the-best-candidates)).

| Piece | Files | Why it might suit the town | Watch out for | Measured |
| --- | --- | --- | --- | --- |
| [Deep Sea Pearl (Karmazina)](#deep-sea-pearl) | `deepsea (2).stl`, 245 k | Tube loops fanning round a pearl; the RJW 2026 text speaks of a bubble "in the depths of a lake" — a natural pavilion for the Vittoria Lake garden. Wire-like, so the strand route fits. | The 9.7 M-triangle file is unusable; Future House already shows its photograph. | 10 k = 0.18 MB, 9 % |
| [Eye of Winter](#eye-of-winter) | base + two covers + screw | A looped base that takes two different honeycomb half-shell covers and a screw: one building, two variants (two covers on one plinth, or a day/night switch). | 10 M-triangle base; use the half-shells (0.4–0.7 M) or a procedural base. | base + half + screw: 22 k at 10 k each, 12 % |
| [Spiral dome](#spere-dome) | `+sperecels2-1.stl`, 485 k | Hemispherical shell wound with ribs, a spire on top: a ready-made observatory or lookout silhouette. | Unlisted work with no artist text, so its story would be pure Livistone fiction and must be labelled so. | 10 k = 0.18 MB, 5 % |
| [Hexa / not so hexa](#hexa) | base + top pairs, 0.8 M | Spiral-ribbed dome on a ring plus a small band-and-pins top: a ready pavilion roof structure. | Four generations of the same idea: pick one (`complete/` holds the author's final). | 10 k = 0.18 MB, 12 % |
| [IESF trophy](#iesf-trophy) | 6 k-triangle assemblies | The only sculpture already low-poly (a 60 cm mountain, eight blades and a crystal): a plaza monument with almost no processing. | Apparently a commission for another organisation, not a jewelry piece: ask first. | already 6 k; the 3.3 M base is solid and reduces freely |
| [Hardata](#cylinder-stick) | `hard data.stl`, 2 M | A 16 cm noise-textured hollow cylinder that won the Hyper Form open call; a tower or lighthouse that would sit well next to Glucose Commons. | Heavy; reading it as "hard data" is the author's title, not a claim about GlucoseDAO. | 10 k = 0.18 MB, 4 % |
| [Mushroom Ring](#mushroom-ring), [Funghi series](#funghi), [Mycelium](#mycelium) | 0.45 M, 4 rings, 0.36 M | More crown shapes for the Mycelium grove (today drawn from photographs): hexagonal band with conical caps, four distinct fungal rings. | Caps here are trumpets, not the folded silver crowns the grove is built on. | Mycelium: 10 k = 0.18 MB, 14 %; the Mushroom and Funghi meshes need cleanup first |
| [Rotary](#rotary), [La Navette](#la-navette), [Sticks and Stones](#sticks-and-stones), [Eyelense](#eyelense) | parts and screws | Real mechanisms (a rotor in a frame, a free-swinging stone, threaded faces) are the only pieces whose parts could animate: turning gates, hinged doors, a rotating gallery panel. | Needs animation and per-part colliders; only the 2020 ancestor of Rotary Magnetic is here. | La Navette: 4 parts at 10 k = 40 k triangles, 3 % (frame) |
| [Interchangeable Flower](#interchangeable-flower) | cup, motif, petals, balls | A perforated Voronoi cup (49 k) plus petals and balls: a modular fountain bowl or pergola in the garden. | 2018 early work, lowest priority. | cup is 49 k; 30 k is within 1 % |
| [King's Chapel ring](#kings-chapel) | `+king college.stl`, 1.14 M | Direct source for refining the gateway arch. | The current arch is approved and based on photographs. | 10 k = 18 %, but 5,270 non-manifold edges |
| [Cloud Agate](#cloud-agate), [Emerald Stillness](#emerald-stilness), [Thunderstone](#thunderstone), [Moldavite](#moldavit) | September, May, July 2026 | The newest work, with parts, left/right pairs and several grades of detail. | Not on the website yet: wait for publication or ask. | Cloud Agate: 10 k = 4 %; Moldavite 10 k = 7 % |

### Bringing a piece in

1. Pick the latest file(s) from the entry, not the folder, and copy only those into `data/models/` (git-ignored). Check the work's tier in the [inclusion analysis](jewelry-stl-inclusion-analysis.md) first. Note the source path, date and SHA-256 in the commit message or the model notes.
2. Check scale (millimetres), orientation and mesh health before anything else; open the Rhino/Grasshopper source if the STL is too dense or has defects.
3. Produce the derivative offline (strands, decimated GLB or a procedural stand-in) and keep the STL out of the build.
4. Add a section to [concepts/](../concepts/) or the model notes in the existing style, update [README.md](../README.md) and the agent docs if behaviour changes, and run `bun run build`, `bun run test` and, for world changes, `bun run test:browser`.

## Check before use

- **Private commissions.** Wedding rings (Helix, Woven, the 2018 pair), the engagement rings (2018 and 2019 series), the family portrait medallions, the Mr Bean mask, the Merlusca (denisa) and Vera rings and the client-sized Bubble re-save were made for individuals. Several filenames carry first names; they are deliberately not repeated here. Keep them out of the town, and out of public screenshots, unless the owner agrees.
- **Commissions and competitions.** The IESF trophy appears to be made for another organisation (the folder is named IESF; the website does not mention it). The 2021 trophy design has no recorded client. Hardata won the Hyper Form open call in Timișoara (2021), so credit and permissions rest with the artist and the organisers.
- **Third-party models.** The spine set (a CT-research dataset and a "vertebrae and disks" download), the Baroque flute head (`2head.STL`) and the frog scan (KIRIScene export) are not the artist's own geometry and have no licence recorded here.
- **Unpublished work.** Everything dated 2026 outside RJW 2026 (Cloud Agate, Emerald Stillness, Thunderstone, Moldavite) and the Osmium contest set (the collection did not reach the finalist stage) has no public page yet.
- **Lore versus fiction.** Livistone's rule applies: artist descriptions and source facts stay separate from invented Livistone stories, and no piece's fictional power is a health or efficacy claim.

## How the numbers were produced

- Triangle counts and bounding boxes were read straight from the files: the 80-byte header and triangle count for binary STLs (653 files), a vertex scan for ASCII STLs (41 files, up to 137 MB). Two files did not read cleanly: `golesti++.stl` is empty, and `Spine_-_vertebrae_and_disks/files/vertebre.stl` is a Meshmixer binary whose header count does not match its length (no triangle count recorded).
- Duplicates were found by hashing the size plus the first, middle and last megabyte of each file (51 files duplicate another). Dates are file modification times, to the second.
- Matching to website works used the artist's site export (`pieces.md` in the sibling `livia` repository, 97 works excluding the two Untold stage entries), the exhibition documents in the Drive folder (RJW 2025 and 2026 texts, the Osmium contest form), file names, dates and published dimensions. Unlisted pieces were identified by rendering the latest file and looking at it; the renders are not part of the repository.
- The grouping into works and the choice of what to call a part were made by hand and exist only on this page. When new files arrive, add them in the right period section and re-check "latest" by timestamp.
- Snapshot: the Drive export as found on 3 October 2026 (the `drive-folder` copy in `Downloads`); the website snapshot is whatever the `livia` repository held that day.
