/**
 * Map with a maximum entry count. When full, the oldest-inserted entry is evicted.
 * Used for in-memory offline fallbacks so they cannot grow without bound.
 */
export class BoundedMap<K, V> extends Map<K, V> {
  constructor(private readonly maxEntries: number) {
    super();
  }

  override set(key: K, value: V): this {
    if (super.has(key)) {
      super.delete(key);
    } else if (this.size >= this.maxEntries) {
      const oldestKey = this.keys().next().value as K;
      super.delete(oldestKey);
    }
    return super.set(key, value);
  }
}

export default BoundedMap;
