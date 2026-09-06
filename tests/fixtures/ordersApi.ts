// HTTP test double only. Production code never imports this module.
import { AxiosError, AxiosHeaders, type AxiosAdapter } from 'axios';
import { apiClient } from '../../src/api';
import { createEmptyTrip, type Trip } from '../../src/shared/trip';
import type { OrderShopRow } from '../../src/modules/operations/orders/types';

export const day='2026-09-06';
export function row(shopId:number,boxes=10):OrderShopRow {
  return {id:shopId,clientKey:`test:${shopId}`,shopId,shopName:`Test shop ${shopId}`,serialNo:shopId,boxNo:boxes,
    birds:boxes*10,weight:boxes*15,birdTypeId:1,birdType:'Broiler',mortality:0,rate:null,amount:0,remarks:'[ORDER]'};
}
export function trip(id=123,date=day):Trip {
  return createEmptyTrip({id,tripNo:`TRP-${id}`,tripDate:date,vehicleId:1,vehicleNo:'TEST VEHICLE',
    startStepSubmitted:true,farmStepSubmitted:true,pickupStepSubmitted:true,status:'Draft',version:1,
    ordersCollection:[],orderAssignments:[],assignmentSubmitted:false,collectionFinished:false});
}
export function installOrdersApi(initial:Trip[]) {
  const original=apiClient.defaults.adapter;
  const records=new Map(initial.map(t=>[t.id,structuredClone(t)]));
  const calls:Array<{method:string;url:string;body:Record<string,unknown>}> = [];
  const control={fail:false,whatsapp:false};
  const adapter:AxiosAdapter=async config=>{
    const method=config.method??'get'; const url=config.url??'';
    const body=typeof config.data==='string'?JSON.parse(config.data):config.data??{};
    calls.push({method,url,body});
    const fail=(status:number,message:string):never=>{throw new AxiosError(message,undefined,config,undefined,{data:{error:message},status,statusText:message,headers:new AxiosHeaders(),config});};
    if(control.fail) return fail(503,'Real API unavailable');
    let data:unknown;
    if(url==='/trips' && method==='get') data=[...records.values()];
    else if(url==='/masters/vehicles') data=[{id:1,vehicleNo:1,vehicleNumber:'TEST VEHICLE',noOfBoxes:100,status:'Active'}];
    else {
      const match=url.match(/^\/trips\/(\d+)(.*)$/); if(!match) return fail(404,'Unknown test URL');
      const t=records.get(Number(match[1])); if(!t) return fail(404,'Trip not found');
      if(method==='get' && !match[2]) data=t;
      else if(match[2]==='/steps/deliveries') {
        if(body.expectedVersion!=null && body.expectedVersion!==t.version) return fail(409,'Trip changed');
        if(body.ordersAction==='collection') {
          t.ordersCollection=body.deliveries; t.collectionFinished=body.finishCollection===true;
        } else if(body.ordersAction==='assignment') {
          if(body.mode==='submit' && !control.whatsapp) return fail(409,'WhatsApp confirmation required');
          if(body.deliveries.some((r:OrderShopRow)=>!t.ordersCollection?.some(o=>o.shopId===r.shopId && o.boxNo>=r.boxNo))) return fail(400,'Over assignment');
          t.orderAssignments=body.deliveries;
          t.deliveries=body.deliveries.map((r:OrderShopRow)=>({...r,remarks:`[ORDER] O:${t.id}`,assignedBoxes:r.boxNo}));
          t.assignmentSubmitted=body.mode==='submit';
        } else t.deliveries=body.deliveries;
        t.version=(t.version??0)+1; data=t;
      } else return fail(404,'Unknown test URL');
    }
    return {data:structuredClone(data),status:200,statusText:'OK',headers:new AxiosHeaders(),config};
  };
  apiClient.defaults.adapter=adapter;
  return {records,calls,control,restore:()=>{apiClient.defaults.adapter=original;}};
}
