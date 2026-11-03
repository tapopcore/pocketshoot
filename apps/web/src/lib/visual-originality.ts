import "server-only";
import sharp from "sharp";
import type {CheckResult} from "@packshot/core";
/** Local perceptual comparison only: previous private outputs never leave this backend. */
export const ORIGINALITY_VERSION="2026-11-01.local-1";
interface Features {hash:boolean[];spatial:Buffer;palette:number[]}
const cosine=Array.from({length:8},(_,u)=>Array.from({length:32},(_,x)=>Math.cos((2*x+1)*u*Math.PI/64)));
async function features(image:Buffer):Promise<Features>{
 const rgb=await sharp(image).rotate().flatten({background:"#fff"}).removeAlpha().toColourspace("srgb").resize(32,32,{fit:"fill"}).raw().toBuffer();
 const gray=Array.from({length:1024},(_,i)=>.299*rgb[i*3]+.587*rgb[i*3+1]+.114*rgb[i*3+2]);
 const coeff:number[]=[];
 for(let u=0;u<8;u++)for(let v=0;v<8;v++){let n=0;for(let x=0;x<32;x++)for(let y=0;y<32;y++)n+=gray[y*32+x]*cosine[u][x]*cosine[v][y];if(u||v)coeff.push(n);}
 const median=[...coeff].sort((a,b)=>a-b)[Math.floor(coeff.length/2)];
 const palette=Array(64).fill(0) as number[];
 for(let i=0;i<rgb.length;i+=3)palette[(rgb[i]>>6)*16+(rgb[i+1]>>6)*4+(rgb[i+2]>>6)]++;
 return {hash:coeff.map(n=>n>median),spatial:rgb,palette:palette.map(n=>n/1024)};
}
function compare(a:Features,b:Features){
 const hashDistance=a.hash.filter((v,i)=>v!==b.hash[i]).length;
 let spatialDistance=0;for(let i=0;i<a.spatial.length;i++)spatialDistance+=Math.abs(a.spatial[i]-b.spatial[i]);spatialDistance/=a.spatial.length*255;
 const paletteDistance=a.palette.reduce((s,v,i)=>s+Math.abs(v-b.palette[i]),0)/2;
 const duplicate=(hashDistance<=12&&spatialDistance<=.065&&paletteDistance<=.1)||(hashDistance<=6&&spatialDistance<=.08&&paletteDistance<=.16);
 return {hashDistance,spatialDistance,paletteDistance,duplicate};
}
export async function localOriginalityCheck(image:Buffer,previous:{id:string;image:Buffer}[]):Promise<CheckResult>{
 if(!previous.length)return {type:"visual_originality",score:1,decision:"pass",details:{method:ORIGINALITY_VERSION,compared:0,note:"No matching delivered history available; no uniqueness claim is inferred."}};
 const current=await features(image);
 const comparisons=await Promise.all(previous.map(async p=>({assetId:p.id,...compare(current,await features(p.image))})));
 const closest=[...comparisons].sort((a,b)=>a.hashDistance/63+a.spatialDistance+a.paletteDistance-(b.hashDistance/63+b.spatialDistance+b.paletteDistance))[0];
 const duplicate=comparisons.find(c=>c.duplicate);
 return {type:"visual_originality",score:duplicate?0:1,decision:duplicate?"fail":"pass",details:{method:ORIGINALITY_VERSION,compared:comparisons.length,closest,matchedAssetId:duplicate?.assetId??null,note:duplicate?"The composition, spatial colour layout and perceptual structure closely repeat a prior delivered photo.":"No near-duplicate found by local perceptual/layout comparison. This is not a semantic or artistic-quality guarantee."}};
}


const STUDIO_ORIGINALITY_VERSION="2026-11-03.appearance-2";
/** Exclude white margins and pale contact shadows before measuring product structure. */
async function foreground(image:Buffer){
 const {data,info}=await sharp(image).rotate().flatten({background:"#fff"}).resize(256,256,{fit:"inside"}).removeAlpha().toColourspace("srgb").raw().toBuffer({resolveWithObject:true});
 let left=info.width,top=info.height,right=0,bottom=0,count=0,sx=0,sy=0;
 const points:[number,number][]=[];
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
  const p=(y*info.width+x)*3,r=data[p],g=data[p+1],b=data[p+2];
  if(Math.min(r,g,b)<210||(Math.max(r,g,b)-Math.min(r,g,b)>22&&Math.min(r,g,b)<240)){
   left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);count++;sx+=x;sy+=y;points.push([x,y]);
  }
 }
 if(count<40)return null;
 const mx=sx/count,my=sy/count;
 let xx=0,yy=0,xy=0;
 for(const [x,y] of points){xx+=(x-mx)**2;yy+=(y-my)**2;xy+=(x-mx)*(y-my);}
 const angle=Math.atan2(2*xy,xx-yy)*90/Math.PI;
 const png=await sharp(data,{raw:{width:info.width,height:info.height,channels:3}}).extract({left,top,width:right-left+1,height:bottom-top+1}).png().toBuffer();
 return {png,angle};
}
async function studioFeatures(image:Buffer):Promise<Features[]>{
 const object=await foreground(image);
 if(!object)return [await features(image)];
 const aligned=await sharp(object.png).rotate(90-object.angle,{background:"#fff"}).png().toBuffer();
 const cropped=(await foreground(aligned))?.png??aligned;
 // Normalize the appearance area, not white padding: slim products otherwise lose label information.
 const canvas=await sharp(cropped).resize(32,32,{fit:"fill"}).png().toBuffer();
 return [await features(canvas),await features(await sharp(canvas).rotate(180).png().toBuffer())];
}
/** Detect same-pack copies after zoom, translation or image-plane rotation; never exports history. */
export async function studioOriginalityCheck(image:Buffer,previous:{id:string;image:Buffer}[]):Promise<CheckResult>{
 const current=await studioFeatures(image);
 const comparisons=await Promise.all(previous.map(async p=>{
  const prior=await studioFeatures(p.image);
  const variants=current.flatMap(a=>prior.map(b=>{let intersection=0,union=0;for(let i=0;i<a.spatial.length;i+=3){const am=Math.min(a.spatial[i],a.spatial[i+1],a.spatial[i+2])<220,bm=Math.min(b.spatial[i],b.spatial[i+1],b.spatial[i+2])<220;if(am||bm)union++;if(am&&bm)intersection++;}return {...compare(a,b),silhouetteOverlap:union?intersection/union:0};}));
  const best=variants.sort((a,b)=>a.hashDistance/63+a.spatialDistance-(b.hashDistance/63+b.spatialDistance))[0];
  // A shared outline alone is not evidence of duplication (for example front/back labels on a bottle).
  const duplicate=variants.some(c=>c.paletteDistance<=.14&&((c.hashDistance<=10&&c.spatialDistance<=.07)||(c.silhouetteOverlap>=.98&&c.spatialDistance<=.03)));
  return {assetId:p.id,...best,duplicate};
 }));
 const duplicate=comparisons.find(c=>c.duplicate);
 return {type:"visual_originality",score:duplicate?0:1,decision:duplicate?"fail":"pass",details:{method:STUDIO_ORIGINALITY_VERSION,scope:"current-studio-pack",compared:previous.length,matchedAssetId:duplicate?.assetId??null,comparisons,note:duplicate?"The product repeats another delivered frame after removing white margins, scale and image-plane rotation.":"No close foreground duplicate found within this pack. Physical view is assessed separately against its planned geometry."}};
}
