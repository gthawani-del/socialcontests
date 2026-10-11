import bpy, math
from mathutils import Vector
root=bpy.data.objects['ASSET_boot'];scene=bpy.context.scene
# Reference correction: independent lace crossings, recessed tongue and stitched panels.
old=bpy.data.objects['MESH_Laces_Ivory'];bpy.data.objects.remove(old,do_unlink=True)
blue=bpy.data.materials['Team_Primary'];node=blue.node_tree.nodes.get('Principled BSDF');node.inputs['Base Color'].default_value=(.012,.08,.32,1);node.inputs['Metallic'].default_value=.4;node.inputs['Roughness'].default_value=.25
white=bpy.data.materials['Laces_Ivory'];white.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.56,.61,.66,1)
black=bpy.data.materials['Sole_Graphite'];black.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.28
trim=bpy.data.materials['Trim_Silver']
def tube(name,pts,r,mat):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=2;c.bevel_depth=r;c.bevel_resolution=2;s=c.splines.new('POLY');s.points.add(len(pts)-1)
 for p,v in zip(s.points,pts):p.co=(*v,1)
 o=bpy.data.objects.new(name,c);scene.collection.objects.link(o);o.parent=root;o.data.materials.append(mat)
 return o
for i in range(6):
 x=.35+i*.067;z=.278-i*.012
 tube('DETAIL_lace_cross_a',[(x,-.05,z),(x+.067,.05,z-.012)],.006,white)
 tube('DETAIL_lace_cross_b',[(x,.05,z+.003),(x+.067,-.05,z-.009)],.006,white)
 for y in [-.055,.055]:
  tube('DETAIL_eyelet',[(x+.012*math.cos(j*math.tau/16),y+.008*math.sin(j*math.tau/16),z-.001) for j in range(17)],.003,trim)
# Fine longitudinal stitch lines follow the curved upper instead of floating above it.
for side in [-1,1]:
 tube('DETAIL_upper_stitch',[(.42,side*.093,.22),(.6,side*.105,.181),(.82,side*.12,.153),(1.04,side*.12,.13),(1.25,side*.092,.115)],.0025,white)
 # Three diagonal inset panels, original unbranded sports construction.
 for i in range(3):
  x=.68+i*.11
  tube('DETAIL_side_panel',[(x,side*.142,.083),(x+.095,side*.139,.148)],.014,trim)
# Connected seam around toe cap.
tube('DETAIL_toecap',[(1.04+.28*math.cos(a),.125*math.sin(a),.112-.014*math.cos(a)) for a in [(-math.pi/2)+i*math.pi/32 for i in range(33)]],.003,trim)
for o in list(root.children):
 if o.type=='CURVE':
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
 if o.type=='MESH' and not o.data.uv_layers:
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(island_margin=.02);bpy.ops.object.mode_set(mode='OBJECT')
# Batch new detail by material while keeping the upper/sole components separately editable.
for mat in [white,trim]:
 objs=[o for o in root.children if o.type=='MESH' and o.name.startswith('DETAIL') and o.data.materials[0]==mat]
 if objs:
  bpy.ops.object.select_all(action='DESELECT')
  for o in objs:o.select_set(True)
  bpy.context.view_layer.objects.active=objs[0];bpy.ops.object.join();objs[0].name='DETAIL_'+mat.name
scene.camera.location=(2.4,-2.7,2.2);scene.camera.rotation_euler=(Vector((.65,0,.13))-scene.camera.location).to_track_quat('-Z','Y').to_euler();scene.camera.data.ortho_scale=1.9
scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=768;scene.render.resolution_y=512;scene.render.resolution_percentage=100
scene.render.image_settings.media_type='IMAGE';scene.render.image_settings.file_format='PNG'
p=artifacts.file(name='boot-reference-refined.png',media_type='image/png');scene.render.filepath=str(p.path);bpy.ops.render.render(write_still=True);p.publish()
result={'root':root.name,'meshes':len([o for o in root.children if o.type=='MESH']),'pivot':[0,0,0],'length_m':1.55}
