import test from 'node:test';
import assert from 'node:assert/strict';
import { TEAM_CATALOGUE } from '../src/football-pinball/ui/team-selection.js';
import { TEAM_KITS, resolveKits } from '../src/football-pinball/ui/team-kits.js';
test('Every selectable team has both palettes; no unknown team is silently assigned colours',()=>{
  for(const group of Object.values(TEAM_CATALOGUE))for(const name of group.names){
    assert(TEAM_KITS[name],name);
    for(const kit of Object.values(TEAM_KITS[name]))for(const key of ['primary','secondary'])assert.match(kit[key],/^#[0-9a-f]{6}$/i);
  }
  assert.throws(()=>resolveKits('Unknown','India'));
});
test('Distinct country home colours stay unchanged; red kit clash uses an alternate',()=>{
  assert.deepEqual(resolveKits('India','Brazil'),{blue:TEAM_KITS.India.home,red:TEAM_KITS.Brazil.home});
  const clash=resolveKits('England','Germany');
  assert.notEqual(clash.blue.primary,clash.red.primary);
  const clubs=resolveKits('Liverpool','Manchester United');
  assert.notEqual(clubs.blue.primary,clubs.red.primary);
});
