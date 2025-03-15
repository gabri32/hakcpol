import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const USDT_ADDRESS = process.env.USDT_ADDRESS;
const SAFE_CONTRACT = process.env.SAFE_CONTRACT;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RPC_URL = "wss://rpc-mainnet.matic.quiknode.pro/";

const provider = new ethers.WebSocketProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const usdtAbi = [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "function transfer(address recipient, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)"
];

const usdtContract = new ethers.Contract(USDT_ADDRESS, usdtAbi, wallet);

let lastExecution = 0;
const MIN_DELAY = 1000; // 90 segundos

usdtContract.on("Transfer", async (from, to, value, event) => {
  const now = Date.now();
  if (now - lastExecution < MIN_DELAY) {
    return;
  }
  lastExecution = now;

  console.log(`🔍 Detectado: ${ethers.formatUnits(value, 6)} USDT de ${from} a ${to}`);

  if (to.toLowerCase() === SAFE_CONTRACT.toLowerCase()) {
    console.log("🔹 Fondos ya en la wallet segura. No se necesita acción.");
    return;
  }

  const code = await provider.getCode(to);
  if (code !== "0x") {
    console.log(`⚠️ ${to} es un contrato. Verificando balance de USDT...`);

    try {
 

      const balance = await usdtContract.balanceOf(to);
      const balanceInt = BigInt(balance); // Convertir a BigInt
      if (balanceInt > 0n) {
        const amountToTransfer = (balanceInt * 95n) / 100n; // balance * 0.95 usando BigInt
        const amountFormatted = ethers.formatUnits(amountToTransfer, 6);

        console.log(`💰 El contrato ${to} tiene ${ethers.formatUnits(balance, 6)} USDT.`);
        console.log(`🚀 Enviando el 95% (${amountFormatted} USDT) a la wallet segura...`);

        const tx = await usdtContract.transfer(SAFE_CONTRACT, amountToTransfer);
        console.log(`⏳ Enviando transacción... TX Hash: ${tx.hash}`);

        await tx.wait();
        console.log(`✅ Fondos recuperados con éxito: ${amountFormatted} USDT a ${SAFE_CONTRACT}`);
      } else {
        console.log("🔸 No hay fondos retenidos en este contrato.");
      }
    } catch (error) {
      console.error("❌ Error al recuperar fondos:", error);
    }
  }
});
