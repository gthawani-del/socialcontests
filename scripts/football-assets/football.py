# ASSET and common.py are prepended before hosted execution.
white=material('Panel_Ivory',(.88,.89,.85),.55);black=material('Panel_Black',(.015,.021,.026),.58)
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1);ico=bpy.context.object;verts=[v.co.copy() for v in ico.data.vertices];faces=[list(p.vertices) for p in ico.data.polygons];bpy.data.objects.remove(ico,do_unlink=True)
neighbors={i:set() for i in range(len(verts))}
for f in faces:
 for i in range(3):neighbors[f[i]].update([f[(i+1)%3],f[(i+2)%3]])
panels=[]
for i,ns in neighbors.items():
 n=verts[i].normalized();u=n.cross(Vector((0,0,1)))
 if u.length<.1:u=n.cross(Vector((0,1,0)))
 u.normalize();v=n.cross(u)
 ps=[(verts[i]*2+verts[j])/3 for j in ns];ps.sort(key=lambda p:math.atan2(p.dot(v),p.dot(u)));panels.append((ps,black))
for a,b,c in faces:panels.append(([(verts[a]*2+verts[b])/3,(verts[b]*2+verts[a])/3,(verts[b]*2+verts[c])/3,(verts[c]*2+verts[b])/3,(verts[c]*2+verts[a])/3,(verts[a]*2+verts[c])/3],white))
for idx,(ps,mat) in enumerate(panels):
 center=sum(ps,Vector())/len(ps);vs=[tuple(center.normalized()*.13)];n=len(ps)
 for t in [.5,.985]:
  for p in ps:vs.append(tuple((center+(p-center)*t).normalized()*.13))
 fs=[]
 for i in range(n):fs.extend([(0,1+i,1+(i+1)%n),(1+i,1+n+i,1+n+(i+1)%n,1+(i+1)%n)])
 mesh('HERO_panel_%02d'%idx,vs,fs,mat,True)
sphere('PRP_seam_core',(0,0,0),(.12,.12,.12),black)
root['collider']='sphere radius 0.13m';result=finish((0,0,0),.46,(.4,-.5,.3))
