from pathlib import Path
import json, math, hashlib
src=Path('output/testing/human-base.obj');vertices=[];groups={};group=''
for line in src.read_text().splitlines():
 if line.startswith('v '): vertices.append(list(map(float,line.split()[1:4])))
 elif line.startswith('g '): group=line[2:];groups.setdefault(group,[])
 elif line.startswith('f '): groups[group].append([int(s.split('/')[0])-1 for s in line.split()[1:]])
def center(g):
 ids=set(i for f in groups[g] for i in f)
 return [sum(vertices[i][a] for i in ids)/len(ids) for a in range(3)]
def smooth(t):
 t=max(0,min(1,t));return t*t*(3-2*t)
def sub(a,b):return [x-y for x,y in zip(a,b)]
def norm(a):
 n=math.sqrt(sum(x*x for x in a));return [x/n for x in a]
def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def rotate(p,pivot,a,b,w):
 a=norm(a);b=norm(b);axis=norm(cross(a,b));angle=math.acos(max(-1,min(1,sum(x*y for x,y in zip(a,b)))))*w
 c=math.cos(angle);s=math.sin(angle);q=sub(p,pivot);k=cross(axis,q);d=sum(x*y for x,y in zip(axis,q))
 return [pivot[i]+q[i]*c+k[i]*s+axis[i]*d*(1-c) for i in range(3)]
shoulder=center('joint-l-shoulder');elbow=center('joint-l-elbow');hand=center('joint-l-hand');upper=sub(elbow,shoulder);fore=sub(hand,elbow)
ids=sorted(set(i for f in groups['body'] for i in f));mapping={old:i for i,old in enumerate(ids)};positions=[]
for i in ids:
 p=vertices[i][:];side=1 if p[0]>=0 else -1;p[0]=abs(p[0]);x,y=p[:2]
 p=rotate(p,elbow,fore,upper,smooth((x-2.75)/.7)*smooth(y))
 # Only arm/shoulder vertices rotate; pelvis stays untouched. Hands have full influence regardless of height.
 weight=smooth(y)*smooth((x-1.15)/.95)*max(smooth((y-2.5)/1.7),smooth((x-2.1)/.65))
 p=rotate(p,shoulder,upper,[1,0,0],weight);p[0]*=side
 positions.extend([round(p[0]*.48,4),round((p[1]+8.168)*.48,4),round(p[2]*.48,4)])
indices=[]
for f in groups['body']:
 for j in range(1,len(f)-1):indices.extend([mapping[f[0]],mapping[f[j]],mapping[f[j+1]]])
Path('src/world/models/enhancement-human.json').write_text(json.dumps({'source':'MakeHuman hm08 CC0 body, arms posed outward','sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'positions':positions,'indices':indices},separators=(',',':')))
