# Run after boot.py; preserve parts in original source recipe and group exported draw calls.
root=bpy.data.objects['ASSET_boot']
for o in root.children:
 if o.name.startswith('PRP_lace'):
  for v in o.data.vertices:v.co.z-=.012+abs(v.co.y)*.18
for mat in list(bpy.data.materials):
 group=[o for o in root.children if o.type=='MESH' and len(o.data.materials)==1 and o.data.materials[0]==mat]
 if len(group)>1:
  bpy.ops.object.select_all(action='DESELECT')
  for o in group:o.select_set(True)
  bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join();group[0].name='MESH_'+mat.name
root['collider']='capsule length1.55 radius0.16; heel hinge root0';root['units']='metres';root['asset_version']='1.0'
scene=bpy.context.scene;p=artifacts.file(name='boot-preview.png',media_type='image/png');scene.render.filepath=str(p.path);bpy.ops.render.render(write_still=True);p.publish()
result={'meshes':len(root.children),'triangles':sum(len(p.vertices)-2 for o in root.children for p in o.data.polygons)}
