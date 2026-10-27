/**
 * Helper to format numeric values to Indonesian Rupiah string (e.g. 1500000 -> "Rp 1.500.000")
 */
export const formatRupiah = (val) => {
  if (val === undefined || val === null || val === "" || isNaN(val))
    return "Rp 0";
  const num = Math.round(Number(val));
  return "Rp " + num.toLocaleString("id-ID");
};

/**
 * Helper to format raw numbers with Indonesian locale separators (e.g. 1500000 -> "1.500.000")
 */
export const formatNumberId = (val) => {
  if (val === undefined || val === null || val === "" || isNaN(val)) return "0";
  const num = Number(val);
  return num.toLocaleString("id-ID");
};

/**
 * Helper to format quantity cleanly without trailing zeroes (e.g. "10.0000" -> "10", "10.5000" -> "10,5")
 */
export const formatQty = (val) => {
  if (val === undefined || val === null || val === "") return "0";
  const num = parseFloat(val);
  if (isNaN(num)) return "0";
  return parseFloat(num.toFixed(4)).toLocaleString("id-ID");
};

/**
 * Helper to compute accurate payment details (paid, total, remaining, status, term, isFullyPaid, isPartial)
 */
export const getDocPaymentInfo = (doc) => {
  if (!doc)
    return {
      paid: 0,
      total: 0,
      remaining: 0,
      status: "UNPAID",
      term: "LUNAS",
      isFullyPaid: false,
      isPartial: false,
    };
  const total = parseFloat(doc.totalAmount || 0);
  const term =
    doc.metadata?.paymentTerm ||
    (doc.metadata?.dpAmount > 0
      ? "DP"
      : doc.metadata?.dueDate
        ? "TEMPO"
        : "LUNAS");

  let paid = 0;
  if (
    doc.metadata?.paidAmount !== undefined &&
    doc.metadata?.paidAmount !== null
  ) {
    paid = parseFloat(doc.metadata.paidAmount);
  } else if (term === "DP") {
    paid = parseFloat(doc.metadata?.dpAmount || 0);
  } else {
    paid = 0;
  }

  // Extract payments from invoices/bills if available
  const invoiceList = doc.invoices || doc.bills || [];
  const dbPayments = invoiceList.flatMap((inv) => inv.payments || []);
  const dbPaidSum = dbPayments.reduce(
    (sum, p) => sum + (parseFloat(p.amount) || 0),
    0,
  );

  // If payments log exists and has sum
  if (
    Array.isArray(doc.metadata?.payments) &&
    doc.metadata.payments.length > 0 &&
    (doc.metadata?.paidAmount === undefined ||
      doc.metadata?.paidAmount === null)
  ) {
    paid = doc.metadata.payments.reduce(
      (sum, p) => sum + (parseFloat(p.amount) || 0),
      0,
    );
  } else if (
    dbPaidSum > 0 &&
    (doc.metadata?.paidAmount === undefined ||
      doc.metadata?.paidAmount === null)
  ) {
    paid = dbPaidSum;
  }

  const remaining = Math.max(0, total - paid);
  const isFullyPaid = paid >= total - 0.01 && total > 0;
  const isPartial = paid > 0 && !isFullyPaid;
  const status = isFullyPaid
    ? "PAID"
    : isPartial
      ? "PARTIAL"
      : doc.metadata?.paymentStatus === "PAID"
        ? "PAID"
        : "UNPAID";

  // Merged payments list for UI
  const allPayments =
    doc.metadata?.payments && doc.metadata.payments.length > 0
      ? doc.metadata.payments
      : dbPayments.map((p) => ({
          id: p.id || p.paymentNumber,
          amount: parseFloat(p.amount),
          date: p.paymentDate,
          method: p.paymentMethod,
          accountName: p.account?.accountName,
          notes: p.notes,
        }));

  return {
    paid,
    total,
    remaining,
    status,
    term,
    isFullyPaid,
    isPartial,
    payments: allPayments,
  };
};

/**
 * Helper to normalize and sort all available units for a product
 * Returns array of { name, ratio, isBase } sorted from largest unit (highest ratio) to smallest unit.
 */
export const getProductUnitsNormalized = (product) => {
  if (!product) return [];
  const baseUnitName = (product.unit || "PCS").trim().toUpperCase();
  const rawUnits = product.units || product.availableUnits || [];

  const unitMap = new Map();

  // Add base unit first as baseline ratio 1.0
  unitMap.set(baseUnitName, {
    name: baseUnitName,
    ratio: 1.0,
    isBase: true,
  });

  if (Array.isArray(rawUnits)) {
    rawUnits.forEach((u) => {
      const name = (u.unitName || u.name || "").trim().toUpperCase();
      const ratio = parseFloat(u.conversionRatio || u.ratio || 1.0);
      if (name && ratio > 0) {
        unitMap.set(name, {
          name,
          ratio,
          isBase: !!u.isBaseUnit || ratio === 1.0,
        });
      }
    });
  }

  // Sort descending by ratio (e.g. KRT=1.0 > RENCENG=0.1 > PCS=0.01 or KRT=100 > RENCENG=10 > PCS=1)
  return Array.from(unitMap.values()).sort((a, b) => b.ratio - a.ratio);
};

