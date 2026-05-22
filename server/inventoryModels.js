import mongoose from "mongoose";

const INVENTORY_CATEGORIES = [
  "protein",
  "vegetable",
  "carb",
  "oil_supplement",
  "packaging",
  "sticker",
  "other",
];

const UNIT_TYPES = ["kg", "piece", "box", "pack", "unit"];

const FINISHED_PRODUCT_TYPES = ["chicken_rice", "beef_rice", "fish_rice"];

const BATCH_STATUSES = ["available", "partially_sold", "sold_out"];

const inventoryItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: INVENTORY_CATEGORIES, required: true },
    unit: { type: String, enum: UNIT_TYPES, required: true },
    active: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

inventoryItemSchema.index({ name: 1, unit: 1 }, { unique: true });

const purchaseSchema = new mongoose.Schema(
  {
    vendorName: { type: String, required: true, trim: true },
    invoiceDate: { type: Date, required: true },
    invoiceTotal: { type: Number, required: true },
    notes: { type: String, default: "" },
    createdBy: { type: String, required: true },
    paidBy: { type: String, enum: ["elie", "jimmy"], default: null },
    expenseId: { type: mongoose.Schema.Types.ObjectId, ref: "Expense", default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

purchaseSchema.index({ invoiceDate: -1 });

const purchaseLineSchema = new mongoose.Schema(
  {
    purchaseId: { type: mongoose.Schema.Types.ObjectId, ref: "Purchase", required: true },
    inventoryItemId: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryItem", required: true },
    itemNameSnapshot: { type: String, required: true },
    categorySnapshot: { type: String, required: true },
    unit: { type: String, enum: UNIT_TYPES, required: true },
    quantityPurchased: { type: Number, required: true },
    quantityRemaining: { type: Number, required: true },
    totalCost: { type: Number, required: true },
    unitCost: { type: Number, required: true },
    expiryDate: { type: Date, default: null },
    notes: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

purchaseLineSchema.index({ purchaseId: 1 });
purchaseLineSchema.index({ inventoryItemId: 1, createdAt: 1 });

const productionBatchSchema = new mongoose.Schema(
  {
    batchCode: { type: String, required: true, unique: true },
    productType: { type: String, enum: FINISHED_PRODUCT_TYPES, required: true },
    batchDate: { type: Date, required: true },
    outputQuantityKg: { type: Number, required: true },
    remainingQuantityKg: { type: Number, required: true },
    soldQuantityKg: { type: Number, default: 0 },
    totalBatchCost: { type: Number, required: true },
    costPerKg: { type: Number, required: true },
    expectedSellingPricePerKg: { type: Number, default: null },
    notes: { type: String, default: "" },
    status: { type: String, enum: BATCH_STATUSES, default: "available" },
    createdBy: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

productionBatchSchema.index({ productType: 1, batchDate: 1 });
productionBatchSchema.index({ createdAt: 1 });

const batchInputSchema = new mongoose.Schema(
  {
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: "ProductionBatch", required: true },
    inventoryItemId: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryItem", required: true },
    itemNameSnapshot: { type: String, required: true },
    unit: { type: String, enum: UNIT_TYPES, required: true },
    quantityUsed: { type: Number, required: true },
    allocatedCost: { type: Number, required: true },
    sourcePurchaseLots: {
      type: [
        {
          purchaseLineId: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseLine", required: true },
          quantity: { type: Number, required: true },
          unitCost: { type: Number, required: true },
          cost: { type: Number, required: true },
        },
      ],
      default: [],
    },
  },
  { timestamps: false }
);

batchInputSchema.index({ batchId: 1 });

const finishedInventoryLotSchema = new mongoose.Schema(
  {
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: "ProductionBatch", required: true, unique: true },
    productType: { type: String, enum: FINISHED_PRODUCT_TYPES, required: true },
    originalQuantityKg: { type: Number, required: true },
    remainingQuantityKg: { type: Number, required: true },
    costPerKg: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

finishedInventoryLotSchema.index({ productType: 1, createdAt: 1 });
finishedInventoryLotSchema.index({ remainingQuantityKg: 1, productType: 1 });

const orderBatchAllocationSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    orderItemId: { type: mongoose.Schema.Types.ObjectId, required: true },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: "ProductionBatch", required: true },
    finishedLotId: { type: mongoose.Schema.Types.ObjectId, ref: "FinishedInventoryLot", required: true },
    productType: { type: String, enum: FINISHED_PRODUCT_TYPES, required: true },
    quantityKg: { type: Number, required: true },
    costPerKg: { type: Number, required: true },
    allocatedCost: { type: Number, required: true },
    revenueAllocated: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

orderBatchAllocationSchema.index({ orderId: 1 });
orderBatchAllocationSchema.index({ batchId: 1 });
orderBatchAllocationSchema.index({ orderItemId: 1 });

export const InventoryItem =
  mongoose.models.InventoryItem || mongoose.model("InventoryItem", inventoryItemSchema);
export const Purchase = mongoose.models.Purchase || mongoose.model("Purchase", purchaseSchema);
export const PurchaseLine = mongoose.models.PurchaseLine || mongoose.model("PurchaseLine", purchaseLineSchema);
export const ProductionBatch =
  mongoose.models.ProductionBatch || mongoose.model("ProductionBatch", productionBatchSchema);
export const BatchInput = mongoose.models.BatchInput || mongoose.model("BatchInput", batchInputSchema);
export const FinishedInventoryLot =
  mongoose.models.FinishedInventoryLot || mongoose.model("FinishedInventoryLot", finishedInventoryLotSchema);
export const OrderBatchAllocation =
  mongoose.models.OrderBatchAllocation || mongoose.model("OrderBatchAllocation", orderBatchAllocationSchema);

export const INVENTORY_MODEL_CONSTANTS = {
  INVENTORY_CATEGORIES,
  UNIT_TYPES,
  FINISHED_PRODUCT_TYPES,
  BATCH_STATUSES,
};
