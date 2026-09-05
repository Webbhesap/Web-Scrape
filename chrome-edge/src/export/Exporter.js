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
    // P2.4 — per-column CSV types (persisted on the sitemap):
    //   number : normalize localized numbers ("1.234,56", "$1,234.56")
    //   date   : format Date-like values with the column's date format
    // Self-contained on purpose: the export path must keep working even in
    // embeddings where the transform pipeline library is not loaded.

    /**
     * Parses localized numbers; returns a JS number or null.
     *
     * Heuristics:
     *  - both separators present: the LAST one is the decimal separator
     *    ("1.234,56" -> 1234.56, "1,234.56" -> 1234.56)
     *  - a separator appearing 2+ times is a grouping separator
     *    ("1.234.567" -> 1234567)
     *  - a single separator with a 1-2 digit tail is decimal
     *    ("99,90" -> 99.9); a 3-digit tail is grouping
     *    ("1,234" -> 1234)
     * Grouping groups must be exactly 3 digits ("1.2.3" is rejected).
     */
    static parseColumnNumber(raw) {
      if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
      if (raw === null || raw === undefined) return null;
      let s = String(raw).trim();
      if (!s) return null;
      s = s.replace(/[\s\u00A0\u202F]/g, '').replace(/[$€£₺¥₹]/g, '');
      if (!/^[+-]?[\d.,]+$/.test(s) || !/[0-9]/.test(s)) return null;

      let sign = '';
      if (s[0] === '+' || s[0] === '-') { sign = s[0]; s = s.slice(1); }

      const commas = s.split(',').length - 1;
      const dots = s.split('.').length - 1;
      if (commas === 0 && dots === 0) {
        const n = Number(sign + s);
        return Number.isFinite(n) ? n : null;
      }

      let decimalSep = null;
      let groupingSep = null;
      if (commas > 0 && dots > 0) {
        decimalSep = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.';
        groupingSep = decimalSep === ',' ? '.' : ',';
      } else if (commas >= 2) {
        groupingSep = ',';
      } else if (dots >= 2) {
        groupingSep = '.';
      } else {
        const sep = commas === 1 ? ',' : '.';
        const tail = s.slice(s.lastIndexOf(sep) + 1);
        if (/^\d{1,2}$/.test(tail)) {
          decimalSep = sep;
        } else if (/^\d{3}$/.test(tail)) {
          groupingSep = sep;
        } else {
          return null;
        }
      }

      const intSegment = decimalSep ? s.slice(0, s.lastIndexOf(decimalSep)) : s;
      const fracSegment = decimalSep ? s.slice(s.lastIndexOf(decimalSep) + 1) : '';

      if (groupingSep) {
        const groups = intSegment.split(groupingSep);
        for (let i = 0; i < groups.length; i++) {
          if (!/^\d+$/.test(groups[i]) || (i > 0 && groups[i].length !== 3)) return null;
        }
      } else if (!/^\d+$/.test(intSegment)) {
        return null;
      }
      if (!/^\d*$/.test(fracSegment) || (!intSegment && !fracSegment)) return null;

      const n = Number(sign + intSegment.split(groupingSep || '').join('') + (fracSegment ? '.' + fracSegment : ''));
      return Number.isFinite(n) ? n : null;
    }

    /** Formats Date-like values (Date, ISO string, number) for CSV output. */
    static formatColumnDate(value, format) {
      const fmt = typeof format === 'string' && format ? format : 'YYYY-MM-DD';
      let d = value;
      if (!(d instanceof Date)) {
        d = (typeof value === 'number' || (typeof value === 'string' && /^\d{10,13}$/.test(value.trim())))
          ? new Date(/^\d{13}$/.test(String(value).trim()) ? Number(value) : Number(value) * 1000)
          : new Date(value);
      }
      if (!(d instanceof Date) || isNaN(d.getTime())) return value; // not a date: leave untouched
      const p2 = (n) => String(n).padStart(2, '0');
      const tokens = {
        YYYY: String(d.getFullYear()),
        MM: p2(d.getMonth() + 1),
        DD: p2(d.getDate()),
        HH: p2(d.getHours()),
        mm: p2(d.getMinutes()),
        ss: p2(d.getSeconds())
      };
      return fmt
        .replace(/YYYY/g, tokens.YYYY)
        .replace(/MM/g, tokens.MM)
        .replace(/DD/g, tokens.DD)
        .replace(/HH/g, tokens.HH)
        .replace(/mm/g, tokens.mm)
        .replace(/ss/g, tokens.ss);
    }

    /** Applies one column's persisted type to a cell value. */
    static formatCellValue(value, colCfg) {
      if (!colCfg || !colCfg.type) return value;
      if (colCfg.type === 'number') {
        const n = this.parseColumnNumber(value);
        return n === null ? value : n;
      }
      if (colCfg.type === 'date') {
        return this.formatColumnDate(value, colCfg.format);
      }
      return value;
    }

    static toCSV(data, options = {}) {
      const opts = Object.assign({
        delimiter: ',',
        bom: true,
        header: true
      }, options);

      // P2.4: apply the persisted per-column types before serializing.
      // columnTypes may be an array of {name, type, format} (the sitemap
      // shape) or a map of name -> cfg.
      let byName = null;
      if (options.columnTypes) {
        byName = new Map();
        if (Array.isArray(options.columnTypes)) {
          for (const ct of options.columnTypes) {
            if (ct && ct.name) byName.set(ct.name, ct);
          }
        } else if (typeof options.columnTypes === 'object') {
          for (const k of Object.keys(options.columnTypes)) byName.set(k, options.columnTypes[k]);
        }
        if (Array.isArray(data)) {
          data = data.map((row) => {
            if (!row || typeof row !== 'object') return row;
            const out = {};
            for (const key of Object.keys(row)) {
              out[key] = this.formatCellValue(row[key], byName.get(key) || null);
            }
            return out;
          });
        }
      }

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
     * Converts records to TSV (tab separated values) string.
     */
    static toTSV(data, options = {}) {
      return this.toCSV(data, Object.assign({ delimiter: '\t' }, options));
    }

    /**
     * Converts records to NDJSON / JSON Lines: one JSON object per line.
     */
    static toNDJSON(data) {
      if (!Array.isArray(data) || data.length === 0) return '';
      return data.map(row => JSON.stringify(row)).join('\n') + '\n';
    }

    /**
     * Downloads scraped data as CSV file.
     */
    static downloadCSV(data, sitemapName, delimiter = ',', columnTypes) {
      const csvStr = this.toCSV(data, { delimiter: delimiter, bom: true, columnTypes: columnTypes });
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
     * Ö6: downloads a real Office Open XML workbook (.xlsx).
     */
    static async downloadXLSX(data, sitemapName) {
      const bytes = await XLSX.generateXlsx(data, sitemapName);
      const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const filename = `${sanitizeFilename(sitemapName)}_data.xlsx`;
      downloadBlob(blob, filename);
    }

    /**
     * Ö6: rich HTML table markup (for clipboard pasting into spreadsheets).
     */
    static buildHtmlTable(data) {
      return XLSX.buildHtmlTable(data);
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
     * Downloads scraped data as TSV file.
     */
    static downloadTSV(data, sitemapName) {
      const tsvStr = this.toTSV(data, { bom: true });
      const blob = new Blob([tsvStr], { type: 'text/tab-separated-values;charset=utf-8;' });
      const filename = `${sanitizeFilename(sitemapName)}_data.tsv`;
      downloadBlob(blob, filename);
    }

    /**
     * Downloads scraped data as NDJSON (JSON Lines) file.
     */
    static downloadNDJSON(data, sitemapName) {
      const ndStr = this.toNDJSON(data);
      const blob = new Blob([ndStr], { type: 'application/x-ndjson;charset=utf-8;' });
      const filename = `${sanitizeFilename(sitemapName)}_data.ndjson`;
      downloadBlob(blob, filename);
    }

    /**
     * Builds a backup object containing every sitemap definition.
     */
    static buildSitemapsBackup(sitemaps) {
      return {
        format: 'web-scraper-backup',
        version: 1,
        exportedAt: new Date().toISOString(),
        sitemaps: Array.isArray(sitemaps) ? sitemaps : []
      };
    }

    /**
     * Downloads all sitemaps in a single backup JSON file.
     */
    static downloadAllSitemaps(sitemaps) {
      const backup = this.buildSitemapsBackup(sitemaps);
      const jsonStr = this.toJSON(backup, true);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `webscraper_backup_${date}.json`);
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
