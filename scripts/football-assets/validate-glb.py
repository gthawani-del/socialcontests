"""Inspect portable asset geometry; excludes cameras/lights from world-space bounds."""
import json,struct,hashlib,sys,pathlib,math
import numpy as np

def inspect(path):
 b=path.read_bytes();assert b[:4]==b'glTF';assert struct.unpack_from('<I',b,8)[0]==len(b)
 n=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+n]);binary=b[28+n:];bounds=[];tri=0;uv=True
 def acc(i):
  a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];counts={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4};dt={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']];start=v.get('byteOffset',0)+a.get('byteOffset',0);c=counts[a['type']];stride=v.get('byteStride',np.dtype(dt).itemsize*c)
  out=np.ndarray((a['count'],c),dtype=dt,buffer=binary,offset=start,strides=(stride,np.dtype(dt).itemsize));assert np.isfinite(out).all();return out
 def walk(i,parent):
  nonlocal tri,uv
  node=g['nodes'][i];m=np.eye(4)
  if 'matrix'in node:m=np.array(node['matrix']).reshape((4,4)).T
  else:
   x,y,z,w=node.get('rotation',[0,0,0,1]);m[:3,:3]=[[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]];m[:3,:3]@=np.diag(node.get('scale',[1,1,1]));m[:3,3]=node.get('translation',[0,0,0])
  m=parent@m
  if 'mesh'in node:
   for p in g['meshes'][node['mesh']]['primitives']:
    xyz=acc(p['attributes']['POSITION']);pts=np.c_[xyz,np.ones(len(xyz))]@m.T;bounds.extend(pts[:,:3]);tri+=g['accessors'][p['indices']]['count']//3;uv=uv and 'TEXCOORD_0'in p['attributes']
    if 'NORMAL'in p['attributes']:acc(p['attributes']['NORMAL'])
    if 'TEXCOORD_0'in p['attributes']:acc(p['attributes']['TEXCOORD_0'])
  for j in node.get('children',[]):walk(j,m)
 for i in g['scenes'][g.get('scene',0)]['nodes']:walk(i,np.eye(4))
 a=np.array(bounds);return {'file':str(path),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'triangles':tri,'mesh_count':len(g['meshes']),'material_names':[m['name'] for m in g.get('materials',[])],'bounds':{'min':a.min(axis=0).round(6).tolist(),'max':a.max(axis=0).round(6).tolist()},'dimensions':(a.max(axis=0)-a.min(axis=0)).round(6).tolist(),'uv_present_all_meshes':uv,'embedded_texture_bytes':sum(v['byteLength']for v in g.get('bufferViews',[])if any(im.get('bufferView')==g['bufferViews'].index(v)for im in g.get('images',[]))),'finite_geometry':True}
if __name__=='__main__':print(json.dumps([inspect(pathlib.Path(p))for p in sys.argv[1:]],indent=2))
