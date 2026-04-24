const https = require('https');
const fs = require('fs');

function httpsGet(path, accept) {
  return new Promise((resolve, reject) => {
    const req = https.request({hostname:'fal.ai',path,method:'GET',headers:{'Accept':accept||'text/html','User-Agent':'Mozilla/5.0','RSC':'1','Next-Router-State-Tree':'%5B%22%22%5D'}}, res=>{
      let d='';
      res.on('data',c=>d+=c);
      res.on('end',()=>resolve({status:res.statusCode,body:d,headers:res.headers}));
    });
    req.on('error',reject);
    req.setTimeout(30000,()=>{req.destroy();reject(new Error('timeout'));});
    req.end();
  });
}

async function main() {
  // Try with RSC header to get the actual data payload
  console.log('=== Trying RSC fetch ===');
  const r = await httpsGet('/models/fal-ai/nano-banana-2/api', 'text/x-component');
  console.log('Status:', r.status, 'Content-Type:', r.headers['content-type'], 'Length:', r.body.length);
  
  // Save raw response
  fs.writeFileSync('scripts/rsc_dump.txt', r.body);
  
  // Look for schema data
  const lines = r.body.split('\n');
  console.log('Lines:', lines.length);
  
  // Find lines containing property/schema info
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('prompt') || line.includes('properties') || line.includes('inputSchema')) {
      console.log(`Line ${i}: ${line.substring(0, 300)}`);
    }
  }
  
  // Also try the plain JSON endpoint approach - maybe there's an undocumented API for model schemas
  console.log('\n=== Trying alternative schema endpoints ===');
  const altPaths = [
    '/api/docs/fal-ai/nano-banana-2',
    '/api/endpoints/fal-ai/nano-banana-2', 
    '/api/schema/fal-ai/nano-banana-2'
  ];
  
  for (const p of altPaths) {
    const r2 = await httpsGet(p, 'application/json');
    console.log(p, '->', r2.status, r2.body.substring(0, 200));
  }
}

main().catch(console.error);
