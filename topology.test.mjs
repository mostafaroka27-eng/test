import test from 'node:test';
import assert from 'node:assert/strict';
import {cabinet,DEFAULTS} from './engine.mjs';
import {remapPartOverrides} from './topology.mjs';

const configured=()=>({...DEFAULTS,bayShelves:[1,2],partOverrides:{'shelf:1':{edges:[1,1,1,1]},'back:0':{edges:[0,1,0,1]}}});
test('edge customization follows its bay/slot when another bay gains shelves',()=>{
 const previous=configured(),next={...previous,bayShelves:[2,2]};
 const result=remapPartOverrides(previous,next),parts=cabinet(result).parts;
 assert.deepEqual(result.partOverrides,{'shelf:2':{edges:[1,1,1,1]},'back:0':{edges:[0,1,0,1]}});
 assert.deepEqual(parts.find(p=>p.key==='shelf:1:0').edges,[1,1,1,1]);
 assert.deepEqual(parts.find(p=>p.key==='shelf:0:1').edges,[1,0,0,0]);
});
test('removed semantic parts lose customizations rather than passing them to later parts',()=>{
 const previous={...configured(),partOverrides:{'shelf:0':{edges:[1,1,1,1]}}};
 const next=remapPartOverrides(previous,{...previous,bayShelves:[0,2]});
 assert.deepEqual(next.partOverrides,{});
 assert.ok(cabinet(next).parts.filter(p=>p.kind==='shelf').every(p=>p.edges.join()==='1,0,0,0'));
 const restored=remapPartOverrides(next,{...next,bayShelves:[1,2]});
 assert.deepEqual(restored.partOverrides,{});
});
test('drawer sides retain separate edge flags when preceding drawer count changes',()=>{
 const previous={...DEFAULTS,bayShelves:[0,0],bayDrawers:[1,1],partOverrides:{'drawerSide:2':{edges:[1,1,1,1]},'drawerSide:3':{edges:[0,1,0,1]}}};
 const next=remapPartOverrides(previous,{...previous,bayDrawers:[2,1]});
 assert.deepEqual(next.partOverrides,{'drawerSide:4':{edges:[1,1,1,1]},'drawerSide:5':{edges:[0,1,0,1]}});
 const parts=cabinet(next).parts;
 assert.deepEqual(parts.find(p=>p.key==='drawerSide:1:0:0').edges,[1,1,1,1]);
 assert.deepEqual(parts.find(p=>p.key==='drawerSide:1:0:1').edges,[0,1,0,1]);
});
test('remapping is detached, preserves unrelated settings and rejects invalid candidate atomically',()=>{
 const previous=configured(),next={...previous,width:1000,bayShelves:[2,2]},before=structuredClone(previous),candidate=structuredClone(next);
 const result=remapPartOverrides(previous,next);
 assert.equal(result.width,1000);assert.deepEqual(previous,before);assert.deepEqual(next,candidate);
 result.bayShelves[0]=9;result.partOverrides['shelf:2'].edges[0]=0;
 assert.deepEqual(previous,before);assert.deepEqual(next,candidate);
 assert.throws(()=>remapPartOverrides(previous,{...next,width:1}));
 assert.deepEqual(previous,before);
});
test('invalid or removed legacy override keys never become active after adding new parts',()=>{
 const previous={...DEFAULTS,partitions:0,shelves:0,partOverrides:{'shelf:0':{edges:[1,1,1,1]}}};
 const result=remapPartOverrides(previous,{...previous,shelves:1});
 assert.deepEqual(result.partOverrides,{});
 assert.deepEqual(cabinet(result).parts.find(p=>p.kind==='shelf').edges,[1,0,0,0]);
});
