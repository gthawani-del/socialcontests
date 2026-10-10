"""Convert CC0 source recordings to the bundled mobile sound pack.
Usage: python scripts/build-cricket-audio.py SOURCE_DIRECTORY
Extract Kenney Impact Sounds into SOURCE_DIRECTORY, and save qubodup's
Well Done recording there as applause.ogg. See public/audio/cricket/README.md.
"""
import subprocess,sys
from pathlib import Path
root=Path(sys.argv[1]);out=Path('public/audio/cricket')
samples={'bat':('impactPlank_medium_000',.55),'flipper':('impactMetal_light_002',.25),
 'rail':('impactGeneric_light_002',.25),'launch':('impactMetal_light_004',.3),
 'wicket':('impactWood_medium_000',.5)}
for name,(source,level) in samples.items():
 p=root/'Audio'/(source+'.ogg')
 subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(p),'-af',f'lowpass=f=4500,volume={level},afade=t=out:st=0.3:d=0.15','-t','0.45','-ar','24000','-ac','1','-c:a','pcm_s16le',str(out/(name+'.wav'))],check=True)
subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(root/'applause.ogg'),'-af','lowpass=f=5500,volume=0.4,afade=t=in:d=0.15,afade=t=out:st=2.4:d=0.6','-t','3','-ar','24000','-ac','1','-c:a','pcm_s16le',str(out/'crowd.wav')],check=True)
