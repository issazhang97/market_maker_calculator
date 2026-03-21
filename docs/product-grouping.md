# Product Grouping for ETF Codes

## Overview

The app aggregates individual ETF codes into 8 product categories for the summary table. Instead of showing ~37 separate ETF code columns, the table displays 8 product columns matching the reference spreadsheet format.

## Product Mappings

| Product | Default ETF Code(s) | Broker Overrides |
|---------|---------------------|------------------|
| 自由现金流 | 159233 | — |
| AI | 512930 | — |
| 通用航空 | 561660 | — |
| 黄金股票 | 159322 | 方正证券 → 511020, 512390, 515700, 516180 |
| 消费电子 | 561600 | 国信证券 → 159215 |
| 港股医药 | 159718 | — |
| 央企红利 | 159143 | — |
| 港股通科技 | 159152 | — |

### How Broker Overrides Work

Most brokers use the **default ETF code(s)** for each product. However, some brokers trade different ETFs for the same product category. For example:

- **方正证券** trades 4 different gold-related ETFs (511020, 512390, 515700, 516180) instead of the default 159322 for 黄金股票. Their amounts are summed together into the single 黄金股票 column.
- **国信证券** trades 159215 instead of 561600 for 消费电子.

## Calculation Logic

### Data Source

- Input: Per-broker Excel files with daily trade records per ETF code
- Each record contains: broker, ETF code, date, buy amount, sell amount, and optionally a daily total (`当日成交金额`)

### Amount Calculation

The daily amount for each record is:
- `当日成交金额` if available (more accurate due to rounding in source data)
- Otherwise: `buyAmount + sellAmount`

### Aggregation Steps

1. **Parse** all broker Excel files into `TradeRecord[]`
2. **Group** records by: broker → ETF code → date → total amount
3. **Product aggregation**: For each broker + product combination:
   - Look up the ETF codes for that broker/product (using override if applicable, otherwise default)
   - Sum amounts across all matching ETF codes for each date
4. **5-day average**: For the selected target date, take the 5 most recent trading dates (inclusive of target date) and compute the average daily amount, dividing by the number of **active days** (dates where at least one ETF code has a record in the Excel file)
5. **Yesterday**: The amount on the target date itself

### 5-Day Window

- Dates are sorted descending
- The window is: `[targetDate, targetDate-1, targetDate-2, targetDate-3, targetDate-4]` (5 trading days, **including** the target date)
- Average = sum of active days / number of active days
- **Active day**: A date where at least one of the product's ETF codes has a row in the broker's Excel file. Records with value 0 count as active (row exists). Missing records (no row) do not count.
- Example: If an ETF started trading on 03-13 and the window covers 03-11 to 03-17, only the 3 days with records (03-13, 03-16, 03-17) are counted in the divisor.

## Configuration

The mapping is defined in `src/constants/etfColumns.ts`:

```typescript
interface ProductMapping {
  name: string;           // Product display name
  defaultCodes: string[]; // ETF codes used by most brokers
  brokerOverrides?: Record<string, string[]>; // broker name → different ETF codes
}
```

To add a new product or modify a broker override, edit the `PRODUCT_MAPPINGS` array in that file.

## Architecture

```
Excel files
  → excelParser.ts (parse into TradeRecord[])
  → dataAggregator.ts (group by broker/ETF, then aggregate into products)
  → PivotData { products, rows, totals, grandTotal }
  → SummaryTable.tsx (display) / excelExporter.ts (export)
```

Key files:
- `src/constants/etfColumns.ts` — Product mapping configuration
- `src/services/dataAggregator.ts` — Aggregation logic with product grouping
- `src/types/index.ts` — `PivotData` and related types
- `src/components/SummaryTable.tsx` — Table rendering
- `src/services/excelExporter.ts` — Excel export
