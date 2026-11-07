/* eslint-disable @typescript-eslint/no-require-imports */
// Standalone loopback-only static server. No .env, application imports, API or DB.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png'};
http.createServer((req,res)=>{
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end();}
 const pathname=new URL(req.url,'http://127.0.0.1').pathname;
 let target;
 if(pathname==='/'||pathname==='/index.html')target=path.join(root,'index.html');
 else if(['/style.css','/prototype.js'].includes(pathname))target=path.join(root,pathname.slice(1));
 else if(/^\/assets\/[a-z0-9_]+\.png$/.test(pathname))target=path.join(root,pathname.slice(1));
 else if(/^\/classes\/[a-z0-9-]+\.png$/.test(pathname))target=path.join(root,'../../public/game-icons/classes',path.basename(pathname));
 if(!target||!fs.existsSync(target)){res.writeHead(404);return res.end('Not found');}
 res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self'; img-src 'self'; connect-src 'none'; form-action 'none'; frame-ancestors 'none'"});
 if(req.method==='HEAD')return res.end();
 fs.createReadStream(target).pipe(res);
}).listen(3210,'127.0.0.1',()=>process.stdout.write('Raid creation prototype: http://127.0.0.1:3210\n'));
