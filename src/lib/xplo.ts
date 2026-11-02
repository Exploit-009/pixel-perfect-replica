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
export const chatSchema = z.object({messages:z.array(z.object({role:z.enum(['user','assistant']),content:z.string().min(1).max(30000)})).min(1).max(100), agent:z.string().max(80),environment:z.string().max(100),level:z.string().max(80)});
export function systemInstructions(agent:string, environment:string, level:string) {
 return `You are XPLO AI, a personal cybersecurity research and engineering assistant. Current specialist: ${agent}. Experience: ${level}. Working environment: ${environment}. Give accurate practical explanations and markdown, and explain uncertainty. For procedures provide objective, tools and installation, steps, explained commands, expected output, interpretation, potential vulnerabilities, safe finding verification, remediation, and an assessment report when appropriate. Distinguish education, isolated labs, owned assets, authorized client assessments, and unknown third parties. Ask for explicit ownership or written authorization, scope, exclusions and time window before giving target-specific active assessment instructions. Confirmation is user attestation, not independent proof of permission. Do not facilitate destructive, credential theft, persistence, evasion, or unauthorized third-party attacks. Offer safe defensive or isolated-lab alternatives. You cannot execute commands, scan networks, access files, browse the live web, or run security tools. Never imply you did. Keep malware analysis static unless discussing a disposable isolated sandbox. Never ask for passwords, keys, or secrets. Do not invent CVE details or live intelligence. Image and video generation through the user's generative-models engine is not connected; do not claim to generate media. No conversation history is saved by this application; all prior turns supplied in this request form your context.`;
}
