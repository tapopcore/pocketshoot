"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
export function ResumeDraft({scope}:{scope:string}){
 const [name,setName]=useState<string|null>(null);
 useEffect(()=>{try{const d=JSON.parse(localStorage.getItem("pocketshoot:draft:v2:"+scope)||"null");if(d?.productId&&d?.profile&&Date.now()-d.updatedAt<30*86400000)setName(String(d.name||"Your product"));}catch{}},[scope]);
 return name?<Link href="/app/new" className="mb-8 flex min-h-24 items-center justify-between gap-4 rounded-2xl border border-line bg-card p-5"><span><span className="tracked text-mute">Continue your draft</span><strong className="mt-2 block text-base">{name}</strong></span><span className="text-sm font-semibold text-accent">Continue →</span></Link>:null;
}