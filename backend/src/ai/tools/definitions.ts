import { Type } from "@google/genai";

/**
 * Gemini Function Declaration: search_products
 */
export const searchProductsDeclaration = {
  name: "search_products",
  description:
    "Search the electronic product catalog using natural requirements such as budget, brand, category, and specifications like battery life. Always use this tool when the user is looking for, browsing, or asking about products.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      search: {
        type: Type.STRING,
        description: "Keywords to search in product title, brand, or description (e.g. 'earbuds', 'noise cancelling', 'iPhone')",
      },
      category: {
        type: Type.STRING,
        description: "Exact category filter. Available options: 'Wireless Earbuds', 'Headphones', 'Smartwatches', 'Smartphones', 'Laptops'",
      },
      brand: {
        type: Type.STRING,
        description: "Brand name filter (e.g. 'boAt', 'Sony', 'Apple', 'OnePlus', 'Noise', 'Samsung')",
      },
      minPrice: {
        type: Type.NUMBER,
        description: "Minimum price constraint in INR (e.g. 1000)",
      },
      maxPrice: {
        type: Type.NUMBER,
        description: "Maximum budget constraint in INR (e.g. 2500)",
      },
      minRating: {
        type: Type.NUMBER,
        description: "Minimum star rating between 0 and 5 (e.g. 4.0)",
      },
      minBatteryHours: {
        type: Type.NUMBER,
        description: "Minimum battery playback life in hours (e.g. 30)",
      },
      inStock: {
        type: Type.BOOLEAN,
        description: "Filter to show only in-stock products (default: true)",
      },
      sort: {
        type: Type.STRING,
        description: "Sorting preference: 'price_asc', 'price_desc', 'rating_desc', 'name_asc'",
      },
      limit: {
        type: Type.NUMBER,
        description: "Number of recommendations to return (default: 5, max: 10)",
      },
    },
  },
};

/**
 * Gemini Function Declaration: get_product
 */
export const getProductDeclaration = {
  name: "get_product",
  description:
    "Retrieve complete technical specifications, full features list, and real-time inventory status for a specific product by its unique UUID.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      productId: {
        type: Type.STRING,
        description: "The unique product UUID",
      },
    },
    required: ["productId"],
  },
};

/**
 * Gemini Function Declaration: compare_products
 */
export const compareProductsDeclaration = {
  name: "compare_products",
  description:
    "Compare 2 to 4 products side-by-side on key specifications such as price, battery life, rating, features, and brand. Use this when the user asks to compare items (e.g., 'Compare the first two' or 'Compare boAt and JBL').",
  parameters: {
    type: Type.OBJECT,
    properties: {
      productIds: {
        type: Type.ARRAY,
        items: {
          type: Type.STRING,
        },
        description: "An array of 2 to 4 product UUIDs to compare",
      },
    },
    required: ["productIds"],
  },
};

/**
 * Gemini Function Declaration: get_categories
 */
export const getCategoriesDeclaration = {
  name: "get_categories",
  description:
    "Retrieve the list of all available product categories with their current inventory counts.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

/**
 * Gemini Function Declaration: add_to_cart
 */
export const addToCartDeclaration = {
  name: "add_to_cart",
  description:
    "Add a product to the user's shopping cart by its UUID. Use this when the user says 'add to cart', 'add the first one', 'add the cheaper one', 'buy this', etc.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      productId: {
        type: Type.STRING,
        description: "The unique product UUID to add to the cart",
      },
      quantity: {
        type: Type.NUMBER,
        description: "Quantity to add (positive integer between 1 and 10, default: 1)",
      },
    },
    required: ["productId"],
  },
};

/**
 * Gemini Function Declaration: remove_from_cart
 */
export const removeFromCartDeclaration = {
  name: "remove_from_cart",
  description:
    "Remove an item completely from the user's shopping cart by its product UUID.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      productId: {
        type: Type.STRING,
        description: "The unique product UUID of the item to remove from the cart",
      },
    },
    required: ["productId"],
  },
};

/**
 * Gemini Function Declaration: update_cart_quantity
 */
export const updateCartQuantityDeclaration = {
  name: "update_cart_quantity",
  description:
    "Update the exact quantity of an item in the user's shopping cart (e.g. 'change it to 2', 'set quantity to 3').",
  parameters: {
    type: Type.OBJECT,
    properties: {
      productId: {
        type: Type.STRING,
        description: "The unique product UUID of the item in the cart",
      },
      quantity: {
        type: Type.NUMBER,
        description: "The new target quantity (integer between 1 and 10)",
      },
    },
    required: ["productId", "quantity"],
  },
};

/**
 * Gemini Function Declaration: get_cart
 */
export const getCartDeclaration = {
  name: "get_cart",
  description:
    "Retrieve the user's current shopping cart, including all items, quantities, line totals, and authoritative subtotal.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

/**
 * Gemini Function Declaration: clear_cart
 */
export const clearCartDeclaration = {
  name: "clear_cart",
  description:
    "Remove all items from the user's shopping cart, resetting the cart to empty.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

export const ALL_AGENT_TOOLS = [
  searchProductsDeclaration,
  getProductDeclaration,
  compareProductsDeclaration,
  getCategoriesDeclaration,
  addToCartDeclaration,
  removeFromCartDeclaration,
  updateCartQuantityDeclaration,
  getCartDeclaration,
  clearCartDeclaration,
];

