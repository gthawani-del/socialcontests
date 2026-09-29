# Executed in the existing Higgsfield 3D Jutsu project. Engine coordinates are
# converted to the authored GLB coordinates once, keeping collision anchors fixed.
import bpy, math, json, bmesh
from mathutils import Vector
S=.45
scene=bpy.context.scene
for obj in list(bpy.data.objects): bpy.data.objects.remove(obj,do_unlink=True)
scene.unit_settings.system='METRIC'
def v(x,y,z): return (x/S,-z/S,y/S)
def material(name,color,metal=0,rough=.6,emission=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    if emission: p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission
    return m
navy=material('Architecture_Navy',(.018,.039,.074),.35,.4)
stone=material('Architecture_Stone',(.16,.19,.21),.15)
gold=material('Brushed_Champagne',(.61,.40,.15),.7,.3)
white=material('Chalk_Ivory',(.93,.86,.65))
turf=material('Living_Turf',(.055,.22,.085))
sand=material('Rolled_Pitch',(.52,.39,.20))
dark=material('Tunnel_Interior',(.008,.012,.02))
blue=material('Seat_India_Blue',(.025,.15,.35),.1)
blue2=material('Seat_Deep_Blue',(.012,.045,.13),.1)
light=material('Warm_Lamp',(.98,.65,.25),0,.35,3)
led=material('Boundary_LED',(.04,.35,.95),0,.3,2)
willow=material('Willow',(.72,.50,.25),0,.45)
grip=material('Grip_Navy',(.012,.025,.04))
steel=material('Ramp_Champagne',(.07,.09,.10),.55,.4)

def mesh(name,verts,faces,mat,uv=None):
    data=bpy.data.meshes.new(name);data.from_pydata([v(*p) for p in verts],[],faces);data.update()
    bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free()
    o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.data.materials.append(mat)
    if uv:
        layer=data.uv_layers.new(name='UVMap')
        for poly in data.polygons:
            for li in poly.loop_indices:layer.data[li].uv=uv[data.loops[li].vertex_index]
    return o

def box(name,x,y,z,w,h,d,mat,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=v(x,y,z));o=bpy.context.object;o.name=name;o.dimensions=(w/S,d/S,h/S)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat)
    if bevel:
        mod=o.modifiers.new('Soft machined edges','BEVEL');mod.width=bevel/S;mod.segments=2
    return o

def tube(name,points,radius,mat):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=1;c.bevel_depth=radius/S;c.bevel_resolution=1
    sp=c.splines.new('POLY');sp.points.add(len(points)-1)
    for point,co in zip(sp.points,points):point.co=(*v(*co),1)
    o=bpy.data.objects.new(name,c);scene.collection.objects.link(o);o.data.materials.append(mat);return o

def text(name,value,x,y,z,size,mat,flat=False):
    c=bpy.data.curves.new(name,'FONT');c.body=value;c.align_x='CENTER';c.size=size/S;c.extrude=.0008/S;c.resolution_u=3
    o=bpy.data.objects.new(name,c);scene.collection.objects.link(o);o.location=v(x,y,z)
    if not flat:o.rotation_euler.x=math.pi/2
    o.data.materials.append(mat);return o

def cylinder(name,x,y,z,r,h,mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=r/S,depth=h/S,location=v(x,y,z));o=bpy.context.object;o.name=name;o.data.materials.append(mat);return o

def ellipse_ring(name,rx,rz,y,width,height,mat,n=128):
    verts=[];faces=[]
    for i in range(n):
        a=i*math.tau/n
        for dr,dy in [(0,0),(width,0),(width,height),(0,height)]:verts.append(((rx+dr)*math.cos(a),y+dy,(rz+dr)*math.sin(a)))
    for i in range(n):
        j=(i+1)%n
        for k in range(4):faces.append((i*4+k,j*4+k,j*4+(k+1)%4,i*4+(k+1)%4))
    return mesh(name,verts,faces,mat)

