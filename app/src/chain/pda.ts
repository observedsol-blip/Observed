// The four PDAs. Seeds mirror programs/observed/src/lib.rs; the test checks them against
// addresses the program itself derived (app-vectors.json).
import { PublicKey } from "@solana/web3.js";
import { GAME_ID, PROGRAM_ID } from "./ids.ts";

const u64le = (n: bigint) => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, n, true);
  return b;
};
const u32le = (n: number) => {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, true);
  return b;
};

const seed = (s: string) => new TextEncoder().encode(s);

export const configPda = (gameId: bigint = GAME_ID) =>
  PublicKey.findProgramAddressSync([seed("config"), u64le(gameId)], PROGRAM_ID)[0];

export const roundPda = (roundId: number, config: PublicKey = configPda()) =>
  PublicKey.findProgramAddressSync([seed("round"), config.toBytes(), u32le(roundId)], PROGRAM_ID)[0];

export const entryPda = (round: PublicKey, sgtMint: PublicKey) =>
  PublicKey.findProgramAddressSync([seed("entry"), round.toBytes(), sgtMint.toBytes()], PROGRAM_ID)[0];

export const playerPda = (sgtMint: PublicKey, config: PublicKey = configPda()) =>
  PublicKey.findProgramAddressSync([seed("player"), config.toBytes(), sgtMint.toBytes()], PROGRAM_ID)[0];
