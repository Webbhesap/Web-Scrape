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
    sheetName = sheetName.replace(/[:\\/?*\[\]]/g, '_').substring(0, 31);

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

  return {
    generateExcelXml: generateExcelXml
  };
}));