# Continuous floor and physical rectangular wicket-return opening.
bpy.ops.mesh.primitive_cylinder_add(vertices=128,radius=1,depth=.12/S,location=v(0,-.06,0));floor=bpy.context.object;floor.name='Arena_Field_Substrate';floor.scale=(1.6425/S,2.8575/S,1);floor.data.materials.append(turf)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
cut=box('Return_Channel_Cutter',0,-.04,2.475,.369,.4,.324,dark)
mod=floor.modifiers.new('Actual wicket return aperture','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cut;bpy.context.view_layer.objects.active=floor;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cut,do_unlink=True)
box('Wicket_Drain_Recess',0,-.13,2.475,.369,.025,.324,dark)
ellipse_ring('Boundary_Cushion',1.5975,2.8125,.0,.035,.07,navy)
ellipse_ring('Boundary_Gold_Cap',1.5975,2.8125,.072,.04,.012,gold)
ellipse_ring('Boundary_Light_Ribbon',1.645,2.86,.06,.012,.025,led)
# Alternating mown strips, a material variation on the same grass rather than raised obstacles.
# Texture is applied by the game to the floor; the pitch remains measured separately.

# Stepped seating, each row touches its riser; crowd bands stand upright, not pasted on floor.
for row in range(10):
    verts=[];faces=[];n=128
    for i in range(n):
        a=i*math.tau/n;factor=.25+.75*(1-math.sin(a))/2
        h=.09+row*.064*factor;rx=1.72+row*.075;rz=2.94+row*.075
        for dr,dh in [(0,-.055),(0,0),(.078,0),(.078,-.055)]:verts.append(((rx+dr)*math.cos(a),h+dh,(rz+dr)*math.sin(a)))
    for i in range(n):
        for k in range(4):faces.append((4*i+k,4*((i+1)%n)+k,4*((i+1)%n)+(k+1)%4,4*i+(k+1)%4))
    mesh('Seating_Terrace_%02d'%row,verts,faces,navy)
    if row in [0,3,6,9]:
        points=[]
        for i in range(n+1):
            a=i*math.tau/n;f=.25+.75*(1-math.sin(a))/2
            points.append(((1.72+row*.075)*math.cos(a),.10+row*.064*f,(2.94+row*.075)*math.sin(a)))
        tube('Tier_Gold_Rail_%02d'%row,points,.009,gold)
    if row in [1,4,7,9]:
        verts=[];faces=[];uv=[]
        for i in range(n+1):
            a=i*math.tau/n;f=.25+.75*(1-math.sin(a))/2;h=.09+row*.064*f
            for dr,dy,vv in [(0,.006,0),(.025,.115,.16)]:
                verts.append(((1.74+row*.075+dr)*math.cos(a),h+dy,(2.96+row*.075+dr)*math.sin(a)));uv.append((i/n*16,row*.065+vv))
        for i in range(n):faces.append((i*2,i*2+1,i*2+3,i*2+2))
        o=mesh('Crowd_Band_%02d'%row,verts,faces,blue,uv);o['uses_committed_crowd_texture']=True

# Merged seat blocks use two draw calls, with aisle breaks and orientation to field.
for variant,mat in enumerate([blue,blue2]):
    verts=[];faces=[]
    for row in range(10):
        count=110+row*6
        for i in range(count):
            if (i+row)%2!=variant or i%18 in [0,1]:continue
            a=i*math.tau/count;f=.25+.75*(1-math.sin(a))/2;rx=1.765+row*.075;rz=2.985+row*.075;h=.11+row*.064*f
            x=rx*math.cos(a);z=rz*math.sin(a);t=(-math.sin(a),math.cos(a));r=(math.cos(a),math.sin(a));base=len(verts)
            for xx,yy,zz in [(-1,0,-1),(1,0,-1),(1,0,1),(-1,0,1),(-1,1,-1),(1,1,-1),(1,1,1),(-1,1,1)]:verts.append((x+t[0]*xx*.025+r[0]*zz*.021,h+yy*.035,z+t[1]*xx*.025+r[1]*zz*.021))
            faces.extend(tuple(base+j for j in face) for face in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
    mesh('Individual_Seats_%d'%variant,verts,faces,mat)

# Back-half stadium canopy, folded structural panels supported by columns.
for i in range(16):
    a=-math.pi+i*math.pi/16;b=a+math.pi/16;m=(a+b)/2
    verts=[]
    for dh in [0,-.022]:
        for rr,t,h in [(0,a,.84),(0,b,.84),(1,b,1.03),(1,m,1.15),(1,a,1.03)]:
            rx=2.18+rr*.30;rz=3.4+rr*.22;verts.append((rx*math.cos(t),h+dh,rz*math.sin(t)))
    faces=[(0,1,2,3,4),(9,8,7,6,5)]+[(j,(j+1)%5,(j+1)%5+5,j+5) for j in range(5)]
    mesh('Canopy_Panel_%02d'%i,verts,faces,navy)
    tube('Canopy_Rib_%02d'%i,[verts[0],verts[4],verts[3]],.009,gold)
    x=2.43*math.cos(a);z=3.59*math.sin(a)
    cylinder('Canopy_Column_%02d'%i,x,.55,z,.018,.95,stone)
    cylinder('Canopy_Uplight_%02d'%i,x,.18,z,.024,.03,light)

# Pavilion: solid structural mass, real recessed windows from booleans, balconies.
base=box('Pavilion_Shell',0,.61,-3.23,1.72,1.1,.52,navy,.025)
for level,y in enumerate([.39,.75]):
    for i,x in enumerate([-.62,-.31,0,.31,.62]):
        cutter=box('Window_Cutter',x,y,-2.995,.235,.235,.25,dark)
        mod=base.modifiers.new('Window_%d_%d'%(level,i),'BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter;bpy.context.view_layer.objects.active=base;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
        box('Pavilion_Window_Back',x,y,-3.105,.225,.225,.014,light)
        box('Pavilion_Window_Mullion',x,y,-2.955,.012,.25,.025,gold)
    box('Pavilion_Balcony_%d'%level,0,y-.14,-2.91,1.82,.04,.22,stone,.008)
    box('Pavilion_Balcony_Rail_%d'%level,0,y-.06,-2.81,1.78,.018,.02,gold)
box('Pavilion_Cornice',0,1.16,-3.23,1.85,.08,.65,gold,.012)
# A peaked pavilion roof with visible eaves and thickness.
# Sculpted pavilion canopy: shallow saddle shell with higher wing tips and rear lift.
xs=[-1.08+i*(2.16/16) for i in range(17)]
zs=[-2.82,-3.08,-3.34,-3.62]
verts=[];faces=[]
for zi,z in enumerate(zs):
    depth=zi/(len(zs)-1)
    for x in xs:
        u=x/1.08;y=1.30+.24*(abs(u)**1.55)+.035*math.cos(u*math.pi*2)+.09*depth
        verts.append((x,y,z))
for r in range(len(zs)-1):
    for i in range(len(xs)-1):
        a=r*len(xs)+i;b=a+1;c=(r+1)*len(xs)+i+1;d=c-1;faces.append((a,b,c,d))
canopy=mesh('Pavilion_Sculpted_Canopy',verts,faces,white)
solid=canopy.modifiers.new('Canopy thickness','SOLIDIFY');solid.thickness=.022/S;solid.offset=-1
bevel=canopy.modifiers.new('Soft canopy edge','BEVEL');bevel.width=.012/S;bevel.segments=2
for label,z,depth in [('Front',zs[0],0),('Back',zs[-1],1)]:
    pts=[]
    for x in xs:
        u=x/1.08;y=1.30+.24*(abs(u)**1.55)+.035*math.cos(u*math.pi*2)+.09*depth
        pts.append((x,y+.008,z))
    tube('Pavilion_Canopy_'+label+'_Trim',pts,.012,gold)
for idx,x in enumerate([-1.0,-.66,-.33,0,.33,.66,1.0]):
    pts=[];u=x/1.08
    for zi,z in enumerate(zs):
        depth=zi/(len(zs)-1);y=1.30+.24*(abs(u)**1.55)+.035*math.cos(u*math.pi*2)+.09*depth
        pts.append((x,y+.012,z))
    tube('Pavilion_Canopy_Rib_%02d'%idx,pts,.008,gold)
box('Pavilion_Brand_Fascia',0,.98,-2.94,1.43,.15,.07,navy,.008)
text('Pavilion_Brand','CRICKET PINBALL',0,.947,-2.898,.098,white)

# Scoring portals: Boolean arched alcoves; opening footprints remain unchanged.
openings=[]
def portal(name,x,z,half,base_y,label):
    width=half*2;radius=half-.018;spring=.19;depth=.28;front=z+.05625
    shell=box(name+'_Shell',x,base_y+.20,z-.08375,width+.036,.40,depth,navy,.009)
    # Cutter is a closed extruded arch. Its clear width matches existing jamb collision.
    outline=[(-radius,-.04),(radius,-.04),(radius,spring)]
    for i in range(1,17):
        a=i*math.pi/16;outline.append((radius*math.cos(a),spring+radius*math.sin(a)))
    verts=[(x+xx,base_y+yy,zz) for zz in [front+.04,z-.17] for xx,yy in outline];n=len(outline)
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    cutter=mesh(name+'_Cutter',verts,faces,dark);mod=shell.modifiers.new('Arched portal aperture','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter;bpy.context.view_layer.objects.active=shell;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
    box(name+'_Dark_Back',x,base_y+.14,z-.16,width-.025,.30,.012,dark)
    arch=[(x-radius,base_y,front+.013),(x-radius,base_y+spring,front+.013)]
    arch.extend((x+radius*math.cos(math.pi-i*math.pi/24),base_y+spring+radius*math.sin(math.pi-i*math.pi/24),front+.013) for i in range(25));arch.append((x+radius,base_y,front+.013))
    tube(name+'_Arch_Trim',arch,.012,gold)
    # Number on the canopy above the clear ball entrance, facing the production camera.
    text(name+'_Number',label,x,base_y+.245,front+.028,.15,white)
    for sign in [-1,1]:cylinder(name+'_Beacon',x+sign*(half+.012),base_y+.04,front+.026,.014,.025,light)
    openings.append({'id':name,'type':'deep_alcove','width':radius*2/S,'height':(spring+radius)/S,'depth':depth/S,'destination':'scoring recess; ball resolves before back wall'})
portal('Single',-.6075,-.1125,.14625,0,'1')
portal('Double',.6075,-.1125,.14625,0,'2')
portal('Straight_Four',0,-1.575,.1845,0,'4')
portal('Boundary_Four',-1.179,-1.9125,.1125,.01575,'4')
portal('Six_Finish',1.179,-1.9125,.1125,.48825,'6')

# Six and four route decks from the same formula used by stadium-layout.js.
for side in [1,-1]:
    points=[]
    for i in range(30):
        t=i/29;x=(2.62+.26*math.sin(t*math.pi))*.45*side;z=(2.75-7*t)*.45
        h=(0 if i==0 else (.035+1.05*t)*.45) if side==1 else .01575
        points.append((x,h,z))
    verts=[]
    for x,y,z in points:verts.extend([(x-.1125,y,z),(x+.1125,y,z)])
    faces=[(2*i,2*i+1,2*i+3,2*i+2) for i in range(29)]
    deck=mesh('Six_Ramp' if side==1 else 'Boundary_Four_Lane',verts,faces,steel)
    solid=deck.modifiers.new('Structural deck thickness','SOLIDIFY');solid.thickness=.025/S;solid.offset=-1
    for sign in [-1,1]:tube(('Six' if side==1 else 'Four')+'_Rail_'+str(sign),[(x+sign*.1125,y+.03,z) for x,y,z in points],.007,gold)
    if side==1:
        for i in [5,10,15,20,25,29]:
            x,y,z=points[i];box('Six_Ramp_Support_'+str(i),x,max(.005,(y-.036)/2),z,.054,max(.01,y-.036),.072,navy)

# GLB pitch and creases, measured at 22 yards / 10 feet represented scale.
length=2.65;width=3.048/(20.1168/2.65)
pitch=box('Measured_Pitch',0,.004,(2.43-.22)/2,width,.008,length,sand)
pitch['lengthMetres']=20.1168;pitch['metresPerEngineUnit']=20.1168/2.65
for end,z,direction in [('Batting',2.43,-1),('Bowling',-.22,1)]:
    box(end+'_Wicket_Line',0,.009,z,width,.002,.008,white)
    pz=z+direction*1.2192/(20.1168/2.65)
    box(end+'_Popping_Crease',0,.009,pz,width*1.3,.002,.008,white)
for x in [-.06,0,.06]:cylinder('Wicket_Stump',x,.08,2.43,.008,.16,white)
box('Wicket_Bails',0,.164,2.43,.15,.014,.015,gold)

# Flipper bat roots, origins at collider centre. Detailed parts remain one rigid bat.
for side in ['left','right']:
    root=bpy.data.objects.new('Branded_Bat_'+side,None);scene.collection.objects.link(root)
    length=.8325;half=length/2;w=.102375
    outline=[(-half+length*.31,-w*.32),(-half+length*.41,-w/2),(half-.018,-w/2),(half,0),(half-.018,w/2),(-half+length*.41,w/2),(-half+length*.31,w*.32)]
    verts=[(x,y,z) for y in [0,.045] for x,z in outline];n=len(outline)
    blade=mesh('Willow_Blade_'+side,verts,[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],willow)
    bevel=blade.modifiers.new('Rounded willow edges','BEVEL');bevel.width=.007/S;bevel.segments=2
    parts=[blade]
    handle=box('Wrapped_Grip_'+side,-half+length*.17,.018,0,length*.34,.041,.041,grip,.012);parts.append(handle)
    parts.append(box('Brand_Plate_'+side,length*.13,.049,0,length*.42,.005,w*.76,navy,.004))
    brand=text('Bat_Brand_'+side,'CRICKET PINBALL',length*.13,.054,0,.025,white,True);parts.append(brand)
    if side=='right':brand.rotation_euler.z=math.pi
    for i in range(12):parts.append(box('Grip_Ridge_'+side,-half+.02+i*length*.024,.018,0,.004,.046,.046,gold if i%4==0 else grip,.002))
    for o in parts:o.parent=root
    a=math.radians(-14.32 if side=='left' else 194.32);pivot=-.9225 if side=='left' else .9225
    root.location=v(pivot+math.cos(a)*length/2,.065,2.16-math.sin(a)*length/2);root.rotation_euler.z=a
    cylinder('Bat_Pivot_'+side,pivot,.055,2.16,.09,.11,navy);cylinder('Bat_Pivot_Gold_'+side,pivot,.113,2.16,.082,.016,gold)

# Four trussed floodlight towers, each with real multiple lamp lenses.
for sign in [-1,1]:
    x=sign*2.10;z=-2.10
    for dx in [-.055,.055]:tube('Floodlight_Truss_Upright',[(x+dx,0,z),(x+dx*.4,1.75,z)],.012,stone)
    for j in range(7):tube('Floodlight_Truss_Brace',[(x-.055,.2+j*.21,z),(x+.055,.41+j*.21,z)],.007,gold)
    panel=box('Floodlight_Housing',x,1.80,z,.32,.22,.08,navy,.01)
    for col in range(5):
        for row in range(3):box('Floodlight_Lens',x+(col-2)*.053,1.80+(row-1)*.055,z+.046,.037,.036,.012,light,.003)
    bpy.ops.object.light_add(type='SPOT',location=v(x,1.70,z));o=bpy.context.object;o.name='Stadium_Flood';o.data.energy=900;o.data.color=(.70,.82,1);o.data.spot_size=math.radians(90);o.rotation_euler=(Vector(v(0,0,0))-o.location).to_track_quat('-Z','Y').to_euler()
# Small perimeter bollards, kept outside collision boundary.
for i in range(32):
    a=i*math.tau/32;x=1.70*math.cos(a);z=2.91*math.sin(a)
    cylinder('Boundary_Bollard',x,.04,z,.014,.08,navy);cylinder('Boundary_Bollard_Lamp',x,.087,z,.015,.013,light)

# Delivery cameras and motivated lighting.
bpy.ops.object.camera_add(location=v(0,6.9,5.75));camera=bpy.context.object;camera.name='Mobile_Production_Camera';camera.rotation_euler=(Vector(v(0,.18,-.42))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='PERSP';camera.data.lens=48;scene.camera=camera
bpy.ops.object.camera_add(location=v(0,14,0));overhead=bpy.context.object;overhead.name='Engineering_Overhead';overhead.rotation_euler=(Vector((0,0,0))-overhead.location).to_track_quat('-Z','Y').to_euler();overhead.data.type='ORTHO';overhead.data.ortho_scale=8.4/S
bpy.ops.object.light_add(type='SUN',location=v(-3,6,1));key=bpy.context.object;key.name='Moonlight_Key';key.data.energy=2;key.rotation_euler=(.35,-.45,-.2)
bpy.ops.object.light_add(type='SUN');fill=bpy.context.object;fill.name='Camera_Fill';fill.data.energy=.7;fill.rotation_euler=(.6,.4,2.3)
if not scene.world:scene.world=bpy.data.worlds.new('Stadium_Night')
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.018,.028,.05,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.35
scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=600;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
scene['design_revision']='colosseum-06';scene['engine_scale']=S;scene['opening_schedule']=json.dumps(openings)
# Fix normals after procedural generation; preserve editable modifiers and named parts.
for o in list(scene.objects):
    if o.type=='MESH':
        bpy.context.view_layer.objects.active=o;o.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT');o.select_set(False)
result={'objects':len(scene.objects),'meshPolygons':sum(len(o.data.polygons) for o in scene.objects if o.type=='MESH'),'openings':openings,'camera':'Mobile_Production_Camera','pitchLengthMetres':20.1168,'paidGeneration':False}