/**
 * Multi-tier stock breakdown supporting 2, 3, or more unit tiers (e.g. 15 KRT + 3 RENCENG + 5 PCS)
 */
export const formatStockBreakdown = (qty, product) => {
  if (!product) return `${qty || 0}`;
  const totalBaseQty = parseFloat(qty) || 0;
  const baseUnit = (product.unit || "PCS").toUpperCase();

  if (totalBaseQty <= 0) return `0 ${baseUnit}`;

  const units = getProductUnitsNormalized(product);
  if (units.length <= 1)
    return `${totalBaseQty.toLocaleString("id-ID")} ${baseUnit}`;

  let remaining = totalBaseQty;
  const parts = [];

  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    const isLast = i === units.length - 1;

    if (isLast) {
      const count = Math.round(remaining / u.ratio);
      if (count > 0) {
        parts.push(`${count.toLocaleString("id-ID")} ${u.name}`);
      }
    } else {
      const approxCount = Math.round(remaining / u.ratio);
      if (
        approxCount > 0 &&
        Math.abs(remaining - approxCount * u.ratio) < u.ratio * 0.05
      ) {
        parts.push(`${approxCount.toLocaleString("id-ID")} ${u.name}`);
        remaining = 0;
        break;
      }

      const count = Math.floor((remaining + 1e-5) / u.ratio);
      if (count > 0) {
        parts.push(`${count.toLocaleString("id-ID")} ${u.name}`);
        remaining = Math.max(0, remaining - count * u.ratio);
      }
    }
  }

  if (parts.length === 0) return `0 ${baseUnit}`;

  const smallestUnit = units[units.length - 1];
  const totalSmallest = Math.round(totalBaseQty / smallestUnit.ratio);
  const breakdownStr = parts.join(" + ");

  if (units.length > 1 && smallestUnit && smallestUnit.ratio < units[0].ratio) {
    return `${breakdownStr} (Total ${totalSmallest.toLocaleString("id-ID")} ${smallestUnit.name})`;
  }

  return breakdownStr;
};

/**
 * Compact multi-tier stock breakdown for badges / small tags
 * e.g. "15 KRT + 3 RENCENG + 5 PCS"
 */
export const formatStockBreakdownCompact = (qty, product) => {
  if (!product) return `${qty || 0}`;
  const totalBaseQty = parseFloat(qty) || 0;
  const baseUnit = (product.unit || "PCS").toUpperCase();

  if (totalBaseQty <= 0) return `0 ${baseUnit}`;

  const units = getProductUnitsNormalized(product);
  if (units.length <= 1) return `${totalBaseQty} ${baseUnit}`;

  let remaining = totalBaseQty;
  const parts = [];

  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    const isLast = i === units.length - 1;

    if (isLast) {
      const count = Math.round(remaining / u.ratio);
      if (count > 0) {
        parts.push(`${count.toLocaleString("id-ID")} ${u.name}`);
      }
    } else {
      const approxCount = Math.round(remaining / u.ratio);
      if (
        approxCount > 0 &&
        Math.abs(remaining - approxCount * u.ratio) < u.ratio * 0.05
      ) {
        parts.push(`${approxCount.toLocaleString("id-ID")} ${u.name}`);
        remaining = 0;
        break;
      }

      const count = Math.floor((remaining + 1e-5) / u.ratio);
      if (count > 0) {
        parts.push(`${count.toLocaleString("id-ID")} ${u.name}`);
        remaining = Math.max(0, remaining - count * u.ratio);
      }
    }
  }

  if (parts.length === 0) return `0 ${baseUnit}`;
  return parts.join(" + ");
};

/**
 * Formats stock ledger quantity for clean & intuitive display in tables
 * Returns { primaryText, secondaryText, isPositive }
 * e.g. for +150.0000 KRT: primaryText = "+150 KRT", secondaryText = null
 * e.g. for -0.2500 KRT: primaryText = "-1 BAL", secondaryText = "Setara -0,25 KRT"
 * e.g. for -0.2085 KRT: primaryText = "-5 RCG", secondaryText = "Setara -0,21 KRT"
 * e.g. for -10.1000 KRT: primaryText = "-10 KRT + 2 PCS", secondaryText = "Setara -10.1 KRT"
 */
