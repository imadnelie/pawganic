import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const MONGODB_URI = process.env.MONGODB_URI;

const orderItemSchema = new mongoose.Schema(
  {
    mealType: { type: String, required: true },
    quantity: { type: Number, required: true },
    pricePerUnit: { type: Number, required: true },
    subtotal: { type: Number, required: true },
  },
  { _id: true }
);

const orderSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    mealType: { type: String, required: true },
    quantity: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
    status: { type: String, enum: ["pending", "delivered"], default: "pending" },
    createdBy: { type: String, required: true },
    deliveredBy: { type: String, default: null },
    paidTo: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    deliveredAt: { type: Date, default: null },
    items: { type: [orderItemSchema], default: [] },
  },
  { timestamps: false }
);

orderSchema.index({ customerId: 1 });
orderSchema.index({ status: 1 });

const customerSchema = new mongoose.Schema(
  {
    first_name: { type: String, required: true },
    last_name: { type: String, required: true },
    mobile: { type: String, required: true },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

const expenseSchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    paid_by: { type: String, enum: ["elie", "jimmy"], required: true },
  },
  { timestamps: false }
);

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    email: { type: String, default: "" },
    password_hash: { type: String, required: true },
    role: { type: String, enum: ["admin", "user"], required: true },
    display_name: { type: String, required: true },
    two_factor_enabled: { type: Boolean, default: false },
    two_factor_secret: { type: String, default: null },
    two_factor_temp_secret: { type: String, default: null },
    reset_token: { type: String, default: null },
    reset_token_expiry: { type: String, default: null },
  },
  { timestamps: false }
);

export const User = mongoose.models.User || mongoose.model("User", userSchema);
export const Customer = mongoose.models.Customer || mongoose.model("Customer", customerSchema);
export const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);
export const Expense = mongoose.models.Expense || mongoose.model("Expense", expenseSchema);

export async function connectDb() {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is required (set your MongoDB Atlas connection string in .env)");
  }
  await mongoose.connect(MONGODB_URI);
  console.log("[db] Connected to MongoDB");
}

export async function initDb() {
  await seedUsersIfEmpty();
}

async function seedUsersIfEmpty() {
  const count = await User.countDocuments();
  if (count > 0) return;

  const password = process.env.PAWGANIC_PASSWORD || "pawganic1";
  const hash = bcrypt.hashSync(password, 10);
  await User.insertMany([
    {
      username: "elie",
      email: "elie.imad@gmail.com",
      password_hash: hash,
      role: "admin",
      display_name: "Elie",
    },
    {
      username: "jimmy",
      email: "jimmymakdissy@gmail.com",
      password_hash: hash,
      role: "user",
      display_name: "Jimmy",
    },
  ]);
  console.log("[db] Seeded users elie (admin) and jimmy (user). Password:", password);
}
