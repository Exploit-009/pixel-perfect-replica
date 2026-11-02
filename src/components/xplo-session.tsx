import { createContext, useContext, useState, type ReactNode } from 'react';
import type { UIMessage } from 'ai';
export type Thread = {id:string; title:string; agent:string; messages:UIMessage[]};
type Session = {threads:Thread[];createThread:(title:string,agent?:string)=>string; updateMessages:(id:string,messages:UIMessage[])=>void; removeThread:(id:string)=>void; environment:string;setEnvironment:(value:string)=>void;level:string;setLevel:(value:string)=>void;selectedSpecialties:string[];setSelectedSpecialties:(value:string[])=>void};
const SessionContext = createContext<Session | null>(null);
export function XploSession({children}:{children:ReactNode}) {
 const [threads,setThreads]=useState<Thread[]>([]);
 const [environment,setEnvironment]=useState('Android + Termux');
 const [level,setLevel]=useState('Intermediate');
 const [selectedSpecialties,setSelectedSpecialties]=useState(['Web security','Network security','Secure coding']);
 const createThread=(title:string,agent='XPLO Security Core')=>{const id=crypto.randomUUID();setThreads(old=>[{id,title:title.slice(0,52),agent,messages:[]},...old]);return id;};
 const updateMessages=(id:string,messages:UIMessage[])=>setThreads(old=>old.map(t=>t.id===id?{...t,messages}:t));
 return <SessionContext.Provider value={{threads,createThread,updateMessages,removeThread:(id)=>setThreads(old=>old.filter(t=>t.id!==id)),environment,setEnvironment,level,setLevel,selectedSpecialties,setSelectedSpecialties}}>{children}</SessionContext.Provider>;
}
export function useXplo(){const value=useContext(SessionContext);if(!value)throw new Error('XPLO session is missing');return value;}
