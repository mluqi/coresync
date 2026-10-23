/**
 * Generates formatted document numbers in the format: PREFIX.YYYY.MM.XXXXX
 * Example: SO.2026.08.00001, PO.2026.08.00001
 * 
 * @param {string} prefix - 'SO' | 'PO' | 'INV' | 'SJ'
 * @param {string|Date} date - Document date
 * @param {Array} existingList - List of existing orders to calculate next sequential number
 */
export const generateDocumentNumber = (prefix = 'SO', date = new Date(), existingList = []) => {
  const d = date ? new Date(date) : new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  
  const patternPrefix = `${prefix}.${year}.${month}.`;

  let maxSeq = 0;
  if (Array.isArray(existingList)) {
    existingList.forEach(item => {
      const num = item.soNumber || item.poNumber || item.invoiceNumber || item.deliveryNumber || item.number || '';
      if (num && num.startsWith(patternPrefix)) {
        const seqPart = num.replace(patternPrefix, '');
        const seqNum = parseInt(seqPart, 10);
        if (!isNaN(seqNum) && seqNum > maxSeq) {
          maxSeq = seqNum;
        }
      }
    });
  }

  const nextSeq = String(maxSeq + 1).padStart(5, '0');
  return `${prefix}.${year}.${month}.${nextSeq}`;
};

export default generateDocumentNumber;
