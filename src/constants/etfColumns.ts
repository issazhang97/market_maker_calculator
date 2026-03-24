export interface ProductMapping {
  name: string;
  defaultCodes: string[];
  brokerOverrides?: Record<string, string[]>;
}

export const PRODUCT_MAPPINGS: ProductMapping[] = [
  { name: "自由现金流", defaultCodes: ["159233"] },
  { name: "AI", defaultCodes: ["512930"] },
  { name: "通用航空", defaultCodes: ["561660"] },
  {
    name: "黄金股票",
    defaultCodes: ["159322"],
  },
  {
    name: "消费电子",
    defaultCodes: ["561600"],
  },
  { name: "港股医药", defaultCodes: ["159718"] },
  { name: "央企红利", defaultCodes: ["159143"] },
  { name: "港股通科技", defaultCodes: ["159152"] },
];

export function getCodesForBroker(product: ProductMapping, broker: string): string[] {
  return product.brokerOverrides?.[broker] || product.defaultCodes;
}
