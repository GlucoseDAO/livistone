import type { Discovery } from './content';
import type { ResearchFigure } from './research-art';

export interface ResearchSlide { title: string; body: string; figure?: ResearchFigure }

const KYIV = 'https://docs.google.com/presentation/d/1KJa-wgU9ljGFznFV_s3Cy3HhU2P870M5E9kuZA7T-xI/edit?usp=sharing';

/** Source-reviewed 22 September 2026. Public Kyiv 2026 slides replace the unread Drive folder. Talk claims about unpublished benchmarks are attributed, not verified here. */
export const RESEARCH_POSTERS: (Discovery & { slides: ResearchSlide[] })[] = [
  { id: 'glucose-livia', landmark: 'glucose', title: 'Why glucose matters', category: '01 / WHY IT MATTERS',
    body: 'The 2026 Kyiv talk “Predicting Glucose Before It Happens” (Health Intelligence Conference, Kyiv School of Economics) treats glucose dynamics as a signal for diabetes care and for longevity research. Livistone shows that argument as an exhibition. It does not diagnose, treat or predict a visitor’s glucose.',
    links: [{ label: 'Kyiv 2026 talk slides', url: KYIV }, { label: 'Centenarian CGM patterns · 10.3389/fnut.2022.955101', url: 'https://doi.org/10.3389/fnut.2022.955101' }, { label: 'Post-prandial glucose and cardiometabolic risk · 10.1016/j.metabol.2023.155640', url: 'https://doi.org/10.1016/j.metabol.2023.155640' }, { label: 'GlucoseDAO: why it matters', url: 'https://glucosedao.github.io/' }],
    slides: [
      { title: 'A curve, not a single number', figure: 'trace', body: 'The Kyiv talk asks what the shape of a glucose trace shows that one lab value cannot: time in range, meal peaks, and how jittery the line is from hour to hour. Those are research ways of reading a record. This pavilion does not turn them into advice for you.' },
      { title: 'Who the question concerns', figure: 'trace', body: 'GlucoseDAO’s public pages name people with diabetes and related conditions, people watching everyday health, and people reading longevity research. The talk cites published CGM work on centenarians and on post-prandial glucose. Those papers are the sources; market and cost slides in the deck are not independently verified here.' },
      { title: 'A personal curve', figure: 'cgm', body: '“Understanding your glucose values and dynamics is about self-knowledge.” For diabetes, the stated aim is staying in range and avoiding dangerous lows and highs. For health and longevity readers, the same pages talk about diet, lifestyle and glucose spikes. Those are project goals, not results claimed for a visitor of this town.' },
    ] },
  { id: 'glucose-format', landmark: 'glucose', title: 'How glucose is measured', category: '02 / HOW IT IS MEASURED',
    body: 'A fingerstick meter reads capillary blood at one moment. An A1C test averages roughly three months. A continuous glucose monitor samples interstitial fluid. The Kyiv talk describes typical CGMs as externally mounted sensors that report about every five minutes. GlucoseDAO’s cgm_format project then translates the different export files those sensors produce.',
    links: [{ label: 'Kyiv 2026 talk slides', url: KYIV }, { label: 'CGM executive summary (PMC9622212)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9622212/' }, { label: 'cgm_format repository', url: 'https://github.com/GlucoseDAO/cgm_format' }, { label: 'Data-processing repository', url: 'https://github.com/GlucoseDAO/glucose_data_processing' }],
    slides: [
      { title: 'Three common measurements', figure: 'cgm', body: 'Fingerstick blood glucose monitoring gives a capillary plasma reading at the time of the test. Laboratory A1C summarises average glucose over about three months. Neither shows the shape of the day: meals, exercise, sleep or night-time lows remain invisible between those points.' },
      { title: 'What a CGM actually reads', figure: 'cgm', body: 'The Kyiv talk describes a CGM as a small sensor worn on the body that reports interstitial glucose, typically every five minutes, day and night. That stream is still interstitial fluid, with its own lag and error, not a venous blood draw. Clinical summaries treat it as a way to see variability, not as a magic blood equivalent.' },
      { title: 'Files that do not agree', figure: 'network', body: 'Dexcom, FreeStyle Libre, Medtronic and Nightscout exports do not share one table. GlucoseDAO’s cgm_format library detects those vendor files and writes a unified CSV for machine learning. A companion processing repository prepares research datasets. The practical contribution is consistent inputs, not a clinical device.' },
    ] },
  { id: 'glucose-service', landmark: 'glucose', title: 'GlucoseDAO', category: '03 / GLUCOSEDAO',
    body: 'Livia Zaharia founded GlucoseDAO from lived type 1 diabetes and years of CGM traces. The Kyiv 2026 talk presents the public project and names Universitätsmedizin Rostock (IBIMA) as a scientific collaborator. Livistone does not collect readings or run a prediction service.',
    links: [{ label: 'Kyiv 2026 talk slides', url: KYIV }, { label: 'GlucoseDAO manifesto', url: 'https://glucosedao.github.io/' }, { label: 'Explore GlucoseDAO repositories', url: 'https://github.com/GlucoseDAO' }, { label: 'Livia’s GlucoseDAO page', url: 'https://livia.glucosedao.org/science-tech/glucosedao/' }],
    slides: [
      { title: 'From a personal record to a lab', figure: 'network', body: 'Livia describes herself as a type 1 diabetic since 2001 who saw the need for a pattern-reading model on long CGM records. The Kyiv talk places that work beside IBIMA Rostock. The team’s public mission is to join scientific rigor, machine learning and usable design — for diabetes and for wider metabolic questions.' },
      { title: 'What they are building', figure: 'forecast', body: 'Public components include Sugar-Sugar, a data-standardisation pipeline, transformer experiments, and a prediction-service sketch. The talk describes an encoder architecture (Sugar One) and a JEPA-style training idea. Those are research designs. This wall does not declare a clinical winner.' },
      { title: 'Open tools, not a clinic in town', figure: 'network', body: 'GlucoseDAO discusses shared open tools and models that can be fine-tuned on a person’s own data. Livistone is an exhibition of those public pages and the Kyiv slides. It has no backend, stores no glucose, and offers no treatment advice.' },
    ] },
  { id: 'glucose-game', landmark: 'glucose', title: 'Sugar-Sugar', category: '04 / HUMAN PREDICTION',
    body: 'Sugar-Sugar is a browser game: you see part of a CGM trace, draw how you think it continues, then compare your line with the hidden hour. The Kyiv talk notes an ethics clearance for that study. Accuracy is scored with ordinary forecasting metrics. This display does not claim that people or models have won.',
    links: [{ label: 'Kyiv 2026 talk slides', url: KYIV }, { label: 'Sugar-Sugar repository', url: 'https://github.com/GlucoseDAO/sugar-sugar' }],
    slides: [
      { title: 'Draw the next hour', figure: 'trace', body: 'You can upload a Dexcom, Libre, Medtronic or Nightscout file, or use a sample set. Click and drag to forecast the hidden continuation. The game then shows the real values beside your line. MAE, RMSE and MAPE describe closeness — research scores, not a health grade.' },
      { title: 'Why a human baseline', figure: 'forecast', body: 'The project’s stated reason is that there was no published human-baseline benchmark for CGM prediction. The Kyiv talk mentions ethical clearance for collecting those comparisons. The study question is how an informed person reads a trace, not a prize and not a treatment result.' },
    ] },
  { id: 'glucose-models', landmark: 'glucose', title: 'Learning possible futures', category: '05 / FORECASTING RESEARCH',
    body: 'The glucose-forecasting repository trains and evaluates several model families. The Kyiv talk describes Sugar One as an encoder transformer with cross-attention, and mentions JEPA-style training. Shared evaluation tools compare models with published baselines. This exhibition does not independently verify unpublished benchmark wins.',
    links: [{ label: 'Kyiv 2026 talk slides', url: KYIV }, { label: 'Forecasting repository and evaluations', url: 'https://github.com/GlucoseDAO/glucose-forecasting' }, { label: 'CGM metrics discussion · 10.1177/19322968221110830', url: 'https://doi.org/10.1177/19322968221110830' }],
    slides: [
      { title: 'More than one model family', figure: 'forecast', body: 'Public code brings several approaches under one evaluation roof. GluMind uses glucose with heart rate and steps. SugarOne uses glucose, insulin and carbohydrate inputs. The talk adds an encoder-transformer description. Different inputs answer different questions.' },
      { title: 'What a forecast is allowed to mean here', figure: 'trace', body: 'Short-term forecasts are discussed as research toward safer day-to-day decisions about insulin, carbohydrates, exercise and timing. The talk reports comparisons with published baselines; Livistone does not repeat those as verified clinical results. Numbers depend on the dataset and the split. They are not a reading of your sensor and not medical advice.' },
    ] },
  { id: 'glucose-molecule', landmark: 'glucose', title: 'A molecule becomes a place', category: '06 / INSULIN / PDB 1TRZ',
    body: 'The two overhead ribbons follow the alpha-carbon coordinates of human insulin chains A and B from PDB entry 1TRZ: 21 and 30 residues. Gold connectors mark its three disulfide bonds. The small side sculpture is alpha-D-glucopyranose (component GLC). They are different molecules.',
    links: [{ label: 'Human insulin structure · 1TRZ', url: 'https://www.rcsb.org/structure/1TRZ' }, { label: 'Alpha-D-glucopyranose · GLC', url: 'https://www.rcsb.org/ligand/GLC' }, { label: 'Kyiv 2026 talk slides', url: KYIV }],
    slides: [
      { title: 'Insulin overhead, glucose to the side', figure: 'insulin', body: 'Chain A has 21 residues, chain B 30. Three disulfide bonds are marked in gold. Scaling, supports and the open gallery are architectural inventions. Insulin is the hormone sculpture; it is not a glucose molecule writ large.' },
      { title: 'The smaller sugar', figure: 'glucose', body: 'The alcove graph uses the ideal heavy-atom coordinates of alpha-D-glucopyranose, component GLC — six carbons, six oxygens, hydrogens omitted. It sits off the through-route so the names stay separate: a sugar you can walk around, and an insulin fold you walk under.' },
    ] },
];
