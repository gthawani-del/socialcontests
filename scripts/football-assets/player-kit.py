import bpy,math
from mathutils import Vector
root=bpy.data.objects['ASSET_player-bumper'];scene=bpy.context.scene
white=bpy.data.materials['Trim_Ivory'];team=bpy.data.materials['Team_Primary'];dark=bpy.data.materials['Shorts_Graphite']
# Garment construction at the source scale. The game chooses each player's number.
def tube(name,pts,r,mat):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=2;s=c.splines.new('POLY');s.points.add(len(pts)-1)
 for p,v in zip(s.points,pts):p.co=(*v,1)
 o=bpy.data.objects.new(name,c);scene.collection.objects.link(o);o.parent=root;o.data.materials.append(mat)
 return o
tube('KIT_collar',[(.04*math.cos(i*math.tau/32),-.012+.037*math.sin(i*math.tau/32),.785) for i in range(33)],.008,white)
for side in [-1,1]:
 for offset in [-.012,.012]:
  tube('KIT_shoulder_piping',[(side*.055,-.052+offset,.78),(side*.113,-.053+offset,.766),(side*.151,-.047+offset,.728)],.006,white)
 tube('KIT_shirt_side_seam',[(side*.1,.008,.51),(side*.109,.008,.61),(side*.139,.008,.71)],.0035,dark)
 # Two sock bands follow the shin rather than a floating decal.
 for z in [.315,.3]:
  tube('KIT_sock_band',[(side*.1+.032*math.cos(i*math.tau/24),-.038+.032*math.sin(i*math.tau/24),z) for i in range(25)],.004,team)
 bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=(side*.143,-.012,.726));o=bpy.context.object;o.name='KIT_sleeve_shoulder';o.scale=(.054,.059,.055);o.parent=root;o.data.materials.append(team)
for o in list(root.children):
 if o.type=='CURVE':
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
 if o.type=='MESH':
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
scene.camera.location=(1.2,2.4,1.7);scene.camera.rotation_euler=(Vector((0,0,.52))-scene.camera.location).to_track_quat('-Z','Y').to_euler();scene.camera.data.ortho_scale=1.25
scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=512;scene.render.resolution_y=640;scene.render.resolution_percentage=100;scene.render.image_settings.media_type='IMAGE';scene.render.image_settings.file_format='PNG'
p=artifacts.file(name='player-kit.png',media_type='image/png');scene.render.filepath=str(p.path);bpy.ops.render.render(write_still=True);p.publish()
result={'root':root.name,'kit':'collar, shoulder piping, sock bands, continuous sleeves'}
