import Replicate from "replicate";
import { sendWechatMessage } from "./global.js";

export async function text2ImageStableDiffusion(prompt) {
    try {
        //set the number of images you want
        const numberOfPics = "1";

        const bodyInfo = JSON.stringify({
            key: process.env.STABLEDIFFUSIONAPI_API_KEY,
            model_id: "midjourney",
            prompt: prompt,
            negative_prompt:
                "((out of frame)), ((extra fingers)), mutated hands, ((poorly drawn hands)), ((poorly drawn face)), (((mutation))), (((deformed))), (((tiling))), ((naked)), ((tile)), ((fleshpile)), ((ugly)), (((abstract))), blurry, ((bad anatomy)), ((bad proportions)), ((extra limbs)), cloned face, (((skinny))), glitchy, ((extra breasts)), ((double torso)), ((extra arms)), ((extra hands)), ((mangled fingers)), ((missing breasts)), (missing lips), ((ugly face)), ((fat)), ((extra legs)), anime",
            width: "512",
            height: "512",
            samples: numberOfPics,
            num_inference_steps: "30",
            safety_checker: "no",
            enhance_prompt: "yes",
            seed: null,
            guidance_scale: 7.5,
            webhook: null,
            track_id: null,
        });

        const api = await fetch('https://stablediffusionapi.com/api/v3/text2img', {
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


export async function text2ImageByreplicate(prompt) {
    try {
        const replicate = new Replicate({
            auth: process.env.REPLICATE_API_TOKEN,
        });

        const output = await replicate.run(
            "prompthero/openjourney:ad59ca21177f9e217b9075e7300cf6e14f7e5b4505b87b9689dbd866e9768969",
            {
                input: {
                    prompt: `${prompt}`
                }
            }
        );

        return output[0]
    } catch (error) {
        console.error(`/mj has error ${error.stack}`)
        throw error
    }
}

export async function midjourney(prompt, wechat) {
    const baseUrlArr = process.env.MJ_BASE_URL.split(",")
    const index = Math.floor((Math.random() * baseUrlArr.length))
    const baseUrl = baseUrlArr[index]
    try {
        let url = `https://${baseUrl}/mj/submit/imagine`
        const api = await fetch(url, {
            body: JSON.stringify({ "prompt": prompt }),
            method: 'post',
            headers: {
                "Content-Type": "application/json",
                "mj-api-secret": process.env.MJ_API_KEY
            }
        });

        const res = await api.json()
        const { code, result, description } = res

        if (code == 1) {
            await sendWechatMessage(wechat, `任务提交成功:${result}`)
            let taskUrl = `https://${baseUrl}/mj/task/${result}/fetch`
            return await getMjResult(taskUrl)
        }

        throw Error(`任务：${result} ${description}`)
    } catch (error) {
        console.log(error)
        return `https://raster.shields.io/badge/server-${encodeURI(error.message)}-red`
    }
}

export async function getMjResult(url) {
    const api = await fetch(url, {
        method: "get"
    });
    const { status, imageUrl, failReason, progress } = await api.json()
    console.log(`progress:${progress} url:${url}`)
    if (status == "FAILURE") throw Error(failReason)
    if (status != 'SUCCESS') {
        await sleep(3000)
        return await getMjResult(url)
    }
    return imageUrl
}