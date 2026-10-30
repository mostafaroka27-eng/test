// Rectangular room coordinates: X right, Y up, Z front; dimensions in millimetres.
import {cabinet,DEFAULTS} from './engine.mjs';
import {partSize} from './geometry.mjs';

export const DEFAULT_ROOM=Object.freeze({width:4200,depth:3600,height:2800});
export function validateRoom(room){
 if(!room||typeof room!=='object')throw Error('Room required');
 for(const key of ['width','depth','height'])if(typeof room[key]!=='number'||!Number.isFinite(room[key])||room[key]<500||room[key]>100000)throw Error(`Invalid room ${key}`);
 return room;
}

export function unitFootprint(unit){
 if(!unit||!Number.isFinite(unit.x)||!Number.isFinite(unit.z)||!unit.config)throw Error('Invalid unit footprint');
 const rotation=unit.rotation??0;
 if(![0,90,180,270].includes(rotation))throw Error('Unit rotation must be 0, 90, 180 or 270 degrees');
 const [cos,sin]=[[1,0],[0,1],[-1,0],[0,-1]][rotation/90];
 const model=cabinet({...DEFAULTS,...unit.config},unit.id);
 let left=Infinity,right=-Infinity,back=Infinity,front=-Infinity,height=-Infinity,bottom=Infinity;
 for(const part of model.parts){
  const [dx,dy,dz]=partSize(part),p=part.position;
  if(!p||![p.x,p.y,p.z].every(Number.isFinite))throw Error('Invalid panel position');
  for(const x of [p.x-dx/2,p.x+dx/2])for(const z of [p.z-dz/2,p.z+dz/2]){
   const wx=unit.x+cos*x+sin*z,wz=unit.z-sin*x+cos*z;
   left=Math.min(left,wx);right=Math.max(right,wx);back=Math.min(back,wz);front=Math.max(front,wz);
  }
  height=Math.max(height,p.y+dy/2);bottom=Math.min(bottom,p.y-dy/2);
 }
 return {left,right,back,front,width:right-left,depth:front-back,height,bottom,rotation};
}

export function inspectLayout(room,units){
 validateRoom(room);
 if(!Array.isArray(units)||units.length>100)throw Error('Room layout supports at most 100 units');
 const issues=[],bounds=units.map(unitFootprint),epsilon=0.01;
 for(let i=0;i<units.length;i++){
  const b=bounds[i],id=units[i].id;
  if(b.left < -room.width/2-epsilon||b.right>room.width/2+epsilon||b.back < -room.depth/2-epsilon||b.front>room.depth/2+epsilon)issues.push({type:'boundary',units:[id],message:`${id} crosses a room boundary`});
  if(b.height>room.height+epsilon)issues.push({type:'height',units:[id],message:`${id} exceeds room ceiling height`});
  if(b.bottom < -epsilon)issues.push({type:'floor',units:[id],message:`${id} extends below the room floor`});
  for(let j=0;j<i;j++){
   const a=bounds[j];
   if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>epsilon&&Math.min(a.front,b.front)-Math.max(a.back,b.back)>epsilon)issues.push({type:'overlap',units:[units[j].id,id],message:`${units[j].id} overlaps ${id} in plan`});
  }
 }
 return issues;
}

export function snapUnitToWall(room,unit,wall,offset=0){
 validateRoom(room);if(!Number.isFinite(offset)||offset<0)throw Error('Invalid wall clearance');
 const b=unitFootprint(unit),next={x:unit.x,z:unit.z};
 switch(wall){
  case 'back':next.z+=-room.depth/2+offset-b.back;break;
  case 'front':next.z+=room.depth/2-offset-b.front;break;
  case 'left':next.x+=-room.width/2+offset-b.left;break;
  case 'right':next.x+=room.width/2-offset-b.right;break;
  default:throw Error('Unknown wall');
 }
 return next;
}

export function alignToUnit(unit,reference,side,gap=0){
 if(!Number.isFinite(gap)||gap<0||gap>100000)throw Error('Invalid alignment gap');
 const a=unitFootprint(unit),b=unitFootprint(reference),next={x:unit.x,z:unit.z};
 switch(side){
  case 'left':next.x+=b.left-gap-a.right;next.z+=(b.back+b.front-a.back-a.front)/2;break;
  case 'right':next.x+=b.right+gap-a.left;next.z+=(b.back+b.front-a.back-a.front)/2;break;
  case 'back':next.z+=b.back-gap-a.front;next.x+=(b.left+b.right-a.left-a.right)/2;break;
  case 'front':next.z+=b.front+gap-a.back;next.x+=(b.left+b.right-a.left-a.right)/2;break;
  default:throw Error('Unknown alignment side');
 }
 return next;
}

const xml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
export function roomPlanSvg(room,units){
 validateRoom(room);
 const scale=Math.min(820/room.width,560/room.depth),w=room.width*scale,d=room.depth*scale,x=95,y=105,issues=inspectLayout(room,units);
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="800" viewBox="0 0 1100 800" role="img" aria-label="Preliminary room top view"><defs><marker id="room-front-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#24635a"/></marker></defs><rect width="1100" height="800" fill="#f8fafc"/><g font-family="Arial" fill="#18374b"><text x="60" y="42" font-size="23" font-weight="bold">ROKADEX · ROOM LAYOUT / TOP VIEW</text><text x="60" y="65" font-size="12">PRELIMINARY — FULL PANEL ENVELOPES; VERIFY CLEARANCES ON SITE</text><text x="${x}" y="${y-15}" font-size="13">WIDTH ${room.width} mm</text></g><rect x="${x}" y="${y}" width="${w}" height="${d}" fill="#edf4f4" stroke="#173e4c" stroke-width="5"/>`;
 for(const unit of units){
  const b=unitFootprint(unit),bad=issues.some(issue=>issue.units.includes(unit.id)),ux=x+(b.left+room.width/2)*scale,uy=y+(b.back+room.depth/2)*scale,cx=ux+b.width*scale/2,cy=uy+b.depth*scale/2;
  const [sin,cos]=[[0,1],[1,0],[0,-1],[-1,0]][b.rotation/90],arrow=Math.min(b.width,b.depth)*scale*.25;
  svg+=`<g data-unit="${xml(unit.id)}" data-rotation="${b.rotation}" role="button" tabindex="0" aria-label="Select ${xml(unit.name||unit.id)}"><title>${xml(unit.id)} · ${xml(unit.name||'Cabinet')} · ${b.rotation}°</title><rect x="${ux}" y="${uy}" width="${b.width*scale}" height="${b.depth*scale}" fill="${bad?'#f7c9c4':'#92c9b7'}" stroke="${bad?'#a42c26':'#24635a'}" stroke-width="2"/><text x="${ux+5}" y="${uy+16}" font-family="Arial" font-size="12" fill="#18374b">${xml(unit.id)}</text><line x1="${cx}" y1="${cy}" x2="${cx+sin*arrow}" y2="${cy+cos*arrow}" stroke="#24635a" stroke-width="2" marker-end="url(#room-front-arrow)"/></g>`;
 }
 svg+=`<text x="${x+w+15}" y="${y+20}" font-family="Arial" font-size="13" fill="#18374b">DEPTH ${room.depth} mm</text><text x="60" y="${Math.max(710,y+d+45)}" font-family="Arial" font-size="13" fill="${issues.length?'#b13e32':'#37675e'}">${xml(issues.length?issues.map(issue=>issue.message).join(' | '):'No rectangular envelope conflicts detected')}</text></svg>`;
 return svg;
}
