import { generateDocxReport, ReportCompanyContact } from '../docx_report';
import fs from 'fs';
import path from 'path';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`DOCX Real Report Test Failed: ${msg}`);
  }
}

async function runDocxReportRealTest() {
  console.log('--- RUNNING REAL DOCX DIRECTORY REPORT GENERATION TEST ---');

  const sampleContacts: ReportCompanyContact[] = [
    {
      id: 'comp-101',
      company_name: 'Novartis Pharma AG',
      country: 'Switzerland',
      website: 'https://www.novartis.com',
      email: 'info@novartis.com',
      phone: '+41 61 324 1111',
      address: 'Lichtstrasse 35, 4056 Basel, Switzerland',
      industry: 'Pharmaceuticals',
      decision_makers: [
        {
          name: 'Vas Narasimhan',
          designation: 'CEO & Executive Director',
          department: 'Executive Leadership',
          emails: [{ value: 'vas.narasimhan@novartis.com' }],
          phones: [{ value: '+41 61 324 1111' }]
        }
      ],
      contact_persons: [
        {
          name: 'Global Export Operations',
          designation: 'Export Director',
          department: 'International Trade',
          email: 'export@novartis.com',
          phone: '+41 61 324 2222'
        }
      ],
      addresses: [
        { address: 'Lichtstrasse 35, 4056 Basel, Switzerland', type: 'Head Office', source_url: 'https://www.novartis.com/contact-us' },
        { address: 'Pharma Production Plant, Schweizerhalle', type: 'Factory', source_url: 'https://www.novartis.com/locations' }
      ],
      sources: [
        { url: 'https://www.novartis.com/contact-us', title: 'Novartis Contact Us', source_type: 'official_website' },
        { url: 'https://www.novartis.com/about/management-team', title: 'Novartis Executive Leadership', source_type: 'official_website' }
      ]
    },
    {
      id: 'comp-102',
      company_name: 'Getz Pharma (Pvt) Ltd',
      country: 'Pakistan',
      website: 'https://www.getzpharma.com',
      email: 'info@getzpharma.com',
      phone: '+92 21 111 111 500',
      address: '29-30/27, Korangi Industrial Area, Karachi, Pakistan',
      industry: 'Pharmaceutical Manufacturing',
      decision_makers: [
        {
          name: 'Khalid Mahmood',
          designation: 'Managing Director & CEO',
          department: 'Executive Management',
          emails: [{ value: 'khalid.mahmood@getzpharma.com' }]
        }
      ],
      addresses: [
        { address: 'Plot 29-30/27, Korangi Industrial Area, Karachi', type: 'Head Office & Plant', source_url: 'https://www.getzpharma.com/contact' }
      ],
      sources: [
        { url: 'https://www.getzpharma.com/contact', title: 'Getz Pharma Contact', source_type: 'official_website' }
      ]
    }
  ];

  console.log('[Step 1] Generating Importer Contact Directory DOCX...');
  const docxBuffer = await generateDocxReport(sampleContacts, 'importer');

  console.log(`   Generated DOCX Buffer size: ${docxBuffer.length} bytes`);
  assert(docxBuffer.length > 5000, `DOCX buffer size must be >5KB (got ${docxBuffer.length} bytes)`);

  const outputPath = path.join(process.cwd(), '.agent', 'scratch', 'test_edgeview_contact_directory.docx');
  const scratchDir = path.join(process.cwd(), '.agent', 'scratch');
  if (!fs.existsSync(scratchDir)) {
    fs.mkdirSync(scratchDir, { recursive: true });
  }
  fs.writeFileSync(outputPath, docxBuffer);
  console.log(`   Saved generated DOCX report to: ${outputPath}`);

  console.log('\n[Step 2] Generating Exporter Contact Directory DOCX...');
  const expBuffer = await generateDocxReport(sampleContacts, 'exporter');
  assert(expBuffer.length > 5000, 'Exporter DOCX buffer must be >5KB');

  console.log('   ✅ REAL DOCX DIRECTORY REPORT GENERATION VERIFIED PASSED 100%.');
}

runDocxReportRealTest().catch(err => {
  console.error('❌ DOCX Real Report Test Failed:', err);
  process.exit(1);
});
