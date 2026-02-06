import fs from "node:fs";
import path from "node:path";
import { Wallet, HDNodeWallet } from "ethers";

export function keysDir() {
  return path.resolve(process.cwd(), "keys");
}

export function keyPath(name: string) {
  return path.resolve(keysDir(), `${name}.json`);
}

export async function createEncryptedWallet(name: string, password: string) {
  fs.mkdirSync(keysDir(), { recursive: true });
  const wallet = Wallet.createRandom();
  const json = await wallet.encrypt(password);
  fs.writeFileSync(keyPath(name), json, { encoding: "utf8", flag: "wx" });
  return { address: wallet.address, file: keyPath(name) };
}

export async function loadEncryptedWallet(name: string, password: string): Promise<Wallet | HDNodeWallet> {
  const p = keyPath(name);
  const json = fs.readFileSync(p, "utf8");
  // ethers v6 returns Wallet | HDNodeWallet depending on the keystore
  return await Wallet.fromEncryptedJson(json, password);
}
