import sys,json,hashlib
from pathlib import Path
sys.path.insert(0,str(Path('output/audio-tools').resolve()))
import av
from faster_whisper.audio import decode_audio
from faster_whisper.vad import get_speech_timestamps,VadOptions
results=[]
for i,p in enumerate(sorted(Path(r'C:\Users\liv\Downloads').glob('WhatsApp Audio 2026-09-23*.mp4'))):
 audio=decode_audio(str(p),sampling_rate=16000)
 chunks=get_speech_timestamps(audio,VadOptions(threshold=.12,min_speech_duration_ms=96,min_silence_duration_ms=200,speech_pad_ms=2000))
 row={'file':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'duration':len(audio)/16000,'voice_regions':[{'start':c['start']/16000,'end':c['end']/16000} for c in chunks]}
 results.append(row);print(json.dumps(row),flush=True)
 Path('output/audio-review/vad.json').write_text(json.dumps(results,indent=2))
