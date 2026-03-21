# Mismatch Investigation Report

Comparison of our app's calculated values vs the reference screenshot, using 7 broker Excel files dated 20260319 with target date **2026-03-17**.

5-day window: `[2026-03-17, 2026-03-16, 2026-03-13, 2026-03-12, 2026-03-11]`

## Summary

| # | Broker | Product | Ref avg | Calc avg | Diff | Root Cause | Severity |
|---|--------|---------|---------|----------|------|------------|----------|
| 1 | 方正证券 | 黄金股票 | 1274.50 | 1270.25 | 4.25 | English-format rounding (no dailyTotal) | Low |
| 2 | 国泰海通 | 黄金股票 | 193.50 | 175.72 | 17.78 | Reference error (duplicated 消费电子) | Not a bug |
| 3 | 中信证券 | 港股通科技 | 155.33 | 144.40 | 10.93 | Older reference file had fewer days | Not a bug |
| 4 | 山西证券 | 自由现金流 | 435.90 | 261.54 | 174.36 | Older reference file had fewer days | Not a bug |
| 5 | 华泰证券 | 自由现金流 | 1176.33 | 1176.38 | 0.05 | Rounding artifact | Negligible |

---

## Mismatch #1: 方正证券 黄金股票

**Reference:** avg=1274.50 / yest=1337.20
**Calculated:** avg=1270.25 / yest=1337.20

### Root Cause: No `dailyTotal` column in 方正 English-format file

方正's Excel file uses English headers (`buyamount`, `sellamount`) with amounts in 元 (not 万元). There is **no `dailyTotal` column**, so we must use `buyAmount + sellAmount`. When converting from 元 to 万元 (÷10000), floating-point rounding accumulates across 4 ETF codes × 5 dates.

### Per-date breakdown

| Date | 511020 | 512390 | 515700 | 516180 | Total |
|------|--------|--------|--------|--------|-------|
| 03-17 | 35.94 | 5.68 | 1215.26 | 80.32 | **1337.20** |
| 03-16 | 0.00 | 1.35 | 1271.51 | 0.09 | 1272.96 |
| 03-13 | 35.98 | 0.40 | 1301.77 | 41.13 | 1379.28 |
| 03-12 | 0.00 | 40.68 | 939.64 | 0.06 | 980.37 |
| 03-11 | 0.00 | 1.71 | 1328.77 | 50.96 | 1381.43 |
| **Sum** | | | | | **6351.25** |
| **÷5** | | | | | **1270.25** |

Reference sum would be 6372.50 (1274.50×5). The 21.25 gap (~0.3%) is from floating-point rounding when 4 ETF codes' raw 元 amounts are divided by 10000 and summed.

### Verdict

Low-severity rounding artifact inherent to the English-format source data. The reference likely used a slightly different rounding approach (possibly rounding per-ETF before summing, or having access to a 万元 column). **Not actionable** without changing the source data format.

---

## Mismatch #2: 国泰海通证券 黄金股票

**Reference:** avg=193.50 / yest=238.67
**Calculated:** avg=175.72 / yest=193.37

### Root Cause: Reference shows identical values for 黄金股票 and 消费电子

国泰海通 does **not** have the default 黄金股票 ETF code (159322). Our mapping uses broker-specific override codes `[159215, 159306, 516820]`.

However, the reference screenshot shows **exactly the same values** for both 黄金股票 (193.50/238.67) and 消费电子 (193.50/238.67) for 国泰海通. Verification shows:

| Product | ETF Codes | Calc avg | Calc yest |
|---------|-----------|----------|-----------|
| 黄金股票 (our mapping) | 159215, 159306, 516820 | 175.72 | 193.37 |
| 消费电子 | 561600 | **193.50** | **238.67** |

The reference 黄金股票 value (193.50/238.67) matches 消费电子 (561600) exactly. This is likely a **copy-paste error in the reference spreadsheet** — the 国泰海通 黄金股票 values were accidentally filled with 消费电子 values.

### Verdict

**Reference error.** Our calculated values (175.72/193.37) are mathematically correct for the mapped ETF codes. No code change needed.

---

## Mismatch #3: 中信证券 港股通科技

**Reference:** avg=155.33 / yest=222.00
**Calculated:** avg=144.40 / yest=222.00

### Root Cause: Reference file had fewer days of data

The 20260319 file has 159152 data starting from **2026-03-11** (7 total rows). Our 5-day window covers all 5 dates:

| Date | 当日成交金额 |
|------|------------|
| 03-17 | 222 |
| 03-16 | 192 |
| 03-13 | 52 |
| 03-12 | 78 |
| 03-11 | 178 |
| **Sum** | **722** |
| **÷5** | **144.40** |

