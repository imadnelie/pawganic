export const MEAL_TYPES = {
  chicken_with_rice: "Chicken with rice",
  beef_with_rice: "Beef with rice",
  fish_with_rice: "Fish with rice",
};

export const PARTNERS = ["elie", "jimmy"];

export function isMealType(v) {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(MEAL_TYPES, v);
}

export function isPartner(v) {
  return v === "elie" || v === "jimmy";
}
