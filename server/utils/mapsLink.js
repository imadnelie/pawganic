/** Optional string: trim; empty → null */
export function optionalString(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function validCoord(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

/**
 * Best-effort coordinate extraction from common Google Maps URL shapes.
 * Short links (goo.gl / maps.app.goo.gl) usually cannot be parsed without a redirect fetch.
 */
export function extractCoordsFromMapsLink(link) {
  const s = optionalString(link);
  if (!s) return null;

  const tryPair = (latS, lngS) => {
    const lat = Number(latS);
    const lng = Number(lngS);
    return validCoord(lat, lng) ? { lat, lng } : null;
  };

  let m = s.match(/[?&](?:q|query)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i);
  if (m) return tryPair(m[1], m[2]);

  m = s.match(/[?&]ll=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i);
  if (m) return tryPair(m[1], m[2]);

  m = s.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (m) return tryPair(m[1], m[2]);

  m = s.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (m) return tryPair(m[1], m[2]);

  m = s.match(/\/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)(?:\/|,|\?|#|$)/);
  if (m) return tryPair(m[1], m[2]);

  return null;
}

export function resolveCustomerCoords({ lat, lng, maps_link }) {
  const latBody = lat != null && lat !== "" ? Number(lat) : null;
  const lngBody = lng != null && lng !== "" ? Number(lng) : null;
  if (Number.isFinite(latBody) && Number.isFinite(lngBody) && validCoord(latBody, lngBody)) {
    return { lat: latBody, lng: lngBody };
  }
  const extracted = extractCoordsFromMapsLink(maps_link);
  if (extracted) return extracted;
  return { lat: null, lng: null };
}
