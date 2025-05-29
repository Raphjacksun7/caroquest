// A dedicated module for handling binary data compression and decompression

import pako from "pako";

/**
 * Compresses a Uint8Array using the zlib 'deflate' algorithm.
 * @param data The raw Uint8Array data to compress.
 * @returns A new Uint8Array containing the compressed data.
 * Returns an empty Uint8Array if input data is empty.
 */
export function compress(data: Uint8Array): Uint8Array {
  if (!data || data.length === 0) {
    return new Uint8Array(0);
  }
  try {
    return pako.deflate(data);
  } catch (error) {
    console.error("Compression Error (pako.deflate):", error);
    return data; // Fallback to uncompressed data on error
  }
}

/**
 * Decompresses a Uint8Array that was compressed with pako.deflate.
 * @param compressedData The compressed Uint8Array.
 * @returns A new Uint8Array containing the original, decompressed data.
 * Returns an empty Uint8Array if input data is empty.
 * Throws an error if decompression fails.
 */
export function decompress(compressedData: Uint8Array): Uint8Array {
  if (!compressedData || compressedData.length === 0) {
    return new Uint8Array(0);
  }
  try {
    const result = pako.inflate(compressedData);
    if (!result) {
      throw new Error(
        "pako.inflate returned null, possibly due to malformed input."
      );
    }
    return result;
  } catch (error) {
    console.error("Decompression Error (pako.inflate):", error);
    throw error;
  }
}
