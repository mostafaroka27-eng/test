/** Axis-aligned local panel sizes [X,Y,Z], shared by views and room envelopes. */
export function partSize(part){
 const {length:l,width:w,thickness:t}=part;
 if(![l,w,t].every(value=>Number.isFinite(value)&&value>0))throw Error('Invalid panel dimensions');
 switch(part.kind){
  case 'side':case 'partition':return [t,l,w];
  case 'top':case 'bottom':case 'shelf':case 'drawerBottom':return [l,t,w];
  case 'door':case 'back':case 'drawerFront':return [w,l,t];
  case 'drawerSide':return [t,w,l];
  case 'drawerBack':case 'drawerFace':return [l,w,t];
  default:throw Error(`Unsupported panel kind: ${part.kind}`);
 }
}