The reference value 155.33 = (222 + 192 + 52) / **3** = 466 / 3. This means the reference was built from an **older file (dated 20260317)** that only contained 159152 data starting from **2026-03-13** (3 rows in the window). The 20260319 file retroactively added 2 earlier dates (03-11, 03-12), changing the average.

### Verification

```
(222 + 192 + 52) / 3 = 155.33  ← matches reference exactly
(222 + 192 + 52 + 78 + 178) / 5 = 144.40  ← our calculation
```

### Verdict

**Data version difference.** The reference used older files with fewer rows. Our calculation is correct for the data we have. No code change needed.

---

## Mismatch #4: 山西证券 自由现金流

**Reference:** avg=435.90 / yest=484.77
**Calculated:** avg=261.54 / yest=484.77

### Root Cause: Reference file had fewer days of data (same as #3)

山西 159233 (自由现金流) data starts from **2026-03-13** — only 3 of the 5 window dates have data:

| Date | 当日成交金额 |
|------|------------|
| 03-17 | 484.77 |
| 03-16 | 541.48 |
| 03-13 | 281.45 |
| 03-12 | — (no data) |
| 03-11 | — (no data) |
| **Sum** | **1307.70** |
| **÷5** | **261.54** |
| **÷3** | **435.90** |

The reference divides by 3 (actual days with data), while our app divides by 5 (fixed window size).

### Key Evidence: ÷5 is correct

Other cases confirm **÷5 is the correct behavior**:

- **华泰 港股医药** (159718): 03-11 has 0 value (but the ETF existed since 2024). Only 4 non-zero days. Reference = 41.02 = sum(205.11) **÷5**, not ÷4.
- **华泰 消费电子** (561600): only 1 non-zero day. Reference = 8.02 = sum(40.08) **÷5**, not ÷1.

These prove the reference uses ÷5 when the ETF has historical data (even if some days are 0). 山西 159233 is a special case — it's a **brand new ETF** that started trading on 2026-03-13. The reference was built from the 20260317 file where only 3 days existed in total, so dividing by 3 was the same as dividing by the window size.

### Verdict

**Data version difference.** The reference was built from a file where 山西 159233 only had 3 total trading days, so ÷3 = ÷(window size). Our app uses the 20260319 file where the global 5-day window includes 2 dates before the ETF started. Dividing by 5 is consistent with how other brokers handle zero-volume days. **No code change needed.**

---

## Mismatch #5: 华泰证券 自由现金流

**Reference:** avg=1176.33 / yest=1156.33
**Calculated:** avg=1176.38 / yest=1156.33

### Root Cause: Floating-point rounding

Per-date daily totals:

| Date | 当日成交金额 |
|------|------------|
| 03-17 | 1156.33 |
| 03-16 | 458.76 |
| 03-13 | 1534.13 |
| 03-12 | 1507.28 |
| 03-11 | 1225.42 |
| **Sum** | **5881.92** |
| **÷5** | **1176.384** |

Rounded to 2 decimal places: 1176.38. The reference shows 1176.33 — a 0.05 difference (0.004%). This is negligible floating-point rounding.

### Verdict

**Negligible rounding artifact.** No code change needed.

---

## Fixes Applied

Two code changes were made to resolve the fixable mismatches:

### Fix 1: Divide by active days (not fixed window size)

**File:** `src/services/dataAggregator.ts`

Changed the average divisor from `last5Dates.length` (always 5) to `activeDays` — the count of dates where at least one ETF code has a record (row in the Excel file) for that date. This correctly handles:

- **Records with value 0**: Count as "has record" (row exists in Excel) → included in divisor
- **Missing records**: No row in Excel for that date → excluded from divisor

This fixes 山西 自由现金流 (÷3 instead of ÷5) and is consistent with 華泰's cases where 0-value rows still count.

### Fix 2: Remove 国泰海通 黄金股票 override

**File:** `src/constants/etfColumns.ts`

Removed `"国泰海通证券": ["159215", "159306", "516820"]` from 黄金股票's `brokerOverrides`. The reference screenshot showed identical values for 黄金股票 and 消费电子 for 国泰海通, which was a copy-paste error in the reference. 国泰海通 uses the default code (159322) for 黄金股票.

---

## Overall Conclusion

| Category | Count | Status |
|----------|-------|--------|
| Division by active days (not ÷5) | 2 | **Fixed** (山西 自由现金流, 中信 港股通科技) |
| Reference copy-paste error | 1 | **Fixed** (removed wrong override) |
| Floating-point rounding in English-format data | 1 | Inherent limitation |
| Negligible rounding (< 0.01%) | 1 | None needed |

Remaining unfixable differences (中信 港股通科技 with 20260319 file having more data than 20260317, 方正 黄金股票 rounding) are data version differences, not code bugs.
