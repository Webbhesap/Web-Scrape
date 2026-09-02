/**
 * Export Manager for Scraped Data and Sitemaps.
 * Pure Vanilla JS, zero external dependencies.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['../../lib/csv.js', '../../lib/xlsx.js'], factory);
  } else if (typeof module === 'object' && module.exports) {
    const CSV = require('../../lib/csv.js');
    const XLSX = require('../../lib/xlsx.js');
    module.exports = factory(CSV, XLSX);
  } else {
    root.Exporter = factory(root.CSV, root.XLSX);
  }
}(typeof self !== 'undefined' ? self : this, function (CSV, XLSX) {
  'use strict';

  function sanitizeFilename(name) {
    return String(name || 'data')
      .replace(/[^a-zA-Z0-9_\-\.]/g, '_')
      .replace(/_{2,}/g, '_');
  }

  function downloadBlob(blob, filename) {
    if (typeof window === 'undefined') return;

    const url = URL.createObjectURL(blob);
    
    // Check if chrome.downloads API is available
    if (typeof chrome !== 'undefined' && chrome.downloads && chrome.downloads.download) {
      chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: true
      }, () => {
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      });
      return;
    }

    // DOM Anchor download
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  class Exporter {
    /**
     * Converts records to CSV string.
     */
    static toCSV(data, options = {}) {
      const opts = Object.assign({
        delimiter: ',',
        bom: true,
        header: true
      }, options);

      return CSV.unparse(data, opts);
    }

    /**
     * Converts records to Excel XML string.
     */
    static toExcel(data, sheetName) {
      return XLSX.generateExcelXml(data, sheetName);
    }

    /**
     * Converts data to formatted JSON string.
     */
    static toJSON(data, pretty = true) {
      return JSON.stringify(data, null, pretty ? 2 : 0);
    }

    /**
     * Downloads scraped data as CSV file.
     */
    static downloadCSV(data, sitemapName, delimiter = ',') {
      const csvStr = this.toCSV(data, { delimiter: delimiter, bom: true });
      const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
      const filename = `${sanitizeFilename(sitemapName)}_data.csv`;
      downloadBlob(blob, filename);
    }

    /**
     * Downloads scraped data as Excel XLSX/XML file.
     */
    static downloadExcel(data, sitemapName) {
      const xmlStr = this.toExcel(data, sitemapName);
      const blob = new Blob([xmlStr], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const filename = `${sanitizeFilename(sitemapName)}_data.xls`;
      downloadBlob(blob, filename);
    }

    /**
     * Downloads scraped data as JSON file.
     */
    static downloadJSON(data, sitemapName) {
      const jsonStr = this.toJSON(data, true);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
      const filename = `${sanitizeFilename(sitemapName)}_data.json`;
      downloadBlob(blob, filename);
    }

    /**
     * Downloads Sitemap definition as JSON file.
     */
    static downloadSitemapJSON(sitemapData, sitemapName) {
      const jsonStr = this.toJSON(sitemapData, true);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
      const filename = `sitemap_${sanitizeFilename(sitemapName || sitemapData._id)}.json`;
      downloadBlob(blob, filename);
    }
  }

  return Exporter;
}));
