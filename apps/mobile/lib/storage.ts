import * as SecureStore from "expo-secure-store";

const CHUNK_SIZE = 1800;
const META_SUFFIX = ".chunks";

export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const meta = await SecureStore.getItemAsync(key + META_SUFFIX);
    if (meta === null) return SecureStore.getItemAsync(key);
    const count = Number(meta);
    if (!Number.isInteger(count) || count < 1 || count > 100) {
      await this.removeItem(key);
      return null;
    }
    const chunks = await Promise.all(
      Array.from({ length: count }, (_, index) => SecureStore.getItemAsync(`${key}.${index}`)),
    );
    if (chunks.some((chunk) => chunk === null)) {
      await this.removeItem(key);
      return null;
    }
    return chunks.join("");
  },

  async setItem(key: string, value: string): Promise<void> {
    const previousMeta = await SecureStore.getItemAsync(key + META_SUFFIX);
    const previousCount = previousMeta ? Number(previousMeta) : 0;
    const chunks = value.match(new RegExp(`[\\s\\S]{1,${CHUNK_SIZE}}`, "g")) ?? [""];
    if (chunks.length > 100) throw new Error("Secure session payload is unexpectedly large");
    await Promise.all(chunks.map((chunk, index) => SecureStore.setItemAsync(`${key}.${index}`, chunk)));
    await SecureStore.setItemAsync(key + META_SUFFIX, String(chunks.length));
    await SecureStore.deleteItemAsync(key);
    await Promise.all(
      Array.from({ length: Math.max(0, previousCount - chunks.length) }, (_, index) =>
        SecureStore.deleteItemAsync(`${key}.${chunks.length + index}`),
      ),
    );
  },

  async removeItem(key: string): Promise<void> {
    const meta = await SecureStore.getItemAsync(key + META_SUFFIX);
    const count = meta ? Number(meta) : 0;
    await Promise.all([
      SecureStore.deleteItemAsync(key),
      SecureStore.deleteItemAsync(key + META_SUFFIX),
      ...Array.from({ length: Number.isInteger(count) && count > 0 && count <= 100 ? count : 0 }, (_, index) =>
        SecureStore.deleteItemAsync(`${key}.${index}`),
      ),
    ]);
  },
};
