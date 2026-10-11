import bpy, math
from mathutils import Vector
scene=bpy.context.scene;root=bpy.data.objects['ASSET_boot']
team=bpy.data.materials['Team_Primary'];sole=bpy.data.materials['Sole_Graphite'];silver=bpy.data.materials['Trim_Silver'];lace=bpy.data.materials['Laces_Ivory']
# Keep the proven pivot and playable outline; reconstruct the visible shoe construction.
for o in list(root.children):
 if o.name.startswith(('DETAIL_lace','DETAIL_fitted','HERO_ankle','HERO_padded')):bpy.data.objects.remove(o,do_unlink=True)
upper=bpy.data.objects['HERO_boot_upper']
bpy.ops.object.select_all(action='DESELECT');upper.select_set(True);bpy.context.view_layer.objects.active=upper
for mod in list(upper.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
# A real recessed ankle cavity, stopped above the outsole.
bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=1,depth=.5,location=(.165,0,.6));cutter=bpy.context.object;cutter.scale=(.112,.13,1)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
bpy.context.view_layer.objects.active=upper;mod=upper.modifiers.new('Ankle cavity','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)

def matcopy(name,source,color,rough):
 m=source.copy();m.name=name;n=m.node_tree.nodes.get('Principled BSDF');n.inputs['Base Color'].default_value=color;n.inputs['Metallic'].default_value=.12;n.inputs['Roughness'].default_value=rough;return m
lining=matcopy('Boot_Lining',sole,(.008,.012,.022,1),.88)
panel=matcopy('Boot_Panels',sole,(.022,.032,.049,1),.48)
seam=matcopy('Boot_Stitch',lace,(.36,.44,.52,1),.68)
def mesh(name,v,f,mat):
 d=bpy.data.meshes.new(name);d.from_pydata(v,[],f);d.update();o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.parent=root;o.data.materials.append(mat)
 for p in d.polygons:p.use_smooth=True
 return o

def tube(name,pts,r,mat):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=1;s=c.splines.new('POLY');s.points.add(len(pts)-1)
 for p,v in zip(s.points,pts):p.co=(*v,1)
 o=bpy.data.objects.new(name,c);scene.collection.objects.link(o);o.parent=root;o.data.materials.append(mat);return o
# Low padded collar with an actual dark inner wall, not a black disc.
v=[];n=48
for rx,ry,z in [(.117,.135,.535),(.103,.12,.526),(.098,.112,.36)]:
 for i in range(n):
  a=i*math.tau/n;v.append((.165+rx*math.cos(a),ry*math.sin(a),z-.025*math.cos(a)))
f=[]
for row in range(2):
 for i in range(n):f.append((row*n+i,row*n+(i+1)%n,(row+1)*n+(i+1)%n,(row+1)*n+i))
f.append(tuple(2*n+i for i in range(n)));mesh('HERO_recessed_collar_lining',v,f,lining)
tube('TRIM_collar_binding',v[:n]+[v[0]],.01,panel)
bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();host=upper.evaluated_get(deps)
def point(x,y,lift=.005):
 ok,loc,normal,index=host.ray_cast(Vector((x,y,2)),Vector((0,0,-1)))
 if not ok:raise ValueError('Detail outside upper: '+str((x,y)))
 return (x,y,loc.z+lift)
def ribbon(name,coords,halfwidth,mat):
 verts=[];cols=5
 for x,y in coords:
  for j in range(cols):verts.append(point(x,y-halfwidth+2*halfwidth*j/(cols-1),.012))
 faces=[]
 for i in range(len(coords)-1):
  for j in range(cols-1):
   q=i*cols+j;faces.append((q,q+cols,q+cols+1,q+1))
 return mesh(name,verts,faces,mat)
# Tongue and eyestay follow the upper exactly.
ribbon('KIT_tongue',[(.29+i*.022,0) for i in range(26)],.062,panel)
for side in [-1,1]:
 ribbon('KIT_eyestay',[(.30+i*.022,side*.084) for i in range(25)],.016,panel)
 for i in range(6):
  x=.33+i*.084;pos=point(x,side*.08,.009)
  ring=[(pos[0]+.013*math.cos(j*math.tau/16),pos[1]+.01*math.sin(j*math.tau/16),pos[2]) for j in range(17)]
  tube('DETAIL_eyelet',ring,.0025,silver)
 # Broad fitted diagonal panels are readable from the gameplay camera.
 for k in range(3):
  coords=[(.66+k*.135+t*.075,side*(.11+t*.13)) for t in [i/12 for i in range(13)]]
  ribbon('KIT_side_panel',coords,.016,silver)
 # Segmented stitching avoids a thick drawn outline.
 coords=[(.35+i*.023,side*(.16+.035*math.sin(i/29*math.pi))) for i in range(30)]
 for i in range(0,len(coords)-1,2):tube('DETAIL_panel_stitch',[point(*coords[i],.007),point(*coords[i+1],.007)],.0018,seam)
for i in range(5):
 x=.33+i*.084
 for side in [-1,1]:
  pts=[]
  for j in range(9):
   t=j/8;px=x+t*.084;py=side*.08*(1-2*t);p=point(px,py,.012+math.sin(t*math.pi)*.013);pts.append(p)
  tube('DETAIL_flat_lace',pts,.0055,lace)
# Low embossed toe ribs: toe remains a quiet leather surface.
for k in range(4):
 x=1.0+k*.055;pts=[point(x-.025*math.cos(j*math.pi/16),-.16+j*.02,.002) for j in range(17)]
 tube('DETAIL_toe_rib',pts,.0024,panel)
for o in list(root.children):
 if o.type=='CURVE':
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
 if o.type=='MESH' and not o.data.uv_layers:
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(island_margin=.015);bpy.ops.object.mode_set(mode='OBJECT')
scene.camera.location=(2.3,-2.7,1.8);scene.camera.rotation_euler=(Vector((.65,0,.25))-scene.camera.location).to_track_quat('-Z','Y').to_euler();scene.camera.data.ortho_scale=1.9
scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=768;scene.render.resolution_y=512;scene.render.resolution_percentage=100;scene.render.image_settings.media_type='IMAGE';scene.render.image_settings.file_format='PNG'
p=artifacts.file(name='boot-construction.png',media_type='image/png');scene.render.filepath=str(p.path);bpy.ops.render.render(write_still=True);p.publish()
result={'root':root.name,'cavity':'real boolean recess with inner lining','uv_all_meshes':all(o.data.uv_layers for o in root.children if o.type=='MESH')}
