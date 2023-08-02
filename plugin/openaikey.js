let cacheKeys = [];
let lastFetchTime = 0;
const cacheDuration = 2 * 60 * 60 * 1000; // 两个小时，以毫秒为单位

export async function keyProvider() {
  const currentTime = new Date().getTime();
  // 如果缓存不为空且在有效期内，直接返回缓存的 API 密钥
  if (cacheKeys.length > 0 && currentTime - lastFetchTime < cacheDuration) {
    return cacheKeys;
  }

  // 否则重新获取 API 密钥
  const url = `${process.env.OPENAI_KEY_URL}?${currentTime}`;
  const res = await get(url);
  cacheKeys = res.APIkey.keys;
  lastFetchTime = currentTime;

  return cacheKeys;
}