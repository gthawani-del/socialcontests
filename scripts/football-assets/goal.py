white=material('Frame_White',(.85,.89,.89),.32,.45);net=material('Net_Ivory',(.61,.66,.65),.7);dark=material('Foot_Graphite',(.03,.045,.055))
# Front at Blender Y=0; back Y=-.65 => exported glTF +Z depth.
tube('HERO_frame',[(-1.135,0,0),(-1.135,0,1.235),(1.135,0,1.235),(1.135,0,0)],.035,white)
for x in [-1.135,1.135]:
 tube('PRP_back_support',[(x,0,1.235),(x,-.65,.9),(x,-.65,.035),(x,0,.035)],.022,white)
 box('PRP_foot',(x,-.1,.015),(.14,.3,.03),dark,.01)
tube('PRP_back_crossbar',[(-1.135,-.65,.9),(1.135,-.65,.9)],.022,white)
# Actual open mesh net, grouped curves consolidated at export.
for i in range(33):
 x=-1.1+i*2.2/32;tube('PRP_net_vertical',[(x,0,1.2),(x,-.65,.88),(x,-.65,.04)],.003,net)
for i in range(14):
 z=.04+i*.84/13;tube('PRP_net_back',[(-1.1,-.65,z),(1.1,-.65,z)],.003,net)
for i in range(9):
 t=i/8;y=-.65*t;z=1.2-.32*t;tube('PRP_net_roof',[(-1.1,y,z),(1.1,y,z)],.003,net)
for side in [-1,1]:
 x=side*1.1
 for i in range(10):
  y=-.65*i/9;top=1.2-.32*i/9;tube('PRP_net_side',[(x,y,.04),(x,y,top)],.003,net)
 for i in range(13):
  z=.04+i*.84/12;tube('PRP_net_side_cross',[(x,0,z),(x,-.65,z)],.003,net)
root['collider']='opening width 2.2m height 1.2m; post radius .035m';result=finish((0,-.25,.55),3.25,(3,4,2.4))
