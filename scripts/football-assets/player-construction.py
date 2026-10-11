import bpy,math
from mathutils import Vector
scene=bpy.context.scene;root=bpy.data.objects['ASSET_player-bumper']
# Replace the block-shaped body with a connected, tapered athletic silhouette.
for o in list(root.children):
 if o.name!='PRP_pedestal':bpy.data.objects.remove(o,do_unlink=True)
team=bpy.data.materials['Team_Primary'];skin=bpy.data.materials['Skin_Warm'];dark=bpy.data.materials['Shorts_Graphite'];white=bpy.data.materials['Trim_Ivory'];hair=bpy.data.materials['Hair_Dark'];metal=bpy.data.materials['Base_Steel']
team.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.015,.075,.3,1)
def mesh(name,v,f,mat):
 d=bpy.data.meshes.new(name);d.from_pydata(v,[],f);d.update();o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.parent=root;o.data.materials.append(mat)
 for p in d.polygons:p.use_smooth=True
 return o
def loft(name,rings,mat):
 n=20;v=[]
 for z,x,y,w,depth in rings:
  for i in range(n):
   a=i*math.tau/n;fold=.0025*math.sin(a*7+z*26) if name=='HERO_fitted_jersey' else 0
   v.append((x+(w+fold)*math.cos(a),y+(depth+fold)*math.sin(a),z))
 f=[tuple(range(n-1,-1,-1))]
 for j in range(len(rings)-1):
  for i in range(n):f.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
 f.append(tuple((len(rings)-1)*n+i for i in range(n)));o=mesh(name,v,f,mat)
 sub=o.modifiers.new('Sculpted contour','SUBSURF');sub.levels=1;sub.render_levels=1;return o
def limb(name,a,b,r1,r2,mat):
 a=Vector(a);b=Vector(b);axis=(b-a).normalized();u=axis.cross(Vector((0,1,0))).normalized();v=axis.cross(u).normalized();verts=[];n=16
 for t,fullness in [(0,.88),(.08,1),(.3,1.08),(.55,1.04),(.82,1),(.94,.95),(1,.85)]:
  radius=(r1*(1-t)+r2*t)*fullness;center=a.lerp(b,t)
  for j in range(n):
   p=center+radius*(u*math.cos(j*math.tau/n)+v*math.sin(j*math.tau/n));verts.append(tuple(p))
 faces=[tuple(range(n-1,-1,-1))]
 for row in range(6):
  for j in range(n):faces.append((row*n+j,row*n+(j+1)%n,(row+1)*n+(j+1)%n,(row+1)*n+j))
 faces.append(tuple(6*n+j for j in range(n)));return mesh(name,verts,faces,mat)
def sphere(name,loc,scale,mat):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=10,radius=1,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;o.parent=root;o.data.materials.append(mat)
 for p in o.data.polygons:p.use_smooth=True
 return o
loft('HERO_fitted_jersey',[(.49,0,0,.1,.068),(.54,0,-.008,.104,.068),(.62,0,-.012,.114,.075),(.7,0,-.016,.146,.083),(.75,0,-.016,.16,.076),(.78,0,-.014,.12,.061),(.795,0,-.012,.045,.04)],team)
for side in [-1,1]:
 hip=(side*.065,0,.49);knee=(side*.1,-.045,.34);ankle=(side*.13,.005,.17)
 limb('HERO_shorts',hip,(side*.085,-.018,.41),.065,.058,dark)
 limb('HERO_thigh',(side*.085,-.018,.415),knee,.049,.035,skin)
 sphere('HERO_knee',knee,(.036,.039,.037),skin)
 limb('HERO_sock',knee,ankle,.034,.025,white)
 sphere('HERO_calf',(side*.118,-.018,.255),(.032,.031,.062),white)
 sphere('HERO_boot',(side*.13,-.036,.135),(.041,.083,.033),dark)
 shoulder=(side*.135,-.012,.737);elbow=(side*.22,-.045 if side>0 else .012,.655 if side>0 else .63);wrist=(side*.20,-.14 if side>0 else -.07,.615 if side>0 else .55)
 limb('HERO_sleeve',shoulder,(side*.177,-.02,.68),.066,.049,team)
 limb('HERO_upper_arm',(side*.18,-.021,.685),elbow,.035,.026,skin)
 sphere('HERO_elbow',elbow,(.026,.026,.025),skin)
 limb('HERO_forearm',elbow,wrist,.028,.019,skin)
 sphere('HERO_hand',wrist,(.021,.018,.033),skin)
 for finger in range(3):limb('DETAIL_finger',(wrist[0]+(finger-1)*.009,wrist[1]-.002,wrist[2]-.012),(wrist[0]+(finger-1)*.009,wrist[1]-.006,wrist[2]-.042),.0045,.0035,skin)
