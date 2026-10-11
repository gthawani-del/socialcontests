ASSET='round-target'
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

metal=material('Brushed_Metal',(.28,.32,.36),.32,.7)
dark=material('Graphite',(.028,.039,.055),.58,.15)
team=material('Team_Primary',(.045,.19,.48),.35,.15)
white=material('Marking',(.85,.87,.86),.45,.05)
def cylinder(name,r,depth,z,mat,vertices=48):
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=(0,0,z));o=bpy.context.object;o.name=name;o.parent=root;o.data.materials.append(mat)
 m=o.modifiers.new('Edge_softening','BEVEL');m.width=.006;m.segments=2
 return o
def polygon_prism(name,pts,z0,z1,mat):
 n=len(pts);vs=[(x,y,z) for z in (z0,z1) for x,y in pts];fs=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)];return mesh(name,vs,fs,mat)
cylinder('Lower_housing',.36,.1,.05,dark)
cylinder('Steel_shoulder',.35,.08,.14,metal)
cylinder('Blue_strike_surface',.32,.065,.2075,team)
# Inlaid arrow is a separate material, not text.
polygon_prism('Arrow', [(-.055,-.12),(.055,-.12),(.055,.01),(.12,.01),(0,.15),(-.12,.01),(-.055,.01)],.239,.25,white)
root['collider']='cylinder radius=.36 height=.25'
result=finish((0,0,.1),1.05,(1,-1.3,1.3))
