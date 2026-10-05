"""Inspect the rendered film, including temporal motion and synchronized source audio."""
import json
from pathlib import Path
import re
import subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
VIDEO = ROOT / 'artifacts/promo/moment-water-promo-v3.mp4'
QA = ROOT / 'tmp/promo-qa-v3'
DOCS = ROOT / 'docs/promo-video-2026-10-05/revision-3'
QA.mkdir(parents=True, exist_ok=True)
DOCS.mkdir(parents=True, exist_ok=True)
shots = json.loads((HERE / 'src/timeline.json').read_text(encoding='utf-8'))
seconds=max(s['from']+s['duration'] for s in shots)/30
primary_durations={s['id']:(shots[i+1]['from']-s['from'])/30 for i,s in enumerate(shots[:-1])}
assert all(4 <= primary_durations[name] <= 5 for name in ['snow','cloud'])

def ff(*args):
    return subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-threads','1',*map(str,args)],check=True,stdout=subprocess.PIPE).stdout

probe = json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(VIDEO)]))
v = next(s for s in probe['streams'] if s['codec_type']=='video')
a = next(s for s in probe['streams'] if s['codec_type']=='audio')
assert (v['width'],v['height'],v['r_frame_rate']) == (1080,1440,'30/1')
assert abs(float(probe['format']['duration'])-seconds)<.1
assert v['codec_name']=='h264' and a['codec_name']=='aac'
font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',20)
sheet = Image.new('RGB',(990,1440),'#102923')
draw = ImageDraw.Draw(sheet)
checked=[]
for i,s in enumerate(shots):
    # First, peak and tail frame, plus a stable middle frame for the overview.
    frames = sorted(set([s['from']+10,s['from']+round(s['duration']*.5),s['from']+s['duration']-24]))
    for f in frames:
        p=QA/f'f{f:04d}.png'
        ff('-ss',f/30,'-i',VIDEO,'-frames:v',1,p)
        im=Image.open(p).convert('RGB')
        # All bottom 25% content must stay near the flat background (codec tolerance).
        roi=np.asarray(im)[1090:]
        assert np.max(np.std(roi.astype(float),axis=(0,1)))<1.1, f'Bottom safe area disturbed f{f}'
        checked.append(f)
    f=frames[len(frames)//2]
    im=Image.open(QA/f'f{f:04d}.png').convert('RGB').resize((324,432))
    x=(i%3)*330;y=(i//3)*480
    sheet.paste(im,(x,y+36))
    draw.text((x+8,y+7),f"{s['label']} · {f/30:.1f}s",font=font,fill='#e6ead6')
sheet.save(DOCS/'contact-sheet.jpg',quality=93)

hold=[]
for sec in [47,49]:
    pixels=ff('-ss',sec,'-i',VIDEO,'-frames:v',1,'-vf','crop=920:465:80:420','-f','rawvideo','-pix_fmt','gray','pipe:1')
    hold.append(np.frombuffer(pixels,dtype=np.uint8).astype(float))
ending_difference=float(np.mean(abs(hold[0]-hold[1])))
assert ending_difference<1.2, 'Ending screenshots should hold without water interaction'

raw=ff('-i',VIDEO,'-vf','crop=850:600:115:405,scale=170:120,fps=2','-f','rawvideo','-pix_fmt','gray','pipe:1')
imgs=np.frombuffer(raw,dtype=np.uint8).reshape(-1,120,170).astype(float)
delta=np.mean(abs(np.diff(imgs,axis=0)),axis=(1,2))
motion={}
for s in shots:
    if s['id']=='end':
        motion[s['id']]={'intent':'Three real screenshots hold after a gentle entrance; no water-interaction video.'}
        continue
    start=int(s['from']/30*2)+2;end=int((s['from']+s['duration'])/30*2)-2
    d=delta[start:max(start+1,end)]
    motion[s['id']]={'mean_half_second_pixel_change':round(float(d.mean()),3),'min':round(float(d.min()),3)}
    assert float(d.max())>.5, f'No motion in {s["id"]}'

pcm=np.frombuffer(ff('-i',VIDEO,'-vn','-ar',48000,'-ac',2,'-f','f32le','pipe:1'),dtype='<f4').reshape(-1,2)
peak=float(np.max(abs(pcm)))
assert peak<.98, 'Audio clipping'
# Compare final AAC against the exact scheduled PCM mix; a local lag scan detects container offset.
expected=np.zeros((round(seconds*48000),2),dtype=np.float32)
for s in shots:
    signal=np.frombuffer(ff('-i',HERE/'public/audio'/f"{s['id']}.wav",'-f','f32le','pipe:1'),dtype='<f4').reshape(-1,2)
    start=round(s['from']/30*48000);n=min(len(signal),len(expected)-start)
    expected[start:start+n]+=signal[:n]
lags=[]
for sec in [10,19,30,37,42,47]:
    start=sec*48000; reference=expected[start:start+24000,0]
    scores=[]
    for lag in range(-2400,2401,8):
        sample=pcm[start+lag:start+lag+24000,0]
        scores.append(float(np.dot(sample,reference)/(np.linalg.norm(sample)*np.linalg.norm(reference)+1e-12)))
    j=int(np.argmax(scores));lag=-2400+j*8
    lags.append({'at_seconds':sec,'lag_samples':lag,'lag_frames':round(lag/1600,3),'correlation':round(scores[j],5)})
    assert abs(lag)<=800, f'Audio offset exceeds half frame: {lag}'
report={'duration_seconds':float(probe['format']['duration']),'dimensions':[1080,1440],'fps':30,'bytes':VIDEO.stat().st_size,
        'primary_durations_seconds':primary_durations,'ending_hold_pixel_difference':round(ending_difference,4),
        'video_codec':v['codec_name'],'audio_codec':a['codec_name'],'sample_rate':a['sample_rate'],
        'checked_frames':checked,'motion':motion,'peak_dbfs':round(20*np.log10(peak+1e-12),2),
        'rms_dbfs':round(float(20*np.log10(np.sqrt(np.mean(pcm**2))+1e-12)),2),'audio_sync_probes':lags,
        'bottom_safe_area':'y >= 1090 remains flat; no essential content below y=1081',
        'all_checks_passed':True}
(DOCS/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
