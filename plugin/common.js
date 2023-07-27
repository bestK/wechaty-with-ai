
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
