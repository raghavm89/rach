'use strict';

/**
 * Invoice PDF renderer (pdfkit — pure JS, no headless browser).
 *
 * Renders entirely from the invoice row's snapshotted `seller_json` /
 * `buyer_json` / line items. It never reads the users table, so regenerating a
 * PDF years later produces byte-for-byte the same document.
 *
 * Layout covers the fields Rule 46 of the CGST Rules requires on a tax invoice:
 * supplier name/address/GSTIN, invoice number and date, recipient details,
 * SAC code, taxable value, tax rate and amount split by component, place of
 * supply, and total.
 */

const PDFDocument = require('pdfkit');
const { formatMinor, formatRateBps } = require('../tax/money');

const PAGE_MARGIN = 48;
const COLORS = {
  ink: '#111827',
  muted: '#6b7280',
  line: '#e5e7eb',
  accent: '#2563eb',
  band: '#f9fafb',
};

/**
 * @returns {Promise<Buffer>}
 */
function renderInvoicePdf({ invoice, lines }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const seller = parse(invoice.seller_json);
      const buyer = parse(invoice.buyer_json);
      const taxMeta = parse(invoice.tax_json);
      const cur = invoice.currency;
      const locale = cur === 'INR' ? 'en-IN' : 'en-US';
      const fmt = (m) => formatMinor(Number(m), cur, locale);

      const pageW = doc.page.width - PAGE_MARGIN * 2;
      const right = PAGE_MARGIN + pageW;

      // ── Header ───────────────────────────────────────────────────────────
      doc.fillColor(COLORS.ink).fontSize(20).font('Helvetica-Bold')
         .text(seller.legal_name || 'Rach Dev LLP', PAGE_MARGIN, PAGE_MARGIN);

      doc.fontSize(9).font('Helvetica').fillColor(COLORS.muted);
      if (seller.address) doc.text(seller.address, { width: pageW * 0.55 });
      if (seller.gstin)   doc.text(`GSTIN: ${seller.gstin}`);
      if (seller.pan)     doc.text(`PAN: ${seller.pan}`);
      if (seller.email)   doc.text(seller.email);

      // Title block, right aligned
      const isZeroTax = Number(invoice.tax_total_minor) === 0;
      const title = isZeroTax ? 'INVOICE' : 'TAX INVOICE';
      doc.fillColor(COLORS.accent).fontSize(16).font('Helvetica-Bold')
         .text(title, PAGE_MARGIN, PAGE_MARGIN, { width: pageW, align: 'right' });

      doc.fontSize(9).font('Helvetica').fillColor(COLORS.ink)
         .text(invoice.invoice_number, { width: pageW, align: 'right' })
         .fillColor(COLORS.muted)
         .text(new Date(invoice.issued_at).toLocaleDateString(locale, {
           day: 'numeric', month: 'long', year: 'numeric',
         }), { width: pageW, align: 'right' });

      if (invoice.status === 'void') {
        doc.fillColor('#dc2626').font('Helvetica-Bold').fontSize(11)
           .text('VOID', { width: pageW, align: 'right' });
      }

      doc.moveDown(2);
      rule(doc, right);

      // ── Bill to ──────────────────────────────────────────────────────────
      doc.moveDown(0.8);
      const billTop = doc.y;

      doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.muted)
         .text('BILL TO', PAGE_MARGIN, billTop);
      doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.ink)
         .text(buyer.business_name || buyer.name || '—', { width: pageW * 0.5 });

      doc.fontSize(9).font('Helvetica').fillColor(COLORS.muted);
      if (buyer.email)        doc.text(buyer.email, { width: pageW * 0.5 });
      if (buyer.address_line) doc.text(buyer.address_line, { width: pageW * 0.5 });
      const cityLine = [buyer.city, buyer.region_code, buyer.postal_code].filter(Boolean).join(', ');
      if (cityLine)           doc.text(cityLine, { width: pageW * 0.5 });
      if (buyer.country_code) doc.text(buyer.country_code, { width: pageW * 0.5 });
      if (buyer.gstin) {
        doc.font('Helvetica-Bold').fillColor(COLORS.ink)
           .text(`GSTIN: ${buyer.gstin}`, { width: pageW * 0.5 });
      }

      // Place of supply, right column
      if (invoice.place_of_supply) {
        doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.muted)
           .text('PLACE OF SUPPLY', PAGE_MARGIN + pageW * 0.55, billTop, { width: pageW * 0.45 });
        doc.fontSize(9).font('Helvetica').fillColor(COLORS.ink)
           .text(invoice.place_of_supply, { width: pageW * 0.45 });
      }

      doc.y = Math.max(doc.y, billTop) + 12;
      doc.x = PAGE_MARGIN;

      // ── Line items ───────────────────────────────────────────────────────
      const showSac = lines.some((l) => l.sac_code);
      const showTax = !isZeroTax;

      // Column x-positions, computed from the right edge so money stays aligned.
      const colTotal = right - 78;
      const colTax   = showTax ? colTotal - 78 : null;
      const colRate  = showTax ? colTax - 44 : null;
      const colAmt   = (showTax ? colRate : colTotal) - 78;
      const colQty   = colAmt - 34;
      const descW    = colQty - PAGE_MARGIN - 8;

      let y = doc.y + 6;
      doc.rect(PAGE_MARGIN, y - 4, pageW, 20).fill(COLORS.band);
      doc.fillColor(COLORS.muted).fontSize(8).font('Helvetica-Bold');
      doc.text('DESCRIPTION', PAGE_MARGIN + 4, y + 2, { width: descW });
      doc.text('QTY',  colQty, y + 2, { width: 30, align: 'right' });
      doc.text('AMOUNT', colAmt, y + 2, { width: 74, align: 'right' });
      if (showTax) {
        doc.text('RATE', colRate, y + 2, { width: 40, align: 'right' });
        doc.text('TAX',  colTax,  y + 2, { width: 74, align: 'right' });
      }
      doc.text('TOTAL', colTotal, y + 2, { width: 74, align: 'right' });

      y += 24;

      for (const l of lines) {
        if (y > doc.page.height - 200) { doc.addPage(); y = PAGE_MARGIN; }

        doc.fillColor(COLORS.ink).fontSize(9).font('Helvetica');
        const descHeight = doc.heightOfString(l.description, { width: descW });
        doc.text(l.description, PAGE_MARGIN + 4, y, { width: descW });

        if (showSac && l.sac_code) {
          doc.fontSize(7).fillColor(COLORS.muted)
             .text(`SAC ${l.sac_code}`, PAGE_MARGIN + 4, y + descHeight + 1, { width: descW });
        }

        doc.fontSize(9).fillColor(COLORS.ink).font('Helvetica');
        doc.text(String(l.quantity), colQty, y, { width: 30, align: 'right' });
        doc.text(fmt(l.subtotal_minor), colAmt, y, { width: 74, align: 'right' });
        if (showTax) {
          doc.text(formatRateBps(l.tax_rate_bps), colRate, y, { width: 40, align: 'right' });
          doc.text(fmt(l.tax_amount_minor), colTax, y, { width: 74, align: 'right' });
        }
        doc.font('Helvetica-Bold').text(fmt(l.total_minor), colTotal, y, { width: 74, align: 'right' });

        y += Math.max(descHeight, 12) + (showSac && l.sac_code ? 10 : 0) + 8;
        doc.moveTo(PAGE_MARGIN, y - 4).lineTo(right, y - 4)
           .strokeColor(COLORS.line).lineWidth(0.5).stroke();
      }

      // ── Totals ───────────────────────────────────────────────────────────
      y += 8;
      const labelX = colAmt - 40;
      const valueW = 74;
      const valueX = colTotal;

      const totalRow = (label, value, bold = false) => {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica')
           .fontSize(bold ? 11 : 9)
           .fillColor(bold ? COLORS.ink : COLORS.muted)
           .text(label, labelX, y, { width: (valueX - labelX) - 8, align: 'right' })
           .fillColor(COLORS.ink)
           .text(value, valueX, y, { width: valueW, align: 'right' });
        y += bold ? 18 : 14;
      };

      totalRow('Subtotal', fmt(invoice.subtotal_minor));

      // Aggregate the per-line component breakdown (CGST/SGST/IGST/state tax).
      const components = new Map();
      for (const l of lines) {
        for (const b of parse(l.tax_breakdown) ?? []) {
          const key = `${b.name}|${b.rate_bps}`;
          components.set(key, (components.get(key) ?? 0) + Number(b.amount_minor));
        }
      }
      for (const [key, amount] of components) {
        const [name, rate] = key.split('|');
        totalRow(`${name} @ ${formatRateBps(Number(rate))}`, fmt(amount));
      }

      doc.moveTo(labelX, y).lineTo(right, y).strokeColor(COLORS.line).lineWidth(1).stroke();
      y += 8;
      totalRow('Total', fmt(invoice.total_minor), true);

      // ── Footer ───────────────────────────────────────────────────────────
      const footerY = Math.max(y + 24, doc.page.height - 140);
      doc.y = footerY;
      doc.x = PAGE_MARGIN;

      const noteText = invoice.notes || taxMeta.notes;
      if (noteText) {
        doc.fontSize(8).font('Helvetica').fillColor(COLORS.muted)
           .text(noteText, PAGE_MARGIN, doc.y, { width: pageW });
        doc.moveDown(0.5);
      }

      if (invoice.tax_treatment === 'export_zero_rated') {
        doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.muted)
           .text('Supply meant for export under Letter of Undertaking without payment of IGST.',
                 { width: pageW });
        doc.moveDown(0.5);
      }

      const ref = [
        invoice.razorpay_payment_id && `Payment: ${invoice.razorpay_payment_id}`,
        invoice.razorpay_subscription_id && `Subscription: ${invoice.razorpay_subscription_id}`,
      ].filter(Boolean).join('   ');
      if (ref) {
        doc.fontSize(7).font('Helvetica').fillColor(COLORS.muted).text(ref, { width: pageW });
      }

      doc.moveDown(0.8);
      doc.fontSize(7).fillColor(COLORS.muted)
         .text('This is a computer-generated invoice and does not require a signature.',
               { width: pageW, align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function parse(v) {
  if (v == null) return null;
  return typeof v === 'string' ? JSON.parse(v) : v;
}

function rule(doc, right) {
  doc.moveTo(PAGE_MARGIN, doc.y).lineTo(right, doc.y)
     .strokeColor(COLORS.line).lineWidth(1).stroke();
}

/** Filename-safe version of the invoice number: RB/2026-27/000123 → RB-2026-27-000123 */
function pdfFilename(invoice) {
  return `${String(invoice.invoice_number).replace(/[^\w.-]+/g, '-')}.pdf`;
}

module.exports = { renderInvoicePdf, pdfFilename };
