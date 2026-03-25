/**
 * @route GET /api/widget/inject.js
 * @description Project Gateway-Intake: Serves the ultra-lightweight widget injection
 *   script. Reads data-widget-token from the host page, fetches config from Supabase
 *   RPC, and renders a dynamic iframe with auto-resize via postMessage.
 *   Bundle target: <15KB gzipped.
 */

import { NextResponse } from "next/server";

const WIDGET_SCRIPT = `
(function(){
  "use strict";
  var root=document.getElementById("iworkr-intake-root");
  if(!root)return;
  var token=root.getAttribute("data-widget-token");
  if(!token)return;

  var SUPABASE_URL="${process.env.NEXT_PUBLIC_SUPABASE_URL || ""}";
  var SUPABASE_KEY="${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""}";
  var INTAKE_URL="${process.env.NEXT_PUBLIC_SUPABASE_URL || ""}/functions/v1/intake-router";
  var APP_URL="${process.env.NEXT_PUBLIC_APP_URL || "https://app.iworkr.com"}";

  var iframe=document.createElement("iframe");
  iframe.style.cssText="width:100%;border:none;overflow:hidden;min-height:500px;transition:height 0.3s ease";
  iframe.setAttribute("scrolling","no");
  iframe.setAttribute("title","iWorkr Intake Form");
  root.appendChild(iframe);

  window.addEventListener("message",function(e){
    if(e.data&&e.data.type==="IWORKR_RESIZE"&&e.data.height){
      iframe.style.height=e.data.height+"px";
    }
    if(e.data&&e.data.type==="IWORKR_SUBMITTED"){
      if(typeof root.dataset.onSubmit==="function")root.dataset.onSubmit(e.data);
    }
  });

  fetch(SUPABASE_URL+"/rest/v1/rpc/get_widget_config",{
    method:"POST",
    headers:{"Content-Type":"application/json","apikey":SUPABASE_KEY},
    body:JSON.stringify({p_embed_token:token})
  })
  .then(function(r){return r.json()})
  .then(function(config){
    if(!config||!config.is_active)return;
    var doc=iframe.contentDocument||iframe.contentWindow.document;
    var themeColor=config.theme_color||"#10B981";
    var sector=config.sector||"TRADES";
    var fields=config.config_jsonb||{};
    var customQuestions=fields.custom_questions||[];
    var requirePhoto=fields.require_photo||false;
    var showUrgency=fields.show_urgency||false;
    var multiStep=fields.multi_step||false;

    var urgencyOptions=sector==="CARE"
      ?'<option value="STANDARD">Standard</option><option value="URGENT">Urgent</option><option value="EMERGENCY">Emergency</option>'
      :'<option value="LOW">Low</option><option value="STANDARD">Standard</option><option value="URGENT">Urgent</option><option value="EMERGENCY">Emergency</option>';

    var customFieldsHtml=customQuestions.map(function(q,i){
      return '<div style="margin-bottom:12px"><label style="display:block;font-size:13px;color:#9CA3AF;margin-bottom:4px">'+q+'</label><input type="text" name="custom_'+i+'" style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid #374151;background:#111;color:#E5E7EB;font-size:14px;outline:none" /></div>';
    }).join("");

    var html='<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'
      +'*{margin:0;padding:0;box-sizing:border-box}'
      +'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:transparent;color:#E5E7EB}'
      +'.form-wrap{background:#0A0A0A;border:1px solid #1F2937;border-radius:12px;padding:24px;max-width:520px;margin:0 auto}'
      +'h2{font-size:18px;font-weight:600;color:#F3F4F6;margin-bottom:4px}'
      +'.subtitle{font-size:13px;color:#6B7280;margin-bottom:20px}'
      +'label{display:block;font-size:13px;color:#9CA3AF;margin-bottom:4px}'
      +'input,select,textarea{width:100%;padding:10px 12px;border-radius:8px;border:1px solid #374151;background:#111;color:#E5E7EB;font-size:14px;outline:none;transition:border-color .2s}'
      +'input:focus,select:focus,textarea:focus{border-color:'+themeColor+'}'
      +'.row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}'
      +'.field{margin-bottom:12px}'
      +'.honeypot{position:absolute;left:-9999px;opacity:0;height:0;width:0;overflow:hidden}'
      +'button[type=submit]{width:100%;padding:12px;border-radius:8px;border:none;background:'+themeColor+';color:#fff;font-size:14px;font-weight:600;cursor:pointer;margin-top:8px;transition:opacity .2s}'
      +'button[type=submit]:hover{opacity:0.9}'
      +'button[type=submit]:disabled{opacity:0.5;cursor:not-allowed}'
      +'.success{text-align:center;padding:40px 20px}'
      +'.success svg{width:48px;height:48px;color:'+themeColor+';margin-bottom:12px}'
      +'.success h3{font-size:18px;color:#F3F4F6;margin-bottom:8px}'
      +'.success p{font-size:14px;color:#9CA3AF}'
      +'</style></head><body>'
      +'<div class="form-wrap" id="form-container">'
      +'<h2>'+(config.name||"Get a Quote")+'</h2>'
      +'<p class="subtitle">'+(config.welcome_message||"How can we help you today?")+'</p>'
      +'<form id="intake-form">'
      +'<div class="row"><div class="field"><label>First Name *</label><input type="text" name="first_name" required /></div>'
      +'<div class="field"><label>Last Name *</label><input type="text" name="last_name" required /></div></div>'
      +'<div class="row"><div class="field"><label>Email</label><input type="email" name="email" /></div>'
      +'<div class="field"><label>Phone</label><input type="tel" name="phone" /></div></div>'
      +'<div class="field"><label>Address</label><input type="text" name="address" placeholder="Street address, suburb, state" /></div>'
      +(showUrgency?'<div class="field"><label>Urgency</label><select name="urgency">'+urgencyOptions+'</select></div>':'')+customFieldsHtml
      +'<div class="field"><label>Details</label><textarea name="details" rows="3" placeholder="Describe your needs..."></textarea></div>'
      +(requirePhoto?'<div class="field"><label>Upload Photo'+(fields.require_photo_mandatory?" *":"")+'</label><input type="file" name="photo" accept="image/*" style="padding:8px" /></div>':'')
      +'<div class="honeypot"><label>Website</label><input type="text" name="website" tabindex="-1" autocomplete="off" /></div>'
      +'<button type="submit" id="submit-btn">Submit Request</button>'
      +'</form></div>'
      +'<div id="success-view" style="display:none" class="success">'
      +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
      +'<h3>Request Submitted!</h3>'
      +'<p>'+(config.success_message||"Thank you! We will be in touch shortly.")+'</p>'
      +'</div>'
      +'<script>'
      +'var ro=new ResizeObserver(function(entries){window.parent.postMessage({type:"IWORKR_RESIZE",height:document.body.scrollHeight+20},"*")});'
      +'ro.observe(document.body);'
      +'document.getElementById("intake-form").addEventListener("submit",function(e){'
      +'e.preventDefault();var btn=document.getElementById("submit-btn");btn.disabled=true;btn.textContent="Sending...";'
      +'var fd=new FormData(e.target);var data={};fd.forEach(function(v,k){data[k]=v});'
      +'var customFields={};Object.keys(data).forEach(function(k){if(k.startsWith("custom_")){customFields[k]=data[k]}});'
      +'fetch("'+INTAKE_URL+'",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({'
      +'embed_token:"'+token+'",'
      +'first_name:data.first_name,last_name:data.last_name,'
      +'email:data.email,phone:data.phone,'
      +'address:data.address,urgency:data.urgency||"STANDARD",'
      +'captured_data:Object.assign({details:data.details},customFields),'
      +'website:data.website,'
      +'media_urls:[]})})'
      +'.then(function(r){return r.json()})'
      +'.then(function(res){'
      +'if(res.success){document.getElementById("form-container").style.display="none";document.getElementById("success-view").style.display="block";'
      +'window.parent.postMessage({type:"IWORKR_SUBMITTED",lead_id:res.lead_id},"*");'
      +'setTimeout(function(){window.parent.postMessage({type:"IWORKR_RESIZE",height:document.body.scrollHeight+20},"*")},100)}'
      +'else{btn.disabled=false;btn.textContent="Submit Request";alert(res.error||"Something went wrong")}})'
      +'.catch(function(){btn.disabled=false;btn.textContent="Submit Request";alert("Network error. Please try again.")});'
      +'});</script></body></html>';

    doc.open();doc.write(html);doc.close();
    setTimeout(function(){iframe.style.height=(iframe.contentDocument.body.scrollHeight+20)+"px"},200);
  })
  .catch(function(err){console.error("iWorkr widget error:",err)});
})();
`;

export async function GET() {
  return new NextResponse(WIDGET_SCRIPT, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
