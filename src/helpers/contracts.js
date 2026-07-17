const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Tengeneza Mkataba wa Kisheria (PDF) kati ya Mteja na Freelancer
 * Inahifadhi kwenye disk kwa muda na kurudisha path ya faili.
 */
function generateContractPDF(job, client, freelancer, price) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const fileName = `Contract_Job_${job.id}_${Date.now()}.pdf`;
      const filePath = path.join(__dirname, '../../', fileName);
      
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Header
      doc.fontSize(20).text('GIGLINK: MKATABA WA KAZI', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Tarehe: ${new Date().toLocaleDateString('sw-TZ')}`, { align: 'right' });
      doc.moveDown(2);

      // Parties
      doc.fontSize(14).text('1. PANDE ZINAZOHUSIKA', { underline: true });
      doc.fontSize(12).text(`Mteja (Client): ${client.firstName || client.username} (ID: ${client.telegramId})`);
      doc.text(`Mkandarasi (Freelancer): ${freelancer.firstName || freelancer.username} (ID: ${freelancer.telegramId})`);
      doc.moveDown();

      // Job Details
      doc.fontSize(14).text('2. MAELEZO YA KAZI', { underline: true });
      doc.fontSize(12).text(`Kichwa: ${job.title}`);
      doc.text(`Maelezo: ${job.description || 'Kama ilivyokubaliwa kwenye jukwaa.'}`);
      doc.text(`Malipo Yaliyokubaliwa: TZS ${price.toLocaleString()}`);
      doc.moveDown();

      // Terms
      doc.fontSize(14).text('3. MASHARTI NA VIGEZO', { underline: true });
      doc.fontSize(12).text('a) Mkandarasi anakubali kufanya kazi hii kwa kiwango cha juu cha weledi.');
      doc.text('b) Mteja anakubali kufanya malipo kupitia Mfumo wa Escrow wa GigLink kabla kazi kuanza.');
      doc.text('c) Migogoro yoyote itatatuliwa kupitia jopo la usuluhishi la GigLink.');
      doc.text('d) Haki miliki za kazi hii zitahamishiwa kwa Mteja pindi tu malipo yatakapokamilika.');
      doc.moveDown(2);

      // Signatures
      doc.fontSize(14).text('4. SAINI ZA KIDIJITALI (E-SIGNATURE)', { underline: true });
      doc.fontSize(12).text('Kwa kubofya "Ninakubali" kwenye mfumo wa GigLink, pande zote mbili zinaridhia masharti haya.');
      doc.moveDown();
      doc.text('Saini ya Mteja: [_________________________]   Tarehe: [__________]');
      doc.moveDown();
      doc.text('Saini ya Freelancer: [_____________________]   Tarehe: [__________]');

      doc.end();

      stream.on('finish', () => {
        resolve(filePath);
      });
      stream.on('error', (err) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateContractPDF };
