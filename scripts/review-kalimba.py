import sys,json,subprocess,os
from pathlib import Path
sys.path.insert(0,str(Path('output/audio-tools').resolve()))
os.environ['HF_HUB_DISABLE_SYMLINKS_WARNING']='1'
from faster_whisper import WhisperModel
from faster_whisper.audio import decode_audio
from faster_whisper.vad import get_speech_timestamps,VadOptions
import imageio_ffmpeg
rows=json.loads(Path('output/audio-review/vad.json').read_text());selected=[]
for i,row in enumerate(rows):
 intervals=[];last=5
 for r in row['voice_regions']:
  if r['start']-3>last:intervals.append((last,r['start']-3))
  last=max(last,r['end']+3)
 if row['duration']-5>last:intervals.append((last,row['duration']-5))
 a,b=max(intervals,key=lambda x:x[1]-x[0]);start=round((a+b)/2-45,3);duration=90
 source=Path(r'C:\Users\liv\Downloads')/row['file'];out=Path('output/audio-review')/f'kalimba-{i+1:02}.wav'
 subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-hide_banner','-loglevel','error','-y','-ss',str(start),'-i',str(source),'-t',str(duration),'-vn','-ac','1','-ar','16000',str(out)],check=True)
 audio=decode_audio(str(out));vad=get_speech_timestamps(audio,VadOptions(threshold=.03,min_speech_duration_ms=64,min_silence_duration_ms=100,speech_pad_ms=1000))
 item={'id':f'kalimba-{i+1:02}','source':row['file'],'source_sha256':row['sha256'],'start':start,'duration':duration,'sensitive_vad':vad};selected.append(item);print('CANDIDATE',json.dumps(item),flush=True)
Path('output/audio-review/candidates.json').write_text(json.dumps(selected,indent=2))
print('Loading multilingual Whisper small (local CPU)',flush=True)
model=WhisperModel('small',device='cpu',compute_type='int8',cpu_threads=4,download_root='output/audio-models')
for item in selected:
 path=Path('output/audio-review')/(item['id']+'.wav')
 segments,info=model.transcribe(str(path),beam_size=5,vad_filter=False,condition_on_previous_text=False,temperature=0)
 item['language']=info.language;item['segments']=[{'start':s.start,'end':s.end,'text':s.text,'no_speech_prob':s.no_speech_prob,'avg_logprob':s.avg_logprob} for s in segments]
 print('ASR',json.dumps(item),flush=True)
 Path('output/audio-review/candidates.json').write_text(json.dumps(selected,indent=2))
