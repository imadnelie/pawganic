export const MEAL_TYPES = [
  { value: "chicken_with_rice", label: "Chicken with rice" },
  { value: "beef_with_rice", label: "Beef with rice" },
  { value: "fish_with_rice", label: "Fish with rice" },
];

export function mealLabel(value) {
  return MEAL_TYPES.find((m) => m.value === value)?.label || value;
}

export const PARTNERS = [
  { value: "elie", label: "Elie" },
  { value: "jimmy", label: "Jimmy" },
];

/** Ingredient / supply categories for purchases & inventory */
export const INVENTORY_CATEGORIES = [
  { value: "protein", label: "Protein" },
  { value: "vegetable", label: "Vegetable" },
  { value: "carb", label: "Carb" },
  { value: "oil_supplement", label: "Oil / supplement" },
  { value: "packaging", label: "Packaging" },
  { value: "sticker", label: "Sticker" },
  { value: "other", label: "Other" },
];

export const UNIT_TYPES = [
  { value: "kg", label: "kg" },
  { value: "piece", label: "piece" },
  { value: "box", label: "box" },
  { value: "pack", label: "pack" },
  { value: "unit", label: "unit" },
];

/** Finished goods produced in batches */
export const FINISHED_PRODUCT_TYPES = [
  { value: "chicken_rice", label: "Chicken Rice" },
  { value: "beef_rice", label: "Beef Rice" },
  { value: "fish_rice", label: "Fish Rice" },
];

export function finishedProductLabel(value) {
  return FINISHED_PRODUCT_TYPES.find((p) => p.value === value)?.label || value;
}

export function inventoryCategoryLabel(value) {
  return INVENTORY_CATEGORIES.find((c) => c.value === value)?.label || value;
}
