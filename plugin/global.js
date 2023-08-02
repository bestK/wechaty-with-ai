
export function sleep(time) {
    return new Promise(resolve => {
        setTimeout(resolve, time);
    });
}

export async function SDFetchForResult(res, bodyInfo) {
    const api = await fetch(res.fetch_result, {
        body: bodyInfo,
        method: 'post',
        headers: { "Content-Type": "application/json" }
    });
    const fetch_result = await api.json()

    if (fetch_result.status != 'success') {
        await sleep(3000)
        console.log(`Time:${new Date().format("yyyy-MM-dd hh:mm:ss")} retry fetchForResult ${res.fetch_result}  `)
        return await SDFetchForResult(res, bodyInfo)
    }

    return fetch_result
}


export async function post(url, params) {
    const api = await fetch(url, {
        body: JSON.stringify(params),
        method: 'post',
        headers: { "Content-Type": "application/json" }
    })
    const res = await api.json()
    return res
}

export async function get(url) {
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

export function random(arr) {
    if (!arr || arr.length == 0) return null
    let index = Math.floor((Math.random() * arr.length))
    return arr[index]
}

export async function sendWechatMessage(contact, message) {
    try {
        await contact.say(message);
    } catch (e) {
        console.error(e);
    }
}

global.sleep = sleep
global.SDFetchForResult = SDFetchForResult
global.post = post
global.get = get
global.random = random
global.sendWechatMessage = sendWechatMessage


Date.prototype.format = function (fmt) {
    var o = {
        "M+": this.getMonth() + 1,                 //月份 
        "d+": this.getDate(),                    //日 
        "h+": this.getHours(),                   //小时 
        "m+": this.getMinutes(),                 //分 
        "s+": this.getSeconds(),                 //秒 
        "q+": Math.floor((this.getMonth() + 3) / 3), //季度 
        "S": this.getMilliseconds()             //毫秒 
    };
    if (/(y+)/.test(fmt)) {
        fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
    }
    for (var k in o) {
        if (new RegExp("(" + k + ")").test(fmt)) {
            fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
        }
    }
    return fmt;
}
