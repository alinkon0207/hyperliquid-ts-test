import { account , Walletclient } from "./wallet"



const test = async() => {
const hash = await Walletclient.sendTransaction({ 
  account,
  to: '0x7Ae503888C0CbbD92544E1CE1F40Ef22b602ABf9',
  value: 1000000000000000n
}) 
return hash;
}


// test()