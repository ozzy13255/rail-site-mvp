/**
 * RailSite railway mileage positioning utilities.
 * Uses only an authorised, validated reference dataset supplied by the app.
 * No fabricated railway coordinates and no PinPoint scraping.
 *
 * Expected point shape:
 * { elr, miles, chains, latitude, longitude, routeReference?, source? }
 *
 * For map display/planning support only. Never use as safety-critical positioning.
 */
export const CHAINS_PER_MILE = 80;
export const YARDS_PER_CHAIN = 22;

export function parseMileage(milesValue, chainsValue) {
  const miles = Number(milesValue);
  const chains = Number(chainsValue);
  if (!Number.isInteger(miles) || miles < 0) {
    throw new Error("Miles must be a whole number of zero or greater.");
  }
  if (!Number.isInteger(chains) || chains < 0 || chains >= CHAINS_PER_MILE) {
    throw new Error("Chains must be a whole number from 0 to 79.");
  }
  return { miles, chains, totalChains: miles * CHAINS_PER_MILE + chains };
}

function normaliseElr(value) {
  return String(value ?? "").trim().toUpperCase();
}

function validReferencePoint(point) {
  return point &&
    Number.isFinite(Number(point.miles)) &&
    Number.isInteger(Number(point.chains)) &&
    Number(point.chains) >= 0 &&
    Number(point.chains) < CHAINS_PER_MILE &&
    Number.isFinite(Number(point.latitude)) &&
    Number(point.latitude) >= -90 && Number(point.latitude) <= 90 &&
    Number.isFinite(Number(point.longitude)) &&
    Number(point.longitude) >= -180 && Number(point.longitude) <= 180;
}

function totalChains(point) {
  return Number(point.miles) * CHAINS_PER_MILE + Number(point.chains);
}

/**
 * Find an ELR mileage using adjacent reference points on the same ELR.
 * When routeReference is provided, points with a different route reference
 * are excluded. The reference dataset must be authorised and validated.
 */
export function locateElrMileage({
  elr, miles, chains, referencePoints = [], routeReference = "",
}) {
  const targetElr = normaliseElr(elr);
  if (!targetElr) throw new Error("Enter an ELR.");
  const target = parseMileage(miles, chains).totalChains;
  const targetRoute = String(routeReference ?? "").trim().toUpperCase();

  const points = referencePoints
    .filter(validReferencePoint)
    .filter((point) => normaliseElr(point.elr) === targetElr)
    .filter((point) => !targetRoute || !point.routeReference ||
      String(point.routeReference).trim().toUpperCase() === targetRoute)
    .map((point) => ({ ...point, _totalChains: totalChains(point) }))
    .sort((a, b) => a._totalChains - b._totalChains);

  if (points.length < 2) {
    return { found: false, reason: "insufficient_reference_points",
      message: "There are not enough validated reference points for this ELR and route." };
  }

  const exact = points.find((point) => point._totalChains === target);
  if (exact) {
    return {
      found: true, exact: true, latitude: Number(exact.latitude),
      longitude: Number(exact.longitude), elr: targetElr,
      miles: Number(miles), chains: Number(chains),
      routeReference: exact.routeReference ?? routeReference ?? "",
      source: exact.source ?? null, referencePoints: [exact],
      confidence: "dataset_exact_point",
      warning: "Reference mapping only. Verify against approved railway documentation and procedures.",
    };
  }

  let lower = null;
  let upper = null;
  for (let i = 0; i < points.length - 1; i += 1) {
    if (points[i]._totalChains < target && points[i + 1]._totalChains > target) {
      lower = points[i];
      upper = points[i + 1];
      break;
    }
  }

  if (!lower || !upper) {
    return { found: false, reason: "mileage_outside_reference_coverage",
      message: "This mileage is outside the available reference points for the selected ELR and route." };
  }

  const span = upper._totalChains - lower._totalChains;
  if (span <= 0) {
    return { found: false, reason: "invalid_reference_order",
      message: "The reference data contains duplicate or incorrectly ordered mileage points." };
  }

  const ratio = (target - lower._totalChains) / span;
  return {
    found: true, exact: false,
    latitude: Number(lower.latitude) + (Number(upper.latitude) - Number(lower.latitude)) * ratio,
    longitude: Number(lower.longitude) + (Number(upper.longitude) - Number(lower.longitude)) * ratio,
    elr: targetElr, miles: Number(miles), chains: Number(chains),
    routeReference: routeReference || lower.routeReference || "",
    source: lower.source === upper.source ? (lower.source ?? null) : null,
    referencePoints: [lower, upper],
    confidence: "interpolated_between_reference_points",
    warning: "Interpolated reference position only. Verify against approved railway documentation and procedures.",
  };
}

/** Basic import validation only; this does not verify provenance, licensing,
 * topology, completeness, accuracy, or operational suitability. */
export function validateMileageDataset(rows) {
  if (!Array.isArray(rows)) {
    return { valid: false, errors: ["Dataset must be an array of reference points."], count: 0 };
  }
  const errors = [];
  rows.forEach((point, index) => {
    if (!point || !normaliseElr(point.elr)) {
      errors.push("Row " + (index + 1) + ": missing ELR.");
      return;
    }
    if (!validReferencePoint(point)) {
      errors.push("Row " + (index + 1) + ": invalid mileage, chainage or coordinates.");
    }
  });
  return { valid: errors.length === 0, errors, count: rows.length };
}
