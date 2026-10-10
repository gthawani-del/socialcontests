import test from 'node:test';
import assert from 'node:assert/strict';
import {createStadiumFeedback} from '../src/cricket-pinball/game/stadium-feedback.js';
function check(run){
 const previous={document:globalThis.document,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout};
 const nodes=[];
 globalThis.document={createElement:()=>({hidden:false,dataset:{},style:{setProperty(){}},children:[],setAttribute(){},replaceChildren(){this.children=[];},append(...children){this.children.push(...children);},remove(){}})};
 globalThis.setTimeout=()=>1;globalThis.clearTimeout=()=>{};
 const feedback=createStadiumFeedback({app:{classList:{add(){},remove(){}},offsetWidth:1},viewport:{append:n=>nodes.push(n)},ballMaterial:null});
 try{run(feedback,nodes[0]);}finally{Object.assign(globalThis,previous);}
}
test('missed final human delivery survives role change before outcome',()=>check((feedback,timing)=>{
 feedback.handle({type:'CONTROL_STATE',humanBatting:true});
 feedback.handle({type:'DELIVERY_LAUNCH',match:{battingPlayerId:'player'}});
 feedback.handle({type:'CONTROL_STATE',humanBatting:false});
 feedback.handle({type:'OUTCOME',outcome:'WICKET'});
 assert.equal(timing.hidden,false);assert.equal(timing.children[0].textContent,'MISSED');
}));
test('CPU final miss does not show human timing; dead ball cannot show missed',()=>check((feedback,timing)=>{
 feedback.handle({type:'DELIVERY_LAUNCH',match:{battingPlayerId:'cpu'}});
 feedback.handle({type:'CONTROL_STATE',humanBatting:true});
 feedback.handle({type:'OUTCOME',outcome:'WICKET'});assert.equal(timing.hidden,true);
 feedback.handle({type:'DELIVERY_LAUNCH',match:{battingPlayerId:'player'}});
 feedback.handle({type:'OUTCOME',outcome:'DEAD_BALL'});assert.equal(timing.hidden,true);
}));
test('actual contact timing is retained instead of being overwritten by missed',()=>check((feedback,timing)=>{
 feedback.handle({type:'DELIVERY_LAUNCH',match:{battingPlayerId:'player'}});
 feedback.handle({type:'BAT_CONTACT',feedback:{timing:'EARLY',quality:.5}});
 feedback.handle({type:'CONTROL_STATE',humanBatting:false});
 feedback.handle({type:'OUTCOME',outcome:'DOT'});
 assert.equal(timing.children[0].textContent,'EARLY');
}));
