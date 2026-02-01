import fs from "fs";
import path from "path";
const CACHE_PATH = path.join(process.cwd(), "provider-cache.json");
export default function handler(req,res){
  try{ res.status(200).json(JSON.parse(fs.readFileSync(CACHE_PATH,"utf-8"))); }
  catch{ res.status(200).json({ ok:true, cache:{} }); }
}
