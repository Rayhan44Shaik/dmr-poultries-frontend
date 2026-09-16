/**
 * Amount → words, Indian numbering (thousand / lakh / crore).
 *
 * The Collection Entry amount field shows the entered figure spelled out
 * underneath it ("Two Thousand Rupees Only") so a figure can be read back
 * before it is saved. Telugu is supported in full: every alphabetic word is
 * rendered in Telugu script while the digits themselves stay Latin, exactly
 * like the rest of the Telugu view.
 */

export type AmountWordsLanguage = "en" | "te";

const EN_ONES = [
  "Zero",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const EN_TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

const TE_ONES = [
  "సున్నా",
  "ఒకటి",
  "రెండు",
  "మూడు",
  "నాలుగు",
  "ఐదు",
  "ఆరు",
  "ఏడు",
  "ఎనిమిది",
  "తొమ్మిది",
];

const TE_TEENS = [
  "పది",
  "పదకొండు",
  "పన్నెండు",
  "పదమూడు",
  "పద్నాలుగు",
  "పదిహేను",
  "పదహారు",
  "పదిహేడు",
  "పద్దెనిమిది",
  "పంతొమ్మిది",
];

const TE_TENS = ["", "", "ఇరవై", "ముప్పై", "నలభై", "యాభై", "అరవై", "డెబ్బై", "ఎనభై", "తొంభై"];

function enBelowHundred(n: number): string {
  if (n < 20) return EN_ONES[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return ones === 0 ? EN_TENS[tens] : `${EN_TENS[tens]} ${EN_ONES[ones]}`;
}

function enBelowThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds > 0) parts.push(`${EN_ONES[hundreds]} Hundred`);
  if (rest > 0) parts.push(enBelowHundred(rest));
  return parts.join(" ");
}

/** Whole number in Indian scales: crore → lakh → thousand → hundred. */
function enIntegerWords(value: number): string {
  if (value <= 0) return EN_ONES[0];

  const scales: Array<[number, string]> = [
    [10000000, "Crore"],
    [100000, "Lakh"],
    [1000, "Thousand"],
  ];

  const parts: string[] = [];
  let rest = value;

  for (const [size, label] of scales) {
    const count = Math.floor(rest / size);
    if (count > 0) {
      // Recursion keeps 100+ crore readable ("One Hundred Crore").
      parts.push(`${enIntegerWords(count)} ${label}`);
      rest %= size;
    }
  }

  if (rest > 0) parts.push(enBelowThousand(rest));
  return parts.join(" ");
}

function teBelowHundred(n: number): string {
  if (n < 10) return TE_ONES[n];
  if (n < 20) return TE_TEENS[n - 10];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return ones === 0 ? TE_TENS[tens] : `${TE_TENS[tens]} ${TE_ONES[ones]}`;
}

/**
 * Telugu scale words have a standing form and an oblique form. Before a noun
 * ("రూపాయలు", "పైసలు") the oblique is the correct one — "రెండు వేల రూపాయలు",
 * never "రెండు వేలు రూపాయలు" — so the builder takes an `oblique` flag.
 */
function teBelowThousand(n: number, oblique: boolean): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds > 0) {
    if (hundreds === 1) parts.push("వంద");
    else parts.push(`${TE_ONES[hundreds]} ${oblique ? "వందల" : "వందలు"}`);
  }
  if (rest > 0) parts.push(teBelowHundred(rest));
  return parts.join(" ");
}

/** Whole number in Telugu scales: కోటి → లక్ష → వేలు → వందలు. */
function teIntegerWords(value: number, oblique = false): string {
  if (value <= 0) return TE_ONES[0];

  const scales: Array<[number, string, string, string]> = [
    [10000000, "కోటి", "కోట్లు", "కోట్ల"],
    [100000, "లక్ష", "లక్షలు", "లక్షల"],
    [1000, "వెయ్యి", "వేలు", "వేల"],
  ];

  const parts: string[] = [];
  let rest = value;

  for (const [size, singular, plural, obliquePlural] of scales) {
    const count = Math.floor(rest / size);
    if (count > 0) {
      if (count === 1) {
        // "వెయ్యి" is already the attributive form; కోటి / లక్ష are unchanged.
        parts.push(singular);
      } else {
        const countWords = teIntegerWords(count, true);
        parts.push(`${countWords} ${oblique ? obliquePlural : plural}`);
      }
      rest %= size;
    }
  }

  if (rest > 0) parts.push(teBelowThousand(rest, oblique));
  return parts.join(" ");
}

/**
 * Split into rupees and paise without floating-point drift
 * (1234.565 → 1234 rupees 57 paise).
 */
function splitAmount(amount: number): { rupees: number; paise: number } {
  const absolute = Math.abs(Number.isFinite(amount) ? amount : 0);
  const totalPaise = Math.round(absolute * 100);
  return { rupees: Math.floor(totalPaise / 100), paise: totalPaise % 100 };
}

/**
 * "Two Thousand Rupees Only" / "రెండు వేల రూపాయలు మాత్రమే".
 *
 * A zero amount reads "Zero Rupees Only" so the line under the field is never
 * empty while the user is typing.
 */
export function amountInWords(amount: number, language: AmountWordsLanguage = "en"): string {
  const { rupees, paise } = splitAmount(amount);

  if (language === "te") {
    // Oblique scale forms: "రెండు వేల రూపాయలు", not "రెండు వేలు రూపాయలు".
    const rupeesWords =
      rupees === 1 ? "ఒక రూపాయి" : `${teIntegerWords(rupees, true)} రూపాయలు`;
    if (paise === 0) return `${rupeesWords} మాత్రమే`;
    const paiseWords = paise === 1 ? "ఒక పైసా" : `${teBelowHundred(paise)} పైసలు`;
    return `${rupeesWords} ${paiseWords} మాత్రమే`;
  }

  const rupeesWords = `${enIntegerWords(rupees)} ${rupees === 1 ? "Rupee" : "Rupees"}`;
  if (paise === 0) return `${rupeesWords} Only`;
  const paiseWords = `${enBelowHundred(paise)} ${paise === 1 ? "Paisa" : "Paise"}`;
  return `${rupeesWords} and ${paiseWords} Only`;
}
