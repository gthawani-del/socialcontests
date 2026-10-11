team=material('Team_Primary',(.025,.32,.15),.7);dark=material('Shorts_Graphite',(.025,.035,.035),.65);white=material('Gloves_Ivory',(.82,.86,.8),.65);skin=material('Skin_Warm',(.43,.25,.15),.75);hair=material('Hair_Dark',(.025,.017,.012),.8)
# Athletic goalkeeper stance, independent torso/arms/legs editable in recipe.
vs=[]
for z,w,d in [(.47,.105,.065),(.57,.12,.07),(.77,.185,.08),(.82,.13,.065)]:vs.extend([(-w,-d,z),(w,-d,z),(w,d,z),(-w,d,z)])
fs=[(0,3,2,1),(12,13,14,15)]
for i in range(3):
 for j in range(4):fs.append((i*4+j,i*4+(j+1)%4,(i+1)*4+(j+1)%4,(i+1)*4+j))
o=mesh('HERO_keeper_jersey',vs,fs,team);m=o.modifiers.new('Jersey_edges','BEVEL');m.width=.025;m.segments=3
for s in [-1,1]:
 tube('PRP_upper_arm',[(s*.15,0,.76),(s*.29,-.025,.65)],.06,team)
 tube('PRP_forearm',[(s*.29,-.025,.65),(s*.44,-.045,.58)],.045,team)
 sphere('PRP_glove',(s*.49,-.055,.565),(.075,.043,.045),white)
 tube('PRP_thigh',[(s*.075,0,.5),(s*.19,-.015,.32)],.075,dark)
 tube('PRP_shin',[(s*.19,-.015,.32),(s*.27,0,.105)],.047,team)
 box('PRP_boot',(s*.275,-.045,.055),(.12,.235,.09),dark,.025)
sphere('PRP_neck',(0,0,.835),(.045,.045,.065),skin)
sphere('HERO_head',(0,-.004,.947),(.079,.071,.103),skin)
# Shallow facial planes and close cropped hair; no oversized cartoon features.
sphere('PRP_hair',(0,.009,.992),(.080,.068,.06),hair)
sphere('PRP_nose',(0,-.072,.945),(.016,.014,.025),skin)
for s in [-1,1]:sphere('PRP_brow',(s*.03,-.066,.974),(.022,.007,.005),hair)
root['collider']='keeper movable body; width1.13m height1.055m';result=finish((0,0,.52),1.9,(1.8,-3,1.3))
