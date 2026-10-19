import http from 'http';

const memorySnapshots = [];

function recordMemory(label) {
  if (global.gc) global.gc();
  const mem = process.memoryUsage();
  memorySnapshots.push({
    label,
    timestamp: new Date().toISOString(),
    rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
    heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
    external: Math.round(process.memoryUsage().external / 1024 / 1024),
  });
  console.log(`[${label}] RSS: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB, Heap: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB / ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`);
}

async function fetchSize(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(Buffer.byteLength(data, 'utf8')));
    }).on('error', reject);
  });
}

async function runMemorySoak() {
  console.log('=== Starting 203-Company Memory Soak Test ===');
  
  // Record baseline
  recordMemory('BASELINE');
  
  // Start the server
  console.log('Starting server...');
  const { startServer } = await import('./dist/server.cjs');
  const server = await startServer();
  recordMemory('SERVER_STARTED');
  
  // Wait for server to initialize
  await new Promise(resolve => setTimeout(resolve, 3000));
  recordMemory('AFTER_INIT');
  
  // Measure endpoints
  const progressSize = await fetchSize('http://127.0.0.1:3000/api/enrich/job/job-1789812121356-ww8u06/progress');
  const fullSize = await fetchSize('http://127.0.0.1:3000/api/enrich/job/job-1789812121356-ww8u06');
  console.log(`Progress endpoint: ${progressSize} bytes (${(progressSize/1024).toFixed(1)} KB)`);
  console.log(`Full job endpoint: ${fullSize} bytes (${(fullSize/1024).toFixed(1)} KB)`);
  
  recordMemory('ENDPOINTS_MEASURED');
  
  // Monitor the real job progress
  let monitoring = true;
  let completedCount = 0;
  
  const monitorInterval = setInterval(async () => {
    if (!monitoring) {
      clearInterval(monitorInterval);
      return;
    }
    
    try {
      const response = await fetch('http://127.0.0.1:3000/api/enrich/job/job-1789812121356-ww8u06');
      if (response.ok) {
        const job = await response.json();
        if (job.job && job.job.completed_companies !== completedCount) {
          completedCount = job.job.completed_companies;
          recordMemory(`COMPLETED_${completedCount}`);
          
          // Measure endpoint sizes
          const progressSize = await fetchSize(`http://127.0.0.1:3000/api/enrich/job/job-1789812121356-ww8u06/progress`);
          const fullSize = await fetchSize(`http://127.0.0.1:3000/api/enrich/job/job-1789812121356-ww8u06`);
          
          console.log(`Progress: ${completedCount}/203 | Progress API: ${(progressSize/1024).toFixed(1)}KB | Full API: ${(fullSize/1024).toFixed(1)}KB`);
        }
      } catch (e) {
        // ignore
      }
    } catch (e) {
      // ignore
    }
  }, 10000);
  
  // Run for 2 minutes to collect data
  await new Promise(resolve => setTimeout(resolve, 120000));
  
  monitoring = false;
  clearInterval(monitorInterval);
  
  recordMemory('END_TEST');
  
  // Print summary
  console.log('\n=== Memory Soak Summary ===');
  memorySnapshots.forEach(s => {
    console.log(`${s.label}: RSS=${s.rss}MB, Heap=${s.heapUsed}MB/${s.heapTotal}MB`);
  });
  
  process.exit(0);
}

runMemorySoak().catch(console.error);