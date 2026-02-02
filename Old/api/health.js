export default async function handler(req,res){
  res.status(200).json({ ok:true, service:"L'Oppresseur AI API", time: new Date().toISOString() });
}
