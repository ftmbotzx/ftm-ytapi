

import CryptoJS from "crypto-js";
import apiConfig from "../configs/apiConfig.js";

// Simple in-memory cache to replace localdb-json
const cache = new Map();

class EncoderClient {
  constructor(key) {
    if (!key) {
      throw new Error("An encryption key must be provided to the Encoder class.");
    }
    this.defaultKey = key;
    this.methods = ["aes", "des", "rabbit", "rc4", "combined"];
  }

  generateKey(length = 256) {
    return CryptoJS.lib.WordArray.random(length / 8).toString();
  }

  padKey(key, length = 32) {
    return key.padEnd(length, "0");
  }

  formatAsUUID(str) {
    console.log("[Cache] Preparing UUID and storing to memory cache.");
    const hash = CryptoJS.SHA256(str).toString();
    const uuid = [
      hash.substring(0, 8),
      hash.substring(8, 12),
      "4" + hash.substring(13, 16),
      (parseInt(hash.substring(16, 17), 16) & 3 | 8).toString(16) + hash.substring(17, 20),
      hash.substring(20, 32)
    ].join("-");

    try {
      cache.set(uuid, str);
      console.log(`[Cache] Cache entry for UUID: ${uuid} successfully stored.`);
      return uuid;
    } catch (error) {
      console.error("[Cache] Failed to store cache entry:", error);
      throw new Error("Failed to store UUID in memory cache.");
    }
  }

  parseFromUUID(uuid) {
    console.log(`[Cache] Looking for UUID: ${uuid} in memory cache.`);
    try {
      const cachedItem = cache.get(uuid);
      
      if (!cachedItem) {
        console.warn(`[Cache] UUID: ${uuid} not found.`);
        throw new Error("UUID not found or invalid");
      }
      console.log(`[Cache] UUID: ${uuid} found. Retrieving value.`);
      return cachedItem;
    } catch (error) {
      console.error("[Cache] Failed to retrieve cache entry:", error);
      throw new Error("Failed to retrieve UUID from memory cache.");
    }
  }

  encryptAES(text, key) {
    console.log("[Encrypt] Starting AES encryption.");
    const paddedKey = this.padKey(key);
    const iv = CryptoJS.lib.WordArray.random(128 / 8);
    const encrypted = CryptoJS.AES.encrypt(text, paddedKey, {
      iv: iv
    });
    const combined = iv.toString() + ":" + encrypted.toString();
    console.log("[Encrypt] AES encryption complete. Storing to cache.");
    return this.formatAsUUID(combined);
  }

  decryptAES(uuidText, key) {
    console.log("[Decrypt] Starting AES decryption.");
    const paddedKey = this.padKey(key);
    const encryptedText = this.parseFromUUID(uuidText);
    const parts = encryptedText.split(":");
    if (parts.length !== 2) throw new Error("Invalid encrypted text format");
    const iv = CryptoJS.enc.Hex.parse(parts[0]);
    const encrypted = parts[1];
    const decrypted = CryptoJS.AES.decrypt(encrypted, paddedKey, {
      iv: iv
    });
    console.log("[Decrypt] AES decryption complete.");
    return decrypted.toString(CryptoJS.enc.Utf8);
  }

  encryptMultiLayer(text, key) {
    console.log("[Encrypt] Starting multi-layer encryption.");
    const paddedKey = this.padKey(key);
    const timestamp = Date.now().toString();
    const textWithTime = timestamp + "|" + text;
    const iv = CryptoJS.lib.WordArray.random(128 / 8);
    const encrypted = CryptoJS.AES.encrypt(textWithTime, paddedKey, {
      iv: iv
    });
    const aesEncrypted = iv.toString() + ":" + encrypted.toString();
    const base64Encoded = Buffer.from(aesEncrypted).toString("base64");
    const checksum = CryptoJS.MD5(base64Encoded + paddedKey).toString().substring(0, 8);
    const combined = checksum + "." + base64Encoded;
    console.log("[Encrypt] Multi-layer encryption complete. Storing to cache.");
    return this.formatAsUUID(combined);
  }

