import {
  RazorpayCheckoutOptions,
  RazorpayInstance,
} from "../types/razorpay.js";

const RAZORPAY_CHECKOUT_SCRIPT_URL =
  "https://checkout.razorpay.com/v1/checkout.js";

let scriptLoadingPromise: Promise<boolean> | null = null;

/**
 * Loads the Razorpay Standard Checkout SDK (checkout.js) reliably.
 * Reuses existing script tag if present, prevents duplicate injections,
 * and handles network/loading errors gracefully.
 */
export function loadRazorpayCheckout(): Promise<boolean> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Razorpay Checkout can only be loaded in a browser environment."));
  }

  // 1. If window.Razorpay is already present and initialized, resolve immediately
  if (typeof window.Razorpay === "function") {
    return Promise.resolve(true);
  }

  // 2. If a loading promise is already active, return it to prevent duplicate loads
  if (scriptLoadingPromise) {
    return scriptLoadingPromise;
  }

  scriptLoadingPromise = new Promise<boolean>((resolve, reject) => {
    // Check if script tag is already in DOM (e.g. from index.html)
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${RAZORPAY_CHECKOUT_SCRIPT_URL}"]`
    );

    if (existingScript) {
      if (typeof window.Razorpay === "function") {
        resolve(true);
        return;
      }

      existingScript.addEventListener("load", () => {
        if (typeof window.Razorpay === "function") {
          resolve(true);
        } else {
          reject(new Error("Razorpay Checkout SDK script loaded, but constructor not found."));
        }
      });

      existingScript.addEventListener("error", () => {
        scriptLoadingPromise = null;
        reject(new Error("Unable to load payment checkout. Please check your internet connection and try again."));
      });
      return;
    }

    // Otherwise dynamically inject the script tag
    const script = document.createElement("script");
    script.src = RAZORPAY_CHECKOUT_SCRIPT_URL;
    script.async = true;

    script.onload = () => {
      if (typeof window.Razorpay === "function") {
        resolve(true);
      } else {
        scriptLoadingPromise = null;
        reject(new Error("Razorpay Checkout SDK script loaded, but constructor not found."));
      }
    };

    script.onerror = () => {
      scriptLoadingPromise = null;
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
      reject(new Error("Unable to load payment checkout. Please check your internet connection and try again."));
    };

    document.body.appendChild(script);
  });

  return scriptLoadingPromise;
}

/**
 * Initializes and opens Razorpay Standard Checkout modal with authoritative backend order details.
 */
export async function openRazorpayCheckout(
  options: RazorpayCheckoutOptions
): Promise<RazorpayInstance> {
  await loadRazorpayCheckout();

  if (typeof window.Razorpay !== "function") {
    throw new Error("Razorpay Checkout is not available in the current environment.");
  }

  const razorpay = new window.Razorpay(options);
  razorpay.open();
  return razorpay;
}
