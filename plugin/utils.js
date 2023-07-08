import { exec } from 'child_process';
import { FileBox } from 'file-box';
import * as PATH from 'path';
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


async function saveFile(filebox, path = 'resource') {
    const audioReadStream = Readable.from(filebox.stream);
    const filePath = PATH.join(path, filebox.name);
    const writeStream = FS.createWriteStream(filePath);

    audioReadStream.pipe(writeStream);

    await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
    });
}

async function textToSpeechUrl(text) {
    var apiUrl = 'https://www.text-to-speech.cn/getSpeek.php';
    var data = {
        language: '中文（普通话，简体）',
        voice: 'zh-CN-YunxiNeural',
        text: text,
        role: 0,
        style: 0,
        styledegree: 1,
        rate: 0,
        pitch: 0,
        kbitrate: 'audio-16khz-32kbitrate-mono-mp3',
        silence: '',
        user_id: '',
        yzm: ''
    };
    const randomIp = () => Array(4).fill(0).map((_, i) => Math.floor(Math.random() * 255) + (i === 0 ? 1 : 0)).join('.');

    const api = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'x-forwarded-for': randomIp(),
        },
        body: new URLSearchParams(data)
    })
    const { code, download } = await api.json()
    if (code != 200) throw new Error('语音生成失败')
    return download
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

export { hasChinese, imageMessage, pluginSogouEmotion, runCommand, saveFile, splitStringByLength, textToSpeechUrl, transToEnglish };

