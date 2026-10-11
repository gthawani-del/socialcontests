import bpy, math
from mathutils import Vector
# Scene passport: editable 1.55 m boot, heel hinge origin, +X toe, +Z up.
# Clean sports product silhouette; blue upper, white laces, graphite sole.
scene=bpy.context.scene
scene.unit_settings.system='METRIC'
root=bpy.data.objects.new('ASSET_boot',None); scene.collection.objects.link(root)
def mat(name,c,rough=.4,metal=0):
 m=bpy.data.materials.new(name); m.diffuse_color=(*c,1); m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*c,1); p.inputs['Roughness'].default_value=rough; p.inputs['Metallic'].default_value=metal
 return m
blue=mat('Team_Primary',(.035,.19,.58),.32); black=mat('Sole_Graphite',(.017,.023,.032),.38); white=mat('Laces_Ivory',(.86,.89,.87),.6); trim=mat('Trim_Silver',(.45,.51,.59),.26,.7)
def mesh(name,verts,faces,material):
 m=bpy.data.meshes.new(name);m.from_pydata(verts,[],faces);m.update();o=bpy.data.objects.new(name,m);scene.collection.objects.link(o);o.parent=root;o.data.materials.append(material)
 for p in m.polygons:p.use_smooth=True
 return o
def loft(name,profiles,material):
 n=24;vs=[]
 for x,w,base,top in profiles:
  for j in range(n):
   a=j*2*math.pi/n; vs.append((x,w*math.sin(a),base+(top-base)*(1+math.cos(a))/2))
 fs=[]
 for i in range(len(profiles)-1):
  for j in range(n):fs.append((i*n+j,i*n+(j+1)%n,(i+1)*n+(j+1)%n,(i+1)*n+j))
 fs += [tuple(range(n-1,-1,-1)),tuple((len(profiles)-1)*n+j for j in range(n))]
 return mesh(name,vs,fs,material)
profiles=[(-.10,.055,.04,.28),(0,.13,.04,.34),(.16,.16,.04,.36),(.34,.145,.04,.28),(.55,.13,.04,.235),(.82,.15,.04,.20),(1.08,.16,.04,.18),(1.3,.13,.04,.15),(1.43,.065,.045,.115),(1.45,.005,.07,.09)]
upper=loft('HERO_upper',profiles,blue)
sole=loft('PRP_sole',[(x,w*1.035,-.025,.057) for x,w,b,t in profiles],black)
def tube(name,points,r,material):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=1;c.bevel_depth=r;c.bevel_resolution=2
 s=c.splines.new('POLY');s.points.add(len(points)-1)
 for p,v in zip(s.points,points):p.co=(*v,1)
 o=bpy.data.objects.new(name,c);scene.collection.objects.link(o);o.parent=root;o.data.materials.append(material);return o
# Cuff is a deliberate open collar, not an opaque ankle cylinder.
tube('PRP_collar',[(.15+.12*math.cos(i*2*math.pi/32),.115*math.sin(i*2*math.pi/32),.332+.025*math.cos(i*2*math.pi/32)) for i in range(33)],.018,black)
for i in range(7):
 x=.35+i*.082; z=.28-i*.014
 tube('PRP_lace_%02d'%i,[(x,-.06,z),(x+.04,.0,z+.012),(x,.06,z)],.012,white)
# Quiet side seam following upper curvature, and a single original silver chevron.
for side in [-1,1]:
 tube('PRP_seam_'+str(side),[(.18,side*.145,.16),(.4,side*.137,.14),(.75,side*.14,.125),(1.1,side*.145,.105),(1.32,side*.10,.09)],.005,trim)
 tube('PRP_chevron_'+str(side),[(.45,side*.133,.10),(.62,side*.143,.18),(.85,side*.152,.10)],.018,white)
for x in [.06,.35,.76,1.12]:
 for y in [-.09,.09]:
  bpy.ops.mesh.primitive_cone_add(vertices=10,radius1=.035,radius2=.047,depth=.06,location=(x,y,-.045));o=bpy.context.object;o.name='PRP_stud';o.parent=root;o.data.materials.append(black)
bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=.073,depth=.012,location=(0,0,.345));o=bpy.context.object;o.name='PRP_hinge_cap';o.parent=root;o.data.materials.append(trim)
# UVs and portable geometry; curves become meshes, semantic parts stay separate.
for o in list(root.children):
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
 if o.type=='CURVE':bpy.ops.object.convert(target='MESH')
 if o.type=='MESH':
  bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(island_margin=.02);bpy.ops.object.mode_set(mode='OBJECT')
def aim(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
camd=bpy.data.cameras.new('CAM_main');cam=bpy.data.objects.new('CAM_main',camd);scene.collection.objects.link(cam);cam.location=(2.4,-2.7,2.1);aim(cam,(.66,0,.1));camd.type='ORTHO';camd.ortho_scale=1.95;scene.camera=cam
for name,typ,loc,power in [('LGT_key','SUN',(2,-3,5),2.5),('LGT_fill','POINT',(-1,2,3),170)]:
 d=bpy.data.lights.new(name,typ);d.energy=power;o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=loc;aim(o,(.6,0,0))
 if typ=='POINT':d.shadow_soft_size=2
scene.world=bpy.data.worlds.new('World_Studio');scene.world.color=(.15,.15,.15);scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=768;scene.render.resolution_y=512;scene.render.resolution_percentage=100
scene.render.image_settings.media_type='IMAGE';scene.render.image_settings.file_format='PNG'
target=artifacts.file(name='boot-preview.png',media_type='image/png');scene.render.filepath=str(target.path);bpy.ops.render.render(write_still=True);target.publish()
result={'asset':'boot','root':root.name,'objects':len(root.children),'materials':[m.name for m in bpy.data.materials],'triangles':sum(len(p.vertices)-2 for o in root.children if o.type=='MESH' for p in o.data.polygons)}
