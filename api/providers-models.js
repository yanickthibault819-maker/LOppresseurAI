import fs from "fs";
import path from "path";
const CACHE_PATH = path.join(process.cwd(), "provider-cache.json");
function readCache(){ try{ return JSON.parse(fs.readFileSync(CACHE_PATH,"utf-8")); }catch{ return {}; } }
export default function handler(req,res){
  const provider = (req.query.provider||"").toString();
  const cache = readCache();
  res.status(200).json({ ok:true, provider, models: cache?.[provider]?.models || [] });
}
