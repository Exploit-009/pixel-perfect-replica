import { describe,it,expect } from 'vitest';
import { validateAssessment, specialties } from '@/lib/xplo';
const plan={objective:'Review my own web application',scope:'localhost:3000',context:'Isolated lab',authorized:true,specialty:'Web security',environment:'Android + Termux'};
describe('Assessment authorization',()=>{
 it('requires explicit ownership or authorization',()=>{expect(()=>validateAssessment({...plan,authorized:false})).toThrow();});
 it('does not permit unknown third-party target plans',()=>{expect(()=>validateAssessment({...plan,context:'Unknown third party'})).toThrow();});
 it('accepts a scoped authorized isolated lab',()=>{expect(validateAssessment(plan).scope).toBe('localhost:3000');});
 it('includes all fourteen requested cybersecurity modules',()=>{expect(specialties).toHaveLength(14);expect(specialties).toContain('Wireless security');});
});
