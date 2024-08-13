import { encode } from "@msgpack/msgpack";
import { Hex, keccak256 } from "viem";
import { config } from 'dotenv';
import { ethers } from 'ethers';
import axios from 'axios';

config();

type CustomSignature = {
  r: string;
  s: string;
  v: number;
};

const IS_MAINNET = true;

const phantomDomain = {
  name: "Exchange",
  version: "1",
  chainId: 1337,
  verifyingContract: "0x0000000000000000000000000000000000000000",
};

const agentTypes = {
  Agent: [
    { name: "source", type: "string" },
    { name: "connectionId", type: "bytes32" },
  ],
};


function addressToBytes(address: string): Uint8Array {
  const hex = address.startsWith("0x") ? address.substring(2) : address;
  return Uint8Array.from(Buffer.from(hex, "hex"));
}

function hashAction(
  action: unknown,
  vaultAddress: string | null,
  nonce: number
): Hex {
  const msgPackBytes = encode(action);
  console.log("Action hash:", Buffer.from(msgPackBytes).toString("base64"));
  const additionalBytesLength = vaultAddress === null ? 9 : 29;
  const data = new Uint8Array(msgPackBytes.length + additionalBytesLength);
  data.set(msgPackBytes);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  view.setBigUint64(msgPackBytes.length, BigInt(nonce));
  if (vaultAddress === null) {
    view.setUint8(msgPackBytes.length + 8, 0);
  } else {
    view.setUint8(msgPackBytes.length + 8, 1);
    data.set(addressToBytes(vaultAddress), msgPackBytes.length + 9);
  }
  return keccak256(data);
}

function splitSig(sig: string): CustomSignature {
  sig = sig.slice(2);
  if (sig.length !== 130) {
    throw new Error(`bad sig length: ${sig.length}`);
  }
  const vv = sig.slice(-2);

  if (vv !== "1c" && vv !== "1b" && vv !== "00" && vv !== "01") {
    throw new Error(`bad sig v ${vv}`);
  }
  const v = vv === "1b" || vv === "00" ? 27 : 28;
  const r = "0x" + sig.slice(0, 64);
  const s = "0x" + sig.slice(64, 128);
  return { r, s, v };
}


async function signInner(wallet: ethers.Wallet, data: any): Promise<CustomSignature> {
  const signedAgent = await wallet.signTypedData(data.domain, data.types, data.message);
  console.log("Signed agent:", signedAgent);
  return splitSig(signedAgent);
}

async function signL1Action(
  wallet: ethers.Wallet,
  action: any,
  vaultAddress: null,
  nonce: number
): Promise<CustomSignature> {
  const connectionId = hashAction(action, vaultAddress, nonce);
  const phantomAgent = {
    source: IS_MAINNET ? "a" : "b",
    connectionId: connectionId,
  };
  const payloadToSign = {
    domain: phantomDomain,
    types: agentTypes,
    primaryType: "Agent",
    message: phantomAgent,
  };

  // console.log("Signing payload:", JSON.stringify(payloadToSign, null, 2));

  return await signInner(wallet, payloadToSign);
}

async function signUserSignedAction(
  wallet: ethers.Wallet, 
  action: any, 
  payloadTypes: Array<{ name: string; type: string }>,
  primaryType: string
) : Promise<CustomSignature> {
  action.signatureChainId = "0x66eee";
  action.hyperliquidChain = IS_MAINNET ? "Mainnet" : "Testnet";
  const data = {
    domain: {
      name: "HyperliquidSignTransaction", 
      version: "1", 
      chainId: 0x66eee, 
      verifyingContract: "0x0000000000000000000000000000000000000000"
    }, 
    types: {
      [primaryType]: payloadTypes, 
    }, 
    primaryType: primaryType, 
    message: action
  };
  return signInner(wallet, data);
}

async function signUsdTransferAction(
  wallet: ethers.Wallet, 
  action: any
) : Promise<CustomSignature> {
  return signUserSignedAction(
    wallet, 
    action, 
    [
      { name: "hyperliquidChain", type: "string" }, 
      { name: "destination", type: "string" }, 
      { name: "amount", type: "string" }, 
      { name: "time", type: "uint64" }
    ], 
    "HyperliquidTransaction:UsdSend"
  );
}

async function signWithdrawFromBridgeAction(
  wallet: ethers.Wallet,
  action: any
): Promise<CustomSignature> {
  return signUserSignedAction(
      wallet,
      action,
      [
          { name: "hyperliquidChain", type: "string" },
          { name: "destination", type: "string" },
          { name: "amount", type: "string" },
          { name: "time", type: "uint64" },
      ],
      "HyperliquidTransaction:Withdraw"
  );
}


// async function transferBetweenSpotAndPerp() {
//   const classTransfer = {
//     "usdc": /* 9100000 */ 0,
//     "toPerp": true,
//   };

//   const action = {
//     type: "spotUser",
//     classTransfer: classTransfer,
//   };

//   const nonce = Date.now();