limb('HERO_neck',(0,-.013,.777),(0,-.018,.825),.035,.036,skin)
loft('HERO_head',[(.816,0,-.022,.026,.028),(.828,0,-.03,.041,.04),(.855,0,-.027,.054,.05),(.896,0,-.02,.058,.048),(.928,0,-.012,.055,.046),(.954,0,-.005,.04,.035),(.968,0,-.005,.007,.007)],skin)
loft('DETAIL_hair',[(.914,0,-.006,.055,.045),(.941,0,-.004,.052,.045),(.964,0,-.001,.034,.028),(.977,0,0,.005,.005)],hair)
mesh('DETAIL_nose',[(-.008,-.069,.893),(.008,-.069,.893),(0,-.085,.872),(-.009,-.072,.864),(.009,-.072,.864)],[(0,1,2),(0,2,3),(1,4,2),(2,4,3)],skin)
for side in [-1,1]:
 sphere('DETAIL_ear',(side*.056,-.014,.88),(.007,.011,.017),skin)
 sphere('DETAIL_eye',(side*.021,-.067,.896),(.006,.002,.003),hair)
# Small construction details follow the body; no oversized ornamental geometry.
def tube(name,pts,r,mat):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=1;s=c.splines.new('POLY');s.points.add(len(pts)-1)
 for p,v in zip(s.points,pts):p.co=(*v,1)
 o=bpy.data.objects.new(name,c);scene.collection.objects.link(o);o.parent=root;o.data.materials.append(mat)
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
tube('KIT_v_collar',[(-.041,-.04,.785),(0,-.065,.754),(.041,-.04,.785)],.0045,white)
for side in [-1,1]:
 tube('KIT_shoulder_seam',[(side*.05,-.045,.777),(side*.105,-.05,.763),(side*.146,-.04,.733)],.0035,white)
 for z in [.29,.303]:tube('KIT_sock_band',[(side*.113+.031*math.cos(j*math.tau/24),-.02+.033*math.sin(j*math.tau/24),z) for j in range(25)],.003,team)
# A small chest shield reads as kit construction, with team numbers assigned by the game.
mesh('KIT_chest_shield',[(.06,-.088,.721),(.086,-.087,.721),(.084,-.088,.696),(.073,-.09,.687),(.061,-.088,.696)],[(0,1,2,3,4)],white)
# Separate garment seam is not a baked text label.
for o in list(root.children):
 if o.type=='MESH':
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
  if not o.data.uv_layers:bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(island_margin=.02);bpy.ops.object.mode_set(mode='OBJECT')
scene.camera.location=(1.25,-2.3,1.2);scene.camera.rotation_euler=(Vector((0,0,.5))-scene.camera.location).to_track_quat('-Z','Y').to_euler();scene.camera.data.ortho_scale=1.35
scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=512;scene.render.resolution_y=640;scene.render.resolution_percentage=100;scene.render.image_settings.media_type='IMAGE';scene.render.image_settings.file_format='PNG'
p=artifacts.file(name='player-construction.png',media_type='image/png');scene.render.filepath=str(p.path);bpy.ops.render.render(write_still=True);p.publish()
result={'construction':'shorter neck, shaped torso, articulated arm pose, muscle contours','meshes':len(root.children),'height_m':.996,'base_radius_m':.25,'forward':'-Y in Blender, +Z in GLB'}
