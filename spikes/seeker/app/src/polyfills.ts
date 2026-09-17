// Must be imported before @solana/web3.js.
import "react-native-get-random-values";
import { Buffer } from "buffer";

(globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
