export async function text2VideoByStableDiffusion(prompt) {
    try {
        const bodyInfo = JSON.stringify({
            key: process.env.STABLEDIFFUSIONAPI_API_KEY,
            prompt: prompt,
            seconds: 10
        });

        const api = await fetch('https://stablediffusionapi.com/api/v5/text2video', {
            body: bodyInfo,
            method: 'post',
            headers: { "Content-Type": "application/json" }
        });

        let res = await api.json()
        if (res.status == 'processing') {
            res = await SDFetchForResult(res, bodyInfo)
        }

        return res.output[0]
    } catch (error) {
        console.error(`/sd has error ${error.stack}`)
        throw error
    }
}




