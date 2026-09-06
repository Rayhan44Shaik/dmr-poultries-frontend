import { withTransaction } from '../config/db.js';
import { AppError } from '../middleware/errorHandler.js';

/** Real WhatsApp Cloud API only. Missing provider configuration is an error,
 * never a simulated send or a reason to bypass the assignment gate. */
export async function sendAssignmentWhatsApp(tripId: number, body: Record<string, unknown>) {
  const phoneId=process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token=process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneId || !token) throw new AppError(503,'BLOCKED — BACKEND GAP: WhatsApp provider is not configured');
  return withTransaction(async client=>{
    const trip=(await client.query('SELECT * FROM trips WHERE id=$1 FOR UPDATE',[tripId])).rows[0];
    if (!trip || trip.deleted) throw new AppError(404,'Trip not found');
    if (trip.status!=='Draft' || trip.assignment_submitted) throw new AppError(409,'Assignment is not editable');
    if (!trip.orders_hash || body.ordersHash!==trip.orders_hash) throw new AppError(409,'Assignment changed. Refresh its PDF before sending.');
    if (!(await client.query('SELECT 1 FROM trip_order_rows WHERE trip_id=$1 AND assigned_boxes>0',[tripId])).rowCount) throw new AppError(400,'Save assignment before sending');
    if (trip.whatsapp_confirmed_hash===trip.orders_hash && trip.whatsapp_message_id) return {sent:true,messageId:trip.whatsapp_message_id};
    const supervisor=(await client.query('SELECT phone_number FROM employees WHERE id=$1',[trip.supervisor_id])).rows[0];
    let recipient=String(supervisor?.phone_number??'').replace(/\D/g,'');
    if (recipient.length===10) recipient=`91${recipient}`;
    if (!/^\d{10,15}$/.test(recipient)) throw new AppError(400,'Supervisor mobile is missing or invalid');
    const pdf=Buffer.from(String(body.pdfBase64??''),'base64');
    if (pdf.length===0 || pdf.length>10_000_000 || pdf.subarray(0,4).toString()!=='%PDF') throw new AppError(400,'A valid assignment PDF is required');
    const graph=`https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || 'v23.0'}/${phoneId}`;
    const media=new FormData();
    media.append('messaging_product','whatsapp'); media.append('type','application/pdf');
    media.append('file',new Blob([new Uint8Array(pdf)],{type:'application/pdf'}),'assignment.pdf');
    const upload=await fetch(`${graph}/media`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:media,signal:AbortSignal.timeout(25_000)});
    const uploaded=await upload.json() as {id?:string};
    if (!upload.ok || !uploaded.id) throw new AppError(502,'WhatsApp PDF upload failed; assignment remains unconfirmed');
    const response=await fetch(`${graph}/messages`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
      body:JSON.stringify({messaging_product:'whatsapp',to:recipient,type:'document',document:{id:uploaded.id,filename:String(body.fileName??'assignment.pdf'),caption:`DMR Poultries assignment for ${trip.trip_no}`}}),
      signal:AbortSignal.timeout(25_000)});
    const sent=await response.json() as {messages?:Array<{id?:string}>};
    const messageId=sent.messages?.[0]?.id;
    if (!response.ok || !messageId) throw new AppError(502,'WhatsApp send failed; assignment remains unconfirmed');
    await client.query('UPDATE trips SET whatsapp_confirmed_hash=orders_hash,whatsapp_message_id=$2 WHERE id=$1',[tripId,messageId]);
    return {sent:true,messageId};
  });
}
