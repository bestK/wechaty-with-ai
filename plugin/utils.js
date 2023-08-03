import { exec } from 'child_process';
import { FileBox } from 'file-box';
import * as FS from 'fs';
import * as PATH from 'path';
import { Readable } from 'stream';
import { promisify } from 'util';

function splitStringByLength(str, maxLength) {
    const result = [];
    let index = 0;

    while (index < str.length) {
        result.push(str.substr(index, maxLength));
        index += maxLength;
    }

    return result;
}


function imageMessage(url, ext = 'png') {
    if (!url || !url.startsWith("http")) return url
    return FileBox.fromUrl(url, { name: `${new Date().getTime()}.${ext}` })
}

function videoMessage(url, ext = 'mp4') {
    if (!url || !url.startsWith("http")) return url
    return FileBox.fromUrl(url, { name: `${new Date().getTime()}.${ext}` })
}

async function transToEnglish(originText) {
    try {
        const { text } = await api3.sendMessage(`我希望你能充当英语翻译。
      你将检测语言，翻译它，不要在乎它是什么只需要翻译，不要输出任何与翻译无关的解释，我的第一句话是 ${originText}`)
        originText = text
    } catch (error) {
    }
    return originText
}

function hasChinese(str) {
    var pattern = /[\u4e00-\u9fa5]/; // 使用Unicode范围匹配中文字符
    return pattern.test(str);
}


async function saveFile(filebox, folderPath = 'resource') {
    if (!FS.existsSync(folderPath)) {
        FS.mkdirSync(folderPath, { recursive: true });
        console.log(`Folder created: ${folderPath}`);
    } else {
        console.log(`Folder already exists: ${folderPath}`);
    }
    const audioReadStream = Readable.from(await filebox.toStream());

    const filePath = PATH.join(folderPath, filebox.name);
    const writeStream = FS.createWriteStream(filePath);

    audioReadStream.pipe(writeStream);

    await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
    });
}


async function pluginSogouEmotion(keyword, random = true) {
    try {
        const url = `https://pic.sogou.com/napi/wap/emoji/searchlist?keyword=${keyword.length == 0 ? '随机' : keyword}&spver=&rcer=&tag=0&routeName=emosearch`

        const api = await fetch(url)

        const res = await api.json()

        const emotions = res['data']['emotions']

        const index = random ? Math.floor((Math.random() * emotions.length)) : 0

        const pic_url = emotions[index]['thumbSrc']

        // 必须为 gif 结尾 否则将作为图片发送 https://github.com/nodeWechat/wechat4u/blob/f66fb69a352b4775210edd87d1101d7a165de797/src/wechat.js#L63
        return imageMessage(pic_url, 'gif')
    } catch (error) {
        console.error(`get sogou pic has error:${error.message}`)
        return null
    }
}



async function runCommand(command) {
    try {
        const { stdout, stderr } = await promisify(exec)(command);
        // console.log('命令输出：', stdout);
        if (stderr) {
            console.error('命令执行出错：', stderr);
        }
    } catch (error) {
        console.error('执行命令时出错：', error);
    }
}

async function silkEncoder(params, voiceLength) {
    const api = await fetch('https://tosilk.zeabur.app/v1/encoder', {
        body: JSON.stringify(params),
        method: 'post',
        headers: { "Content-Type": "application/json" }
    })
    const { data } = await api.json()
    const sil = FileBox.fromBase64(data, `${new Date().getTime()}.sil`)
    if (!voiceLength) {
        voiceLength = Number(data.length / 1.8 / 1024 / 2).toFixed(0) * 1
        if (voiceLength >= 60) {
            voiceLength = 59
        }
    }

    voiceLength = voiceLength * 1000

    sil.metadata = {
        voiceLength
    };

    return sil
}

async function silkDecoder(params) {
    const api = await fetch('https://tosilk.zeabur.app/v1/decoder', {
        body: JSON.stringify(params),
        method: 'post',
        headers: { "Content-Type": "application/json" }
    })
    const { data } = await api.json()
    const mp3 = FileBox.fromBase64(data, `${new Date().getTime()}.mp3`)
    return mp3
}


function retry(fn, retriesLeft = 3, interval = 3000) {
    return new Promise((resolve, reject) => {
        fn()
            .then(resolve)
            .catch((error) => {
                console.log(error, '\nretry...')
                setTimeout(() => {
                    if (retriesLeft === 1) {
                        // 如果重试次数已用完，那么reject
                        reject(`maximum retries exceeded ${error}`);
                        return;
                    }

                    // 如果还有重试次数，那么再次尝试
                    retry(fn, retriesLeft - 1, interval).then(resolve, reject);
                }, interval)
            });
    });
}


async function promptToCommand(prompt, keywords, openai) {
    if (prompt.startsWith('/help')) return prompt
    const systemPrompt = `Use below config match json. The format is json,
     if you don't know the answer, just say {"command":"/c","prompt":"${prompt}"},
     don't try to make up the answer, and don't have any explanation.
  
        ### config start
        ${JSON.stringify(keywords)}
        ### config end
    `
    const response = await openai.createChatCompletion(
        {
            model: "gpt-3.5-turbo-16k",
            messages: [
                { "role": "system", "content": systemPrompt },
                { "role": "user", "content": "我想画一个汤姆猫" },
                { "role": "assistant", "content": `{"command":"/画图","prompt":"一个汤姆猫"}` },
                { "role": "user", "content": prompt },
            ],
            temperature: 0.8,
        }
    )

    const text = response.data.choices[0].message.content;
    let command = {}
    try {
        const regex = /\{.*?\}/;
        const match = text.match(regex);
        if (match) {
            const extractedJson = match[0];
            command = JSON.parse(extractedJson)
        } else {
            console.log("promptToCommand No match found.");
        }
    } catch (error) {
        console.log(`promptToCommand has error:${text} ${error}`)
    }

    return command
}
export { promptToCommand, hasChinese, imageMessage, pluginSogouEmotion, runCommand, saveFile, silkDecoder, silkEncoder, splitStringByLength, transToEnglish, videoMessage, retry };

