import bpy, math
from mathutils import Vector
root=bpy.data.objects['ASSET_keeper'];scene=bpy.context.scene
for name in ['MESH_Skin_Warm','MESH_Hair_Dark']:bpy.data.objects.remove(bpy.data.objects[name],do_unlink=True)
skin=bpy.data.materials['Skin_Warm'];hair=bpy.data.materials['Hair_Dark']
def mesh(name,vs,fs,mat):
 m=bpy.data.meshes.new(name);m.from_pydata(vs,[],fs);m.update();o=bpy.data.objects.new(name,m);scene.collection.objects.link(o);o.parent=root;o.data.materials.append(mat)
 for p in m.polygons:p.use_smooth=True
 return o
# Adult jaw/cheek/temple contour, sculpted continuous cross-section head.
vs=[];rings=[(.864,.034,.038),(.885,.049,.052),(.918,.069,.060),(.96,.071,.061),(.996,.068,.057),(1.025,.048,.04),(1.044,.012,.012)]
for z,w,d in rings:
 for i in range(20):
  a=2*math.pi*i/20;y=d*math.sin(a)
  # Broad frontal plane avoids a spherical mannequin head.
  if y<0:y=-d*(abs(math.sin(a))**.35)
  vs.append((w*math.cos(a),y,z))
fs=[tuple(range(19,-1,-1))]
for j in range(len(rings)-1):
 for i in range(20):fs.append((j*20+i,j*20+(i+1)%20,(j+1)*20+(i+1)%20,(j+1)*20+i))
fs.append(tuple((len(rings)-1)*20+i for i in range(20)));mesh('HERO_adult_head',vs,fs,skin)
# Small triangular nose bridge rather than rounded cartoon bulb.
mesh('PRP_nose',[(-.01,-.059,.956),(.01,-.059,.956),(0,-.076,.932),(-.01,-.063,.927),(.01,-.063,.927)],[(0,1,2),(0,2,3),(1,4,2),(2,4,3)],skin)
for s in [-1,1]:
 bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,radius=1,location=(s*.07,0,.943));o=bpy.context.object;o.name='PRP_ear';o.scale=(.01,.019,.027);o.parent=root;o.data.materials.append(skin)
bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=.032,depth=.09,location=(0,0,.84));o=bpy.context.object;o.name='PRP_neck';o.parent=root;o.data.materials.append(skin)
# Fitted short hair cap follows temples; no separate eyes at pinball scale.
vs=[]
for z,w,d in [(1.0,.069,.058),(1.024,.051,.043),(1.047,.009,.009)]:
 for i in range(20):a=2*math.pi*i/20;vs.append((w*math.cos(a),d*math.sin(a)+.003,z))
fs=[]
for j in range(2):
 for i in range(20):fs.append((j*20+i,j*20+(i+1)%20,(j+1)*20+(i+1)%20,(j+1)*20+i))
fs.append(tuple(40+i for i in range(20)));mesh('PRP_close_cropped_hair',vs,fs,hair)
# Apply all current bevel modifiers before material consolidation to avoid beveling future joins.
for o in list(root.children):
 if o.type!='MESH':continue
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if not o.data.uv_layers:
  bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(island_margin=.02);bpy.ops.object.mode_set(mode='OBJECT')
for mat in [skin,hair]:
 group=[o for o in root.children if o.type=='MESH' and o.data.materials[0]==mat]
 bpy.ops.object.select_all(action='DESELECT')
 for o in group:o.select_set(True)
 bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join();group[0].name='MESH_'+mat.name
p=artifacts.file(name='keeper-preview.png',media_type='image/png');scene.render.filepath=str(p.path);bpy.ops.render.render(write_still=True);p.publish();result={'refinement':'Adult jaw/cheek/temple contour and subtle facial planes'}