//   const privateKey = process.env.PRIVATE_KEY;
//   if (!privateKey) {
//     throw new Error("PRIVATE_KEY not set in .env file");
//   }
//   const wallet = new ethers.Wallet(privateKey);

//   console.log("Wallet address:", wallet.address);

//   try {
//     const signature = await signL1Action(wallet, action, null, nonce);
//     console.log("Signature:", signature);

//     const payload = {
//       action: action,
//       nonce: nonce,
//       signature: signature,
//       vaultAddress: null,
//     };

//     console.log("Payload to be sent:", JSON.stringify(payload, null, 2));

//     const response = await axios.post(
//       "https://api.hyperliquid.xyz/exchange",
//       payload,
//       {
//         headers: { "Content-Type": "application/json" },
//       }
//     );

//     console.log("Transfer Response:", response.data);
//   } catch (error: any) {
//     console.error("Error spot transfer:", error.message);
//   }
// }

// transferBetweenSpotAndPerp();


// async function usdTransfer() {
//   const curTime = Date.now();

//   const action = {
//     type: "usdSend",
//     signatureChainId: "0xa4b1",
//     hyperliquidChain: "Mainnet",
//     destination: "0xd36e4a5805f6b14c2f4Fa0A2fF7B8D5b35E10971",
//     amount: "1.0",
//     time: curTime
//   };

//   const nonce = curTime;

//   const privateKey = process.env.PRIVATE_KEY;
//   if (!privateKey) {
//     throw new Error("PRIVATE_KEY not set in .env file");
//   }
//   const wallet = new ethers.Wallet(privateKey);

//   console.log("Wallet address:", wallet.address);

//   try {
//     const signature = await signUsdTransferAction(wallet, action);
//     console.log("Signature:", signature);

//     const payload = {
//       action: action,
//       nonce: nonce,
//       signature: signature,
//     };

//     console.log("Payload to be sent:", JSON.stringify(payload, null, 2));

//     const response = await axios.post(
//       "https://api.hyperliquid.xyz/exchange",
//       payload,
//       {
//         headers: { "Content-Type": "application/json" },
//       }
//     );

//     console.log("Transfer Response:", response.data);
//   } catch (error: any) {
//     console.error("Error spot transfer:", error.message);
//   }
// }

// usdTransfer();


async function spotTransfer() {
  const curTime = Date.now();

  const action = {
    type: "spotSend",
    signatureChainId: "0x66eee",
    hyperliquidChain: "Mainnet",
    destination: "0xd36e4a5805f6b14c2f4Fa0A2fF7B8D5b35E10971",
    token: "USDC:0x6d1e7cde53ba9467b783cb7c530ce054",
    amount: "1.0",
    time: curTime
  };

  const nonce = curTime;

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY not set in .env file");
  }
  const wallet = new ethers.Wallet(privateKey);

  console.log("Wallet address:", wallet.address);

  try {
    const signature = await signUserSignedAction(
      wallet, 
      action, 
      [
        { name: 'hyperliquidChain', type: 'string' }, 
        { name: 'destination', type: 'string' }, 
        { name: 'token', type: 'string' }, 
        { name: 'amount', type: 'string' }, 
        { name: 'time', type: 'uint64' }
      ], 
      'HyperliquidTransaction:SpotSend'
    );
    console.log("Signature:", signature);

    const payload = {
      action: action,
      nonce: nonce,
      signature: signature
    };
    console.log("Payload to be sent:", JSON.stringify(payload, null, 2));

    const response = await axios.post(
      "https://api.hyperliquid.xyz/exchange",
      payload,
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    console.log("Transfer Response:", response.data);
  } catch (error: any) {
    console.error("Error spot transfer:", error.message);
  }
}

spotTransfer();


// async function withdraw() {
//   const curTime = Date.now();

//   const action = {
//     type: "withdraw3",
//     signatureChainId: "0xa4b1",
//     hyperliquidChain: "Mainnet",
//     amount: /* "0.1" */ "5.0",
//     time: curTime,
//     destination: /* "0xd36e4a5805f6b14c2f4Fa0A2fF7B8D5b35E10971" */ "0x1C92424F859ad47147C3eAA5B49E8cffbA7cebBa",
//   };

//   const nonce = curTime;

//   const privateKey = process.env.PRIVATE_KEY;
//   if (!privateKey) {
//     throw new Error("PRIVATE_KEY not set in .env file");
//   }
//   const wallet = new ethers.Wallet(privateKey);

//   console.log("Wallet address:", wallet.address);

//   try {
//     const signature = await signL1Action(wallet, action, null, nonce);
//     console.log("Signature:", signature);

//     const payload = {
//       action: action,
//       nonce: nonce,
//       signature: signature,
//       // vaultAddress: null,
//     };

//     console.log("Payload to be sent:", JSON.stringify(payload, null, 2));

//     const response = await axios.post(
//       "https://api.hyperliquid.xyz/exchange",
//       payload,
//       {
//         headers: { "Content-Type": "application/json" },
//       }
//     );

//     console.log("Transfer Response:", response.data);
//   } catch (error: any) {
//     console.error("Error spot transfer:", error.message);
//   }
// }

// withdraw();
