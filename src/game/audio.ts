import { RecordingPlayer } from './recording-player';
/** Only the six exact recordings listened to and approved by Livia. */
export const KALIMBA_TRACKS = ['01', '02', '03', '04', '05', '06'].map(id => `${import.meta.env.BASE_URL}audio/kalimba/kalimba-${id}.m4a`);
export class Ambience extends RecordingPlayer {
  constructor() { super(KALIMBA_TRACKS); }
  setGarden(_garden: boolean): void { /* The same quiet playlist throughout town. */ }
}
