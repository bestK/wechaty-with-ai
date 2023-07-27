import Replicate from "replicate";

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