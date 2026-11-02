import { z } from 'zod';

export const specialties = ['Reconnaissance', 'Network security', 'Web security', 'Penetration testing', 'Vulnerability research', 'Linux security', 'Reverse engineering', 'Malware analysis', 'Digital forensics', 'Cryptography', 'Cloud security', 'Secure coding', 'Incident response', 'Wireless security'];
export const agents = [
 {name:'Recon AI', tag:'DISCOVERY', description:'Map assets. Understand your attack surface.', icon:'radar', color:'mint', prompt:'Help me plan passive reconnaissance for an authorized assessment.'},
 {name:'WebSec AI', tag:'APPLICATION', description:'Find weaknesses. Build stronger applications.', icon:'globe', color:'violet', prompt:'Teach me how to assess my own web application using OWASP WSTG.'},
 {name:'Forensics AI', tag:'INVESTIGATION', description:'Follow the evidence. Uncover the story.', icon:'fingerprint', color:'amber', prompt:'Explain how to preserve and investigate Linux authentication logs.'},
 {name:'Defense AI', tag:'PROTECTION', description:'Harden systems. Stay ahead of threats.', icon:'shield', color:'blue', prompt:'Create a practical Ubuntu server hardening checklist.'},
 {name:'Network AI', tag:'NETWORK', description:'Understand services, packets, and exposure.', icon:'network', color:'blue', prompt:'Help me interpret network traffic from my isolated lab.'},
 {name:'Exploit Research AI', tag:'RESEARCH', description:'Understand vulnerabilities in controlled labs.', icon:'flask', color:'amber', prompt:'Explain a safe workflow for reproducing a CVE in an isolated lab.'},
 {name:'Malware Research AI', tag:'ANALYSIS', description:'Inspect suspicious files without running them.', icon:'bug', color:'violet', prompt:'Guide me through safe static analysis of a suspicious file.'},
 {name:'CodeSec AI', tag:'ENGINEERING', description:'Review code. Fix vulnerabilities at the source.', icon:'code', color:'mint', prompt:'Help me audit code for authentication and authorization weaknesses.'},
];
export const tools = [
 ['Nmap','Network discovery','Network AI'],['Wireshark','Packet analysis','Network AI'],['Burp Suite','Web security testing','WebSec AI'],['OWASP ZAP','Application assessment','WebSec AI'],['Ghidra','Reverse engineering','Exploit Research AI'],['YARA','Pattern-based identification','Malware Research AI'],['Metasploit','Controlled lab research','Exploit Research AI'],['Kali Linux','Security environment','XPLO Security Core'],
];
export const assessmentSchema = z.object({objective:z.string().min(10).max(3000), scope:z.string().min(3).max(2000), context:z.enum(['Isolated lab','Authorized assessment','Unknown third party']), authorized:z.boolean(), specialty:z.string(), environment:z.string()});
export function validateAssessment(input: unknown) {
 const value = assessmentSchema.parse(input);
 if (!value.authorized || value.context === 'Unknown third party') throw new Error('Confirm ownership or written authorization and a defined scope before creating a target-specific plan.');
 return value;
}
/** Request limits shared by the browser (to explain them) and the chat route (to enforce them). */
export const MAX_MESSAGES = 40;
export const MAX_MESSAGE_CHARS = 12000;
export const MAX_MESSAGE_CHARS_LABEL = '12,000';

/**
 * Returns a plain-language reason when a conversation can no longer be sent, or null when it fits.
 * Nothing is trimmed or discarded: the caller keeps the conversation and tells the user what to do.
 */
export function checkConversationLimits(history: { content: string }[]): string | null {
 if (history.some(m => m.content.length > MAX_MESSAGE_CHARS)) return `One message is longer than ${MAX_MESSAGE_CHARS_LABEL} characters, so XPLO cannot use it. Shorten your message, or start a new conversation if the long text came from an earlier reply.`;
 if (history.length > MAX_MESSAGES) return `This conversation has reached its length limit of ${MAX_MESSAGES} messages. Start a new conversation to continue; this one stays available until you leave XPLO.`;
 return null;
}
