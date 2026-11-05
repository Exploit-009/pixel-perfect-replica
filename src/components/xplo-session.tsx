import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { UIMessage } from 'ai';
export type Thread = {id:string; title:string; agent:string; messages:UIMessage[]};
type Session = {
 threads:Thread[];
 /** Creates a conversation. An optional first prompt is held in memory until the chat opens and takes it. */
 createThread:(title:string,agent?:string,firstPrompt?:string)=>string;
 /** Returns the first prompt waiting for this conversation exactly once, then forgets it. */
 takeFirstPrompt:(id:string)=>string|null;
 /** Puts a conversation the user chose to save back into memory so it can be continued. */
 restoreThread:(thread:Thread)=>void;
 updateMessages:(id:string,messages:UIMessage[])=>void; removeThread:(id:string)=>void;reset:()=>void;
 environment:string;setEnvironment:(value:string)=>void;level:string;setLevel:(value:string)=>void;selectedSpecialties:string[];setSelectedSpecialties:(value:string[])=>void};
// Kept on globalThis so a hot reload of this file reuses the same context instead of orphaning open pages.
const holder = globalThis as { __xploSessionContext?: ReturnType<typeof createContext<Session | null>> };
const SessionContext = (holder.__xploSessionContext ??= createContext<Session | null>(null));
export function XploSession({children}:{children:ReactNode}) {
 const [threads,setThreads]=useState<Thread[]>([]);
 const [environment,setEnvironment]=useState('Android + Termux');
 const [level,setLevel]=useState('Intermediate');
 const [selectedSpecialties,setSelectedSpecialties]=useState(['Web security','Network security','Secure coding']);
 // Memory only: never written to browser storage, and cleared on sign-out or reload.
 const firstPrompts=useRef(new Map<string,string>());
 const createThread=useCallback((title:string,agent='XPLO Security Core',firstPrompt?:string)=>{
  const id=crypto.randomUUID();
  if(firstPrompt&&firstPrompt.trim())firstPrompts.current.set(id,firstPrompt);
  setThreads(old=>[{id,title:title.slice(0,52),agent,messages:[]},...old]);
  return id;
 },[]);
 const takeFirstPrompt=useCallback((id:string)=>{const prompt=firstPrompts.current.get(id)??null;firstPrompts.current.delete(id);return prompt;},[]);
 const restoreThread=useCallback((thread:Thread)=>setThreads(old=>old.some(t=>t.id===thread.id)?old:[thread,...old]),[]);
 const updateMessages=useCallback((id:string,messages:UIMessage[])=>setThreads(old=>old.map(t=>t.id===id?{...t,messages}:t)),[]);
 const removeThread=useCallback((id:string)=>{firstPrompts.current.delete(id);setThreads(old=>old.filter(t=>t.id!==id));},[]);
 const reset=useCallback(()=>{firstPrompts.current.clear();setThreads([]);},[]);
 const value=useMemo(()=>({threads,createThread,takeFirstPrompt,restoreThread,updateMessages,removeThread,reset,environment,setEnvironment,level,setLevel,selectedSpecialties,setSelectedSpecialties}),[threads,createThread,takeFirstPrompt,restoreThread,updateMessages,removeThread,reset,environment,level,selectedSpecialties]);
 return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
export function useXplo(){const value=useContext(SessionContext);if(!value)throw new Error('XPLO session is missing');return value;}
