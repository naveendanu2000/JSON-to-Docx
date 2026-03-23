import { htmlToJSON } from "./htmlTODocx.js";
import { combineSections } from "./combineSections.js";

export const getJSONFromHTML = (html) => {
  return htmlToJSON(html);
};
