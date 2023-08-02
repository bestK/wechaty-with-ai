const BASE_URL = 'https://ncm.icodeq.com'

export async function search(keyword) {
    const res = await get(`${BASE_URL}/search?keywords=${keyword}`)
    const { id } = res.result.songs[0]
    return id
}

export async function getSong(id) {
    const res = await get(`${BASE_URL}/song/url?id=${id}`)
    const { url } = res.data[0]
    return url
}

export async function getMp3Url(keyword) {
    const id = await search(keyword)
    const url = await getSong(id)
    return url
}
