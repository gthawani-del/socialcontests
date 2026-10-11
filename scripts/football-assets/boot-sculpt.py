import bpy, math
from mathutils import Vector
root=bpy.data.objects['ASSET_boot'];scene=bpy.context.scene
for o in list(root.children):bpy.data.objects.remove(o,do_unlink=True)
team=bpy.data.materials['Team_Primary'];sole=bpy.data.materials['Sole_Graphite'];silver=bpy.data.materials['Trim_Silver'];lace=bpy.data.materials['Laces_Ivory']
for m,col,metal,rough in [(team,(.012,.10,.38,1),.42,.23),(sole,(.014,.018,.025,1),.65,.25),(silver,(.5,.61,.7,1),.85,.2),(lace,(.78,.83,.88,1),.15,.35)]:
 n=m.node_tree.nodes.get('Principled BSDF');n.inputs['Base Color'].default_value=col;n.inputs['Metallic'].default_value=metal;n.inputs['Roughness'].default_value=rough
# Length 1.55m, width 0.56m: a football shoe silhouette with heel counter and broad forefoot.
profiles=[(-.1,.015,.12,.18),(-.06,.13,.1,.34),(.05,.20,.09,.52),(.18,.22,.09,.56),(.32,.235,.09,.49),(.48,.245,.085,.39),(.68,.27,.08,.3),(.9,.28,.075,.26),(1.12,.26,.075,.235),(1.32,.19,.08,.2),(1.43,.08,.09,.155),(1.45,.01,.11,.13)]
def surface(name,rows,mat):
 n=32;v=[]
 for x,w,low,high in rows:
  for j in range(n):
   a=math.tau*j/n;v.append((x,w*math.cos(a),low+(high-low)*(math.sin(a)+1)/2))
 f=[tuple(range(n-1,-1,-1))]
 for k in range(len(rows)-1):
  for j in range(n):f.append((k*n+j,k*n+(j+1)%n,(k+1)*n+(j+1)%n,(k+1)*n+j))
 f.append(tuple((len(rows)-1)*n+j for j in range(n)));d=bpy.data.meshes.new(name);d.from_pydata(v,[],f);d.update();o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.parent=root;o.data.materials.append(mat)
 for p in d.polygons:p.use_smooth=True
 sub=o.modifiers.new('Continuous shoe surface','SUBSURF');sub.levels=2;sub.render_levels=2
 return o
surface('HERO_boot_upper',profiles,team)
surface('HERO_outsole',[(x,w*1.035,.025,.105) for x,w,lo,hi in profiles],sole)
surface('TRIM_midsole',[(x,w*1.04,.083,.112) for x,w,lo,hi in profiles],silver)
def tube(name,pts,r,mat):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=3;c.bevel_depth=r;c.bevel_resolution=3;s=c.splines.new('POLY');s.points.add(len(pts)-1)
 for p,v in zip(s.points,pts):p.co=(*v,1)
 o=bpy.data.objects.new(name,c);scene.collection.objects.link(o);o.parent=root;o.data.materials.append(mat);return o
# Dark inset ankle mouth and padded silver rim.
pts=[(.18+.105*math.cos(j*math.tau/48),.123*math.sin(j*math.tau/48),.54-.025*math.cos(j*math.tau/48)) for j in range(49)]
tube('HERO_padded_collar',pts,.026,sole)
bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,location=(.18,0,.528));o=bpy.context.object;o.name='HERO_ankle_opening';o.scale=(.11,.127,.015);o.parent=root;o.data.materials.append(sole)
for i in range(7):
 x=.36+i*.068;z=.47-i*.028
 tube('DETAIL_lace_a',[(x,-.072,z),(x+.068,.072,z-.028)],.009,lace)
 tube('DETAIL_lace_b',[(x,.072,z+.006),(x+.068,-.072,z-.022)],.009,lace)
for side in [-1,1]:
 for k in range(3):
  x=.56+k*.14;tube('DETAIL_side_blade',[(x,side*.245,.14),(x+.095,side*.223,.27)],.027,silver)
 tube('DETAIL_panel_seam',[(.08,side*.15,.39),(.25,side*.21,.35),(.5,side*.242,.25),(.85,side*.26,.18),(1.18,side*.22,.155)],.006,sole)
 tube('DETAIL_toe_seam',[(.96+i*.016,side*(.258-i*.003),.194-i*.0008) for i in range(20)],.004,lace)
 for x in [.1,.35,.85,1.12]:
  bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=.043,radius2=.03,depth=.065,location=(x,side*(.15 if x<.5 else .19),.015));o=bpy.context.object;o.name='DETAIL_stud';o.parent=root;o.data.materials.append(silver)
for o in list(root.children):
 if o.type=='CURVE':
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
 if o.type=='MESH':
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
scene.camera.location=(2.3,-2.7,1.8);scene.camera.rotation_euler=(Vector((.65,0,.25))-scene.camera.location).to_track_quat('-Z','Y').to_euler();scene.camera.data.ortho_scale=1.9
scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=768;scene.render.resolution_y=512;scene.render.resolution_percentage=100
scene.render.image_settings.media_type='IMAGE';scene.render.image_settings.file_format='PNG';p=artifacts.file(name='boot-sculpt.png',media_type='image/png');scene.render.filepath=str(p.path);bpy.ops.render.render(write_still=True);p.publish()
result={'length':1.55,'width':.58,'heel_height':.57,'root':root.name}
