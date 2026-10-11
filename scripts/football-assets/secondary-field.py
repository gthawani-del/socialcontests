ASSET="field"
import bpy, math
from mathutils import Vector
scene=bpy.context.scene
scene.unit_settings.system='METRIC'
root=bpy.data.objects.new('ASSET_'+ASSET,None);scene.collection.objects.link(root)
def material(name,color,rough=.45,metal=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;return m
def mesh(name,vs,fs,mat,smooth=False):
 m=bpy.data.meshes.new(name);m.from_pydata(vs,[],fs);m.update();o=bpy.data.objects.new(name,m);scene.collection.objects.link(o);o.parent=root;o.data.materials.append(mat)
 for p in m.polygons:p.use_smooth=smooth
 return o
def tube(name,points,r,mat):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=1;c.bevel_depth=r;c.bevel_resolution=1;s=c.splines.new('POLY');s.points.add(len(points)-1)
 for p,v in zip(s.points,points):p.co=(*v,1)
 o=bpy.data.objects.new(name,c);scene.collection.objects.link(o);o.parent=root;o.data.materials.append(mat);return o
def box(name,loc,size,mat,bevel=.01):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.parent=root;o.data.materials.append(mat)
 if bevel:m=o.modifiers.new('Manufactured_edges','BEVEL');m.width=bevel;m.segments=2
 return o
def sphere(name,loc,scale,mat):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,radius=1,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;o.parent=root;o.data.materials.append(mat)
 for p in o.data.polygons:p.use_smooth=True
 return o
def finish(target,size,camloc):
 for o in list(root.children):
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
  if o.type=='CURVE':bpy.ops.object.convert(target='MESH')
  if o.type=='MESH':
   bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
   for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
   bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(island_margin=.02);bpy.ops.object.mode_set(mode='OBJECT')
 # Consolidate static parts by material to bound mobile draw calls.
 for mat in list(bpy.data.materials):
  group=[o for o in root.children if o.type=='MESH' and len(o.data.materials)==1 and o.data.materials[0]==mat]
  if len(group)>1:
   bpy.ops.object.select_all(action='DESELECT')
   for o in group:o.select_set(True)
   bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join();group[0].name='MESH_'+mat.name
 def aim(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
 d=bpy.data.cameras.new('CAM_main');o=bpy.data.objects.new('CAM_main',d);scene.collection.objects.link(o);o.location=camloc;aim(o,target);d.type='ORTHO';d.ortho_scale=size;scene.camera=o
 for name,typ,loc,power in [('LGT_key','SUN',(3,-4,5),2.5),('LGT_fill','POINT',(-2,1,3),180)]:
  d=bpy.data.lights.new(name,typ);d.energy=power;o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=loc;aim(o,target)
  if typ=='POINT':d.shadow_soft_size=2
 scene.world=bpy.data.worlds.new('World_Studio');scene.world.color=(.15,.15,.15);scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=768;scene.render.resolution_y=512;scene.render.resolution_percentage=100
 scene.render.image_settings.media_type='IMAGE';scene.render.image_settings.file_format='PNG';p=artifacts.file(name=ASSET+'-preview.png',media_type='image/png');scene.render.filepath=str(p.path);bpy.ops.render.render(write_still=True);p.publish()
 # Semantic collider description is exported as root extras, not visible proxy geometry.
 root['units']='metres';root['axis']='Blender Z up; glTF Y up';root['asset_version']='1.0'
 return {'asset':ASSET,'root':root.name,'triangles':sum(len(p.vertices)-2 for o in root.children if o.type=='MESH' for p in o.data.polygons),'materials':[m.name for m in bpy.data.materials]}

grass=material('Pitch_Green',(.025,.12,.055),.9,0)
stripe=material('Pitch_Stripe',(.035,.155,.07),.9,0)
white=material('Pitch_Marking',(.78,.81,.73),.8,0)
box('Pitch_base',(0,0,-.09),(6.4,11.65,.18),grass,0)
for i in range(12):
 if i%2==0:box('Mown_stripe',(0,-5.825+(i+.5)*11.65/12,.0095),(6.38,11.65/12,.001),stripe,0)
def line(name,pts):
 for (x1,y1),(x2,y2) in zip(pts[:-1],pts[1:]):
  dx=x2-x1;dy=y2-y1;length=math.hypot(dx,dy)
  o=box(name,((x1+x2)/2,(y1+y2)/2,.02),(length,.028,.002),white,0)
  o.rotation_euler.z=math.atan2(dy,dx)
line('Touchline',[(-3,-5.6),(3,-5.6),(3,5.6),(-3,5.6),(-3,-5.6)])
line('Halfway',[(-3,0),(3,0)])
line('Centre_circle',[(.88*math.cos(i*math.tau/64),.88*math.sin(i*math.tau/64)) for i in range(65)])
for sign in [-1,1]:
 line('Penalty_area',[(-1.65,sign*5.6),(-1.65,sign*3.95),(1.65,sign*3.95),(1.65,sign*5.6)])
 line('Goal_area',[(-.85,sign*5.6),(-.85,sign*4.95),(.85,sign*4.95),(.85,sign*5.6)])
root['collider']='cuboid floor top=0; width6.4 length11.65 thickness.18'
result=finish((0,0,0),18,(8,-10,15))
