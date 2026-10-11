import bpy
scene=bpy.context.scene
for o in bpy.data.objects:
 if not o.name.startswith('HERO_sleeve'):continue
 for v in o.data.vertices:
  side=1 if v.co.x>0 else -1
  v.co.x=side*(.135+(abs(v.co.x)-.135)*.82)
  v.co.z=.715+(v.co.z-.715)*.8
 o.data.update()
scene.render.image_settings.media_type='IMAGE';scene.render.image_settings.file_format='PNG'
p=artifacts.file(name='player-construction-fitted.png',media_type='image/png');scene.render.filepath=str(p.path);bpy.ops.render.render(write_still=True);p.publish()
result={'sleeves':'reduced shoulder bulk and cap height; torso and pose retained'}
