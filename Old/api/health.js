export default async function handler(req, res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS'){ res.status(204).end(); return; }
  if(req.method!=='GET'){ res.status(405).json({ok:false,error:'method not allowed'}); return; }
  res.status(200).json({ ok:true, ts: Date.now() });
}
