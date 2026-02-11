/**
 * Generate CSV string from array of objects
 * @param {Array<Object>} data - Array of objects to convert to CSV
 * @returns {string} CSV formatted string
 */
export function generateCSV(data) {
  if (!data || data.length === 0) {
    return '';
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);

  // Escape value for CSV
  const escapeCSV = (value) => {
    if (value === null || value === undefined) {
      return '';
    }
    const str = String(value);
    // If value contains comma, quote, or newline, wrap in quotes and escape internal quotes
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // Build CSV
  const lines = [
    headers.join(','), // Header row
    ...data.map(row =>
      headers.map(header => escapeCSV(row[header])).join(',')
    )
  ];

  return lines.join('\n');
}

/**
 * Parse CSV string to array of objects
 * @param {string} csv - CSV string to parse
 * @returns {Array<Object>} Array of objects
 */
export function parseCSV(csv) {
  const lines = csv.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = values[i] || '';
    });
    return obj;
  });
}

/**
 * Parse a single CSV line respecting quoted values
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        current += '"';
        i++; // Skip next quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }

  result.push(current);
  return result;
}
