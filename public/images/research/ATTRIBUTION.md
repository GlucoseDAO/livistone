# Glucose Commons source images

Provided by the project owner in the Google Drive folder:
https://drive.google.com/drive/folders/1yRQlA4vkeTHwVFzbLx2WphQGPMnaMutV

Read on 23 September 2026 through the connected Google Drive account.

## Original artwork

`Livia_Zaharia_poster.pdf`, in the POSTERS subfolder:
https://drive.google.com/file/d/1lzwvasgtLLSQ7X4qh5xixGZRhWFZVcLu/view

Title: **Predicting glucose, personalizing models**. Romanian AI Days, 18–19 September 2026, Politehnica Bucharest. Livia Zaharia and collaborators, credited in the full original poster. The original is retained in the user's Drive; the downloaded working copy is in ignored `output/testing/research-sources/`.

Source PDF SHA-256: `029430b3819ff87fc7b5e9b84eda9039e9890824386c5c01c1db98a0ce552540`. `scripts/extract-research.py` checks that hash before rendering and cropping with pypdfium2/Pillow.

The WebP images are direct page renders and rectangular extracts, without redrawn plots, generated imagery or altered results:

- `original-poster.webp`: complete page.
- `cgm.webp`: What’s a CGM? / illustrative traces / Why forecast glucose?
- `architecture.webp`: SugarJEPA architecture and its caption.
- `benchmarks.webp`: global holdout benchmarks and preliminary 120-minute forecasts.
- `personalisation.webp`: personalisation plots and source caption.
- `sugar-sugar.webp`: game invitation, QR code, recruitment snapshot and study details.
- `inputs.webp`: insulin and meal input ablation chart and caption.

Research results remain attributed to their authors. The source poster identifies limitations and the need for prospective validation. Recruitment data are dated 5 September 2026.

## Text source

The folder's **glucose text** document supplies the SugarGenie / Sugar-Sugar descriptions:
https://docs.google.com/document/d/1BILbcqv7yr4_gb3Plmm5Q9FiPMVUzjpsyFXTnP2hgb8/edit

Chapter descriptions paraphrase that document and the inspected original poster. Existing insulin PDB 1TRZ and glucose GLC geometry retains its separate molecular provenance in `data/molecules/`.

## Original presentation slides

**12 Predicting Glucose Before It Happens_Glucose_DAO_2026**:
https://docs.google.com/presentation/d/1SrdHJ4IVZIFiRDoj3VDkZFOp5AtTET_kvtZsSyLrQmQ/edit

The deck was read and visually inspected, then exported as PDF from the supplied folder. SHA-256: `730059e4fafa7d1437a8ee528b2ade97aac05682496df3cb878330e8c7d2b446`. `slide-01`, `02`, `03`, `09`, `11`, `12`, `13`, `14`, `15`, and `16` are complete page renders, preserving original text, images and citations. No plots were redrawn. The authoring script is `scripts/extend-archive.py`.

These slides cover the talk introduction, CGM hardware, daily experience, curve research, GlucoseDAO context, API diagram, team, Sugar-Sugar, model results and collaboration invitation. Team and result statements are the deck's September 2026 snapshot; research comparisons are not independent clinical validation. Chapters retain the poster and document material alongside these slides.
