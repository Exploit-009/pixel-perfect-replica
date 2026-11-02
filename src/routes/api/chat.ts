import { createFileRoute } from '@tanstack/react-router';
import { streamResponse, GatewayError } from '@lovable.dev/ai-gateway';
import { buildModelInput, chatSchema, systemInstructions } from '@/lib/xplo';

export const Route = createFileRoute('/api/chat')({server:{handlers:{POST:async({request})=>{
 const origin=request.headers.get('origin');
 if(origin && origin!==new URL(request.url).origin)return Response.json({error:'Request origin not allowed.'},{status:403});
 const raw=await request.text();
 if(raw.length>120000)return Response.json({error:'This conversation is too long. Start a new conversation.'},{status:413});
 let body;try{body=chatSchema.parse(JSON.parse(raw));}catch{return Response.json({error:'Please send a valid conversation.'},{status:400});}
 const input=buildModelInput(body.messages);
 if(!input)return Response.json({error:'Please send a valid conversation.'},{status:400});
 try{
 const result=await streamResponse({model:'openai/gpt-6-astra',instructions:systemInstructions(body.agent,body.environment,body.level,body.specialties),input},{signal:request.signal});
 const encoder=new TextEncoder();
 const stream=new ReadableStream({async start(controller){
  try{for await(const event of result){
   if(event.type==='response.output_text.delta')controller.enqueue(encoder.encode(JSON.stringify({text:event.delta})+'\n'));
   if(event.type==='response.refusal.delta')controller.enqueue(encoder.encode(JSON.stringify({text:event.delta})+'\n'));
  }controller.enqueue(encoder.encode(JSON.stringify({done:true})+'\n'));}
  catch(error){if(!request.signal.aborted)controller.enqueue(encoder.encode(JSON.stringify({error:'The response was interrupted. Your conversation remains here; you can try again.'})+'\n'));}
  finally{controller.close();}
 }});
 return new Response(stream,{headers:{'Content-Type':'application/x-ndjson','Cache-Control':'no-store'}});
 }catch(error){
 if(request.signal.aborted)return new Response(null,{status:499});
 const message=error instanceof GatewayError && error.httpStatus===402?'Online AI needs workspace credits before it can respond.':'Online AI is unavailable right now. Your message has not been saved.';
 return Response.json({error:message},{status:503});
 }
}}}});
