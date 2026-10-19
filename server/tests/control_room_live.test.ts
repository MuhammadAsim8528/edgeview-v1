import http from 'http';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Control Room Live Test Failed: ${msg}`);
  }
}

async function runControlRoomTest() {
  console.log('--- TESTING EDGEVIEW AI ENGINEERING CONTROL ROOM ---');

  console.log('[Test 1] Testing REST API /api/control-room/state...');
  const res = await fetch('http://127.0.0.1:3100/api/control-room/state');
  assert(res.ok, 'REST state endpoint must return 200 OK');
  assert(res.headers.get('x-content-type-options') === 'nosniff', 'Must include X-Content-Type-Options nosniff header');
  const data = await res.json();
  console.log(`   Project Status: ${data.project_status}`);
  console.log(`   Uptime: ${data.uptime_formatted}`);
  console.log(`   Agent Statuses Count: ${data.agent_statuses.length}`);
  assert(data.agent_statuses.length >= 3, 'Must contain status cards for Antigravity, OpenCode, Codex');
  console.log('   ✅ REST API Endpoint & Security Headers verified.');

  console.log('\n[Test 2] Testing Agent Heartbeat POST /api/control-room/heartbeat...');
  const heartbeatRes = await fetch('http://127.0.0.1:3100/api/control-room/heartbeat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agent: 'antigravity',
      name: 'Antigravity',
      role: 'LEAD / ARCHITECT / INTEGRATOR',
      status: 'WORKING',
      current_task: 'Control Room Verification',
      area: 'server/control_room_server.ts',
      last_action: 'Live Control Room online and verified on port 3100',
      last_message: 'Dashboard running on http://127.0.0.1:3100'
    })
  });

  assert(heartbeatRes.ok, 'Heartbeat endpoint must return 200 OK');
  const heartbeatData = await heartbeatRes.json();
  console.log(`   Heartbeat Response: ${JSON.stringify(heartbeatData)}`);
  console.log('   ✅ Agent Heartbeat API verified.');

  console.log('\n✅ EDGEVIEW AI ENGINEERING CONTROL ROOM VERIFIED 100% ONLINE.');
}

runControlRoomTest().catch(err => {
  console.error('❌ Control Room Test Failed:', err);
  process.exit(1);
});
