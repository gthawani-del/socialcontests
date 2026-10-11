team=material('Team_Primary',(.035,.19,.58),.65);dark=material('Shorts_Graphite',(.025,.035,.045),.7);white=material('Trim_Ivory',(.8,.84,.81),.65);metal=material('Base_Steel',(.16,.19,.22),.3,.7)
# Headless jersey-and-legs pinball miniature, adult athletic proportions.
def cylinder(name,r,depth,z,mat):
 bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=r,depth=depth,location=(0,0,z));o=bpy.context.object;o.name=name;o.parent=root;o.data.materials.append(mat);return o
cylinder('PRP_pedestal',.25,.09,.045,metal);cylinder('PRP_team_ring',.257,.025,.09,team)
# Torso tailored silhouette, front toward -Y.
vs=[]
for z,w,d in [(.49,.115,.07),(.59,.12,.07),(.76,.17,.08),(.8,.12,.06)]:
 vs.extend([(-w,-d,z),(w,-d,z),(w,d,z),(-w,d,z)])
fs=[(0,3,2,1),(12,13,14,15)]
for i in range(3):
 for j in range(4):fs.append((i*4+j,i*4+(j+1)%4,(i+1)*4+(j+1)%4,(i+1)*4+j))
o=mesh('HERO_jersey',vs,fs,team);m=o.modifiers.new('Fabric_edges','BEVEL');m.width=.025;m.segments=3
for s in [-1,1]:
 box('PRP_shorts',(s*.066,0,.47),(.115,.16,.15),dark,.02)
 sphere('PRP_sock',(s*.09,0,.265),(.045,.05,.145),white)
 box('PRP_boot',(s*.09,-.055,.125),(.105,.21,.075),dark,.028)
 tube('PRP_sleeve',[(s*.135,0,.742),(s*.215,0,.66)],.064,team)
 tube('PRP_cuff',[(s*.202,0,.674),(s*.215,0,.66)],.066,white)
tube('PRP_collar',[(.065*math.cos(i*math.pi*2/24),.035*math.sin(i*math.pi*2/24),.8) for i in range(25)],.012,white)
root['collider']='cylinder radius .257m height .82m';result=finish((0,0,.42),1.5,(1.4,-2,1.2))
