import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "@alchemy/aa-core";
import { WalletClientSigner } from "@alchemy/aa-core";
import { config } from 'dotenv';
config();


// const connect = "connect wallet"
// console.log(connect);
export const account = privateKeyToAccount(`0x${process.env.PRIVATE_KEY}`);
// console.log(account);




//for wallet client 
export const Walletclient = createWalletClient({
    account,
    chain: arbitrumSepolia,
    transport: http(),
  });
  
//   console.log(client)




export const eoaSigner = new WalletClientSigner(
Walletclient,
"local"
);

// console.log(eoaSigner)


