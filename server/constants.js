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

/** Maps order meal types to finished-goods product types for inventory FIFO. */
export function mealTypeToFinishedProductType(mealType) {
  const m = {
    chicken_with_rice: "chicken_rice",
    beef_with_rice: "beef_rice",
    fish_with_rice: "fish_rice",
  };
  const key = String(mealType || "");
  return Object.prototype.hasOwnProperty.call(m, key) ? m[key] : null;
}
