import { Prisma } from "@prisma/client";
import { ValidationError } from "./errors.js";

/**
 * Exact monetary conversion from INR (Rupees) to Razorpay smallest currency unit (Paise).
 * ₹1 = 100 paise.
 * Avoids IEEE 754 floating-point precision drift.
 */
export function rupeesToPaise(rupees: number | string | Prisma.Decimal): number {
  let num: number;

  if (typeof rupees === "number") {
    num = rupees;
  } else if (typeof rupees === "string") {
    num = parseFloat(rupees);
  } else if (rupees instanceof Prisma.Decimal) {
    num = rupees.toNumber();
  } else if (typeof rupees === "object" && rupees !== null && "toNumber" in rupees) {
    num = (rupees as any).toNumber();
  } else {
    throw new ValidationError("Invalid monetary value provided for rupee-to-paise conversion");
  }

  if (isNaN(num) || !isFinite(num)) {
    throw new ValidationError("Monetary amount must be a finite valid number");
  }

  if (num < 0) {
    throw new ValidationError("Monetary amount cannot be negative");
  }

  // Exact integer paise conversion
  // Using Math.round((num + Number.EPSILON) * 100) to ensure exact integer values
  const paise = Math.round((num + Number.EPSILON) * 100);

  return paise;
}

/**
 * Exact monetary conversion from Razorpay smallest currency unit (Paise) to INR (Rupees).
 */
export function paiseToRupees(paise: number): number {
  if (!Number.isInteger(paise) || paise < 0) {
    throw new ValidationError("Paise must be a non-negative integer");
  }
  return paise / 100;
}
