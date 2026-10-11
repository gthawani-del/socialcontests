import bpy, bmesh
from mathutils import Vector
root=next(o for o in bpy.data.objects if o.name.startswith('ASSET_'))
points=[o.matrix_world @ v.co for o in root.children if o.type=='MESH' for v in o.data.vertices]
meshes=[]
for o in root.children:
 if o.type!='MESH':continue
 bm=bmesh.new();bm.from_mesh(o.data)
 meshes.append({'name':o.name,'triangles':sum(len(p.vertices)-2 for p in o.data.polygons),'uvLayers':len(o.data.uv_layers),'degenerateFaces':sum(f.calc_area()<1e-10 for f in bm.faces),'nonManifoldEdges':sum(not e.is_manifold for e in bm.edges),'scale':list(o.scale),'materials':[m.name for m in o.data.materials]})
 bm.free()
result={'asset':root.name,'rootLocation':list(root.location),'rootScale':list(root.scale),'bounds':[[min(v[i] for v in points) for i in range(3)],[max(v[i] for v in points) for i in range(3)]],'meshes':meshes,'imageNodes':sum(n.type=='TEX_IMAGE' for m in bpy.data.materials if m.use_nodes for n in m.node_tree.nodes)}
