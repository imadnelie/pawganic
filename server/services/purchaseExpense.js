import { Expense } from "../db.js";
import { isPartner } from "../constants.js";

export const PURCHASE_EXPENSE_SOURCE = "purchase";

export function purchaseExpenseDescription(vendorName) {
  const vendor = String(vendorName || "").trim();
  return vendor ? `Inventory Purchase: ${vendor}` : "Inventory Purchase";
}

export function purchaseInvoiceToExpenseDate(invoiceDate) {
  if (invoiceDate instanceof Date) return invoiceDate.toISOString().slice(0, 10);
  const s = String(invoiceDate || "");
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/** paidBy from form, else logged-in partner username, else elie. */
export function resolvePurchasePaidBy(bodyPaidBy, fallbackUsername) {
  const fromBody = String(bodyPaidBy || "").toLowerCase();
  if (isPartner(fromBody)) return fromBody;
  const fromUser = String(fallbackUsername || "").toLowerCase();
  if (isPartner(fromUser)) return fromUser;
  return "elie";
}

/**
 * Create linked expense for a new purchase (skips if expenseId already set or amount <= 0).
 */
export async function createLinkedExpenseForPurchase(purchase, paidBy, session) {
  if (purchase.expenseId) return null;
  const amount = Number(purchase.invoiceTotal);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const expense = (
    await Expense.create(
      [
        {
          date: purchaseInvoiceToExpenseDate(purchase.invoiceDate),
          description: purchaseExpenseDescription(purchase.vendorName),
          amount,
          paid_by: paidBy,
          sourceType: PURCHASE_EXPENSE_SOURCE,
          sourceId: purchase._id,
        },
      ],
      session ? { session } : {}
    )
  )[0];

  purchase.expenseId = expense._id;
  purchase.paidBy = paidBy;
  await purchase.save(session ? { session } : {});
  return expense;
}

/** Update existing linked expense when admin edits purchase. */
export async function updateLinkedExpenseForPurchase(purchase, paidBy, session) {
  if (!purchase.expenseId) return;
  const amount = Number(purchase.invoiceTotal);
  const opts = session ? { session } : {};
  if (!Number.isFinite(amount) || amount <= 0) {
    await Expense.deleteOne({ _id: purchase.expenseId }, opts);
    purchase.expenseId = null;
    purchase.paidBy = paidBy;
    await purchase.save(opts);
    return;
  }
  await Expense.findByIdAndUpdate(
    purchase.expenseId,
    {
      date: purchaseInvoiceToExpenseDate(purchase.invoiceDate),
      description: purchaseExpenseDescription(purchase.vendorName),
      amount,
      paid_by: paidBy,
    },
    opts
  );
  purchase.paidBy = paidBy;
  await purchase.save(opts);
}

export async function deleteLinkedExpenseForPurchase(purchase, session) {
  if (!purchase.expenseId) return;
  const opts = session ? { session } : {};
  await Expense.deleteOne({ _id: purchase.expenseId }, opts);
}
