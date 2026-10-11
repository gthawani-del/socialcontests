import bpy,math
from mathutils import Vector
root=bpy.data.objects['ASSET_boot'];scene=bpy.context.scene
for o in list(root.children):
 if o.name.startswith(('DETAIL_side_blade','DETAIL_panel_seam','DETAIL_toe_seam')):bpy.data.objects.remove(o,do_unlink=True)
profiles=[(-.1,.015,.12,.18),(-.06,.13,.1,.34),(.05,.20,.09,.52),(.18,.22,.09,.56),(.32,.235,.09,.49),(.48,.245,.085,.39),(.68,.27,.08,.3),(.9,.28,.075,.26),(1.12,.26,.075,.235),(1.32,.19,.08,.2),(1.43,.08,.09,.155),(1.45,.01,.11,.13)]
def point(x,angle,side):
 for a,b in zip(profiles,profiles[1:]):
  if a[0]<=x<=b[0]:
   t=(x-a[0])/(b[0]-a[0]);w,lo,hi=[a[i]+t*(b[i]-a[i]) for i in [1,2,3]];return (x,side*(w*math.cos(angle)+.002), (lo+hi)/2+(hi-lo)/2*math.sin(angle)+.003)
def tube(name,pts,r,mat):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=3;s=c.splines.new('POLY');s.points.add(len(pts)-1)
 for p,v in zip(s.points,pts):p.co=(*v,1)
 o=bpy.data.objects.new(name,c);scene.collection.objects.link(o);o.parent=root;o.data.materials.append(mat)
for side in [-1,1]:
 for k in range(3):tube('DETAIL_fitted_stripe',[point(.53+k*.14+t*.10,-.35+t*.95,side) for t in [i/24 for i in range(25)]],.018,bpy.data.materials['Trim_Silver'])
 tube('DETAIL_fitted_seam',[point(.12+i*.025,.35,side) for i in range(45)],.004,bpy.data.materials['Sole_Graphite'])
for o in list(root.children):
 if o.type=='CURVE':
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
 if o.type=='MESH':
  for p in o.data.polygons:p.use_smooth=True
scene.render.image_settings.media_type='IMAGE';scene.render.image_settings.file_format='PNG';p=artifacts.file(name='boot-panels-fitted.png',media_type='image/png');scene.render.filepath=str(p.path);bpy.ops.render.render(write_still=True);p.publish();result={'panels':'fitted to upper cross sections'}
