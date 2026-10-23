/**
 * Audit Trail Diffing Helper
 * Compares two objects and generates a structured change log
 */

const formatCurrency = (val) => {
  if (val === null || val === undefined || isNaN(val)) return 'Rp 0';
  return 'Rp ' + Number(val).toLocaleString('id-ID');
};

exports.computeDiff = (previousObj, currentObj, fieldsConfig = []) => {
  const changes = [];

  for (const config of fieldsConfig) {
    const { field, label, type = 'TEXT' } = config;
    let beforeVal = previousObj ? previousObj[field] : undefined;
    let afterVal = currentObj ? currentObj[field] : undefined;

    // Standardize numeric / null values
    if (type === 'NUMBER' || type === 'CURRENCY') {
      beforeVal = beforeVal !== undefined && beforeVal !== null ? Number(beforeVal) : 0;
      afterVal = afterVal !== undefined && afterVal !== null ? Number(afterVal) : 0;

      if (beforeVal !== afterVal) {
        changes.push({
          field,
          label: label || field,
          type,
          before: beforeVal,
          after: afterVal,
          beforeFormatted: type === 'CURRENCY' ? formatCurrency(beforeVal) : String(beforeVal),
          afterFormatted: type === 'CURRENCY' ? formatCurrency(afterVal) : String(afterVal)
        });
      }
    } else {
      // String / Generic comparison
      const bStr = beforeVal !== undefined && beforeVal !== null ? String(beforeVal).trim() : '';
      const aStr = afterVal !== undefined && afterVal !== null ? String(afterVal).trim() : '';

      if (bStr !== aStr) {
        changes.push({
          field,
          label: label || field,
          type,
          before: beforeVal || null,
          after: afterVal || null,
          beforeFormatted: bStr || '(Kosong)',
          afterFormatted: aStr || '(Kosong)'
        });
      }
    }
  }

  return changes;
};
