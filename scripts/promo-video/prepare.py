"""Prepare source excerpts without altering recordings. Requires ffmpeg/ffprobe."""
import hashlib
import argparse
import json
from pathlib import Path
import shutil
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
ORIGINALS = ROOT / 'assets-source/video'
PUBLIC = HERE / 'public'
SOURCES = {
    'water': ('D:/BaiduNetdiskDownload/飞书20261005-005412.mp4', 'water-interactions-recording.mp4'),
    'nature': ('D:/BaiduNetdiskDownload/飞书20261005-005420.mp4', 'snow-cloud-recording.mp4'),
}

def run(args):
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', *map(str, args)], check=True)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--audio-only', action='store_true')
    parser.add_argument('--shot', help='Prepare a single timeline shot')
    args = parser.parse_args()
    ORIGINALS.mkdir(parents=True, exist_ok=True)
    (PUBLIC / 'media').mkdir(parents=True, exist_ok=True)
    (PUBLIC / 'audio').mkdir(parents=True, exist_ok=True)
    (PUBLIC / 'frames').mkdir(parents=True, exist_ok=True)
    (PUBLIC / 'fonts').mkdir(parents=True, exist_ok=True)
    (PUBLIC / 'stills').mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT/'assets-source/fonts/lxgw-wenkai/LXGWWenKai-Regular.ttf', PUBLIC/'fonts/LXGWWenKai-Regular.ttf')
    manifest = []
    for key, (origin, name) in SOURCES.items():
        target = ORIGINALS / name
        if not target.exists():
            shutil.copy2(origin, target)
        manifest.append({'key':key, 'original':origin, 'preserved':str(target.relative_to(ROOT)),
                         'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
    shots = json.loads((HERE / 'src/timeline.json').read_text(encoding='utf-8'))
    for shot in shots:
        if args.shot and shot['id'] != args.shot:
            continue
        source = ORIGINALS / SOURCES[shot['source']][1]
        duration = shot['duration'] / 30
        # Whole real game viewport. The nature recording is two pixels wider;
        # remove only those pixels so both sources share the same portrait ratio.
        crop = 'crop=740:1080:0:0'
        if shot['id'] != 'end' and not args.audio_only:
            run(['-threads', '1', '-ss', shot['start'], '-i', source, '-t', duration,
                 '-vf', f'{crop},setpts=PTS-STARTPTS,setsar=1,fps=30:start_time=0', '-an',
                 '-c:v', 'libx264', '-threads', '2', '-preset', 'fast', '-crf', '17', '-pix_fmt', 'yuv420p', '-g', '1', '-bf', '0',
                 '-movflags', '+faststart', PUBLIC / 'media' / f"{shot['id']}.mp4"])
            # Full 30 fps render proxy, bypassing Windows compositor video seeking.
            frames = PUBLIC / 'frames' / shot['id']
            frames.mkdir(exist_ok=True)
            run(['-threads', '1', '-i', PUBLIC / 'media' / f"{shot['id']}.mp4",
                 '-q:v', '2', '-start_number', '0', frames / '%04d.jpg'])
        # Preserve synchronized source sound, with gentle complementary crossfades.
        fade_in = 1.0 if shot['id'] == 'calm' else .6
        fade_out = 2.4 if shot['id'] == 'end' else .6
        audio_source = ROOT / shot['audioFile'] if shot.get('audioFile') else source
        gain = shot.get('audioGainDb', 5)
        run(['-ss', shot['start'], '-i', audio_source, '-t', duration, '-vn',
             '-af', f'volume={gain}dB,afade=t=in:st=0:d={fade_in},afade=t=out:st={duration-fade_out}:d={fade_out}',
             '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', PUBLIC / 'audio' / f"{shot['id']}.wav"])
        print('Prepared', shot['id'], flush=True)
    for scene, source_key, time in [('water','water',19.8),('snow','nature',21),('cloud','nature',30.2)]:
        if args.audio_only:
            break
        run(['-threads','1','-ss',time,'-i',ORIGINALS/SOURCES[source_key][1],
             '-frames:v','1','-vf','crop=740:830:0:185','-q:v','2',PUBLIC/'stills'/f'{scene}.jpg'])
    (ORIGINALS / 'recordings-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')

if __name__ == '__main__':
    main()
