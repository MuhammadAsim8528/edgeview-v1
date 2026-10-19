import http from 'http';

function postJson(urlStr: string, bodyObj: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const postData = JSON.stringify(bodyObj);
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve(body);
          }
        });
      }
    );
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function runLiveVerification() {
  console.log('--- RUNNING LIVE FETCH INFO & ENRICHMENT VERIFICATION ---');

  const companyName = 'Emerchemie NB Ceylon Limited';
  console.log(`Sending /api/enrich/company request for "${companyName}"...`);

  const response = await postJson('http://127.0.0.1:3000/api/enrich/company', {
    company_name: companyName,
    forceFetch: false,
  });

  console.log('Server Response:', JSON.stringify(response, null, 2));

  if (response.success && response.details) {
    console.log('✅ Live Fetch Info Endpoint returned structured details successfully.');
    console.log(`Company: ${response.details.company_name}`);
    console.log(`Quality Status: ${response.details.quality_status}`);
    console.log(`Email: ${response.details.email || 'Not found'}`);
    console.log(`Phone: ${response.details.phone || 'Not found'}`);
    console.log(`Address: ${response.details.address || 'Not found'}`);
    console.log(`Evidence items: ${response.details.evidence?.length || 0}`);
  } else {
    console.warn('⚠️ Server returned response without success flag:', response);
  }
}

runLiveVerification().catch(console.error);