export const formatStockLedgerDisplay = (rawQty, product, isIncoming) => {
  const numQty = Math.abs(parseFloat(rawQty) || 0);
  const cleanBase = parseFloat(numQty.toFixed(4));
  const baseUnit = (product?.unit || "PCS").toUpperCase();
  const sign = isIncoming ? "+" : "-";

  if (!product || cleanBase === 0) {
    return {
      primaryText: `${sign}0 ${baseUnit}`,
      secondaryText: null,
      isPositive: isIncoming,
    };
  }

  const compact = formatStockBreakdownCompact(cleanBase, product);

  // If cleanBase is an exact integer of base unit (e.g. 2 KRT)
  const isExactBaseInteger =
    cleanBase % 1 === 0 && compact === `${cleanBase} ${baseUnit}`;

  if (compact && !isExactBaseInteger) {
    const isOnlyBaseUnit =
      compact === `${cleanBase} ${baseUnit}` ||
      (!compact.includes("+") && compact.endsWith(baseUnit));

    return {
      primaryText: `${sign}${compact}`,
      secondaryText: isOnlyBaseUnit
        ? null
        : `Setara ${sign}${cleanBase.toLocaleString("id-ID")} ${baseUnit}`,
      isPositive: isIncoming,
    };
  }

  return {
    primaryText: `${sign}${cleanBase.toLocaleString("id-ID")} ${baseUnit}`,
    secondaryText: null,
    isPositive: isIncoming,
  };
};

/**
 * Strips out any purchase price (Harga Beli) or HPP mentions from stock ledger notes
 * to prevent cost price leaks in Stock Ledger / Kartu Stok
 */
export const sanitizeStockLedgerNotes = (notes) => {
  if (!notes) return "—";
  const cleaned = notes
    .replace(
      /[,.]?\s*(?:Harga Beli|HPP|HPP per unit|HPP asal):\s*Rp[\d.,]+/gi,
      "",
    )
    .replace(/\(\s*\)/g, "")
    .trim();

  return cleaned || "—";
};

/**
 * Resolves multi-unit / tiered structure for a product
 * e.g. base=KRT, alt=PCS (ratio 0.0417, capacity 24)
 * or base=PCS, alt=KRT (ratio 24, capacity 24)
 */
export const getProductStructure = (product) => {
  if (!product) {
    return {
      hasMultiUnit: false,
      bigUnitName: "PCS",
      bigPrice: 0,
      smallUnitName: "",
      smallPrice: 0,
      capacity: 1,
      isBaseSmall: false,
      conversionHint: "",
    };
  }

  const baseUnit = (product.unit || "PCS").trim().toUpperCase();
  const rawUnits = product.units || product.availableUnits || [];

  // 1. Big candidate (ratio > 1, e.g. base=PCS, alt=KRT with ratio 24)
  const bigCandidate = rawUnits.find(
    (u) => !u.isBaseUnit && parseFloat(u.conversionRatio || u.ratio || 0) > 1,
  );
  if (bigCandidate) {
    const ratio = parseFloat(bigCandidate.conversionRatio || bigCandidate.ratio || 1);
    const capacity = Math.round(ratio);
    const smallPrice = parseFloat(product.purchasePrice || 0);
    const bigPrice = parseFloat(bigCandidate.purchasePrice || 0) || (smallPrice * capacity);
    return {
      hasMultiUnit: true,
      bigUnitName: (bigCandidate.unitName || bigCandidate.name || "KRT").toUpperCase(),
      bigPrice,
      smallUnitName: baseUnit,
      smallPrice,
      capacity,
      isBaseSmall: true,
      conversionHint: `1 ${(bigCandidate.unitName || bigCandidate.name || "KRT").toUpperCase()} = ${capacity} ${baseUnit}`,
    };
  }

  // 2. Small candidate (ratio < 1 and > 0, e.g. base=KRT, alt=PCS with ratio 0.04167)
  const smallCandidates = rawUnits
    .filter(
      (u) =>
        !u.isBaseUnit &&
        parseFloat(u.conversionRatio || u.ratio || 0) < 1 &&
        parseFloat(u.conversionRatio || u.ratio || 0) > 0,
    )
    .sort(
      (a, b) =>
        parseFloat(a.conversionRatio || a.ratio || 0) -
        parseFloat(b.conversionRatio || b.ratio || 0),
    );

  if (smallCandidates.length > 0) {
    const smallest = smallCandidates[0];
    const smallRatio = parseFloat(smallest.conversionRatio || smallest.ratio || 1);
    const capacity = Math.round(1 / smallRatio);
    const bigPrice = parseFloat(product.purchasePrice || 0);
    const smallPrice = parseFloat(smallest.purchasePrice || 0) || (capacity > 0 ? bigPrice / capacity : 0);
    return {
      hasMultiUnit: true,
      bigUnitName: baseUnit,
      bigPrice,
      smallUnitName: (smallest.unitName || smallest.name || "PCS").toUpperCase(),
      smallPrice,
      capacity,
      isBaseSmall: false,
      conversionHint: `1 ${baseUnit} = ${capacity} ${(smallest.unitName || smallest.name || "PCS").toUpperCase()}`,
    };
  }

  return {
    hasMultiUnit: false,
    bigUnitName: baseUnit,
    bigPrice: parseFloat(product.purchasePrice || 0),
    smallUnitName: "",
    smallPrice: 0,
    capacity: 1,
    isBaseSmall: false,
    conversionHint: "",
  };
};

