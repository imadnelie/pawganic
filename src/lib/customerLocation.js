/** URL to open in maps: saved link, else lat/lng query link. */
export function customerMapHref(customer) {
  const link = customer?.maps_link?.trim?.() || customer?.maps_link;
  if (link) return link;
  if (customer?.lat != null && customer?.lng != null) {
    return `https://www.google.com/maps?q=${customer.lat},${customer.lng}`;
  }
  return null;
}

export function customerHasMap(customer) {
  return !!customerMapHref(customer);
}
