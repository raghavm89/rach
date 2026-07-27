const express = require('express');
const app = express();
const r = express.Router();
r.get('/usage/sessions', (req,res)=>res.end('LOCAL usage/sessions'));
r.all(/^\/sessions(\/.*)?$/, (req,res)=>res.end('PROXY '+req.method+' '+req.originalUrl));
app.use('/api/agent', r);
app.use((req,res)=>res.status(404).json({error:'Route not found'}));
const srv = app.listen(0, async () => {
  const port = srv.address().port;
  const get = (p)=>new Promise(rs=>require('http').get('http://localhost:'+port+p,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>rs(res.statusCode+' '+d));}));
  for (const p of ['/api/agent/sessions','/api/agent/sessions/5/messages','/api/agent/usage/sessions']) console.log(p, '=>', await get(p));
  srv.close();
});
