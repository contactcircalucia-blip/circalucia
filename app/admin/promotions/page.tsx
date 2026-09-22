"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import AdminNav from "@/components/AdminNav";

type Product = { id:string; name:string; collection:string|null; is_active:boolean };
type Promotion = {
  id:string; code:string; description:string|null; discount_type:"percentage"|"fixed";
  discount_value:number; minimum_order_value:number; maximum_discount:number|null;
  starts_at:string|null; expires_at:string|null; usage_limit:number|null; usage_count:number;
  per_customer_limit:number; applies_to:string; is_active:boolean; is_public:boolean;
};

type Form = {
  code:string; description:string; discount_type:"percentage"|"fixed"; discount_value:string;
  minimum_order_value:string; maximum_discount:string; starts_at:string; expires_at:string;
  usage_limit:string; per_customer_limit:string; applies_to:"all"|"products"|"collections";
  is_active:boolean; is_public:boolean; product_ids:string[]; collections:string[];
};

const empty:Form={code:"",description:"",discount_type:"percentage",discount_value:"10",minimum_order_value:"0",maximum_discount:"",starts_at:"",expires_at:"",usage_limit:"",per_customer_limit:"1",applies_to:"all",is_active:true,is_public:true,product_ids:[],collections:[]};
const input:React.CSSProperties={width:"100%",padding:"11px 12px",border:"1px solid var(--line)",background:"var(--paper)",color:"var(--ink)",boxSizing:"border-box"};
const label:React.CSSProperties={display:"grid",gap:7,fontSize:12,letterSpacing:".04em"};
function localValue(v:string|null){ if(!v)return ""; const d=new Date(v); const z=new Date(d.getTime()-d.getTimezoneOffset()*60000); return z.toISOString().slice(0,16); }
function money(v:number){return `₹${Number(v||0).toLocaleString("en-IN",{maximumFractionDigits:2})}`}

