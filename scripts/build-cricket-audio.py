"""Original procedural effects: no samples, external licences or runtime API calls."""
import numpy as np, wave
from pathlib import Path
rng=np.random.default_rng(1709);rate=24000;out=Path('public/audio/cricket');out.mkdir(parents=True,exist_ok=True)
def save(name,x):
 x=np.tanh(x);x=x/max(1,np.max(np.abs(x)))*.8
 with wave.open(str(out/(name+'.wav')),'wb') as f:
  f.setnchannels(1);f.setsampwidth(2);f.setframerate(rate);f.writeframes((x*32767).astype('<i2').tobytes())
def impact(duration,freqs,decay):
 t=np.arange(int(rate*duration))/rate;n=rng.normal(0,1,len(t))
 x=n*.22*np.exp(-t*90)
 for f,a in freqs:x+=a*np.sin(2*np.pi*f*t)*np.exp(-t*decay)
 return x
save('bat',impact(.23,[(180,.6),(510,.35),(970,.16)],30))
save('flipper',impact(.10,[(130,.5),(1800,.15)],55))
save('rail',impact(.24,[(1450,.4),(2270,.18),(3150,.08)],23))
t=np.arange(int(rate*.5))/rate
save('launch',rng.normal(0,.14,len(t))*np.exp(-t*10)+.35*np.sin(2*np.pi*(400*t+400*t*t))*np.exp(-t*14))
x=np.zeros(int(rate*.55))
for delay in [0,.055,.14]:
 y=impact(.3,[(310,.5),(730,.27),(1390,.13)],22);i=int(delay*rate);x[i:i+len(y)]+=y
save('wicket',x)
# Layered applause: individual irregular claps with distant resonant crowd texture.
t=np.arange(rate*4)/rate;x=np.zeros(len(t))
for i in range(145):
 at=int(rng.uniform(0,3.7)*rate);n=int(rate*.08);tt=np.arange(n)/rate
 x[at:at+n]+=rng.normal(0,.07,n)*np.exp(-tt*rng.uniform(45,80))
for i in range(32):
 f=rng.uniform(140,430);x+=.007*np.sin(2*np.pi*f*t+np.sin(t*rng.uniform(2,6)))*(.5+.5*np.sin(t*rng.uniform(1,4)))
x*=np.minimum(t*3,1)*np.minimum((4-t)*2,1)
save('crowd',x*2)
