/* eslint-disable @next/next/no-img-element -- original signed photo URLs */
"use client";
import {useEffect,useRef} from "react";
import {createPortal} from "react-dom";
import {ChevronLeft,ChevronRight,X} from "lucide-react";
export function ReferenceViewer({photos,index,onIndex,onClose}:{photos:{url:string|null|undefined;label?:string}[];index:number;onIndex:(n:number)=>void;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),close=useRef(onClose);close.current=onClose;
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const d=dialog.current;d?.showModal();const old=document.body.style.overflow;document.body.style.overflow="hidden";return()=>{d?.close();document.body.style.overflow=old;previous?.focus();};},[]);
 return createPortal(<dialog ref={dialog} className="reference-viewer" aria-label="Your uploaded photo" onCancel={e=>{e.preventDefault();close.current();}}><header><div><b>Your original photo</b><span>{photos[index]?.label??"Reference"}{photos.length>1?" · "+(index+1)+" / "+photos.length:""}</span></div><button type="button" aria-label="Close original photo" onClick={onClose}><X size={22}/></button></header><div className="reference-image"><img src={photos[index]?.url??""} alt={photos[index]?.label??"Your uploaded product reference"}/></div>{photos.length>1&&<footer><button type="button" disabled={index===0} aria-label="Previous original photo" onClick={()=>onIndex(index-1)}><ChevronLeft size={22}/></button><span>{index+1} of {photos.length}</span><button type="button" disabled={index===photos.length-1} aria-label="Next original photo" onClick={()=>onIndex(index+1)}><ChevronRight size={22}/></button></footer>}</dialog>,document.body);
}
