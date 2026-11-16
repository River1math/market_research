export const PRODUCT_NAME = "Attestly";

/** Price of the Single questionnaire purchase, in USD cents. */
export const SINGLE_PRICE_CENTS = 7900;
export const SINGLE_PRICE_LABEL = "$79";

/** Questions drafted before payment. */
export const FREE_QUESTION_LIMIT = 25;
/** Questions covered by one Single purchase. */
export const MAX_QUESTIONS = 400;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const APP_URL = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
