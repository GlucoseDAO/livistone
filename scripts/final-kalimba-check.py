import sys,json,subprocess
from pathlib import Path
sys.path.insert(0,str(Path('output/audio-tools').resolve()))
from faster_whisper import WhisperModel
from faster_whisper.audio import decode_audio
from faster_whisper.vad import get_speech_timestamps,VadOptions
import imageio_ffmpeg
rows=json.loads(Path('output/audio-review/candidates.json').read_text());result=[]
model=WhisperModel('small',device='cpu',compute_type='int8',cpu_threads=4,download_root='output/audio-models',local_files_only=True)
for row in rows:
 start=round(row['start']+27,3);duration=58;out=Path('output/audio-review')/(row['id']+'.m4a')
 subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-hide_banner','-loglevel','error','-y','-ss',str(start),'-i',str(Path(r'C:\Users\liv\Downloads')/row['source']),'-t',str(duration),'-vn','-ac','2','-ar','44100','-af','loudnorm=I=-22:TP=-3:LRA=9,afade=t=in:d=4,afade=t=out:st=54:d=4','-c:a','aac','-b:a','96k','-movflags','+faststart',str(out)],check=True)
 audio=decode_audio(str(out));vad=get_speech_timestamps(audio,VadOptions(threshold=.03,min_speech_duration_ms=64,min_silence_duration_ms=100,speech_pad_ms=1000))
 item={'id':row['id'],'source':row['source'],'source_sha256':row['source_sha256'],'start':start,'duration':duration,'sensitive_vad':vad,'checks':{}}
 print('ENCODED',row['id'],'VAD',vad,flush=True)
 for language in ['en','ro']:
  segments,info=model.transcribe(audio,language=language,beam_size=1,vad_filter=False,condition_on_previous_text=False,temperature=0,max_new_tokens=64)
  item['checks'][language]=[{'start':s.start,'end':s.end,'text':s.text,'no_speech_prob':s.no_speech_prob,'avg_logprob':s.avg_logprob} for s in segments]
  print(row['id'],language,json.dumps(item['checks'][language]),flush=True)
 result.append(item);Path('output/audio-review/final-screening.json').write_text(json.dumps(result,indent=2))
