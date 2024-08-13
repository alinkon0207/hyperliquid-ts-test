export function bigIntToStringWithTwoDecimalPlaces(bigInt: bigint): string {
    const bigIntStr = bigInt.toString();
    const formatted = bigIntStr.slice(0, -18) + "." + bigIntStr.slice(-18);
    
    const number = parseFloat(formatted);

    const result = number.toFixed(2);
    return result;
}