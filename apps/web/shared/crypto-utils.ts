// Interface for encryption & decryption services
interface CryptoService {
     encrypt(
          data: string,
          secretKey: string | undefined
     ): Promise<EncryptedPayload>;
     decrypt(
          encryptedData: EncryptedPayload,
          secretKey: string | undefined
     ): Promise<any>;
}

// Interface matching backend encryption format
export interface EncryptedPayload {
     encryptedText: string; // Changed to match backend expectation
     authTag: string;
     iv: string;
}

// Helper function to convert hex string to Uint8Array
function hexToUint8Array(hex: string) {
     if (!hex || typeof hex !== "string" || hex.length % 2 !== 0) {
          throw new Error("Invalid hex string");
     }
     return new Uint8Array(
          hex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
     );
}

// Helper function to convert Uint8Array to hex string
const uint8ArrayToHex = (bytes: Uint8Array): string => {
     return Array.from(bytes)
          .map((byte) => byte.toString(16).padStart(2, "0"))
          .join("");
};

// Browser-compatible crypto service using Web Crypto API
export const cryptoService: CryptoService = {
     encrypt: async (data: string, secretKey: string | undefined) => {
          if (!secretKey?.length) {
               throw new Error("NEXT_PUBLIC_AES_SECRET_KEY is not defined");
          }

          try {
               // Convert data to string if it's not already
               const dataString =
                    typeof data === "string" ? data : JSON.stringify(data);

               // Generate a random IV (12 bytes for GCM)
               const iv = window.crypto.getRandomValues(new Uint8Array(12));

               // Import the key
               const keyData = hexToUint8Array(secretKey);
               const key = await window.crypto.subtle.importKey(
                    "raw",
                    keyData,
                    { name: "AES-GCM" },
                    false,
                    ["encrypt"]
               );

               // Encode the data
               const encoder = new TextEncoder();
               const encodedData = encoder.encode(dataString);

               // Encrypt the data
               const encryptedBuffer = await window.crypto.subtle.encrypt(
                    {
                         name: "AES-GCM",
                         iv: iv,
                         tagLength: 128, // 16 bytes auth tag
                    },
                    key,
                    encodedData
               );

               // Extract encrypted data and auth tag
               const encryptedArray = new Uint8Array(encryptedBuffer);
               const encryptedData = encryptedArray.slice(0, -16); // Everything except last 16 bytes
               const authTag = encryptedArray.slice(-16); // Last 16 bytes

               // Create payload matching backend format
               const payload: EncryptedPayload = {
                    encryptedText: uint8ArrayToHex(encryptedData), // Changed to match backend
                    authTag: uint8ArrayToHex(authTag),
                    iv: uint8ArrayToHex(iv),
               };

               // Return the payload object directly (not as JSON string)
               return payload;
          } catch (error) {
               console.error("Encryption error:", error);
               throw new Error("Failed to encrypt data");
          }
     },

     decrypt: async (
          payload: EncryptedPayload,
          secretKey: string | undefined
     ) => {
          if (!secretKey?.length) {
               throw new Error("NEXT_PUBLIC_AES_SECRET_KEY is not defined");
          }

          try {
               // Convert hex values back to Uint8Array
               const iv = hexToUint8Array(payload.iv);
               const encryptedData = hexToUint8Array(payload.encryptedText);
               const authTag = hexToUint8Array(payload.authTag);

               // Combine encrypted data and auth tag back together
               const combinedData = new Uint8Array(
                    encryptedData.length + authTag.length
               );
               combinedData.set(encryptedData, 0);
               combinedData.set(authTag, encryptedData.length);

               // Import the key
               const keyData = hexToUint8Array(secretKey);
               const key = await window.crypto.subtle.importKey(
                    "raw",
                    keyData,
                    { name: "AES-GCM" },
                    false,
                    ["decrypt"]
               );

               // Decrypt the data
               const decryptedBuffer = await window.crypto.subtle.decrypt(
                    {
                         name: "AES-GCM",
                         iv: iv,
                         tagLength: 128,
                    },
                    key,
                    combinedData
               );

               // Decode the decrypted data back into a string
               const decoder = new TextDecoder();
               const decryptedString = decoder.decode(decryptedBuffer);

               // Try to JSON.parse, fallback to string if it fails
               try {
                    return JSON.parse(decryptedString);
               } catch {
                    return decryptedString;
               }
          } catch (error) {
               console.error("Decryption error:", error);
               throw new Error("Failed to decrypt data");
          }
     },
};