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

async function signStandardL1Action(
  action: any,
  wallet: ethers.Wallet,
  nonce: number,
  vaultAddress: null
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

  const signedAgent = await wallet.signTypedData(
    payloadToSign.domain,
    payloadToSign.types,
    payloadToSign.message
  );

  console.log("Signed agent:", signedAgent);

  return splitSig(signedAgent);
}

function hashAction(
  action: unknown,
  vaultAddress: string | null,
  nonce: number
): Hex {
  const msgPackBytes = encode(action);
  console.log("action hash", Buffer.from(msgPackBytes).toString("base64"));
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

function addressToBytes(address: string): Uint8Array {
  const hex = address.startsWith("0x") ? address.substring(2) : address;
  return Uint8Array.from(Buffer.from(hex, "hex"));
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

///place order (trade action data )

async function placeOrder() {
  const leverage = 20;
  const collateral = 1; // 1 $ Trade
  // const ethPrice = 3000; // need to get Eth price api from hl

  // const orderSize = (collateral * leverage) / ethPrice;

  const order = {
    "a": 1,
    "b": true,
    "p": "3820",
    "s": "0.01",
    "r": false,
    "t": {
      "limit": {
        "tif": "Gtc"
      }
    }
  }

  const action = {
    type: "order",
    orders: [order],
    grouping: "na",
  };

  const nonce = Date.now();

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY not set in .env file");
  }
  const wallet = new ethers.Wallet(privateKey);

  console.log("Wallet address:", wallet.address);

  try {
    const signature = await signStandardL1Action(action, wallet, nonce, null);
    console.log("Signature:", signature);

    
    
    
  // const order_action = 
  //   {
  //     "action": {
  //       "type": "order",
  //       "orders": [
  //       {
  //         "a": 128,
  //         "b": true,
  //         "p": "1670",
  //         "s": "0.0147",
  //         "r": false,
  //         "t": {
  //           "limit": {
  //             "tif": "Gtc"
  //           }
  //         }
  //       }
  //     ],
  //     "grouping": "na"
  //   }
  // };

  const payload = {
    action: action,
    nonce: nonce,
    signature: signature,
    vaultAddress: null,
  };
  
  // console.log("Payload to be sent:", JSON.stringify(payload, null, 2));

    const response = await axios.post(
      "https://api.hyperliquid.xyz/exchange",
      payload,
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    console.log("Order Response:", response.data.response.data);
  } catch (error:any) {
    console.error("Error placing order:", error.message);
  }
}

placeOrder();
