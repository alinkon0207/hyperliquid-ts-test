import { bigIntToStringWithTwoDecimalPlaces } from './lib/bigNumber';
import { publicClient } from './config/client'



const check = async () => {
  const balance = await publicClient.getBalance({
    address: "0xE3D181F5C4672fdCbd2e9Cf021DF95ecFE6DC4A4",
  });
  // const bigIntValue = await balance;

  // const bigIntStr = bigIntValue.toString();

  // const formatted = bigIntStr.slice(0, -18) + "." + bigIntStr.slice(-18);

  // console.log(parseFloat(formatted).toFixed(2),"ETH");
  // return balance;
  const formatted = bigIntToStringWithTwoDecimalPlaces(balance);
  console.log(formatted, "ETH");
};

check();