  decryptMultiLayer(uuidText, key) {
    console.log("[Decrypt] Starting multi-layer decryption.");
    const paddedKey = this.padKey(key);
    const encryptedText = this.parseFromUUID(uuidText);
    const parts = encryptedText.split(".");
    if (parts.length !== 2) throw new Error("Invalid multi-layer format");
    const checksum = parts[0];
    const base64Data = parts[1];
    const expectedChecksum = CryptoJS.MD5(base64Data + paddedKey).toString().substring(0, 8);
    if (checksum !== expectedChecksum) {
      console.error("[Decrypt] Checksum mismatch. Possibly wrong key.");
      throw new Error("Invalid checksum - wrong key");
    }
    const aesEncrypted = Buffer.from(base64Data, "base64").toString();
    const aesParts = aesEncrypted.split(":");
    if (aesParts.length !== 2) throw new Error("Invalid AES format");
    const iv = CryptoJS.enc.Hex.parse(aesParts[0]);
    const encrypted = aesParts[1];
    const decrypted = CryptoJS.AES.decrypt(encrypted, paddedKey, {
      iv: iv
    });
    const textWithTime = decrypted.toString(CryptoJS.enc.Utf8);
    const parts2 = textWithTime.split("|");
    if (parts2.length < 2) throw new Error("Invalid timestamp format");
    const timestamp = parts2[0];
    const originalText = parts2.slice(1).join("|");
    console.log("[Decrypt] Multi-layer decryption complete.");
    return {
      text: originalText,
      timestamp: new Date(parseInt(timestamp)).toISOString(),
      age: Math.floor((Date.now() - parseInt(timestamp)) / 1000)
    };
  }

  enc({ data, method = "combined", ...rest }) {
    if (!data) {
      throw new Error("Data is required for encryption.");
    }
    const dataToEncrypt = typeof data === "object" ? JSON.stringify(data) : data;
    let encrypted;

    try {
      switch (method.toLowerCase()) {
        case "aes":
          encrypted = this.encryptAES(dataToEncrypt, this.defaultKey);
          break;
        case "des":
        case "3des":
          const desEncrypted = CryptoJS.TripleDES.encrypt(dataToEncrypt, this.padKey(this.defaultKey)).toString();
          encrypted = this.formatAsUUID(desEncrypted);
          break;
        case "rabbit":
          const rabbitEncrypted = CryptoJS.Rabbit.encrypt(dataToEncrypt, this.padKey(this.defaultKey)).toString();
          encrypted = this.formatAsUUID(rabbitEncrypted);
          break;
        case "rc4":
          const rc4Encrypted = CryptoJS.RC4.encrypt(dataToEncrypt, this.padKey(this.defaultKey)).toString();
          encrypted = this.formatAsUUID(rc4Encrypted);
          break;
        case "combined":
        case "multilayer":
          encrypted = this.encryptMultiLayer(dataToEncrypt, this.defaultKey);
          break;
        default:
          throw new Error(`Unsupported encryption method: ${method}`);
      }
      console.log(`[Encoder] Encryption with method '${method}' successful.`);
      return {
        uuid: encrypted
      };
    } catch (error) {
      console.error(`[Encoder] Failed to encrypt with method '${method}'.`, error);
      throw error;
    }
  }

  dec({ uuid, method = "combined", ...rest }) {
    if (!uuid) {
      throw new Error("UUID is required for decryption.");
    }
    let decrypted;

    try {
      switch (method.toLowerCase()) {
        case "aes":
          const aesOriginal = this.parseFromUUID(uuid);
          decrypted = this.decryptAES(aesOriginal, this.defaultKey);
          break;
        case "des":
        case "3des":
          const desOriginal = this.parseFromUUID(uuid);
          decrypted = CryptoJS.TripleDES.decrypt(desOriginal, this.padKey(this.defaultKey)).toString(CryptoJS.enc.Utf8);
          break;
        case "rabbit":
          const rabbitOriginal = this.parseFromUUID(uuid);
          decrypted = CryptoJS.Rabbit.decrypt(rabbitOriginal, this.padKey(this.defaultKey)).toString(CryptoJS.enc.Utf8);
          break;
        case "rc4":
          const rc4Original = this.parseFromUUID(uuid);
          decrypted = CryptoJS.RC4.decrypt(rc4Original, this.padKey(this.defaultKey)).toString(CryptoJS.enc.Utf8);
          break;
        case "combined":
        case "multilayer":
          decrypted = this.decryptMultiLayer(uuid, this.defaultKey);
          break;
        default:
          throw new Error(`Unsupported decryption method: ${method}`);
      }

      if (!decrypted || typeof decrypted === "string" && decrypted.length === 0) {
        throw new Error("Decryption failed - check key and text format");
      }

      let finalResult = decrypted;

      if (typeof decrypted === "string") {
        try {
          const jsonResult = JSON.parse(decrypted);
          if (typeof jsonResult !== "string") {
            finalResult = jsonResult;
          }
        } catch (e) {
          // Not JSON, leave as string
        }
      } else if (typeof decrypted.text === "string") {
        try {
          const jsonResult = JSON.parse(decrypted.text);
          decrypted.text = jsonResult;
          finalResult = decrypted;
        } catch (e) {
          // Not JSON, leave as string
        }
      }

      console.log(`[Encoder] Decryption with method '${method}' successful.`);
      return finalResult;
    } catch (error) {
      console.error(`[Encoder] Failed to decrypt UUID '${uuid}'.`, error);
      throw error;
    }
  }
}

const Encoder = new EncoderClient(apiConfig.PASSWORD);
export default Encoder;

