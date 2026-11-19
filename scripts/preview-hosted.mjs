import {createServer} from 'node:http';
import worker from '../dist/server/index.js';
const port = Number(process.argv[2] ?? 5181);
createServer(async (req,res)=>{
 try {
  const response = await worker.fetch(new Request(`http://${req.headers.host}${req.url}`,{method:req.method}));
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 } catch {res.writeHead(500);res.end('Preview error');}
}).listen(port,'127.0.0.1',()=>console.log(`http://localhost:${port}/`));