/**
 * Calculates total base qty, gross subtotal, and breakdown text from tiered inputs
 */
export const calculateTieredItemSubtotal = (item, struct) => {
  const hasMulti = struct?.hasMultiUnit;
  const bigQty = parseFloat(item.bigQty !== undefined ? item.bigQty : item.qty) || 0;
  const smallQty = parseFloat(item.smallQty || 0);
  const bigBonus = parseFloat(item.bigBonusQty !== undefined ? item.bigBonusQty : item.bonusQty) || 0;
  const smallBonus = parseFloat(item.smallBonusQty || 0);

  let totalBaseQty = bigQty;
  let totalBaseBonusQty = bigBonus;
  let grossSubtotal = bigQty * (parseFloat(item.price) || struct?.bigPrice || 0);

  if (hasMulti) {
    const bigPrice = parseFloat(item.price) || struct.bigPrice || 0;
    const smallPrice = struct.smallPrice > 0 ? struct.smallPrice : (struct.capacity > 0 ? bigPrice / struct.capacity : 0);

    if (struct.isBaseSmall) {
      totalBaseQty = (bigQty * struct.capacity) + smallQty;
      totalBaseBonusQty = (bigBonus * struct.capacity) + smallBonus;
    } else {
      totalBaseQty = bigQty + (struct.capacity > 0 ? smallQty / struct.capacity : 0);
      totalBaseBonusQty = bigBonus + (struct.capacity > 0 ? smallBonus / struct.capacity : 0);
    }

    grossSubtotal = (bigQty * bigPrice) + (smallQty * smallPrice);
  }

  const discount = parseFloat(item.discount || 0);
  const netSubtotal = Math.max(0, grossSubtotal - discount);

  return {
    totalBaseQty,
    totalBaseBonusQty,
    grossSubtotal,
    netSubtotal,
  };
};

/**
 * Format quantity display with multi-unit breakdown support
 * e.g. "1 KRT + 8 PCS" or falls back to formatStockBreakdownCompact
 */
export const formatTieredQtyDisplay = (qty, metaItem, product, defaultUnit) => {
  if (metaItem && metaItem.bigUnit && (parseFloat(metaItem.bigQty || 0) > 0 || parseFloat(metaItem.smallQty || 0) > 0)) {
    const b = parseFloat(metaItem.bigQty || 0);
    const s = parseFloat(metaItem.smallQty || 0);
    const bUnit = metaItem.bigUnit;
    const sUnit = metaItem.smallUnit || "PCS";
    if (b > 0 && s > 0) return `${b} ${bUnit} + ${s} ${sUnit}`;
    if (b > 0) return `${b} ${bUnit}`;
    if (s > 0) return `${s} ${sUnit}`;
  }
  if (defaultUnit) {
    return `${formatQty(qty)} ${defaultUnit.toUpperCase()}`;
  }
  return formatStockBreakdownCompact(qty, product);
};

/**
 * Format bonus quantity display with multi-unit breakdown support
 */
export const formatTieredBonusDisplay = (bonusQty, metaItem, product, defaultUnit) => {
  if (metaItem && metaItem.bigUnit && (parseFloat(metaItem.bigBonusQty || 0) > 0 || parseFloat(metaItem.smallBonusQty || 0) > 0)) {
    const b = parseFloat(metaItem.bigBonusQty || 0);
    const s = parseFloat(metaItem.smallBonusQty || 0);
    const bUnit = metaItem.bigUnit;
    const sUnit = metaItem.smallUnit || "PCS";
    if (b > 0 && s > 0) return `${b} ${bUnit} + ${s} ${sUnit}`;
    if (b > 0) return `${b} ${bUnit}`;
    if (s > 0) return `${s} ${sUnit}`;
  }
  if (parseFloat(bonusQty || 0) > 0) {
    const u = (defaultUnit || product?.unit || "PCS").toUpperCase();
    return `${formatQty(bonusQty)} ${u}`;
  }
  return "";
};
