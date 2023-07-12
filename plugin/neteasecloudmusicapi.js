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

async function post(url, params) {
    const api = await fetch(url, {
        body: JSON.stringify(params),
        method: 'post',
        headers: { "Content-Type": "application/json" }
    })
    const res = await api.json()
    return res
}

async function get(url) {
    const api = await fetch(url, {
        headers:
        {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
        }
    })
    const res = await api.json()
    return res
}