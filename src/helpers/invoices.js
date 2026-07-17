const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Tengeneza Invoice (Tax & Platform Fees)
 */
async function generateInvoicePDF(job, client, freelancer, amount, currency = 'TZS') {
  return new Promise((resolve, reject) => {
    try {
      const invoiceNo = `INV-${job.id}-${Date.now()}`;
      const fileName = `invoice_${invoiceNo}.pdf`;
      const docsDir = path.join(__dirname, '../../docs');
      if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir);
      
      const filePath = path.join(docsDir, fileName);
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Header
      doc.fontSize(20).text('GIGLINK INVOICE / TAX RECEIPT', { align: 'center' });
      doc.moveDown();
      
      doc.fontSize(12).text(`Invoice No: ${invoiceNo}`);
      doc.text(`Date: ${new Date().toLocaleDateString()}`);
      doc.text(`Status: PAID (via Escrow)`);
      doc.moveDown();

      // Pande Mbili
      doc.text(`Billed To (Client): ${client.firstName || 'Client'} (@${client.username || 'unknown'})`);
      doc.text(`Service Provider: ${freelancer.firstName || 'Freelancer'} (@${freelancer.username || 'unknown'})`);
      doc.moveDown();

      // Maelezo ya Kazi
      doc.fontSize(14).text('Project Details', { underline: true });
      doc.fontSize(12).text(`Job Title: ${job.title}`);
      
      // Hesabu (Math)
      const commission = amount * 0.10; // 10% platform fee
      const vatOnCommission = commission * 0.18; // 18% VAT on our commission
      const totalTax = vatOnCommission; 
      
      doc.moveDown();
      doc.fontSize(14).text('Financial Breakdown', { underline: true });
      doc.fontSize(12).text(`Gross Amount: ${currency} ${amount.toLocaleString()}`);
      doc.text(`Platform Fee (10%): ${currency} ${commission.toLocaleString()}`);
      doc.text(`VAT on Fee (18%): ${currency} ${vatOnCommission.toLocaleString()}`);
      
      if (job.hasInsurance) {
        doc.text(`Micro-Insurance Fee: ${currency} ${job.insuranceFee.toLocaleString()}`);
      }

      const totalDeductions = commission + vatOnCommission + (job.hasInsurance ? job.insuranceFee : 0);
      const netPayout = amount - totalDeductions;
      
      doc.moveDown();
      doc.fontSize(14).text(`Net Payout to Provider: ${currency} ${netPayout.toLocaleString()}`, { bold: true });
      
      doc.moveDown(2);
      doc.fontSize(10).text('Thank you for using GigLink.', { align: 'center' });
      doc.text('This is an auto-generated invoice and is valid without a physical signature.', { align: 'center', color: 'gray' });

      doc.end();

      stream.on('finish', () => {
        resolve({ pdfPath: filePath, invoiceNo, taxAmount: vatOnCommission });
      });
      stream.on('error', (err) => {
        reject(err);
      });
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = { generateInvoicePDF };
