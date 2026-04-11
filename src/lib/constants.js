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
