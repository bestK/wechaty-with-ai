import { v4 as uuidv4 } from 'uuid';

const role = { BV210_streaming: '西安佟掌柜', BV213_streaming: '广西表哥', BV021_streaming: '东北老铁', "熊二": "zh_male_xionger" }

const hack_role = { "熊二": "5ea5a236a0b67106", "团宝": "4fc7ec533470923e", "顾姐": "6bc33dfb8f3df644" }

let selected_hack_role = "熊二"

function randomVoiceType() {
    const voiceRoles = Object.keys(role)
    let index = Math.floor((Math.random() * voiceRoles.length))
    return voiceRoles[index]
}

export async function getByteDanceTTS(ttsTxt = '字节跳动语音合成') {
    const apiUrl = "https://openspeech.bytedance.com/tts_middle_layer/tts"
    const appid = process.env.VOLCENGINE_APPID
    const access_token = process.env.VOLCENGINE_TOKEN
    const cluster = "volcano_tts"
    const voiceType = "BV021_streaming"
    // 其他音色 https://www.volcengine.com/docs/6561/97465
    const requestJson = {
        app: { appid: appid, token: 'access_token', cluster: cluster },
        user: { uid: process.env.VOLCENGINE_UID },
        audio: {
            voice: 'other',
            voice_type: voiceType,
            encoding: 'mp3',
            speed: 10,
            volume: 10,
            pitch: 10,
        },
        request: {
            reqid: uuidv4(),
            text: ttsTxt,
            text_type: 'plain',
            operation: 'query',
        },
    };
    const headers = { Authorization: `Bearer;${access_token}` }
    try {
        const api = await fetch(apiUrl, {
            body: JSON.stringify(requestJson),
            headers: headers,
            method: 'post'
        });
        const res = await api.json();
        return res
    } catch (error) {
        console.error(error);
        console.error(ttsTxt);
        return null
    }
}

export function setHackRole(name) {
    if (!hack_role[name]) return "false"
    selected_hack_role = name
    return "true"
}

export async function hackByteDanceTTS(prompt, zbid) {
    if (!zbid) zbid = hack_role[selected_hack_role]
    const body = JSON.stringify({ "text": prompt, "format": "sil", "zbid": zbid })

    const api = await fetch(`https://douyin.zeabur.app/tts`, {
        method: 'post',
        body: body,
        headers: {
            "content-type": "application/json",
        }
    })

    const res = await api.json()

    return res

}




export async function textToSpeechUrl(text) {
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