export default function PromotionsAdmin(){
 const [checked,setChecked]=useState(false),[isAdmin,setIsAdmin]=useState(false),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 const [promos,setPromos]=useState<Promotion[]>([]),[products,setProducts]=useState<Product[]>([]),[form,setForm]=useState<Form>({...empty}),[editing,setEditing]=useState<string|null>(null);
 const [error,setError]=useState(""),[message,setMessage]=useState("");
 const collections=useMemo(()=>Array.from(new Set(products.map(p=>p.collection).filter((x):x is string=>!!x))).sort(),[products]);
 useEffect(()=>{(async()=>{const {data:{user}}=await supabase.auth.getUser(); if(!user){setChecked(true);setLoading(false);return;} const {data}=await supabase.from("profiles").select("is_admin").eq("id",user.id).maybeSingle(); setIsAdmin(data?.is_admin===true);setChecked(true);})();},[]);
 useEffect(()=>{if(isAdmin)load(); else if(checked)setLoading(false)},[isAdmin,checked]);
 async function load(){setLoading(true);setError(""); const [a,b]=await Promise.all([supabase.from("promotions").select("*").order("created_at",{ascending:false}),supabase.from("products").select("id,name,collection,is_active").order("name")]); if(a.error||b.error){setError(a.error?.message||b.error?.message||"Unable to load promotions.");}else{setPromos((a.data||[]) as Promotion[]);setProducts((b.data||[]) as Product[]);} setLoading(false);}
 async function edit(p:Promotion){setEditing(p.id);setError("");setMessage(""); const [pp,pc]=await Promise.all([supabase.from("promotion_products").select("product_id").eq("promotion_id",p.id),supabase.from("promotion_collections").select("collection").eq("promotion_id",p.id)]); setForm({code:p.code,description:p.description||"",discount_type:p.discount_type,discount_value:String(p.discount_value),minimum_order_value:String(p.minimum_order_value||0),maximum_discount:p.maximum_discount==null?"":String(p.maximum_discount),starts_at:localValue(p.starts_at),expires_at:localValue(p.expires_at),usage_limit:p.usage_limit==null?"":String(p.usage_limit),per_customer_limit:String(p.per_customer_limit||1),applies_to:(p.applies_to==="product"?"products":p.applies_to==="collection"?"collections":p.applies_to) as Form["applies_to"],is_active:p.is_active,is_public:p.is_public,product_ids:(pp.data||[]).map(x=>x.product_id),collections:(pc.data||[]).map(x=>x.collection)}); window.scrollTo({top:0,behavior:"smooth"});}
 async function save(){setSaving(true);setError("");setMessage(""); try{const code=form.code.trim().toUpperCase(); const dv=Number(form.discount_value); if(!code)throw new Error("Promo code is required."); if(!(dv>0))throw new Error("Discount must be greater than zero."); if(form.discount_type==="percentage"&&dv>100)throw new Error("Percentage cannot exceed 100%."); if(form.applies_to==="products"&&!form.product_ids.length)throw new Error("Select at least one product."); if(form.applies_to==="collections"&&!form.collections.length)throw new Error("Select at least one collection."); const payload={code,description:form.description.trim()||null,discount_type:form.discount_type,discount_value:dv,minimum_order_value:Number(form.minimum_order_value||0),maximum_discount:form.maximum_discount?Number(form.maximum_discount):null,starts_at:form.starts_at?new Date(form.starts_at).toISOString():null,expires_at:form.expires_at?new Date(form.expires_at).toISOString():null,usage_limit:form.usage_limit?Number(form.usage_limit):null,per_customer_limit:Math.max(1,Number(form.per_customer_limit||1)),applies_to:form.applies_to,is_active:form.is_active,is_public:form.is_public,updated_at:new Date().toISOString()}; let id=editing; if(editing){const {error}=await supabase.from("promotions").update(payload).eq("id",editing);if(error)throw error;}else{const {data,error}=await supabase.from("promotions").insert(payload).select("id").single();if(error)throw error;id=data.id;} if(!id)throw new Error("Promotion could not be saved."); await Promise.all([supabase.from("promotion_products").delete().eq("promotion_id",id),supabase.from("promotion_collections").delete().eq("promotion_id",id)]); if(form.applies_to==="products"){const {error}=await supabase.from("promotion_products").insert(form.product_ids.map(product_id=>({promotion_id:id,product_id})));if(error)throw error;} if(form.applies_to==="collections"){const {error}=await supabase.from("promotion_collections").insert(form.collections.map(collection=>({promotion_id:id,collection})));if(error)throw error;} setMessage(editing?"Promotion updated.":"Promotion created.");setEditing(null);setForm({...empty});await load();}catch(e:any){setError(e?.message||"Unable to save promotion.");}finally{setSaving(false)}}
 async function toggle(p:Promotion){const {error}=await supabase.from("promotions").update({is_active:!p.is_active,updated_at:new Date().toISOString()}).eq("id",p.id);if(error)setError(error.message);else load();}
 async function removePromotion(p:Promotion){
  setError("");setMessage("");
  if(Number(p.usage_count||0)>0){
   setError(`${p.code} has successful redemptions and cannot be permanently deleted. Deactivate it instead so order and promotion history remain intact.`);
   return;
  }
  const confirmed=window.confirm(`Delete promo ${p.code}? This permanently removes the promotion and cannot be undone.`);
  if(!confirmed)return;
  try{
   if(editing===p.id){setEditing(null);setForm({...empty});}
   const {error:productError}=await supabase.from("promotion_products").delete().eq("promotion_id",p.id);
   if(productError)throw productError;
   const {error:collectionError}=await supabase.from("promotion_collections").delete().eq("promotion_id",p.id);
   if(collectionError)throw collectionError;
   const {error:deleteError}=await supabase.from("promotions").delete().eq("id",p.id);
   if(deleteError)throw deleteError;
   setMessage(`${p.code} deleted permanently.`);
   await load();
  }catch(e:any){
   setError(e?.message||"Unable to delete promotion.");
  }
 }
 function pickProduct(id:string){setForm(f=>({...f,product_ids:f.product_ids.includes(id)?f.product_ids.filter(x=>x!==id):[...f.product_ids,id]}))}
 function pickCollection(c:string){setForm(f=>({...f,collections:f.collections.includes(c)?f.collections.filter(x=>x!==c):[...f.collections,c]}))}
 if(!checked||loading)return <section className="section"><p className="eyebrow">ADMIN</p><h1>Loading promotions...</h1></section>;
 if(!isAdmin)return <section className="section"><p className="eyebrow">ADMIN</p><h1>Access denied.</h1><Link href="/account" className="button">Account</Link></section>;
 return <main className="page">
  <section className="section">
   <div className="container">
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:"20px",marginBottom:"22px",flexWrap:"wrap"}}>
     <div>
      <p style={{margin:"0 0 8px",fontSize:"12px",letterSpacing:"0.16em",textTransform:"uppercase",color:"var(--muted)"}}>Circa Lucia · Administration</p>
      <h1 style={{margin:0,fontFamily:"Cormorant Garamond, serif",fontSize:"48px",fontWeight:500}}>Promotions</h1>
     </div>
     <button type="button" onClick={load} disabled={loading} style={{padding:"12px 18px",border:"1px solid var(--line)",background:"transparent",color:"var(--ink)",cursor:loading?"not-allowed":"pointer",opacity:loading?0.6:1}}>
      {loading?"Refreshing...":"Refresh promotions"}
     </button>
    </div>

    <AdminNav />

    <div style={{marginBottom:"28px"}}>
     <p style={{margin:0,maxWidth:"760px",color:"var(--muted)",fontSize:"14px",lineHeight:1.7}}>Create store-wide, product-specific or collection-specific offers. Redemption limits count successful paid orders only.</p>
    </div>

    {error&&<div style={{marginBottom:"20px",padding:"14px 16px",border:"1px solid #c7aaa0",background:"#faf1ee",color:"#7c3f30",fontSize:"14px"}}>{error}</div>}
    {message&&<div style={{marginBottom:"20px",padding:"14px 16px",border:"1px solid var(--line)",background:"var(--cream)",fontSize:"14px"}}>{message}</div>}

    <div className="promotion-admin-grid" style={{display:"grid",gridTemplateColumns:"minmax(0,1.15fr) minmax(360px,.85fr)",gap:"22px",alignItems:"start"}}>
   <div style={{border:"1px solid var(--line)",padding:"24px",background:"var(--paper)"}}>
    <p style={{margin:"0 0 7px",fontSize:"11px",letterSpacing:"0.12em",textTransform:"uppercase",color:"var(--muted)"}}>{editing?"Promotion editor":"Create offer"}</p>
    <h2 style={{margin:"0 0 22px",fontFamily:"Cormorant Garamond, serif",fontSize:"32px",fontWeight:500}}>{editing?"Edit promotion":"New promotion"}</h2>
    <div className="promotion-form-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"14px"}}>
    <label style={label}>Promo code<input style={input} value={form.code} onChange={e=>setForm({...form,code:e.target.value.toUpperCase()})} placeholder="WELCOME10"/></label>
    <label style={label}>Discount type<select style={input} value={form.discount_type} onChange={e=>setForm({...form,discount_type:e.target.value as Form["discount_type"]})}><option value="percentage">Percentage</option><option value="fixed">Fixed ₹</option></select></label>
    <label style={label}>Discount value<input style={input} type="number" min="0" step="0.01" value={form.discount_value} onChange={e=>setForm({...form,discount_value:e.target.value})}/></label>
    <label style={label}>Minimum order value<input style={input} type="number" min="0" value={form.minimum_order_value} onChange={e=>setForm({...form,minimum_order_value:e.target.value})}/></label>
    <label style={label}>Maximum discount (optional)<input style={input} type="number" min="0" value={form.maximum_discount} onChange={e=>setForm({...form,maximum_discount:e.target.value})}/></label>
    <label style={label}>Uses per customer<input style={input} type="number" min="1" value={form.per_customer_limit} onChange={e=>setForm({...form,per_customer_limit:e.target.value})}/></label>
    <label style={label}>Total usage limit (optional)<input style={input} type="number" min="1" value={form.usage_limit} onChange={e=>setForm({...form,usage_limit:e.target.value})}/></label>
    <label style={label}>Applies to<select style={input} value={form.applies_to} onChange={e=>setForm({...form,applies_to:e.target.value as Form["applies_to"],product_ids:[],collections:[]})}><option value="all">All products</option><option value="products">Selected products</option><option value="collections">Selected collections</option></select></label>
    <label style={label}>Starts at (optional)<input style={input} type="datetime-local" value={form.starts_at} onChange={e=>setForm({...form,starts_at:e.target.value})}/></label>
    <label style={label}>Expires at (optional)<input style={input} type="datetime-local" value={form.expires_at} onChange={e=>setForm({...form,expires_at:e.target.value})}/></label>
   </div><label style={{...label,marginTop:14}}>Description<textarea style={{...input,minHeight:80}} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
   {form.applies_to==="products"&&<div style={{marginTop:16}}><strong>Eligible products</strong><div style={{display:"grid",gap:8,marginTop:10,maxHeight:260,overflow:"auto"}}>{products.map(p=><label key={p.id} style={{display:"flex",gap:9,alignItems:"center"}}><input type="checkbox" checked={form.product_ids.includes(p.id)} onChange={()=>pickProduct(p.id)}/>{p.name}{!p.is_active?" (inactive)":""}</label>)}</div></div>}
   {form.applies_to==="collections"&&<div style={{marginTop:16}}><strong>Eligible collections</strong><div style={{display:"grid",gap:8,marginTop:10}}>{collections.map(c=><label key={c} style={{display:"flex",gap:9}}><input type="checkbox" checked={form.collections.includes(c)} onChange={()=>pickCollection(c)}/>{c}</label>)}</div></div>}
   <div style={{display:"flex",gap:18,marginTop:18,flexWrap:"wrap"}}><label><input type="checkbox" checked={form.is_active} onChange={e=>setForm({...form,is_active:e.target.checked})}/> Active</label><label><input type="checkbox" checked={form.is_public} onChange={e=>setForm({...form,is_public:e.target.checked})}/> Show publicly in available offers</label></div>
   <div style={{display:"flex",gap:10,marginTop:20}}><button className="button button-dark" onClick={save} disabled={saving}>{saving?"Saving...":editing?"Update promotion":"Create promotion"}</button>{editing&&<button className="button" onClick={()=>{setEditing(null);setForm({...empty})}}>Cancel</button>}</div>
   </div>
   <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:"12px",marginBottom:"14px"}}>
     <div>
      <p style={{margin:"0 0 7px",fontSize:"11px",letterSpacing:"0.12em",textTransform:"uppercase",color:"var(--muted)"}}>Promotion library</p>
      <h2 style={{margin:0,fontFamily:"Cormorant Garamond, serif",fontSize:"32px",fontWeight:500}}>All promotions</h2>
     </div>
     <span style={{fontSize:"12px",color:"var(--muted)"}}>{promos.length} total</span>
    </div>
    <div style={{display:"grid",gap:"12px"}}>{promos.length===0?<p>No promotions yet.</p>:promos.map(p=><article key={p.id} style={{border:"1px solid var(--line)",padding:"18px",background:"var(--paper)",opacity:p.is_active?1:.62}}><div style={{display:"flex",justifyContent:"space-between",gap:12}}><div><strong style={{fontSize:18}}>{p.code}</strong><p style={{margin:"5px 0",fontSize:13}}>{p.description||"No description"}</p></div><span>{p.is_active?"ACTIVE":"INACTIVE"}</span></div><p style={{fontSize:13}}>{p.discount_type==="percentage"?`${p.discount_value}% OFF`:`${money(p.discount_value)} OFF`} · {p.applies_to} · {p.per_customer_limit} use{p.per_customer_limit===1?"":"s"}/customer</p><p style={{fontSize:12,color:"#716b64"}}>Successful uses: {p.usage_count}{p.usage_limit!=null?` / ${p.usage_limit}`:""}</p><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className="button" onClick={()=>edit(p)}>Edit</button><button className="button" onClick={()=>toggle(p)}>{p.is_active?"Deactivate":"Activate"}</button><button className="button" onClick={()=>removePromotion(p)} style={{borderColor:"#9f5548",color:"#8b3f34"}}>Delete</button></div></article>)}</div></div>
    </div>
    <style jsx>{`
      @media (max-width: 900px) {
        .promotion-admin-grid { grid-template-columns: 1fr !important; }
      }
      @media (max-width: 640px) {
        .promotion-form-grid { grid-template-columns: 1fr !important; }
      }
    `}</style>
   </div>
  </section>
 </main>;
}
