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
