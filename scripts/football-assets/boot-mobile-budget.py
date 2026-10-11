import bpy
scene=bpy.context.scene
root=bpy.data.objects['ASSET_boot']
for o in root.children:
 if o.type!='MESH':continue
 for m in o.modifiers:
  if m.type=='SUBSURF':m.levels=1;m.render_levels=1
 if not o.data.uv_layers:
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(island_margin=.015);bpy.ops.object.mode_set(mode='OBJECT')
p=artifacts.file(name='boot-mobile-budget.png',media_type='image/png');scene.render.filepath=str(p.path);bpy.ops.render.render(write_still=True);p.publish();result={'subdivision':1,'uv_all_meshes':all(o.data.uv_layers for o in root.children if o.type=='MESH')}
