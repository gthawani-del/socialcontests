import bpy,math
from mathutils import Vector
scene=bpy.context.scene;root=bpy.data.objects['ASSET_boot'];upper=bpy.data.objects['HERO_boot_upper'];silver=bpy.data.materials['Trim_Silver'];panel=bpy.data.materials['Boot_Panels']
for o in list(root.children):
 if o.name.startswith(('KIT_eyestay','KIT_side_panel','KIT_tongue')):bpy.data.objects.remove(o,do_unlink=True)
def mesh(name,v,f,mat):
 d=bpy.data.meshes.new(name);d.from_pydata(v,[],f);d.update();o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.parent=root;o.data.materials.append(mat)
 for p in d.polygons:p.use_smooth=True
 return o

def tube(name,pts,r,mat):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=1;s=c.splines.new('POLY');s.points.add(len(pts)-1)
 for p,v in zip(s.points,pts):p.co=(*v,1)
 o=bpy.data.objects.new(name,c);scene.collection.objects.link(o);o.parent=root;o.data.materials.append(mat);return o
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
ribbon('KIT_tongue',[(.29+i*.022,0) for i in range(26)],.062,panel)
for side in [-1,1]:
 ribbon('KIT_eyestay',[(.30+i*.022,side*.084) for i in range(25)],.016,panel)
 for k in range(3):
  coords=[(.66+k*.135+t*.075,side*(.11+t*.13)) for t in [i/24 for i in range(25)]]
  ribbon('KIT_side_panel',coords,.016,silver)
for o in list(root.children):
 if o.type=='CURVE':
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
 if o.type=='MESH' and not o.data.uv_layers:
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(island_margin=.015);bpy.ops.object.mode_set(mode='OBJECT')
scene.camera.location=(2.3,-2.7,1.8);scene.camera.rotation_euler=(Vector((.65,0,.25))-scene.camera.location).to_track_quat('-Z','Y').to_euler();scene.camera.data.ortho_scale=1.9
scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=768;scene.render.resolution_y=512;scene.render.resolution_percentage=100;scene.render.image_settings.media_type='IMAGE';scene.render.image_settings.file_format='PNG'
p=artifacts.file(name='boot-construction-fitted.png',media_type='image/png');scene.render.filepath=str(p.path);bpy.ops.render.render(write_still=True);p.publish()
result={'root':root.name,'cavity':'real boolean recess with inner lining','uv_all_meshes':all(o.data.uv_layers for o in root.children if o.type=='MESH')}
