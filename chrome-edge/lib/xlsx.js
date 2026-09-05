/**
 * Standalone Excel Export utility.
 * Generates valid Excel Spreadsheet XML (SpreadsheetML) with UTF-8 support,
 * which opens natively in Microsoft Excel, LibreOffice Calc, Apple Numbers, and Google Sheets.
 * Pure Vanilla JavaScript with zero dependencies.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.XLSX = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function escapeXml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function generateExcelXml(data, sheetName) {
    sheetName = sheetName || 'Scraped Data';
    sheetName = sheetName.replace(/[:\\/?*[\]]/g, '_').substring(0, 31);

    let headers = [];
    let rows = [];

    if (Array.isArray(data) && data.length > 0) {
      if (typeof data[0] === 'object' && !Array.isArray(data[0]) && data[0] !== null) {
        headers = Object.keys(data[0]);
        rows = data;
      } else if (Array.isArray(data[0])) {
        headers = data[0];
        rows = data.slice(1).map(row => {
          const obj = {};
          headers.forEach((h, idx) => {
            obj[h] = row[idx];
          });
          return obj;
        });
      }
    }

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\r\n';
    xml += '<?mso-application progid="Excel.Sheet"?>\r\n';
    xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\r\n';
    xml += ' xmlns:o="urn:schemas-microsoft-com:office:office"\r\n';
    xml += ' xmlns:x="urn:schemas-microsoft-com:office:excel"\r\n';
    xml += ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"\r\n';
    xml += ' xmlns:html="http://www.w3.org/TR/REC-html40">\r\n';

    // Styles
    xml += ' <Styles>\r\n';
    xml += '  <Style ss:ID="Default" ss:Name="Normal">\r\n';
    xml += '   <Alignment ss:Vertical="Center"/>\r\n';
    xml += '   <Font ss:FontName="Segoe UI" x:Family="Swiss" ss:Size="11" ss:Color="#1E293B"/>\r\n';
    xml += '  </Style>\r\n';
    xml += '  <Style ss:ID="HeaderStyle">\r\n';
    xml += '   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>\r\n';
    xml += '   <Font ss:FontName="Segoe UI" x:Family="Swiss" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>\r\n';
    xml += '   <Interior ss:Color="#0F766E" ss:Pattern="Solid"/>\r\n';
    xml += '   <Borders>\r\n';
    xml += '    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0D9488"/>\r\n';
    xml += '   </Borders>\r\n';
    xml += '  </Style>\r\n';
    xml += '  <Style ss:ID="RowEven">\r\n';
    xml += '   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>\r\n';
    xml += '  </Style>\r\n';
    xml += ' </Styles>\r\n';

    // Worksheet
    xml += ` <Worksheet ss:Name="${escapeXml(sheetName)}">\r\n`;
    xml += '  <Table>\r\n';

    // Column widths
    headers.forEach(() => {
      xml += '   <Column ss:AutoFitWidth="1" ss:Width="160"/>\r\n';
    });

    // Header row
    xml += '   <Row ss:Height="26">\r\n';
    headers.forEach(h => {
      xml += `    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>\r\n`;
    });
    xml += '   </Row>\r\n';

    // Data rows
    rows.forEach((row, rowIndex) => {
      const styleId = rowIndex % 2 === 1 ? ' ss:StyleID="RowEven"' : '';
      xml += `   <Row ss:Height="20"${styleId}>\r\n`;
      headers.forEach(h => {
        const val = row[h];
        if (val === null || val === undefined) {
          xml += '    <Cell><Data ss:Type="String"></Data></Cell>\r\n';
        } else if (typeof val === 'number' && !isNaN(val)) {
          xml += `    <Cell><Data ss:Type="Number">${val}</Data></Cell>\r\n`;
        } else if (typeof val === 'boolean') {
          xml += `    <Cell><Data ss:Type="String">${val ? 'TRUE' : 'FALSE'}</Data></Cell>\r\n`;
        } else {
          xml += `    <Cell><Data ss:Type="String">${escapeXml(val)}</Data></Cell>\r\n`;
        }
      });
      xml += '   </Row>\r\n';
    });

    xml += '  </Table>\r\n';
    xml += ' </Worksheet>\r\n';
    xml += '</Workbook>';

    return xml;
  }

  // --------------------------------------------------------------------------
  // Ö6: real Office Open XML workbook (.xlsx), assembled with SimpleZip.
  // --------------------------------------------------------------------------

  function resolveZip() {
    if (typeof SimpleZip !== 'undefined') return SimpleZip;
      if (typeof module === 'object' && module.exports) { try { return require('./zip.js'); } catch (e) { /* browser */ } }
    return null;
  }

  function colLetter(index) {
    let out = '';
    let n = index;
    while (n >= 0) {
      out = String.fromCharCode(65 + (n % 26)) + out;
      n = Math.floor(n / 26) - 1;
    }
    return out;
  }

  function isNumericCell(v) {
    if (typeof v === 'number') return Number.isFinite(v);
    if (typeof v === 'string' && v.trim() !== '') {
      return /^-?\d+(\.\d+)?$/.test(v.trim().replace(/,(?=\d+\.\d+$)/, ''));
    }
    return false;
  }

  async function generateXlsx(data, sheetName) {
    const SimpleZipLib = resolveZip();
    if (!SimpleZipLib) throw new Error('SimpleZip is not available');

    sheetName = (sheetName || 'Scraped Data').replace(/[:\\/?*[\]]/g, '_').substring(0, 31);

    let headers = [];
    let rows = [];
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && data[0] !== null && !Array.isArray(data[0])) {
      headers = Object.keys(data[0]);
      rows = data;
    }

    // ---- worksheet ----
    const widths = headers.map((h) => Math.min(60, Math.max(10, String(h).length + 4)));
    rows.slice(0, 200).forEach((row) => {
      headers.forEach((h, i) => {
        const len = String(row[h] == null ? '' : row[h]).length + 2;
        if (len > widths[i]) widths[i] = Math.min(60, len);
      });
    });

    let sheetXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
    sheetXml += '<cols>' + widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('') + '</cols>';
    sheetXml += '<sheetData>';
    sheetXml += '<row r="1" s="1" customFormat="1">';
    headers.forEach((h, i) => {
      sheetXml += `<c r="${colLetter(i)}1" t="inlineStr" s="1"><is><t xml:space="preserve">${escapeXml(h)}</t></is></c>`;
    });
    sheetXml += '</row>';
    rows.forEach((row, r) => {
      const rowNum = r + 2;
      sheetXml += `<row r="${rowNum}">`;
      headers.forEach((h, i) => {
        const v = row[h];
        const ref = `${colLetter(i)}${rowNum}`;
        if (v === null || v === undefined || v === '') {
          sheetXml += `<c r="${ref}"/>`;
        } else if (isNumericCell(v)) {
          sheetXml += `<c r="${ref}"><v>${typeof v === 'number' ? v : String(v).trim().replace(/,(?=\d+\.\d+$)/, '')}</v></c>`;
        } else if (typeof v === 'boolean') {
          sheetXml += `<c r="${ref}" t="b"><v>${v ? 1 : 0}</v></c>`;
        } else {
          sheetXml += `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(v)}</t></is></c>`;
        }
      });
      sheetXml += '</row>';
    });
    sheetXml += '</sheetData></worksheet>';

    const enc = (typeof TextEncoder !== 'undefined') ? new TextEncoder() : null;
    const xmlBytes = (str) => {
      if (enc) return enc.encode(str);
      // Very old engines without TextEncoder: manual UTF-8 encode
      const out = [];
      for (let i = 0; i < str.length; i++) {
        let cp = str.codePointAt(i);
        if (cp > 0xffff) i++;
        if (cp < 0x80) out.push(cp);
        else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
        else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
        else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
      }
      return new Uint8Array(out);
    };

    const files = [
      {
        name: '[Content_Types].xml',
        data: xmlBytes('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
          '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
          '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
          '</Types>')
      },
      {
        name: '_rels/.rels',
        data: xmlBytes('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
          '</Relationships>')
      },
      {
        name: 'xl/workbook.xml',
        data: xmlBytes('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
          'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
          `<sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets>` +
          '</workbook>')
      },
      {
        name: 'xl/_rels/workbook.xml.rels',
        data: xmlBytes('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
          '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
          '</Relationships>')
      },
      {
        name: 'xl/styles.xml',
        data: xmlBytes('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
          '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>' +
          '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>' +
          '<fills count="3"><fill><patternFill patternType="none"/></fill>' +
          '<fill><patternFill patternType="gray125"/></fill>' +
          '<fill><patternFill patternType="solid"><fgColor rgb="FF0F766E"/><bgColor indexed="64"/></patternFill></fill></fills>' +
          '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
          '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
          '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
          '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment vertical="center"/></xf></cellXfs>' +
          '</styleSheet>')
      },
      { name: 'xl/worksheets/sheet1.xml', data: xmlBytes(sheetXml) }
    ];

    return SimpleZipLib.build(files);
  }

  /** Ö6: rich HTML table markup for clipboard pasting into spreadsheets. */
  function buildHtmlTable(data) {
    let headers = [];
    let rows = [];
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && data[0] !== null && !Array.isArray(data[0])) {
      headers = Object.keys(data[0]);
      rows = data;
    }
    let html = '<table><thead><tr>';
    headers.forEach((h) => { html += `<th>${escapeXml(h)}</th>`; });
    html += '</tr></thead><tbody>';
    rows.forEach((row) => {
      html += '<tr>';
      headers.forEach((h) => { html += `<td>${escapeXml(row[h])}</td>`; });
      html += '</tr>';
    });
    html += '</tbody></table>';
    return html;
  }

  return {
    generateExcelXml: generateExcelXml,
    generateXlsx: generateXlsx,
    buildHtmlTable: buildHtmlTable
  };
}));
