import * as THREE from 'three';

// Shared football art materials, studio reflections and contact shadows.
// No gameplay dimensions or scoring rules live here. Modes can opt into the same kit.
export function createFootballVisualKit(scene, renderer) {
  const textures=[];
  const palette={blue:'#0641a2',red:'#9a0b19',gold:'#c79736',green:'#247554'};
  let seed=8417;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  function grain(kind){
    const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');
    const pixels=x.createImageData(256,256);
    for(let y=0;y<256;y++)for(let col=0;col<256;col++){
      const i=(y*256+col)*4;
      const weave=kind==='cloth'?Math.sin(col*Math.PI)*8+((col+y)%4<2?18:-18):kind==='metal'?Math.sin(y*1.8)*12:0;
      const n=128+(random()-.5)*(kind==='leather'?90:45)+weave;
      pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=n;pixels.data[i+3]=255;
    }
    x.putImageData(pixels,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(kind==='metal'?4:6,kind==='metal'?20:6);textures.push(t);return t;
  }
  const leather=grain('leather'),cloth=grain('cloth'),brushed=grain('metal');
  const metal=new THREE.MeshPhysicalMaterial({color:'#a5afb9',metalness:1,roughness:.3,clearcoat:.35,clearcoatRoughness:.22,bumpMap:brushed,bumpScale:.003});
  const black=new THREE.MeshPhysicalMaterial({color:'#060a10',metalness:.7,roughness:.2,clearcoat:.65,clearcoatRoughness:.15});

  // Purpose-built reflection strips give chrome bright edges and dark faces.
  // These are environment-only reflectors, never visible game geometry.
  const studio=new THREE.Scene();studio.background=new THREE.Color('#080c15');
  function reflector(w,h,position,color,intensity,target=[0,0,0]){
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(intensity),side:THREE.DoubleSide}));m.position.set(...position);m.lookAt(...target);studio.add(m);
  }
  reflector(1.4,13,[-5,5,0],'#dceaff',5);
  reflector(1,11,[5,4,0],'#fff0db',3.5);
  reflector(7,1.6,[0,7,-5],'#ffffff',4);
  reflector(.5,9,[-4,2,0],'#125aff',1.5);
  reflector(.5,9,[4,2,0],'#ff263d',1.5);
  const pmrem=new THREE.PMREMGenerator(renderer);const environment=pmrem.fromScene(studio,.06);scene.environment=environment.texture;scene.environmentIntensity=.65;pmrem.dispose();studio.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
  const ambient=new THREE.HemisphereLight('#b6c8e2','#172519',.75);
  const key=new THREE.DirectionalLight('#fff0d9',2.2);key.position.set(-4.5,10,-2.5);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-4.3,right:4.3,top:6.8,bottom:-6.8,near:.1,far:25});key.shadow.bias=-.00015;key.shadow.normalBias=.008;key.shadow.radius=3;
  const fill=new THREE.DirectionalLight('#aecaff',1.7);fill.position.set(5,5,5);
  const rim=new THREE.DirectionalLight('#99bbff',.65);rim.position.set(1,3,-7);
  const blueSpill=new THREE.PointLight('#176fff',4,6,2);blueSpill.position.set(-2.5,1.0,3.4);
  const redSpill=new THREE.PointLight('#ff283e',4,6,2);redSpill.position.set(2.5,1.0,-3.4);
  const lights=[ambient,key,fill,rim,blueSpill,redSpill];scene.add(...lights);
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;const cx=shadowCanvas.getContext('2d');const gradient=cx.createRadialGradient(64,64,10,64,64,64);gradient.addColorStop(0,'rgba(0,0,0,.8)');gradient.addColorStop(.4,'rgba(0,0,0,.52)');gradient.addColorStop(1,'rgba(0,0,0,0)');cx.fillStyle=gradient;cx.fillRect(0,0,128,128);const shadowMap=new THREE.CanvasTexture(shadowCanvas);textures.push(shadowMap);
  function contact(root,width,depth,x=0,y=.008,z=0){
    const m=new THREE.Mesh(new THREE.PlaneGeometry(width,depth),new THREE.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false,opacity:.8,polygonOffset:true,polygonOffsetFactor:-1}));m.name='ART_contact_shadow';m.rotation.x=-Math.PI/2;m.position.set(x,y,z);m.renderOrder=1;root.add(m);return m;
  }
  function finish(root,asset,team){
    root.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;
      const convert=m=>{
        const primary=m.name==='Team_Primary';
        if(primary && asset==='boot'){
          const next=new THREE.MeshPhysicalMaterial({color:palette[team]||palette.blue,metalness:.15,roughness:.34,clearcoat:.65,clearcoatRoughness:.22,bumpMap:leather,bumpScale:.0015});next.name=m.name;m.dispose();return next;
        }
        if(primary && (asset==='player-bumper'||asset==='keeper')){m.color.set(palette[team]||palette.blue);m.metalness=0;m.roughness=.82;m.bumpMap=cloth;m.bumpScale=.005;}
        if(/Skin/.test(m.name)){m.metalness=0;m.roughness=.66;}
        if(asset==='boot') {
          if(m.name==='Boot_Panels'){m.color.set(team==='red'?'#380711':'#05204c');m.metalness=.25;m.roughness=.36;}
          if(m.name==='Laces_Ivory'){m.color.set('#e1ded0');m.metalness=0;m.roughness=.9;}
          if(m.name==='Boot_Stitch'){m.color.set(team==='red'?'#bf6974':'#537fb1');m.metalness=0;m.roughness=.8;}
          if(m.name==='Boot_Lining'){m.color.set('#090e18');m.metalness=0;m.roughness=.95;}
        }
        if(/Silver|Base_Steel|Brushed_Metal|Frame_White/.test(m.name)){m.color.set('#7f8b97');m.metalness=.95;m.roughness=.2;m.bumpMap=brushed;m.bumpScale=.002;}
        if(/Sole|Shorts/.test(m.name)){m.color.set('#080c13');m.metalness=.1;m.roughness=.65;}
        return m;
      };o.material=Array.isArray(o.material)?o.material.map(convert):convert(o.material);
    });
  }
  function playerKit(root,kitName){
    root.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material])
      if(m.name==='Team_Primary')m.color.set(kitName==='white'?'#e5e7e8':palette[kitName]||palette.blue);
    });
  }
  function setReduced(low){key.shadow.mapSize.set(low?1024:2048,low?1024:2048);key.shadow.map?.dispose();key.shadow.map=null;}
  return {palette,metal,black,leather,cloth,brushed,contact,finish,playerKit,setReduced,
    dispose(){environment.dispose();textures.forEach(t=>t.dispose());lights.forEach(l=>{l.shadow?.map?.dispose();scene.remove(l);});}
  };
}
